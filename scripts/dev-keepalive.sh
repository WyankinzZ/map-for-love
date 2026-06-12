#!/usr/bin/env bash
set -u

PORT="${PORT:-3002}"
HOST="${HOST:-localhost}"
LOG_FILE="${LOG_FILE:-.next/dev-keepalive.log}"
CHECK_URL="http://${HOST}:${PORT}/"

mkdir -p "$(dirname "$LOG_FILE")"

timestamp() {
  date "+%Y-%m-%d %H:%M:%S"
}

echo "[$(timestamp)] keepalive watching ${CHECK_URL}" >> "$LOG_FILE"

while true; do
  if curl -fsS "$CHECK_URL" >/dev/null 2>&1; then
    sleep 5
    continue
  fi

  echo "[$(timestamp)] starting next dev on port ${PORT}" >> "$LOG_FILE"
  npx next dev -p "$PORT" >> "$LOG_FILE" 2>&1
  status=$?
  echo "[$(timestamp)] next dev exited with status ${status}; restarting soon" >> "$LOG_FILE"
  sleep 2
done
