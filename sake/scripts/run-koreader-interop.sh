#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$(uname -s)" == "Darwin" && "${SAKE_KOREADER_CONTAINER:-}" != "1" ]]; then
    if ! command -v docker >/dev/null 2>&1; then
        echo "KOReader interoperability tests need Linux or Docker on macOS." >&2
        exit 2
    fi
    exec docker run --rm \
        --volume "$ROOT_DIR:/workspace" \
        --workdir /workspace \
        --env SAKE_KOREADER_CONTAINER=1 \
        oven/bun:1.3.8 \
        bash -lc 'apt-get update -qq && apt-get install -y -qq --no-install-recommends ca-certificates curl xz-utils coreutils >/dev/null && bun install --frozen-lockfile && bun run test:reader:interop'
fi

if [[ "$(uname -s)" != "Linux" ]]; then
    echo "KOReader interoperability tests currently require a Linux x86_64 or arm64 runtime." >&2
    echo "Run them in the GitHub Actions workflow or from a Linux environment." >&2
    exit 2
fi

case "$(uname -m)" in
    x86_64)
        archive_name='koreader-linux-x86_64-v2026.03.tar.xz'
        archive_sha256='2fe4e5bb7973e30e3a3932f9370b549d6cc26272acaba471c35ebcaf81c741af'
        ;;
    aarch64|arm64)
        archive_name='koreader-linux-arm64-v2026.03.tar.xz'
        archive_sha256='f50304e54ca295860bbddb836873e8a43d677f65832586f707bacd9533152ad6'
        ;;
    *)
        echo "Unsupported Linux architecture: $(uname -m)" >&2
        exit 2
        ;;
esac

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

archive_path="$TEMP_DIR/$archive_name"
curl --fail --location --retry 3 --silent --show-error \
    "https://github.com/koreader/koreader/releases/download/v2026.03/$archive_name" \
    --output "$archive_path"
echo "$archive_sha256  $archive_path" | sha256sum --check --status

mkdir "$TEMP_DIR/koreader"
tar -xJf "$archive_path" -C "$TEMP_DIR/koreader"

bun run "$ROOT_DIR/scripts/create-reader-interop-epub.ts" "$TEMP_DIR/interop.epub"
bun run "$ROOT_DIR/scripts/create-reader-interop-sidecar.ts" "$TEMP_DIR/metadata.epub.lua"

KO_DIR="$TEMP_DIR/koreader/lib/koreader"
export KO_HOME="$TEMP_DIR/ko-home"
mkdir -p "$KO_HOME"
export LUA_PATH="$ROOT_DIR/tests/interop/reader/?.lua;common/?.lua;frontend/?.lua;;"
export LUA_CPATH='common/?.so;;'
export SAKE_READER_TEST_EPUB="$TEMP_DIR/interop.epub"
export SAKE_READER_TEST_SIDECAR="$TEMP_DIR/metadata.epub.lua"

cd "$KO_DIR"
exec ./luajit "$ROOT_DIR/scripts/koreader-interop-runner.lua" \
    "$ROOT_DIR/tests/interop/reader/koreader-xpointer-interop-spec.lua"
