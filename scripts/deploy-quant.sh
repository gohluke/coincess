#!/bin/bash
# Coincess Quant Server Deployment Script
# Run this on your Contabo VPS

set -e

echo "=== Coincess Quant Server Deployment ==="

# Check if env vars are set
if [ -z "$HL_API_PRIVATE_KEY" ] || [ -z "$HL_ACCOUNT_ADDRESS" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "ERROR: Required environment variables not set."
  echo ""
  echo "Add these to your ~/.bashrc or use a .env file:"
  echo "  export HL_API_PRIVATE_KEY=0x..."
  echo "  export HL_ACCOUNT_ADDRESS=0x..."
  echo "  export NEXT_PUBLIC_SUPABASE_URL=https://xoggrjyjhewbwsshhjmz.supabase.co"
  echo "  export SUPABASE_SERVICE_ROLE_KEY=..."
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Install pm2 globally if needed
if ! command -v pm2 &> /dev/null; then
  echo "Installing pm2..."
  npm install -g pm2
fi

# Install tsx globally for TypeScript execution
if ! command -v tsx &> /dev/null; then
  echo "Installing tsx..."
  npm install -g tsx
fi

# Stop existing instance
pm2 stop coincess-quant 2>/dev/null || true
pm2 delete coincess-quant 2>/dev/null || true

# Start with pm2
echo "Starting quant server..."
pm2 start scripts/quant-server.ts \
  --name coincess-quant \
  --interpreter npx \
  --interpreter-args "tsx" \
  --max-memory-restart 512M \
  --restart-delay 5000

# Save pm2 config for auto-start on reboot
pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "=== Deployment Complete ==="
echo "Monitor: pm2 logs coincess-quant"
echo "Status:  pm2 status"
echo "Stop:    pm2 stop coincess-quant"
