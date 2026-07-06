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
INVOICE_NFT_ADDRESS=0x76799a06A64f0b1C24Dd688348c6c2D2B215b173
YIELD_VAULT_ADDRESS=0xEfcae7a8c221956D1B3aff5bCDB0267e4aD6646A
AGENT_ROUTER_ADDRESS=0x38cf9B34d8Ca1d041FfB876Bf73f8DE2Cb119E01
MOCK_ORACLE_ADDRESS=
PYTH_ORACLE_ADDRESS=0xD793Bb98C1B0b94E5392370d031ED76DeDeAcDd1
AAVE_YIELD_ADDRESS=0x413FbA572293494972636975BEe37477dB405652
AGENT_PRIVATE_KEY=0x...
QWEN_API_KEY=sk-...
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
