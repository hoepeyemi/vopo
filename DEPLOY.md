# vopo — Deployment Guide

Both the **app** and the **agent** are deployed as Docker containers to an Ubuntu server via GitHub Actions CI/CD.

---

## Contract Addresses (Mantle Sepolia)

| Contract | Address |
|---|---|
| InvoiceNFT | `0x5F1b5A2BF9B38528F74a6d3EDa585C9417050FBa` |
| YieldVault | `0xb8129B7710C4a63B39735FA560c28C9A2303e095` |
| AgentRouter | `0x51C6620A0846cA41845756f0315412981487E947` |
| PrivacyRegistry | `0xe87632AdEdDDc580c726894190c209540FEE5a96` |

These are baked into `Dockerfile.web` as `ENV` vars so the client-side bundle uses the correct addresses without needing secrets in CI.

---

## Production Infrastructure

| Service | URL |
|---|---|
| App | `https://vopo.eduworld.world` |
| Agent WebSocket | `ws://agent.eduworld.world` |
| Agent Health | `http://agent.eduworld.world/health` |
| Mantle Sepolia Explorer | `https://explorer.sepolia.mantle.xyz` |

Both containers run on the same Ubuntu server behind the `vopo-net` Docker bridge network.

---

## GitHub Secrets Required

Set these once in **Settings → Secrets → Actions**:

| Secret | Description |
|---|---|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password or access token |
| `SSH_HOST` | Server IP or hostname |
| `SSH_USERNAME` | SSH login user |
| `SSH_PRIVATE_KEY` | Private key for SSH access |

No contract addresses, RPC URLs, or `NEXT_PUBLIC_*` values belong in GitHub secrets — they are either baked into the Docker image at build time or live in `~/vopo/.env.app` on the server.

---

## Server Setup (one-time)

SSH into the server and run:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/hoepeyemi/vopo/main/scripts/server-setup.sh)
```

This installs Docker, creates the `~/vopo/` directory, and generates `.env.app` and `.env.agent` stubs for you to fill in.

### `~/vopo/.env.app`

```bash
# Contract addresses
NEXT_PUBLIC_INVOICE_NFT_ADDRESS=0x5F1b5A2BF9B38528F74a6d3EDa585C9417050FBa
NEXT_PUBLIC_YIELD_VAULT_ADDRESS=0xb8129B7710C4a63B39735FA560c28C9A2303e095
NEXT_PUBLIC_AGENT_ROUTER_ADDRESS=0x51C6620A0846cA41845756f0315412981487E947
NEXT_PUBLIC_PRIVACY_REGISTRY_ADDRESS=0xe87632AdEdDDc580c726894190c209540FEE5a96

# Runtime-injected values (sed-replaced into JS bundle at container startup)
NEXT_PUBLIC_AGENT_WS_URL=ws://agent.eduworld.world
NEXT_PUBLIC_APP_URL=https://vopo.eduworld.world
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id

# QuickBooks OAuth (optional)
QUICKBOOKS_CLIENT_ID=your-client-id
QUICKBOOKS_CLIENT_SECRET=your-client-secret
QUICKBOOKS_REDIRECT_URI=https://vopo.eduworld.world/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox
```

### `~/vopo/.env.agent`

```bash
MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
WS_PORT=8080
DEPLOYMENT_NETWORK=mantleSepolia
CONTRACT_ADDRESS=0x5F1b5A2BF9B38528F74a6d3EDa585C9417050FBa
YIELD_VAULT_ADDRESS=0xb8129B7710C4a63B39735FA560c28C9A2303e095
AGENT_ROUTER_ADDRESS=0x51C6620A0846cA41845756f0315412981487E947
PYTH_ORACLE_ADDRESS=0x025C18Ccc2403D7a8cb7aD20Ac4924b16AF26e13
AAVE_YIELD_ADDRESS=0x9700149E7fE5CAAA16940BD1ae775a173e1e33B5
AGENT_PRIVATE_KEY=0x...
QWEN_API_KEY=sk-...
```

> **Important**: No trailing spaces in any value — Docker's `--env-file` parser includes trailing whitespace as part of the value, causing silent failures (e.g. `clientId='undefined'` in QuickBooks OAuth).

---

## How CI/CD Works

On every push to `main`, the pipeline runs three jobs:

### Job 1 — Test
- Typechecks and tests the agent
- Runs a build smoke test

### Job 2 — Build & Push
- Builds `Dockerfile.web` → pushes as `<user>/vopo-app:latest`
- Builds `Dockerfile.mcp` → pushes as `<user>/vopo-agent:latest`
- Contract addresses and RPC URLs are baked in at build time (not secrets)
- Three `NEXT_PUBLIC_*` vars use placeholder strings replaced at runtime:
  - `__VOPO_AGENT_WS_URL__` → `NEXT_PUBLIC_AGENT_WS_URL`
  - `__VOPO_APP_URL__` → `NEXT_PUBLIC_APP_URL`
  - `__VOPO_WC_PROJECT_ID__` → `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

