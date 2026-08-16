#!/bin/sh
# sync-profile.sh — copy the freshly built lib/client.js into the installed
# DSH profile copy so the client HMR poll sees the change.
#
# Why this exists: `dsh plugin add` installs this package into the profile's
# node_modules as a *copy* (file: dependency, not a symlink). Editing the
# source repo's lib/client.js never touches that copy, so the HMR watcher
# (which stat-polls every plugin bundle ~every 500ms) sees no change and the
# GUI keeps serving the old bundle. Copying the artifact in makes HMR pick it
# up within ~1s — no dsh web restart, no page refresh.
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
	echo "install it first: dsh plugin --profile $PROFILE add github:yuxino/dsh-blue-whale-maid" >&2
	exit 1
fi

cp "$SRC" "$TARGET"
echo "synced lib/client.js -> profile '$PROFILE'"
echo "client HMR will hot-reload within ~1s (no dsh web restart needed)."
