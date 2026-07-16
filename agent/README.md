# vopo Agent

The vopo agent monitors the Mantle Sepolia deployment, analyzes invoice and yield state, and can trigger on-chain strategy updates through `AgentRouter`.

## What the agent does

- Reads deployed contract state from Mantle Sepolia
- Analyzes invoice risk and due dates
- Decides between conservative and aggressive yield strategies
- Broadcasts live status to the frontend over WebSocket
- Can execute approved strategy changes on-chain via `AgentRouter`

## Production deployment

- WebSocket: `ws://agent.eduworld.world`
- Health endpoint: `http://agent.eduworld.world/health`
- Default port: `8080`

The agent runs as a Docker container on Ubuntu via GitHub Actions CI/CD. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full setup.

## Contract addresses (Mantle Sepolia, chainId 5003)

| Contract | Address |
|---|---|
| InvoiceNFT | `0x5F1b5A2BF9B38528F74a6d3EDa585C9417050FBa` |
| YieldVault | `0xb8129B7710C4a63B39735FA560c28C9A2303e095` |
| AgentRouter | `0x51C6620A0846cA41845756f0315412981487E947` |
| PrivacyRegistry | `0xe87632AdEdDDc580c726894190c209540FEE5a96` |

## Quick start (local)

```bash
cd agent
pnpm install
pnpm dev
```

## Docker (local)

Build from the repo root:

```bash
docker build -f Dockerfile.mcp -t vopo-agent .
```

Run the container:

```bash
docker run -p 8080:8080 --env-file agent/.env.local vopo-agent
```

## Required environment variables

```bash
MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
WS_PORT=8080
DEPLOYMENT_NETWORK=mantleSepolia

# Active contract addresses
CONTRACT_ADDRESS=0x5F1b5A2BF9B38528F74a6d3EDa585C9417050FBa
YIELD_VAULT_ADDRESS=0xb8129B7710C4a63B39735FA560c28C9A2303e095
AGENT_ROUTER_ADDRESS=0x51C6620A0846cA41845756f0315412981487E947
PYTH_ORACLE_ADDRESS=0xD793Bb98C1B0b94E5392370d031ED76DeDeAcDd1
AAVE_YIELD_ADDRESS=0x413FbA572293494972636975BEe37477dB405652

# Secrets — never commit these
AGENT_PRIVATE_KEY=0x...
QWEN_API_KEY=sk-...
```

## Agent data persistence

The agent writes persistent data (decisions, analysis history) to `/app/agent/data` inside the container. In production this is mounted to `~/vopo/agent-data` on the host so data survives container restarts:

```bash
-v ~/vopo/agent-data:/app/agent/data
```

## WebSocket API

**Connection**: `ws://localhost:8080` locally, `ws://agent.eduworld.world` in production

The agent broadcasts analysis, execution, and error messages to the frontend dashboard. See [docs/TECHNICAL_MVP.md](../docs/TECHNICAL_MVP.md) for the full message protocol.

## Production notes

- Keep `AGENT_PRIVATE_KEY` only in `~/vopo/.env.agent` on the server — never in the frontend or in GitHub secrets
- The Docker container exposes `/health` for readiness checks
- Agent data is persisted via volume mount; the directory must exist on the host before the container starts
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full Ubuntu + GitHub Actions setup

## Deployment

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Ubuntu server + Docker + GitHub Actions
- [.github/workflows/ci.yml](../.github/workflows/ci.yml) — CI/CD pipeline
