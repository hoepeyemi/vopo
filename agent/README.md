# vasmo Agent

The vasmo agent monitors the Mantle Sepolia deployment, analyzes invoice and yield state, and can trigger on-chain strategy updates through `AgentRouter`.

## What the agent does

- Reads deployed contract state from Mantle Sepolia
- Analyzes invoice risk and due dates
- Decides between conservative and aggressive behavior
- Broadcasts live status to the frontend over WebSocket
- Can execute approved strategy changes on-chain

## Public deployment

The browser should connect to a public WebSocket endpoint, not localhost.

- Health endpoint: `/health`
- Default port: `8080`

## Quick start

```bash
cd agent
pnpm install
pnpm dev
```

## Docker

Build from the repo root:

```bash
docker build -f Dockerfile.mcp -t vasmo-agent .
```

Run the container:

```bash
docker run -p 8080:8080 --env-file .env.local vasmo-agent
```

## Required environment variables

```bash
MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
WS_PORT=8080
DEPLOYMENT_NETWORK=mantleSepolia
INVOICE_NFT_ADDRESS=0x018ee8F363421016177DbC8F9492fe2a1C720e29
YIELD_VAULT_ADDRESS=0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6
AGENT_ROUTER_ADDRESS=0x4430248F3b2304F946f08c43A06C3451657FD658
MOCK_ORACLE_ADDRESS=
PYTH_ORACLE_ADDRESS=0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3
AAVE_YIELD_ADDRESS=0x5a179d261fD322ecaED06FA9Aa2973980D74322c
AGENT_PRIVATE_KEY=0x...
ANTHROPIC_API_KEY=sk-ant-...
```

If you use the live deployment manifest, the agent can read the Mantle Sepolia defaults from:

- [`contracts/deployments/mantleSepolia.json`](C:/Users/jwavo/vasmo/contracts/deployments/mantleSepolia.json)

## WebSocket API

- Server URL: `ws://localhost:8080` in local development
- Production should use `wss://` with a public domain

The agent broadcasts analysis, execution, and error messages to the frontend dashboard.

## Production notes

- The agent runs as a single Node.js process
- The Docker container exposes `/health`
- For production, keep `AGENT_PRIVATE_KEY` only on the server and never in the frontend
- Use a public agent URL in `NEXT_PUBLIC_AGENT_WS_URL`

## Deployment

See:

- [`agent/DEPLOYMENT.md`](C:/Users/jwavo/vasmo/agent/DEPLOYMENT.md)
- [`.github/workflows/ci.yml`](C:/Users/jwavo/vasmo/.github/workflows/ci.yml)
