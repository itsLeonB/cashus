#!/usr/bin/env python3
"""Request branch-HEAD API, worker and migrator deployments without a success gate."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

from dokploy_diagnostics import curl_quote, request_config


def request(env, route, payload=None):
    origin_url, lines = request_config(env)
    url = origin_url.removesuffix("project.all") + route
    lines[0] = "url = " + curl_quote(url)
    with tempfile.TemporaryDirectory(prefix="dokploy-release-") as directory:
        body_path = Path(directory) / "body"
        lines.append("output = " + curl_quote(str(body_path)))
        if payload is not None:
            lines.append("header = " + curl_quote("Content-Type: application/json"))
            lines.append("data = " + curl_quote(json.dumps(payload)))
        result = subprocess.run([
            "curl", "--disable", "--globoff", "--silent", "--show-error",
            "--request", "POST" if payload is not None else "GET", "--proto", "=https",
            "--max-time", "20", "--max-filesize", "1048576", "--config", "-",
            "--write-out", "%{http_code}",
        ], input="\n".join(lines) + "\n", text=True, capture_output=True, timeout=25)
        if result.returncode or not result.stdout.strip().isdigit():
            raise ValueError("Transport failed; request outcome may be unknown. Do not retry blindly.")
        status = int(result.stdout.strip())
        if not 200 <= status < 300:
            raise ValueError(f"HTTP {status}; request rejected or outcome unknown.")
        body = body_path.read_text()
        try:
            return json.loads(body) if body.strip() else None
        except ValueError:
            raise ValueError("Unexpected API response; request outcome unknown.") from None


def check_target(app, component, app_id, branch):
    expected_file = {"api": "Dockerfile", "worker": "Dockerfile.worker",
                     "migrator": "Dockerfile.migrate"}[component]
    if not isinstance(app, dict) or any((
        app.get("applicationId") != app_id, app.get("sourceType") != "github",
        app.get("branch") != branch, app.get("buildType") != "dockerfile",
        app.get("dockerfile") != expected_file, app.get("buildPath") != "/backend",
        app.get("dockerContextPath") != ".",
    )):
        raise ValueError(f"{component}: target must use the requested GitHub branch and backend Dockerfile/context.")
    policy = app.get("restartPolicySwarm")
    if component == "migrator" and (
        app.get("replicas") != 1 or app.get("modeSwarm") is not None
        or not isinstance(policy, dict) or policy.get("Condition") != "none"
        or bool(app.get("command"))
    ):
        raise ValueError("migrator: require normal one-replica mode, restart none, no command override.")
    identity = tuple(app.get(key) for key in ("environmentId", "owner", "repository"))
    if not all(isinstance(value, str) and value for value in identity):
        raise ValueError(f"{component}: missing environment or repository identity.")
    return identity


def deploy(env, component, app_id, args):
    record = {"component": component, "application_id": app_id, "branch": args.branch,
              "requested_sha": args.requested_sha, "observed_revision": None,
              "process_status": "unknown"}
    try:
        response = request(env, "application.deploy", {
            "applicationId": app_id, "title": "CASH-34 parallel branch release",
            "description": f"Branch {args.branch}; requested SHA {args.requested_sha}; built revision unverified.",
        })
        if response is not None and response is not True:
            raise ValueError("Unexpected deployment response; request outcome unknown.")
        record["request_status"] = "accepted"
    except (ValueError, OSError, subprocess.TimeoutExpired):
        record["request_status"] = "failed_or_unknown"
    return record


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--branch", required=True)
    parser.add_argument("--requested-sha", required=True)
    for component in ("api", "worker", "migrator"):
        parser.add_argument(f"--{component}-id", required=True)
    parser.add_argument("--execute", action="store_true", help="Send deployment requests; requires target approval.")
    args = parser.parse_args(argv)
    targets = {component: getattr(args, f"{component}_id")
               for component in ("api", "worker", "migrator")}
    try:
        if not re.fullmatch(r"[a-fA-F0-9]{40}", args.requested_sha):
            raise ValueError("requested-sha must be a full 40-character Git SHA (audit label only).")
        if not args.branch or any(char.isspace() or ord(char) < 32 for char in args.branch):
            raise ValueError("branch must be a nonempty Git branch without whitespace or control characters.")
        if len(set(targets.values())) != 3 or not all(
                re.fullmatch(r"[A-Za-z0-9_-]+", value) for value in targets.values()):
            raise ValueError("Use three distinct application IDs with letters, digits, underscores or dashes.")
        if not args.execute:
            print(json.dumps({"mode": "dry-run", "branch": args.branch, "targets": targets,
                              "requested_sha": args.requested_sha, "observed_revision": None}))
            return 0
        # Validate every target before the first write. Never change app settings here.
        identities = [check_target(request(os.environ, f"application.one?applicationId={app_id}"),
                                   component, app_id, args.branch)
                      for component, app_id in targets.items()]
        if len(set(identities)) != 1:
            raise ValueError("Targets must share the same environment and GitHub repository.")
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(deploy, os.environ, component, app_id, args)
                       for component, app_id in targets.items()]
            records = [future.result() for future in futures]
        for record in records:
            print(json.dumps(record))
        return int(any(record["request_status"] != "accepted" for record in records))
    except ValueError as error:
        print(str(error), file=sys.stderr)
    except (OSError, subprocess.TimeoutExpired):
        print("Release request could not finish; inspect Dokploy before any retry.", file=sys.stderr)
    except KeyboardInterrupt:
        print("Release interrupted; requests may already be queued. Inspect all three apps before retry.", file=sys.stderr)
        return 130
    return 1


if __name__ == "__main__":
    sys.exit(main())
