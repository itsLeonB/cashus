"""Offline checks at the Dokploy HTTP boundary; no cloud calls."""

import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import threading
import unittest
from unittest.mock import patch

import dokploy_release


ENV = {"DOKPLOY_HOST": "https://dokploy.example", "DOKPLOY_TOKEN": "synthetic-token"}
ARGS = ["--branch", "main", "--requested-sha", "a" * 40,
        "--api-id", "api", "--worker-id", "worker", "--migrator-id", "migrator"]


class FakeDokploy:
    def __init__(self, overrides=None, failed_id=None, deploy_response=None, interrupted_id=None):
        self.requests = []
        self.applications = {}
        self.barrier = threading.Barrier(3)
        self.overrides = overrides or {}
        self.failed_id = failed_id
        self.deploy_response = deploy_response
        self.interrupted_id = interrupted_id

    def __call__(self, command, **kwargs):
        config = dict(line.split(" = ", 1) for line in kwargs["input"].splitlines()
                      if " = " in line and not line.startswith("header"))
        url = json.loads(config["url"])
        payload = json.loads(json.loads(config["data"])) if "data" in config else None
        self.requests.append((url, payload))
        if "application.one" in url:
            app_id = url.rsplit("=", 1)[1]
            body = {"applicationId": app_id, "sourceType": "github", "branch": "main",
                    "buildType": "dockerfile", "dockerfile": {
                        "api": "Dockerfile", "worker": "Dockerfile.worker",
                        "migrator": "Dockerfile.migrate"}[app_id],
                    "buildPath": "/backend", "dockerContextPath": "./backend",
                    "environmentId": "env", "owner": "owner", "repository": "cashus",
                    "modeSwarm": None, "replicas": 1,
                    "restartPolicySwarm": {"Condition": "none"}, "env": "secret-do-not-print"}
            body.update(self.overrides.get(app_id, {}))
            self.applications[app_id] = body
        else:
            # All three deploy requests must arrive before any response completes.
            self.barrier.wait(timeout=3)
            if payload["applicationId"] == self.interrupted_id:
                raise KeyboardInterrupt()
            if payload["applicationId"] == self.failed_id:
                return subprocess.CompletedProcess(command, 28, stdout="000", stderr="secret-do-not-print")
            body = self.deploy_response
        Path(json.loads(config["output"])).write_text(json.dumps(body))
        return subprocess.CompletedProcess(command, 0, stdout="200", stderr="")


