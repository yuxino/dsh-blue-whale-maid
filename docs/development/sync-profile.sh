#!/bin/sh
# Copy the freshly built client bundle into a non-linked DSH profile install.
# This helper is documentation/development tooling, not package runtime code.
#
# Usage:
#   node docs/development/embed.mjs
#   sh docs/development/sync-profile.sh
set -eu

PROFILE="${DSH_PROFILE:-web}"
HOME_DIR="${DSH_HOME:-$HOME/.dsh}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/lib/client.js"
TARGET="$HOME_DIR/profiles/$PROFILE/node_modules/dsh-blue-whale-maid/lib/client.js"

if [ ! -f "$SRC" ]; then
	echo "error: $SRC not found — run 'node docs/development/embed.mjs' first" >&2
	exit 1
fi
if [ ! -f "$TARGET" ]; then
	echo "error: plugin not installed in profile '$PROFILE' ($TARGET)" >&2
	exit 1
fi

if [ "$SRC" -ef "$TARGET" ]; then
	echo "profile '$PROFILE' already links this checkout; lib/client.js is current"
	exit 0
fi

cp "$SRC" "$TARGET"
echo "synced lib/client.js -> profile '$PROFILE'"
