#!/usr/bin/env python3
"""Read-only Dokploy access check and offline disposable-test payloads."""

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import urljoin, urlsplit


def curl_quote(value):
    if any(character in value for character in "\r\n\0"):
        raise ValueError("Configuration values must be single-line strings.")
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def request_config(env):
    host = env.get("DOKPLOY_HOST", "")
    token = env.get("DOKPLOY_TOKEN", "")
    if not host or not token:
        raise ValueError("Export DOKPLOY_HOST and DOKPLOY_TOKEN first.")
    origin = urlsplit(host)
    if (origin.scheme != "https" or not origin.hostname or origin.username
            or origin.password or origin.path not in ("", "/")
            or origin.query or origin.fragment):
        raise ValueError("DOKPLOY_HOST must be an HTTPS origin without a path or credentials.")
    headers = [("x-api-key", token)]
    client_id = env.get("CF_CLIENT_ID", "")
    client_secret = env.get("CF_CLIENT_SECRET", "")
    if bool(client_id) != bool(client_secret):
        raise ValueError("Export both CF_CLIENT_ID and CF_CLIENT_SECRET, or neither.")
    if client_id:
        headers.extend([
            ("CF-Access-Client-Id", client_id),
            ("CF-Access-Client-Secret", client_secret),
        ])
    url = host.rstrip("/") + "/api/project.all"
    lines = ["url = " + curl_quote(url)]
    lines.extend("header = " + curl_quote(f"{key}: {value}") for key, value in headers)
    return url, lines


def response_summary(status, headers, body, url):
    fields = {}
    for line in headers.splitlines():
        if line.startswith("HTTP/"):
            fields = {}
        elif ":" in line:
            key, value = line.split(":", 1)
            fields[key.lower()] = value.strip()
    ray = fields.get("cf-ray", "")
    suffix = f"; request ID {ray}" if re.fullmatch(r"[a-fA-F0-9]+-[A-Za-z]+", ray) else ""
    if status in (301, 302, 303, 307, 308):
        target = urlsplit(urljoin(url, fields.get("location", "")))
        source = urlsplit(url)
        same_origin = (target.scheme, target.netloc) == (source.scheme, source.netloc)
        return False, f"HTTP {status}: redirect blocked (same origin: {same_origin}){suffix}"
    if status == 200:
        try:
            projects = json.loads(body)
        except ValueError:
            projects = None
        if isinstance(projects, list) and all(
                isinstance(project, dict) and isinstance(project.get("projectId"), str)
                for project in projects):
            return True, f"HTTP 200: Dokploy project metadata verified ({len(projects)} projects){suffix}"
        return False, f"HTTP 200: unexpected response; API access is not verified{suffix}"
    lower = body.lower()
    if "cloudflare access" in lower or "access policy" in lower:
        detail = "response indicates Cloudflare Access denial"
    elif "cf-chl-" in lower or "/cdn-cgi/challenge-platform/" in lower:
        detail = "response indicates a Cloudflare challenge"
    else:
        detail = "request failed; denial source is unconfirmed"
    return False, f"HTTP {status}: {detail}{suffix}"


def check_access(env, runner=subprocess.run):
    url, lines = request_config(env)
    with tempfile.TemporaryDirectory(prefix="dokploy-check-") as directory:
        body_path = Path(directory) / "body"
        headers_path = Path(directory) / "headers"
        lines.extend([
            "output = " + curl_quote(str(body_path)),
            "dump-header = " + curl_quote(str(headers_path)),
        ])
        # Keep credentials off argv and ignore user curl settings, including redirects.
        result = runner([
            "curl", "--disable", "--globoff", "--silent", "--show-error", "--request", "GET",
            "--proto", "=https", "--max-time", "20", "--max-filesize", "1048576",
            "--config", "-", "--write-out", "%{http_code}",
        ], input="\n".join(lines) + "\n", text=True, capture_output=True, timeout=25)
        if result.returncode:
            return False, f"curl failed (exit {result.returncode}); check connectivity, TLS, or proxy settings."
        try:
            status = int(result.stdout.strip())
        except ValueError:
            return False, "curl returned an invalid HTTP status."
        return response_summary(
            status, headers_path.read_text(errors="replace"),
            body_path.read_text(errors="replace"), url,
        )


def test_payload(application_id, result):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", application_id):
        raise ValueError("Use an application ID containing letters, digits, underscores, or dashes.")
    if result not in ("success", "failure"):
        raise ValueError("Test result must be success or failure.")
    return {
        "applicationId": application_id,
        "sourceType": "docker",
        "dockerImage": "alpine:3.22",
        "command": "sleep 15" if result == "success" else "false",
        "replicas": 1,
        "modeSwarm": None,
        "restartPolicySwarm": {"Condition": "none"},
        "memoryLimit": str(128 * 1024 * 1024),
        "cpuLimit": str(250_000_000),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("check", help="Check API access without displaying project data.")
    payload = commands.add_parser("payload", help="Print test JSON only; never send it.")
    payload.add_argument("--application-id", required=True)
    payload.add_argument("--result", choices=("success", "failure"), default="success")
    args = parser.parse_args()
    try:
        if args.command == "payload":
            print(json.dumps(test_payload(args.application_id, args.result), indent=2))
            return 0
        success, message = check_access(os.environ)
        print(message)
        return 0 if success else 1
    except ValueError:
        print("Invalid configuration. Check required variables, HTTPS origin, and single-line values.", file=sys.stderr)
    except (OSError, subprocess.TimeoutExpired):
        print("Access check could not finish. Check curl availability, network access, and local file access.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
