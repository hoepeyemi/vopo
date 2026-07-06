# vasmo Contracts

Hardhat workspace for the vasmo protocol contracts on Mantle Sepolia.

## What is deployed

The live deployment is on Mantle Sepolia and the deployed addresses are recorded in:

- [`contracts/deployments/mantleSepolia.json`](C:/Users/jwavo/vasmo/contracts/deployments/mantleSepolia.json)

## Deployed and verified contracts

Chain ID: `5003`

| Contract | Address | Explorer status |
| --- | --- | --- |
| InvoiceNFT | `0x76799a06A64f0b1C24Dd688348c6c2D2B215b173` | Verified |
| YieldVault | `0xEfcae7a8c221956D1B3aff5bCDB0267e4aD6646A` | Verified |
| AgentRouter | `0x38cf9B34d8Ca1d041FfB876Bf73f8DE2Cb119E01` | Verified |
| PrivacyRegistry | `0x1941dF807C71A5261468de9dBDA9ceF626e635d3` | Verified |
| PythOracle | `0xD793Bb98C1B0b94E5392370d031ED76DeDeAcDd1` | Verified |
| AaveV3YieldSource | `0x413FbA572293494972636975BEe37477dB405652` | Verified |

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