### Job 3 — Deploy
- SSHes to the Ubuntu server
- Deploys agent first, waits for `/health`
- Deploys app, waits for `/health`
- Cleans up old images

---

## How `NEXT_PUBLIC_*` Variables Work in Production

`NEXT_PUBLIC_*` vars are baked into the JS bundle at build time — they cannot be changed at runtime via `.env.app`. The solution:

1. Three server-specific vars are baked as placeholder strings (e.g. `__VOPO_AGENT_WS_URL__`)
2. All other `NEXT_PUBLIC_*` vars (RPC URLs, contract addresses) are baked with real values in `Dockerfile.web`
3. At container startup, `docker-entrypoint.sh` runs `sed` to replace the three placeholders in **both** client chunks (`/srv/standalone/app/.next/static/chunks/*.js`) and server route bundles (`/srv/standalone/app/.next/server/**/*.js`)

---

## Manual Deployment (without CI)

```bash
# On the server
docker pull <user>/vopo-agent:latest
docker pull <user>/vopo-app:latest

docker network create vopo-net 2>/dev/null || true
mkdir -p ~/vopo/agent-data

docker stop vopo-agent vopo-app 2>/dev/null; docker rm vopo-agent vopo-app 2>/dev/null

docker run -d --name vopo-agent --restart unless-stopped \
  --network vopo-net -p 8080:8080 \
  --env-file ~/vopo/.env.agent \
  -v ~/vopo/agent-data:/app/agent/data \
  <user>/vopo-agent:latest

docker run -d --name vopo-app --restart unless-stopped \
  --network vopo-net -p 3000:3000 \
  --env-file ~/vopo/.env.app \
  <user>/vopo-app:latest
```

---

## Debugging

```bash
# Live logs
docker logs -f vopo-app
docker logs -f vopo-agent

# Check env vars are injected correctly
docker exec vopo-app env | grep NEXT_PUBLIC
docker exec vopo-app env | grep QUICKBOOKS

# Verify contract addresses in use
docker logs vopo-app 2>&1 | grep "\[contracts/server\]"

# Verify placeholder replacement happened
docker logs vopo-app 2>&1 | grep "\[entrypoint\]"

# Check agent data persistence
ls -la ~/vopo/agent-data/
```

---

## Known Issues & Fixes Applied

| Issue | Fix |
|---|---|
| `Cannot find module '/app/server.js'` | Added `outputFileTracingRoot` in `next.config.ts`; standalone copies to `/srv/standalone/`; server starts with `node standalone/app/server.js` |
| `EACCES: permission denied, mkdir '/app/agent/data'` | `mkdir -p + chown` in Dockerfile before `USER` switch; volume mount persists data |
| `$USER` unset in SSH action | Use `$HOME` instead of `/home/$USER/vopo` |
| `POST http://server:3000/ 405` | RPC placeholder treated as relative URL — RPC URLs now baked directly (not placeholders) |
| `__VOPO_APP_URL__` in server routes | `docker-entrypoint.sh` now runs `sed` on both static chunks and `server/` route bundles |
| QuickBooks `clientId='undefined'` | Trailing spaces in `.env.app` — strip with `sed -i 's/[[:space:]]*$//'` |
| QuickBooks redirect URI mismatch | `QUICKBOOKS_REDIRECT_URI` must be `https://` not `http://` |
| Tx stuck in mempool | Removed `simulateContract` gasPrice injection (created legacy type-0 tx); now uses `writeContractAsync` with wallet-native EIP-1559 fee estimation |
| Invoice table empty / yield = $0 | Wrong contract addresses baked into image (old fallbacks); fixed by explicitly setting correct addresses in `Dockerfile.web` |
| UTF-8 BOM in JSON | PowerShell `WriteAllText` adds BOM prefix; fixed with `New-Object System.Text.UTF8Encoding $false` |
