#!/bin/bash
# Deploy coincess-monitor to Contabo
set -euo pipefail

SERVER="root@184.174.37.31"
REMOTE_DIR="/opt/coincess-monitor"

echo "=== Deploying coincess-monitor to Contabo ==="

# Create remote dir if needed
ssh "$SERVER" "mkdir -p $REMOTE_DIR"

# Sync files (excluding node_modules and .env)
rsync -avz --exclude='node_modules' --exclude='.env' --exclude='dist' \
  "$(dirname "$0")/" "$SERVER:$REMOTE_DIR/"

echo "Installing dependencies..."
ssh "$SERVER" "cd $REMOTE_DIR && npm install --omit=dev"

echo "Restarting PM2 process..."
ssh "$SERVER" "cd $REMOTE_DIR && pm2 delete coincess-monitor 2>/dev/null || true && pm2 start ecosystem.config.cjs && pm2 save"

echo "=== Deploy complete ==="
echo "Check logs: ssh $SERVER 'pm2 logs coincess-monitor'"
