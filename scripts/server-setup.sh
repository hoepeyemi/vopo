#!/usr/bin/env bash
# Run once on a fresh Ubuntu 22.04/24.04 server as root or a sudo user.
# Usage: bash server-setup.sh

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
if ! groups "$USER" | grep -q docker; then
  usermod -aG docker "$USER"
  echo "Added $USER to docker group (re-login or run: newgrp docker)"
fi

# ── App directory & env files ───────────────────────────────────────────────
APP_DIR=/home/${SUDO_USER:-$USER}/vopo
mkdir -p "$APP_DIR"

if [ ! -f "$APP_DIR/.env.app" ]; then
  cat > "$APP_DIR/.env.app" <<'EOF'
# Runtime env vars for the Next.js app container
# Server-side vars (not exposed to the browser)
# QUICKBOOKS_CLIENT_ID=
# QUICKBOOKS_CLIENT_SECRET=
# QUICKBOOKS_REDIRECT_URI=http://YOUR_SERVER_IP:3000/api/quickbooks/callback
EOF
  echo "Created $APP_DIR/.env.app — fill in values before deploying."
fi

if [ ! -f "$APP_DIR/.env.agent" ]; then
  cat > "$APP_DIR/.env.agent" <<'EOF'
# Runtime env vars for the vopo agent container
# WS_PORT=8080
# ANTHROPIC_API_KEY=
# PRIVATE_KEY=
# RPC_URL=https://rpc.sepolia.mantle.xyz
# CONTRACT_ADDRESS=
EOF
  echo "Created $APP_DIR/.env.agent — fill in values before deploying."
fi

# ── Firewall ────────────────────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp   comment "SSH"
  ufw allow 3000/tcp comment "vopo app"
  ufw allow 8080/tcp comment "vopo agent"
  ufw --force enable
  echo "UFW rules applied."
fi

echo ""
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Edit $APP_DIR/.env.app and $APP_DIR/.env.agent"
echo "  2. Add these secrets to your GitHub repo (Settings → Secrets → Actions):"
echo "       DOCKER_USERNAME      — your Docker Hub username"
echo "       DOCKER_PASSWORD      — Docker Hub access token"
echo "       SSH_HOST             — this server's IP or hostname"
echo "       SSH_USERNAME         — $USER"
echo "       SSH_PRIVATE_KEY      — your private SSH key"
echo "       NEXT_PUBLIC_MANTLE_SEPOLIA_RPC"
echo "       NEXT_PUBLIC_AGENT_WS_URL    (e.g. ws://YOUR_SERVER_IP:8080)"
echo "       NEXT_PUBLIC_APP_URL         (e.g. http://YOUR_SERVER_IP:3000)"
echo "       NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"
echo "  3. Push to main — CI will build, push images, and deploy automatically."
