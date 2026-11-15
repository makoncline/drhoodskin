#!/usr/bin/env bash
set -euo pipefail
node -e 'if (Number(process.versions.node.split(".")[0]) !== 24) throw new Error("Node 24 is required")'
# Cloud images can have a read-only Node installation.
export COREPACK_HOME="$PWD/.local/corepack"
export PATH="$PWD/.local/bin:$PATH"
mkdir -p "$COREPACK_HOME" "$PWD/.local/bin"
corepack enable --install-directory "$PWD/.local/bin"
corepack prepare pnpm@10.29.2 --activate
pnpm install --frozen-lockfile
pnpm browser:install
pnpm check
