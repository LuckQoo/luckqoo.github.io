#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# backend's better-sqlite3 native module requires Node >=22; nvm only wires up
# PATH for interactive shells, so pin it explicitly for this script's children.
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -d "$NVM_DIR/versions/node" ]; then
    NODE22_BIN="$(find "$NVM_DIR/versions/node" -maxdepth 1 -name 'v22*' 2>/dev/null | sort -V | tail -1)/bin"
    [ -d "$NODE22_BIN" ] && export PATH="$NODE22_BIN:$PATH"
fi

# --- Services ---
# name:dir:command
FRONTEND_PORT="${EPOCH_FRONTEND_PORT:-8080}"
SERVICES=(
    "frontend:${BASE_DIR}:exec python3 -m http.server ${FRONTEND_PORT}"
    "backend:${BASE_DIR}/server:set -a; [ -f .env ] && source .env; set +a; exec node index.js"
)

pid_file() { echo "/tmp/epoch-$1.pid"; }
log_file() { echo "/tmp/epoch-$1.log"; }

usage() {
    echo "Usage: $0 {start|stop|status|restart|logs}"
    exit 1
}

is_running() {
    local pf
    pf="$(pid_file "$1")"
    [[ -f "$pf" ]] && kill -0 "$(cat "$pf")" 2>/dev/null
}

start_one() {
    local name="$1" dir="$2" cmd="$3"
    local pf lf
    pf="$(pid_file "$name")"
    lf="$(log_file "$name")"

    if is_running "$name"; then
        echo "$name is already running (PID $(cat "$pf"))"
        return 0
    fi
    nohup bash -c "cd '$dir' && $cmd" >>"$lf" 2>&1 &
    echo $! >"$pf"
    sleep 0.3
    if is_running "$name"; then
        echo "$name started (PID $(cat "$pf")), logging to $lf"
    else
        echo "$name failed to start; check $lf"
        rm -f "$pf"
        return 1
    fi
}

stop_one() {
    local name="$1"
    local pf pid
    pf="$(pid_file "$name")"

    if ! is_running "$name"; then
        echo "$name is not running"
        rm -f "$pf"
        return 0
    fi
    pid="$(cat "$pf")"
    kill "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.2
    done
    if kill -0 "$pid" 2>/dev/null; then
        echo "$name did not stop gracefully, sending SIGKILL"
        kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pf"
    echo "$name stopped"
}

status_one() {
    local name="$1"
    if is_running "$name"; then
        echo "$name is running (PID $(cat "$(pid_file "$name")"))"
    else
        echo "$name is not running"
    fi
}

for_each() {
    local action="$1"
    local entry name dir cmd
    for entry in "${SERVICES[@]}"; do
        IFS=':' read -r name dir cmd <<<"$entry"
        "$action" "$name" "$dir" "$cmd"
    done
}

start()   { for_each start_one; }
stop()    { for_each stop_one; }
status()  { for_each status_one; }
restart() { stop; start; }

logs() {
    local entry name dir cmd lf lfs=()
    for entry in "${SERVICES[@]}"; do
        IFS=':' read -r name dir cmd <<<"$entry"
        lf="$(log_file "$name")"
        touch "$lf"
        lfs+=("$lf")
    done
    tail -f "${lfs[@]}"
}

case "${1:-}" in
    start)   start ;;
    stop)    stop ;;
    status)  status ;;
    restart) restart ;;
    logs)    logs ;;
    *)       usage ;;
esac
