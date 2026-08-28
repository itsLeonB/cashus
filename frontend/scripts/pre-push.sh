#!/bin/bash

echo "🔍 Running pre-push checks..."

echo "1. Running tests..."
if ! bun test; then
    echo "❌ Tests failed. Fix errors before pushing."
    exit 1
fi
echo "✅ Tests passed"

# ESLint
echo "2. Running ESLint..."
if ! bun lint; then
    echo "❌ ESLint failed. Fix errors before pushing."
    exit 1
fi
echo "✅ ESLint passed"

# Build
echo "3. Building project..."
if ! bun run build; then
    echo "❌ Build failed. Fix errors before pushing."
    exit 1
fi
echo "✅ Build successful"

# Check unused components
echo "4. Checking unused components..."
bun run scripts/check-unused-components.ts
echo "⚠ Note: Unused component check is informational only"

echo "5. Checking unused dependencies..."
bunx depcheck

echo "🎉 All checks passed! You may push."
exit 0
