#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
# Edit CMD to the actual command you want start/stop/status to manage.
CMD="${EPOCH_CMD:-sleep infinity}"
NAME="epoch"
PID_FILE="${EPOCH_PID_FILE:-/tmp/${NAME}.pid}"
LOG_FILE="${EPOCH_LOG_FILE:-/tmp/${NAME}.log}"

usage() {
    echo "Usage: $0 {start|stop|status|restart}"
    exit 1
}

is_running() {
    [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

start() {
    if is_running; then
        echo "$NAME is already running (PID $(cat "$PID_FILE"))"
        return 0
    fi
    nohup bash -c "$CMD" >>"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
    sleep 0.2
    if is_running; then
        echo "$NAME started (PID $(cat "$PID_FILE")), logging to $LOG_FILE"
    else
        echo "$NAME failed to start; check $LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi
}

stop() {
    if ! is_running; then
        echo "$NAME is not running"
        rm -f "$PID_FILE"
        return 0
    fi
    local pid
    pid="$(cat "$PID_FILE")"
    kill "$pid"
    for _ in $(seq 1 20); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.2
    done
    if kill -0 "$pid" 2>/dev/null; then
        echo "$NAME did not stop gracefully, sending SIGKILL"
        kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
    echo "$NAME stopped"
}

status() {
    if is_running; then
        echo "$NAME is running (PID $(cat "$PID_FILE"))"
    else
        echo "$NAME is not running"
    fi
}

case "${1:-}" in
    start)   start ;;
    stop)    stop ;;
    status)  status ;;
    restart) stop; start ;;
    *)       usage ;;
esac
