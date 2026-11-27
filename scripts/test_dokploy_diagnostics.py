import contextlib
import io
import json
from pathlib import Path
import shlex
import subprocess
import unittest
from unittest.mock import patch

import dokploy_diagnostics as diagnostics


class DokployDiagnosticsTests(unittest.TestCase):
    def setUp(self):
        self.env = {
            "DOKPLOY_HOST": "https://dokploy.example.test/",
            "DOKPLOY_TOKEN": "private-dokploy-token",
            "CF_CLIENT_ID": "private-client-id",
            "CF_CLIENT_SECRET": "private-client-secret",
        }

    def fake_curl(self, status, body, headers="", returncode=0):
        def run(args, **kwargs):
            self.assertEqual(args[:2], ["curl", "--disable"])
            self.assertIn("--globoff", args)
            self.assertNotIn("--location", args)
            self.assertNotIn("--insecure", args)
            self.assertNotIn("--verbose", args)
            self.assertEqual(args[args.index("--request") + 1], "GET")
            self.assertEqual(args[args.index("--proto") + 1], "=https")
            self.assertEqual(kwargs["timeout"], 25)
            config = kwargs["input"]
            for name in ("DOKPLOY_TOKEN", "CF_CLIENT_ID", "CF_CLIENT_SECRET"):
                self.assertNotIn(self.env[name], " ".join(args))
                self.assertIn(self.env[name], config)
            self.assertIn('url = "https://dokploy.example.test/api/project.all"', config)
            self.assertIn("header = \"CF-Access-Client-Id: ", config)
            self.assertIn("header = \"CF-Access-Client-Secret: ", config)
            for line in config.splitlines():
                key, value = line.split(" = ", 1)
                if key in ("output", "dump-header"):
                    path = Path(shlex.split(value)[0])
                    self.assertEqual(path.parent.stat().st_mode & 0o777, 0o700)
                    path.write_text(body if key == "output" else headers)
            return subprocess.CompletedProcess(args, returncode, str(status), "private transport details")
        return run

    def test_success_hides_project_names_env_and_credentials(self):
        body = json.dumps([{
            "projectId": "test-project", "name": "private-project-name",
            "env": "DB_PASSWORD=private-db-password",
        }])
        success, message = diagnostics.check_access(self.env, self.fake_curl(200, body))
        self.assertTrue(success)
        self.assertIn("1 projects", message)
        self.assertNotIn("private-", message)

    def test_denials_and_redirects_hide_body_headers_and_locations(self):
        for status, body, headers, expected in [
            (403, "Cloudflare Access private-secret", "cf-ray: abc123-SIN", "Access denial"),
            (403, "cf-chl-private-secret", "", "challenge"),
            (403, "private-secret", "server: cloudflare", "unconfirmed"),
            (401, '{"error":"private-secret"}', "", "unconfirmed"),
            (302, "private-secret", "Location: https://other.test/private-secret", "same origin: False"),
            (307, "private-secret", "Location: /private-secret", "same origin: True"),
            (500, "private-secret", "", "unconfirmed"),
        ]:
            with self.subTest(status=status, expected=expected):
                success, message = diagnostics.check_access(self.env, self.fake_curl(status, body, headers))
                self.assertFalse(success)
                self.assertIn(expected, message)
                self.assertNotIn("private-secret", message)
                self.assertNotIn("other.test", message)

    def test_html_or_wrong_json_is_not_success(self):
        for body in ("<html>Login private-secret</html>", '{}', '[{"env":"private-secret"}]'):
            with self.subTest(body=body):
                success, message = diagnostics.check_access(self.env, self.fake_curl(200, body))
                self.assertFalse(success)
                self.assertNotIn("private-secret", message)

    def test_empty_project_list_is_valid_metadata(self):
        success, _ = diagnostics.check_access(self.env, self.fake_curl(200, "[]"))
        self.assertTrue(success)

    def test_transport_error_hides_stderr(self):
        success, message = diagnostics.check_access(self.env, self.fake_curl(0, "", returncode=60))
        self.assertFalse(success)
        self.assertIn("exit 60", message)
        self.assertNotIn("private", message)

    def test_cf_headers_are_optional_but_must_be_paired(self):
        env = {key: value for key, value in self.env.items() if not key.startswith("CF_")}
        _, lines = diagnostics.request_config(env)
        self.assertNotIn("CF-Access", "\n".join(lines))
        env["CF_CLIENT_ID"] = "only-one"
        with self.assertRaises(ValueError):
            diagnostics.request_config(env)

    def test_rejects_unsafe_origins_and_missing_credentials(self):
        for host in ("http://example.test", "https://user:pass@example.test", "https://example.test/api",
                     "https://example.test?secret=value", "https://example.test#fragment", ""):
            with self.subTest(host=host), self.assertRaises(ValueError):
                diagnostics.request_config({**self.env, "DOKPLOY_HOST": host})
        with self.assertRaises(ValueError):
            diagnostics.request_config({**self.env, "DOKPLOY_TOKEN": ""})

    def test_rejects_header_and_curl_config_injection(self):
        for value in ('token\nheader = "injected"', "token\rvalue", "token\0value"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                diagnostics.request_config({**self.env, "DOKPLOY_TOKEN": value})
        self.assertEqual(diagnostics.curl_quote('a"b\\c'), '"a\\"b\\\\c"')

    def test_proxy_headers_do_not_override_final_response(self):
        success, message = diagnostics.response_summary(
            403, "HTTP/1.1 200 Connection established\ncf-ray: bad-proxy\n\n"
            "HTTP/2 403\ncf-ray: abc123-SIN\n", "Cloudflare Access", self.env["DOKPLOY_HOST"],
        )
        self.assertFalse(success)
        self.assertIn("abc123-SIN", message)
        self.assertNotIn("bad-proxy", message)

    def test_payload_has_correct_units_safe_commands_and_no_job_mode(self):
        for result, command in (("success", "sleep 15"), ("failure", "false")):
            payload = diagnostics.test_payload("disposable-app", result)
            self.assertEqual(payload["memoryLimit"], "134217728")
            self.assertEqual(payload["cpuLimit"], "250000000")
            self.assertEqual(payload["command"], command)
            self.assertIsNone(payload["modeSwarm"])
            self.assertEqual(payload["replicas"], 1)
            self.assertEqual(payload["restartPolicySwarm"], {"Condition": "none"})
            self.assertNotIn("private", json.dumps(payload))
        for app_id in ("", "app\nname", "app;false"):
            with self.assertRaises(ValueError):
                diagnostics.test_payload(app_id, "success")
        with self.assertRaises(ValueError):
            diagnostics.test_payload("app", "exit17")

    def test_payload_cli_needs_no_credentials_or_network(self):
        output = io.StringIO()
        with patch("sys.argv", ["diagnostics", "payload", "--application-id", "test-app"]), \
                patch.dict("os.environ", {}, clear=True), \
                patch("subprocess.run", side_effect=AssertionError("Network not allowed")), \
                contextlib.redirect_stdout(output):
            self.assertEqual(diagnostics.main(), 0)
        self.assertEqual(json.loads(output.getvalue())["applicationId"], "test-app")

    def test_cli_transport_exceptions_hide_secret_details(self):
        for error in (OSError("private-secret"), subprocess.TimeoutExpired("private-secret", 25)):
            output = io.StringIO()
            with patch("sys.argv", ["diagnostics", "check"]), \
                    patch.object(diagnostics, "check_access", side_effect=error), \
                    contextlib.redirect_stderr(output):
                self.assertEqual(diagnostics.main(), 1)
            self.assertNotIn("private-secret", output.getvalue())


if __name__ == "__main__":
    unittest.main()
