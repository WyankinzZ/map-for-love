#!/usr/bin/env bash
set -euo pipefail

SESSION="${SESSION:-map-dev}"
PORT="${PORT:-3002}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v tmux >/dev/null 2>&1; then
  echo "tmux is required for dev:daemon. Run npm run dev:keepalive in a terminal instead."
  exit 1
fi

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Dev daemon already running in tmux session: ${SESSION}"
  echo "Open it with: tmux attach -t ${SESSION}"
  exit 0
fi

tmux new-session -d -s "$SESSION" "cd \"$ROOT_DIR\" && PORT=$PORT bash scripts/dev-keepalive.sh"

echo "Started dev daemon in tmux session: ${SESSION}"
echo "URL: http://localhost:${PORT}"
echo "Logs: $ROOT_DIR/.next/dev-keepalive.log"
