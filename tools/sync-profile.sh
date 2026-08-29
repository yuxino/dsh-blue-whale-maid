#!/bin/sh
# sync-profile.sh — copy the freshly built lib/client.js into the installed
# DSH profile copy so the client HMR poll sees the change.
#
# Why this exists: a registry or GitHub install keeps a package copy inside the
# profile's node_modules, separate from this source checkout. A local
# `plugin --profile web add .` install is a symlink instead, so its built client
# is already the same file and must not be copied onto itself.
#
# Usage:
#   node tools/embed.mjs && ./tools/sync-profile.sh
#   DSH_PROFILE=headless ./tools/sync-profile.sh
#
# Optional: DSH_HOME to point at a non-default harness home.
set -eu

PROFILE="${DSH_PROFILE:-web}"
HOME_DIR="${DSH_HOME:-$HOME/.dsh}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/lib/client.js"
TARGET="$HOME_DIR/profiles/$PROFILE/node_modules/dsh-blue-whale-maid/lib/client.js"

if [ ! -f "$SRC" ]; then
	echo "error: $SRC not found — run 'node tools/embed.mjs' first" >&2
	exit 1
fi
if [ ! -f "$TARGET" ]; then
	echo "error: plugin not installed in profile '$PROFILE' ($TARGET)" >&2
	echo "install it first: npx @deepseek-ai/dsh plugin --profile $PROFILE add github:yuxino/dsh-blue-whale-maid" >&2
	exit 1
fi

if [ "$SRC" -ef "$TARGET" ]; then
	echo "profile '$PROFILE' already links this checkout; lib/client.js is current"
	echo "restart dsh web to load the rebuilt bundle reliably"
	exit 0
fi

cp "$SRC" "$TARGET"
echo "synced lib/client.js -> profile '$PROFILE'"
echo "client HMR will hot-reload within ~1s (no dsh web restart needed)."
