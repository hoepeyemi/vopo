# vasmo

> Autonomous AI treasury for B2B invoices on Mantle Sepolia

vasmo turns invoices into on-chain assets, lets users mint and manage them in the frontend, and lets an AI agent monitor and execute strategy changes on-chain through the deployed contracts.

Live demo:
- [Frontend](https://vasmo.netlify.app/)

## Submission checklist

- Smart contracts are deployed on Mantle Sepolia
- Smart contracts are verified on Mantle Explorer
- At least one AI-powered function is callable on-chain through the agent and AgentRouter flow
- Frontend is publicly accessible
- Deployment addresses are included below and in the deployment manifest
- Demo video should be at least 2 minutes and walk through the core use case
- README documents setup, architecture, and deployed addresses

## What vasmo does

1. User connects a wallet on Mantle Sepolia.
2. User mints an invoice NFT.
3. User deposits or manages the invoice in the yield vault flow.
4. The AI agent monitors invoices and can execute strategy changes on-chain.
5. The frontend shows portfolio, agent activity, invoice detail pages, and chain status.

## Architecture

- `app/` - Next.js frontend for minting, portfolio, issuer controls, and agent monitoring
- `agent/` - TypeScript WebSocket service that analyzes invoice state and executes actions
- `contracts/` - Hardhat workspace with the Mantle Sepolia smart contracts and verification scripts
- `contracts/deployments/mantleSepolia.json` - canonical live deployment manifest

## Deployed contracts on Mantle Sepolia

Chain ID: `5003`

| Contract | Address | Status |
| --- | --- | --- |
| InvoiceNFT | `0x018ee8F363421016177DbC8F9492fe2a1C720e29` | Verified |
| YieldVault | `0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6` | Verified |
| AgentRouter | `0x4430248F3b2304F946f08c43A06C3451657FD658` | Verified |
| PrivacyRegistry | `0x2DA4B52913A928263a405dE3b42a5768a4dCa3b0` | Verified |
| PythOracle | `0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3` | Verified |
| AaveV3YieldSource | `0x5a179d261fD322ecaED06FA9Aa2973980D74322c` | Verified |

Deployment manifest:
- [`contracts/deployments/mantleSepolia.json`](C:/Users/jwavo/vasmo/contracts/deployments/mantleSepolia.json)

Explorer:
- [Mantle Sepolia Explorer](https://explorer.sepolia.mantle.xyz)

## Setup

### Prerequisites

- Node.js 18+
- pnpm
- MetaMask or another wallet connected to Mantle Sepolia

### Local development

```bash
pnpm install
pnpm dev
```

This starts the app and agent in parallel from the workspace root.

### Frontend

```bash
cd app
pnpm dev
```

### Agent

```bash
cd agent
pnpm dev
```

### Contracts

```bash
cd contracts
npm run build
npm test
npm run verify:mantle-sepolia
```

## Docker deployment

- [`Dockerfile.mcp`](C:/Users/jwavo/vasmo/Dockerfile.mcp) builds the agent image
- [`.github/workflows/ci.yml`](C:/Users/jwavo/vasmo/.github/workflows/ci.yml) handles agent tests and Docker deployment

Local build:

```bash
pnpm run docker:build:agent
```

## Network configuration

- Network: Mantle Sepolia
- Chain ID: `5003`
- Native token symbol: `MNT`
- Frontend health endpoint: `/health`
- Agent health endpoint: `/health`

## AI-powered on-chain function

The AI-powered path is the agent-to-contract flow:

- the agent observes invoice state and market data
- it decides whether to keep or change strategy
- it can write the decision through `AgentRouter`
- the result is recorded on-chain and visible in the frontend

## Notes

- QuickBooks is optional and has a demo fallback if OAuth is not configured
- The frontend is configured for Mantle Sepolia by default
- The repo is organized for public deployment, not localhost-only usage