class ReleaseTests(unittest.TestCase):
    def run_cli(self, args, api=None):
        output = io.StringIO()
        with patch.dict(os.environ, ENV, clear=True), contextlib.redirect_stdout(output), \
                contextlib.redirect_stderr(output), patch("subprocess.run", side_effect=api) as curl:
            status = dokploy_release.main(args)
        return status, output.getvalue(), curl

    def test_execute_checks_targets_then_requests_all_three_without_waiting(self):
        api = FakeDokploy()
        status, output, _ = self.run_cli(ARGS + ["--execute"], api)
        self.assertEqual(status, 0, output)
        deployments = [(url, body) for url, body in api.requests if body]
        self.assertEqual({body["applicationId"] for _, body in deployments},
                         {"api", "worker", "migrator"})
        self.assertTrue(all(url.endswith("/api/application.deploy") for url, _ in deployments))
        self.assertTrue(all("requested SHA" in body["description"] for _, body in deployments))
        self.assertNotIn("secret-do-not-print", output)
        self.assertNotIn("synthetic-token", output)
        records = [json.loads(line) for line in output.splitlines()]
        self.assertTrue(all(record["process_status"] == "unknown" for record in records))
        self.assertTrue(all(record["observed_revision"] is None for record in records))

    def test_accepted_context_resolves_copy_sources_from_checkout_not_build_path(self):
        api = FakeDokploy()
        status, output, _ = self.run_cli(ARGS + ["--execute"], api)
        self.assertEqual(status, 0, output)
        checkout = Path(__file__).resolve().parents[1]
        for app in api.applications.values():
            # Dokploy v0.31.4 directory.ts getDockerContextPath joins code/context.
            context = checkout / app["dockerContextPath"]
            dockerfile = checkout / app["buildPath"].lstrip("/") / app["dockerfile"]
            self.assertTrue(dockerfile.is_file())
            for source in ("go.mod", "go.sum"):
                self.assertTrue((context / source).is_file(), f"COPY {source} must exist in {context}")

    def test_misconfigured_targets_stop_before_any_deployment(self):
        cases = [
            {"api": {"branch": "old-branch"}},
            {"api": {"dockerContextPath": "."}},
            {"worker": {"repository": "other-repo"}},
            {"worker": {"environmentId": "other-env"}},
            {"migrator": {"restartPolicySwarm": {"Condition": "any"}}},
            {"migrator": {"restartPolicySwarm": "unexpected"}},
            {"migrator": {"modeSwarm": {"ReplicatedJob": {}}}},
            {"migrator": {"dockerfile": "Dockerfile.job"}},
            {"migrator": {"command": "false"}},
        ]
        for overrides in cases:
            with self.subTest(overrides=overrides):
                api = FakeDokploy(overrides)
                status, output, _ = self.run_cli(ARGS + ["--execute"], api)
                self.assertEqual(status, 1, output)
                self.assertFalse(any(body for _, body in api.requests))
                self.assertNotIn("secret-do-not-print", output)

    def test_unexpected_json_is_not_reported_as_request_acceptance(self):
        status, output, _ = self.run_cli(ARGS + ["--execute"], FakeDokploy(deploy_response=1))
        self.assertEqual(status, 1)
        self.assertTrue(all(record["request_status"] == "failed_or_unknown"
                            for record in map(json.loads, output.splitlines())))

    def test_partial_failure_does_not_cancel_other_requests_or_retry(self):
        api = FakeDokploy(failed_id="migrator")
        status, output, _ = self.run_cli(ARGS + ["--execute"], api)
        self.assertEqual(status, 1)
        records = {record["component"]: record for record in map(json.loads, output.splitlines())}
        self.assertEqual(records["migrator"]["request_status"], "failed_or_unknown")
        self.assertEqual(records["api"]["request_status"], "accepted")
        self.assertEqual(records["worker"]["request_status"], "accepted")
        self.assertEqual(len([body for _, body in api.requests if body]), 3)
        self.assertNotIn("secret-do-not-print", output)

    def test_explicit_retry_sends_fresh_requests_without_repair_or_rollback(self):
        for _ in range(2):
            api = FakeDokploy()
            status, output, _ = self.run_cli(ARGS + ["--execute"], api)
            self.assertEqual(status, 0, output)
            self.assertEqual(len([body for _, body in api.requests if body]), 3)
            self.assertTrue(all("application.one" in url or "application.deploy" in url
                                for url, _ in api.requests))

    def test_branch_update_checks_current_settings_not_previous_requested_sha(self):
        api = FakeDokploy({component: {"branch": "feature/cash-34"}
                           for component in ("api", "worker", "migrator")})
        args = ["feature/cash-34" if arg == "main" else arg for arg in ARGS]
        status, output, _ = self.run_cli(args + ["--execute"], api)
        self.assertEqual(status, 0, output)
        self.assertTrue(all(record["observed_revision"] is None
                            for record in map(json.loads, output.splitlines())))

    def test_interrupt_after_requests_start_does_not_retry_or_claim_success(self):
        api = FakeDokploy(interrupted_id="migrator")
        status, output, _ = self.run_cli(ARGS + ["--execute"], api)
        self.assertEqual(status, 130)
        self.assertEqual(len([body for _, body in api.requests if body]), 3)
        self.assertIn("may already be queued", output)
        self.assertNotIn('"request_status": "accepted"', output)

    def test_interrupt_during_preflight_is_not_success(self):
        status, output, _ = self.run_cli(ARGS + ["--execute"], KeyboardInterrupt())
        self.assertEqual(status, 130)
        self.assertIn("Inspect all three", output)

    def test_duplicate_targets_and_invalid_sha_fail_without_requests(self):
        for args in (["api" if arg == "worker" else arg for arg in ARGS],
                     ["not-a-sha" if arg == "a" * 40 else arg for arg in ARGS]):
            status, _, curl = self.run_cli(args + ["--execute"])
            self.assertEqual(status, 1)
            curl.assert_not_called()

    def test_dry_run_needs_no_credentials_or_network(self):
        status, output, curl = self.run_cli(ARGS)
        self.assertEqual(status, 0)
        curl.assert_not_called()
        self.assertIn("dry-run", output)
        self.assertIn("observed_revision", output)
        self.assertNotIn("synthetic-token", output)


if __name__ == "__main__":
    unittest.main()
