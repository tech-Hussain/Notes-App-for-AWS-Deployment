#!/usr/bin/env bash
# Usage: scripts/load-test.sh <alb-dns> [seconds] [connections]
set -euo pipefail
DNS="${1:?alb dns}"; DUR="${2:-600}"; CONN="${3:-200}"
npx --yes autocannon -c "$CONN" -d "$DUR" "http://$DNS/api/health"
