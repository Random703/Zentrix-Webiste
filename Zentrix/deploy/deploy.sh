#!/usr/bin/env bash
# Sync the site/ directory to a VPS and reload nginx.
# Usage: ./deploy.sh user@your-vps-ip
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 user@host [remote_path]" >&2
  exit 1
fi

HOST="$1"
REMOTE_PATH="${2:-/var/www/zentrix/site}"
LOCAL_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../site" && pwd)"

echo "Syncing $LOCAL_PATH -> $HOST:$REMOTE_PATH"
ssh "$HOST" "sudo mkdir -p '$REMOTE_PATH'"
rsync -avz --delete "$LOCAL_PATH"/ "$HOST:$REMOTE_PATH"/

echo "Reloading nginx on $HOST"
ssh "$HOST" "sudo nginx -t && sudo systemctl reload nginx"

echo "Done."
