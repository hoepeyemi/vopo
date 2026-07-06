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
INVOICE_NFT_ADDRESS=0x76799a06A64f0b1C24Dd688348c6c2D2B215b173
YIELD_VAULT_ADDRESS=0xEfcae7a8c221956D1B3aff5bCDB0267e4aD6646A
AGENT_ROUTER_ADDRESS=0x38cf9B34d8Ca1d041FfB876Bf73f8DE2Cb119E01
PYTH_ORACLE_ADDRESS=0xD793Bb98C1B0b94E5392370d031ED76DeDeAcDd1
AAVE_YIELD_ADDRESS=0x413FbA572293494972636975BEe37477dB405652
AGENT_PRIVATE_KEY=0x...
QWEN_API_KEY=sk-...
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
