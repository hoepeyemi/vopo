# vasmo Contracts

Hardhat workspace for the vasmo protocol contracts on Mantle Sepolia.

## What is deployed

The live deployment is on Mantle Sepolia and the deployed addresses are recorded in:

- [`contracts/deployments/mantleSepolia.json`](C:/Users/jwavo/vasmo/contracts/deployments/mantleSepolia.json)

## Deployed and verified contracts

Chain ID: `5003`

| Contract | Address | Explorer status |
| --- | --- | --- |
| InvoiceNFT | `0x018ee8F363421016177DbC8F9492fe2a1C720e29` | Verified |
| YieldVault | `0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6` | Verified |
| AgentRouter | `0x4430248F3b2304F946f08c43A06C3451657FD658` | Verified |
| PrivacyRegistry | `0x2DA4B52913A928263a405dE3b42a5768a4dCa3b0` | Verified |
| PythOracle | `0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3` | Verified |
| AaveV3YieldSource | `0x5a179d261fD322ecaED06FA9Aa2973980D74322c` | Verified |

Explorer:
- [Mantle Sepolia Explorer](https://explorer.sepolia.mantle.xyz)

## Contract overview

- `InvoiceNFT` - invoice tokenization and privacy commitments
- `YieldVault` - deposit and yield management
- `AgentRouter` - records and executes AI-driven strategy decisions
- `PrivacyRegistry` - selective disclosure registry
- `PythOracle` - Mantle Sepolia oracle integration
- `AaveV3YieldSource` - yield source integration for the deployed flow

## Setup

```bash
cd contracts
npm install
npm run build
npm test
```

## Deployment

### Mantle Sepolia

```bash
npm run deploy:mantle-sepolia
```

This deployment flow uses the built-in Mantle Sepolia RPC fallbacks and the live oracle and yield source defaults.

### Local network

```bash
npm run deploy:local
```

## Verification

The repo includes a programmatic verifier for the live Mantle Sepolia deployment:

```bash
npm run verify:mantle-sepolia
```

Required environment variable:

```bash
ETHERSCAN_API_KEY=your_api_key_here
```

The verifier checks:

- `InvoiceNFT`
- `YieldVault`
- `AgentRouter`
- `PrivacyRegistry`
- `PythOracle`
- `AaveV3YieldSource`

## Architecture

```text
InvoiceNFT -> YieldVault -> AgentRouter
      |             |
   PythOracle   AaveV3YieldSource
```

## Notes

- The live Mantle Sepolia contracts are verified on Mantle Explorer.
- The deployment manifest is the canonical source of truth for the app and agent.
- If you redeploy any contract, update the deployment manifest and the frontend/agent env values together.

