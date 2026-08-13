#!/bin/sh
# One-step installer for dsh-blue-whale-maid (蓝鲸女仆 DSH 宠物插件).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/yuxino/dsh-blue-whale-maid/main/install.sh | sh
#   DSH_PROFILE=web sh install.sh --restart
#
# The package declares dsh.bundle, so `dsh plugin add` registers it as a
# profile layer automatically — no manual cordis.patch.yml editing.
set -eu

PROFILE="${DSH_PROFILE:-web}"
PORT="${DSH_WEB_PORT:-3080}"
RESTART=0
for arg in "$@"; do
	case "$arg" in
		--restart) RESTART=1 ;;
		*) echo "unknown option: $arg" >&2; exit 1 ;;
	esac
done

if ! command -v dsh >/dev/null 2>&1; then
	echo "error: dsh not found on PATH" >&2
	exit 1
fi

echo "dsh-blue-whale-maid: installing into profile '${PROFILE}' ..."
dsh plugin --profile "${PROFILE}" add github:yuxino/dsh-blue-whale-maid
echo "dsh-blue-whale-maid: registered as profile bundle ✔"

if [ "$RESTART" = "1" ]; then
	echo "dsh-blue-whale-maid: restarting dsh web on port ${PORT} ..."
	PID="$(lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN -t 2>/dev/null || true)"
	if [ -n "${PID}" ]; then
		if [ "$(ps -p "${PID}" -o comm= 2>/dev/null || true)" = "node" ]; then
			kill "${PID}"
			sleep 1
		else
			echo "dsh-blue-whale-maid: port ${PORT} is not a node process; not killing it" >&2
		fi
	fi
	if command -v nohup >/dev/null 2>&1; then
		nohup dsh --profile "${PROFILE}" --port "${PORT}" > "${DSH_HOME:-$HOME/.dsh}/dsh-web.log" 2>&1 &
		echo "dsh-blue-whale-maid: restarted in background (log: ${DSH_HOME:-$HOME/.dsh}/dsh-web.log)"
	else
		dsh --profile "${PROFILE}" --port "${PORT}"
	fi
fi

cat <<EOF

✅ 安装完成。若未使用 --restart，请重启你的 dsh web 服务（dsh ${PROFILE}）后刷新页面，
   蓝鲸女仆就会出现在窗口右下角。卸载：dsh plugin --profile ${PROFILE} remove dsh-blue-whale-maid
EOF
