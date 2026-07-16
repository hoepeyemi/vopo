#!/usr/bin/env bash
# Run once on a fresh Ubuntu 22.04/24.04 server as root or a sudo user.
# Usage: sudo bash server-setup.sh

set -euo pipefail

echo "=== vopo server setup ==="

# ── Docker ─────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "Installing Docker..."
  apt-get update -q
  apt-get install -y --no-install-recommends ca-certificates curl gnupg

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -q
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  echo "Docker installed."
else
  echo "Docker already installed: $(docker --version)"
fi

# Allow current user to run docker without sudo
DEPLOY_USER="${SUDO_USER:-$USER}"
if ! groups "$DEPLOY_USER" | grep -q docker; then
  usermod -aG docker "$DEPLOY_USER"
  echo "Added $DEPLOY_USER to the docker group (re-login or run: newgrp docker)"
fi

# ── App directory ───────────────────────────────────────────────────────────
APP_DIR="/home/${DEPLOY_USER}/vopo"
mkdir -p "$APP_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

# ── .env.app ─────────────────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env.app" ]; then
  cat > "$APP_DIR/.env.app" <<'EOF'
# ─────────────────────────────────────────────────────────────────────────────
# vopo app — production environment
# All NEXT_PUBLIC_* values are injected into the pre-built JS bundle at
# container startup. Edit this file and redeploy to change them.
# ─────────────────────────────────────────────────────────────────────────────

# ── Blockchain ────────────────────────────────────────────────────────────────
NEXT_PUBLIC_CHAIN_ID=5003
NEXT_PUBLIC_NETWORK_MODE=testnet

NEXT_PUBLIC_MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_SELECTED=
NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_FALLBACK_1=https://mantle-sepolia.drpc.org
NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_FALLBACK_2=https://5003.rpc.thirdweb.com/

# ── Contract addresses ────────────────────────────────────────────────────────
NEXT_PUBLIC_INVOICE_NFT_ADDRESS=0x76799a06A64f0b1C24Dd688348c6c2D2B215b173
NEXT_PUBLIC_YIELD_VAULT_ADDRESS=0xEfcae7a8c221956D1B3aff5bCDB0267e4aD6646A
NEXT_PUBLIC_AGENT_ROUTER_ADDRESS=0x38cf9B34d8Ca1d041FfB876Bf73f8DE2Cb119E01
NEXT_PUBLIC_PRIVACY_REGISTRY_ADDRESS=0x1941dF807C71A5261468de9dBDA9ceF626e635d3
NEXT_PUBLIC_MOCK_ORACLE_ADDRESS=

# ── Agent WebSocket — CHANGE to your server's public IP or domain ─────────────
NEXT_PUBLIC_AGENT_WS_URL=ws://YOUR_SERVER_IP:8080

# ── App URL — CHANGE to your server's public IP or domain ────────────────────
NEXT_PUBLIC_APP_URL=http://YOUR_SERVER_IP:3000

# ── WalletConnect — get a project ID at https://cloud.walletconnect.com/ ──────
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# ── QuickBooks OAuth (optional) ───────────────────────────────────────────────
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REDIRECT_URI=http://YOUR_SERVER_IP:3000/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox
EOF
  chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/.env.app"
  chmod 600 "$APP_DIR/.env.app"
  echo "Created $APP_DIR/.env.app"
else
  echo "$APP_DIR/.env.app already exists — skipping."
fi

# ── .env.agent ───────────────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env.agent" ]; then
  cat > "$APP_DIR/.env.agent" <<'EOF'
# ─────────────────────────────────────────────────────────────────────────────
# vopo agent — production environment
# ─────────────────────────────────────────────────────────────────────────────

WS_PORT=8080

# Anthropic API key (required for AI decisions)
ANTHROPIC_API_KEY=

# Wallet private key for on-chain transactions (no 0x prefix)
AGENT_PRIVATE_KEY=

# Mantle Sepolia RPC
RPC_URL=https://rpc.sepolia.mantle.xyz

# Deployed contract addresses
CONTRACT_ADDRESS=0x76799a06A64f0b1C24Dd688348c6c2D2B215b173
YIELD_VAULT_ADDRESS=0xEfcae7a8c221956D1B3aff5bCDB0267e4aD6646A
AGENT_ROUTER_ADDRESS=0x38cf9B34d8Ca1d041FfB876Bf73f8DE2Cb119E01
EOF
  chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/.env.agent"
  chmod 600 "$APP_DIR/.env.agent"
  echo "Created $APP_DIR/.env.agent"
else
  echo "$APP_DIR/.env.agent already exists — skipping."
fi

# ── Firewall ────────────────────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp   comment "SSH"   2>/dev/null || true
  ufw allow 3000/tcp comment "vopo app" 2>/dev/null || true
  ufw allow 8080/tcp comment "vopo agent" 2>/dev/null || true
  ufw --force enable 2>/dev/null || true
  echo "UFW firewall rules applied."
fi

# ── Summary ──────────────────────────────────────────────────────────────────
SERVER_IP=$(curl -fsSL https://api.ipify.org 2>/dev/null || echo "YOUR_SERVER_IP")

echo ""
echo "=== Setup complete ==="
echo ""
echo "Your server IP: $SERVER_IP"
echo ""
echo "REQUIRED — edit these two files before your first deploy:"
echo "  $APP_DIR/.env.app    ← fill in YOUR_SERVER_IP, WalletConnect ID, etc."
echo "  $APP_DIR/.env.agent  ← fill in ANTHROPIC_API_KEY, AGENT_PRIVATE_KEY"
echo ""
echo "REQUIRED — add these secrets to GitHub (Settings → Secrets → Actions):"
echo "  DOCKER_USERNAME   → your Docker Hub username"
echo "  DOCKER_PASSWORD   → Docker Hub access token (not your login password)"
echo "  SSH_HOST          → $SERVER_IP"
echo "  SSH_USERNAME      → $DEPLOY_USER"
echo "  SSH_PRIVATE_KEY   → contents of your private SSH key (~/.ssh/id_rsa)"
echo ""
echo "That's it. Push to main and CI will deploy automatically."
