# vasmo Frontend

Next.js frontend for vasmo, built for Mantle Sepolia and ready for public deployment.

## What this app does

- Mints invoice NFTs
- Shows portfolio and invoice detail pages
- Connects to the AI agent over WebSocket
- Supports issuer and privacy controls
- Displays deployed Mantle Sepolia addresses

## Public deployment

The frontend is configured to be publicly accessible and not localhost-only.

- Live demo: [https://vasno.netlify.app/](https://vasno.netlify.app/)
- Health endpoint: `/health`

Set the public URL in production with `NEXT_PUBLIC_APP_URL`.

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment variables

Required for the live Mantle Sepolia app:

```bash
NEXT_PUBLIC_CHAIN_ID=5003
NEXT_PUBLIC_NETWORK_MODE=testnet
NEXT_PUBLIC_INVOICE_NFT_ADDRESS=0x76799a06A64f0b1C24Dd688348c6c2D2B215b173
NEXT_PUBLIC_YIELD_VAULT_ADDRESS=0xEfcae7a8c221956D1B3aff5bCDB0267e4aD6646A
NEXT_PUBLIC_AGENT_ROUTER_ADDRESS=0x38cf9B34d8Ca1d041FfB876Bf73f8DE2Cb119E01
NEXT_PUBLIC_PRIVACY_REGISTRY_ADDRESS=0x1941dF807C71A5261468de9dBDA9ceF626e635d3
NEXT_PUBLIC_MOCK_ORACLE_ADDRESS=
NEXT_PUBLIC_AGENT_WS_URL=wss://your-public-agent-domain
NEXT_PUBLIC_APP_URL=https://your-public-web-domain
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id
NEXT_PUBLIC_MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_FALLBACK_1=https://mantle-sepolia.drpc.org
NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_FALLBACK_2=https://5003.rpc.thirdweb.com/
```

Mantle Sepolia RPC fallbacks:

```bash
NEXT_PUBLIC_MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_FALLBACK_1=https://mantle-sepolia.drpc.org
NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_FALLBACK_2=https://5003.rpc.thirdweb.com/
```

## Build and scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm tsc
```

## Notes

- QuickBooks uses a demo fallback when OAuth is not configured.
- The app is designed around the live Mantle Sepolia deployment manifest in `contracts/deployments/mantleSepolia.json`.
- If you change contract addresses, update the deployment manifest and the public env values together.
