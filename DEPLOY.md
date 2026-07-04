# vasmo Deployment Guide

This guide reflects the current Mantle Sepolia deployment, verified contracts, and Docker-based agent deployment.

## 1. Deploy or verify contracts

The live Mantle Sepolia deployment is already recorded in:

- [`contracts/deployments/mantleSepolia.json`](C:/Users/jwavo/vasmo/contracts/deployments/mantleSepolia.json)

To verify the deployment programmatically:

```bash
cd contracts
npm run verify:mantle-sepolia
```

Required environment variable:

```bash
ETHERSCAN_API_KEY=your_api_key_here
```

## 2. Agent deployment

The agent reads the live Mantle Sepolia deployment manifest by default.

### Required environment variables

```bash
DEPLOYMENT_NETWORK=mantleSepolia
MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
WS_PORT=8080
INVOICE_NFT_ADDRESS=0x018ee8F363421016177DbC8F9492fe2a1C720e29
YIELD_VAULT_ADDRESS=0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6
AGENT_ROUTER_ADDRESS=0x4430248F3b2304F946f08c43A06C3451657FD658
PYTH_ORACLE_ADDRESS=0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3
AAVE_YIELD_ADDRESS=0x5a179d261fD322ecaED06FA9Aa2973980D74322c
AGENT_PRIVATE_KEY=0x...
ANTHROPIC_API_KEY=sk-ant-...
```

## 3. Docker deployment

The Docker deployment path now targets the agent only.

### Build locally

```bash
pnpm run docker:build:agent
```

### Run locally

```bash
docker run -p 8080:8080 --env-file agent/.env.local vasmo-agent
```

### GitHub Actions workflow

The repo includes:

- [`Dockerfile.mcp`](C:/Users/jwavo/vasmo/Dockerfile.mcp)
- [`.github/workflows/ci.yml`](C:/Users/jwavo/vasmo/.github/workflows/ci.yml)

The workflow:

1. Builds and pushes the agent image.
2. SSHes into an Ubuntu host.
3. Pulls the latest agent image.
4. Starts `vasmo-agent` on port `8080`.
5. Checks `/health` on the agent service.

## 4. User-facing checklist

Before submission, confirm:

- Smart contracts are deployed on Mantle Sepolia
- Smart contracts are verified on Mantle Explorer
- Frontend is publicly accessible through its own hosting provider
- The agent can call the on-chain strategy flow
- Deployment addresses are included in the submission
- Demo video is at least 2 minutes

## 5. Helpful URLs

- Agent health: `https://your-public-agent-domain/health`
- Mantle Sepolia Explorer: [https://explorer.sepolia.mantle.xyz](https://explorer.sepolia.mantle.xyz)
- Mantle Sepolia faucet: [https://faucet.sepolia.mantle.xyz/](https://faucet.sepolia.mantle.xyz/)
