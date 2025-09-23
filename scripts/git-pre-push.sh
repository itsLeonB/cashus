#!/bin/sh
#
# Pre-push hook that builds before allowing push

echo "Running pre-push checks..."

echo "\n=== Running build ==="
if ! bun run build; then
    echo "❌ Build failed! Please fix the issues before pushing."
    exit 1
fi

echo "\n✅ All checks passed! Pushing can continue...\n"
