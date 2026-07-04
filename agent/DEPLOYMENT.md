# vasmo Agent - Production Deployment Guide

## Quick Deploy to Railway (Recommended)

### Step 1: Create Railway Project

1. Go to [Railway.app](https://railway.app/)
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `vasmo` repository
5. Select the `agent` directory as the root path

### Step 2: Configure Environment Variables

Add these environment variables in Railway dashboard:

**Required:**
```
INVOICE_NFT_ADDRESS=0x018ee8F363421016177DbC8F9492fe2a1C720e29
YIELD_VAULT_ADDRESS=0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6
AGENT_ROUTER_ADDRESS=0x4430248F3b2304F946f08c43A06C3451657FD658
PYTH_ORACLE_ADDRESS=0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3
```

**Optional (but recommended):**
```
MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
WS_PORT=8080
NODE_ENV=production
AGENT_PRIVATE_KEY=<your-agent-wallet-private-key>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

### Step 3: Deploy

1. Railway will auto-detect the `railway.toml` configuration
2. Click "Deploy" to start the build
3. Wait for deployment to complete (~2-3 minutes)
4. Note the public URL (will be something like: `vasmo-agent.up.railway.app`)

### Step 4: Update Frontend

Update your frontend `.env` to use the Railway URL:
```
NEXT_PUBLIC_AGENT_WS_URL=wss://vasmo-agent.up.railway.app
```

---

## Alternative: Deploy to Render.com

### Step 1: Create New Web Service

1. Go to [Render.com](https://render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the `vasmo` repository

### Step 2: Configure Service

- **Name:** vasmo-agent
- **Root Directory:** `agent`
- **Environment:** Node
- **Build Command:** `pnpm install && pnpm build`
- **Start Command:** `pnpm start`
- **Plan:** Free

### Step 3: Environment Variables

Add the same environment variables as listed in Railway guide above.

### Step 4: Deploy

Render will automatically deploy and provide a URL like:
`https://vasmo-agent.onrender.com`

---

## Alternative: Docker Deployment

The Docker path now targets the agent service only.

### Build and Run Locally

```bash
# From the repo root
docker build -f Dockerfile.mcp -t vasmo-agent .

# Run container
docker run -p 8080:8080 \
  -e DEPLOYMENT_NETWORK=mantleSepolia \
  -e INVOICE_NFT_ADDRESS=0x018ee8F363421016177DbC8F9492fe2a1C720e29 \
  -e YIELD_VAULT_ADDRESS=0x7f51D3B234E4c20959A1f6e91D3B852EE16c65A6 \
  -e AGENT_ROUTER_ADDRESS=0x4430248F3b2304F946f08c43A06C3451657FD658 \
  -e PYTH_ORACLE_ADDRESS=0x7CfdF0580C87d0c379c4a5cDbC46A036E8AF71E3 \
  -e AAVE_YIELD_ADDRESS=0x5a179d261fD322ecaED06FA9Aa2973980D74322c \
  vasmo-agent
```

The production container now reads the Mantle Sepolia deployment manifest from
[`contracts/deployments/mantleSepolia.json`](/C:/Users/jwavo/vasmo/contracts/deployments/mantleSepolia.json)
so you usually only need to provide RPC and private key overrides in the env file.

### Deploy to Any Cloud

The Docker image can be deployed to:
- Google Cloud Run
- AWS ECS/Fargate
- Azure Container Instances
- DigitalOcean App Platform
- Fly.io
- Any Kubernetes cluster

---

## Testing the Deployment

Once deployed, test the WebSocket connection:

```bash
# Install wscat if needed
npm install -g wscat

# Connect to your deployed service
wscat -c wss://your-agent-url.railway.app

# You should see:
# < {"type":"status","payload":{"status":"connected"}}
```

---

## Troubleshooting

### Connection Issues

- Ensure WebSocket port (8080) is exposed
- Check that the service is running (Railway/Render logs)
- Verify firewall rules allow WebSocket connections

### Environment Variable Issues

- Double-check all contract addresses are correct
- Ensure no trailing spaces in environment values
- Verify RPC URL is accessible from the deployment platform

### Build Failures

- Check that `pnpm` is supported (Railway and Render support it)
- Verify `package.json` and `tsconfig.json` are valid
- Check deployment logs for specific error messages

---

## Next Steps

After deployment:

1. ✅ Update frontend environment variables
2. ✅ Test WebSocket connection from browser
3. ✅ Verify agent receives blockchain data
4. ✅ Test full mint → deposit → agent analysis flow

---

## Cost Estimates

- **Railway Free Tier**: $5 credit/month, ~500 hours
- **Render Free Tier**: 750 hours/month, sleeps after 15min inactivity
- **Docker (Self-hosted)**: Depends on your infrastructure

For hackathon demos, **Railway Free Tier is recommended** (no sleep, persistent connection).
