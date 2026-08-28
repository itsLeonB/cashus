#!/bin/sh
# Pre-push hook: run backend checks only if backend/ changed,
# frontend checks only if frontend/ changed. Installed via
# `make install-pre-push-hook`, always runs from repo root.
set -e

zero="0000000000000000000000000000000000000000"
run_backend=0
run_frontend=0

while read -r local_ref local_sha remote_ref remote_sha; do
	[ "$local_sha" = "$zero" ] && continue # branch deletion, nothing to check

	if [ "$remote_sha" = "$zero" ]; then
		# New branch/first push: no known base to diff against.
		# ponytail: run both check-sets in this ambiguous case rather than
		# computing a synthetic diff range — safe default, rare path.
		run_backend=1
		run_frontend=1
		continue
	fi

	changed=$(git diff --name-only "$remote_sha" "$local_sha")
	echo "$changed" | grep -q '^backend/' && run_backend=1
	echo "$changed" | grep -q '^frontend/' && run_frontend=1
done

echo "Running pre-push checks..."

if [ "$run_backend" = "1" ]; then
	echo "\n=== backend/ changed: running backend checks ==="
	make lint-backend || { echo "backend lint failed"; exit 1; }
	make vulncheck-backend || { echo "backend vulncheck failed"; exit 1; }
	make test-backend || { echo "backend tests failed"; exit 1; }
	make build-all-backend || { echo "backend build failed"; exit 1; }
fi

if [ "$run_frontend" = "1" ]; then
	echo "\n=== frontend/ changed: running frontend checks ==="
	make lint-frontend || { echo "frontend lint failed"; exit 1; }
	make test-frontend || { echo "frontend tests failed"; exit 1; }
	make build-frontend || { echo "frontend build failed"; exit 1; }
fi

if [ "$run_backend" = "0" ] && [ "$run_frontend" = "0" ]; then
	echo "No backend/ or frontend/ changes detected — nothing to check."
fi

echo "\n✅ All checks passed! Pushing can continue...\n"
