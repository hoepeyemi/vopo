# vopo Agent — Production Deployment

The agent is deployed as a Docker container on an Ubuntu server via GitHub Actions. Each push to `main` automatically builds, pushes, and redeploys both the agent and the app.

---

## Overview

```
GitHub push to main
  → GitHub Actions: build Dockerfile.mcp → push to Docker Hub
  → SSH to Ubuntu server
  → pull new image
  → docker stop/rm vopo-agent
  → docker run vopo-agent with ~/vopo/.env.agent
  → wait for /health
```

---

## Prerequisites

- Ubuntu server with Docker installed
- Docker Hub account
- GitHub repository with Actions enabled

---

## One-time server setup

SSH into your server and run:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Create directories
mkdir -p ~/vopo/agent-data

# Create the agent env file (fill in real values)
cat > ~/vopo/.env.agent << 'EOF'
MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
WS_PORT=8080
DEPLOYMENT_NETWORK=mantleSepolia
CONTRACT_ADDRESS=0x5F1b5A2BF9B38528F74a6d3EDa585C9417050FBa
YIELD_VAULT_ADDRESS=0xb8129B7710C4a63B39735FA560c28C9A2303e095
AGENT_ROUTER_ADDRESS=0x51C6620A0846cA41845756f0315412981487E947
PYTH_ORACLE_ADDRESS=0xD793Bb98C1B0b94E5392370d031ED76DeDeAcDd1
AAVE_YIELD_ADDRESS=0x413FbA572293494972636975BEe37477dB405652
AGENT_PRIVATE_KEY=0x...your-agent-wallet-key...
QWEN_API_KEY=sk-...your-qwen-key...
EOF

# Strip any accidental trailing whitespace (Docker --env-file includes it as part of the value)
sed -i 's/[[:space:]]*$//' ~/vopo/.env.agent

# Create the Docker network shared by both containers
docker network create vopo-net
```

---

## GitHub Secrets

Set these in **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `DOCKER_USERNAME` | Your Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password or access token |
| `SSH_HOST` | Server IP or hostname |
| `SSH_USERNAME` | SSH user on the server |
| `SSH_PRIVATE_KEY` | Private key for SSH access |

No contract addresses or private keys go in GitHub secrets — those live in `~/vopo/.env.agent` on the server.

---

## Manual deployment (without CI)

```bash
# On the server
docker pull <your-dockerhub-user>/vopo-agent:latest

docker stop vopo-agent 2>/dev/null; docker rm vopo-agent 2>/dev/null

docker run -d \
  --name vopo-agent \
  --restart unless-stopped \
  --network vopo-net \
  -p 8080:8080 \
  --env-file ~/vopo/.env.agent \
  -v ~/vopo/agent-data:/app/agent/data \
  <your-dockerhub-user>/vopo-agent:latest

# Verify health
curl http://localhost:8080/health
```

---

## Checking logs and status

```bash
# Live logs
docker logs -f vopo-agent

# Check env vars loaded correctly
docker exec vopo-agent env | grep -v PRIVATE_KEY

# Verify agent is connected to the right contracts
docker logs vopo-agent 2>&1 | grep "contract\|address\|connected"

# Health check
curl http://localhost:8080/health

# WebSocket test (requires wscat)
npm install -g wscat
wscat -c ws://localhost:8080
# Expect: {"type":"status","payload":{"status":"connected"}}
```

---

## Troubleshooting

### Agent crashes on startup

Check for missing env vars:

```bash
docker logs vopo-agent 2>&1 | tail -50
```

The most common causes:
- `AGENT_PRIVATE_KEY` is missing or malformed
- `MANTLE_RPC_URL` is unreachable
- Trailing whitespace in `.env.agent` values — fix with `sed -i 's/[[:space:]]*$//' ~/vopo/.env.agent`

### Data not persisting across restarts

Ensure the volume mount is included in the `docker run` command and the host directory exists:

```bash
ls -la ~/vopo/agent-data/
```

### Agent can't reach the app container

Both containers must be on the same Docker network:

```bash
docker network inspect vopo-net
# Both vopo-agent and vopo-app should appear under "Containers"
```

### `$USER` variable unset in SSH session

GitHub Actions SSH sessions are non-login shells where `$USER` may be unset. Use `$HOME` instead:

```bash
# Correct
$HOME/vopo/.env.agent

# May fail
/home/$USER/vopo/.env.agent
```

---

## Authorizing the agent wallet on-chain

The agent wallet must be authorized on `AgentRouter` before it can record decisions:

```bash
cast send 0x51C6620A0846cA41845756f0315412981487E947 \
  "authorizeAgent(address)" \
  <AGENT_WALLET_ADDRESS> \
  --rpc-url https://rpc.sepolia.mantle.xyz \
  --private-key <DEPLOYER_PRIVATE_KEY>
```

---

## Contract addresses (Mantle Sepolia)

| Contract | Address |
|---|---|
| InvoiceNFT | `0x5F1b5A2BF9B38528F74a6d3EDa585C9417050FBa` |
| YieldVault | `0xb8129B7710C4a63B39735FA560c28C9A2303e095` |
| AgentRouter | `0x51C6620A0846cA41845756f0315412981487E947` |
| PrivacyRegistry | `0xe87632AdEdDDc580c726894190c209540FEE5a96` |
| Pyth Oracle | `0xD793Bb98C1B0b94E5392370d031ED76DeDeAcDd1` |
| Aave Yield | `0x413FbA572293494972636975BEe37477dB405652` |
