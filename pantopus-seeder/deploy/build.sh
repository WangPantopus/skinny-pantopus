#!/usr/bin/env bash
# Prepare source and run tests before SAM build/deploy.
#
# This script copies source code and requirements into build/, then runs
# tests. SAM handles dependency installation via `sam build --use-container`
# to ensure native extensions (pydantic, etc.) are compiled for Linux arm64.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"

echo "==> Cleaning previous build..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "==> Copying source code..."
cp -r "$PROJECT_DIR/src" "$BUILD_DIR/src"

# SAM needs requirements.txt in the CodeUri directory to install deps
cp "$PROJECT_DIR/requirements-lambda.txt" "$BUILD_DIR/requirements.txt"

echo "==> Running tests..."
cd "$PROJECT_DIR"
python -m pytest tests/ --tb=short -q || {
  echo "ERROR: Tests failed. Fix tests before deploying."
  exit 1
}

echo ""
echo "Build complete."
echo "Deploy with:"
echo "  cd deploy && sam build --use-container && sam deploy --config-env dev"
