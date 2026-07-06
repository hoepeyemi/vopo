// MemoriVault Agent Service Entry Point

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { VasmoAgent } from './agent.js';
import { ContractAddresses } from './blockchain.js';

// Environment validation
interface EnvValidation {
  name: string;
  value: string | undefined;
  required: boolean;
  description: string;
}

function validateEnvironment(addresses: ContractAddresses): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  const envVars: EnvValidation[] = [
    { name: 'MANTLE_RPC_URL', value: process.env.RPC_URL || process.env.CHAIN_RPC_URL || process.env.MANTLE_RPC_URL, required: false, description: 'RPC endpoint' },
    { name: 'AGENT_PRIVATE_KEY', value: process.env.AGENT_PRIVATE_KEY, required: false, description: 'Agent wallet key' },
    { name: 'QWEN_API_KEY', value: process.env.QWEN_API_KEY, required: false, description: 'Qwen Cloud API key' },
    { name: 'WS_PORT', value: process.env.WS_PORT, required: false, description: 'WebSocket port' },
    { name: 'INVOICE_NFT_ADDRESS', value: addresses.invoiceNFT, required: true, description: 'InvoiceNFT contract' },
    { name: 'YIELD_VAULT_ADDRESS', value: addresses.yieldVault, required: true, description: 'YieldVault contract' },
    { name: 'AGENT_ROUTER_ADDRESS', value: addresses.agentRouter, required: true, description: 'AgentRouter contract' },
    { name: 'MOCK_ORACLE_ADDRESS', value: process.env.MOCK_ORACLE_ADDRESS || process.env.PYTH_ORACLE_ADDRESS, required: false, description: 'Oracle contract (MockOracle or PythOracle)' },
  ];

  const zeroAddress = '0x0000000000000000000000000000000000000000';

  for (const env of envVars) {
    if (env.required) {
      if (!env.value || env.value === zeroAddress) {
        errors.push(`${env.name} (${env.description}) is required but not set`);
      }
    } else if (!env.value) {
      warnings.push(`${env.name} (${env.description}) not set, using defaults`);
    }
  }

  // Validate RPC URL format
  const rpcUrl = process.env.RPC_URL || process.env.CHAIN_RPC_URL || process.env.MANTLE_RPC_URL || 'http://127.0.0.1:8545';
  if (!rpcUrl.startsWith('http://') && !rpcUrl.startsWith('https://')) {
    errors.push('RPC_URL must be a valid HTTP(S) URL');
  }

  // Validate private key format if provided
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (privateKey && !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    warnings.push('AGENT_PRIVATE_KEY must be a 32-byte hex private key (0x + 64 hex chars)');
  }

  // Validate port number
  const wsPort = parseInt(process.env.WS_PORT || '8080');
  if (isNaN(wsPort) || wsPort < 1 || wsPort > 65535) {
    errors.push('WS_PORT must be a valid port number (1-65535)');
  }

  return { valid: errors.length === 0, warnings, errors };
}

function readDeploymentDefaults(networkName: string): Partial<ContractAddresses> {
  const candidates = [
    path.resolve(process.cwd(), 'contracts/deployments', `${networkName}.json`),
    path.resolve(process.cwd(), '..', 'contracts/deployments', `${networkName}.json`),
  ];

  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<ContractAddresses>;
  } catch {
    return {};
  }
}

function uniqueUrls(urls: Array<string | undefined>): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

function normalizePrivateKey(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return /^0x[0-9a-fA-F]{64}$/.test(value) ? value : undefined;
}

const MANTLE_SEPOLIA_RPC_FALLBACKS = uniqueUrls([
  process.env.RPC_URL,
  process.env.CHAIN_RPC_URL,
  process.env.MANTLE_RPC_URL,
  process.env.MANTLE_SEPOLIA_RPC,
  process.env.MANTLE_SEPOLIA_RPC_SELECTED,
  process.env.MANTLE_SEPOLIA_RPC_FALLBACK_1,
  process.env.MANTLE_SEPOLIA_RPC_FALLBACK_2,
  'https://rpc.sepolia.mantle.xyz',
  'https://mantle-sepolia.drpc.org',
  'https://5003.rpc.thirdweb.com/',
]);

async function selectWorkingRpcUrl(urls: string[]): Promise<string> {
  const timeoutMs = 5000;

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_chainId',
          params: [],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const json = await response.json().catch(() => null);
        if (json?.result) {
          return url;
        }
      }
    } catch {
      // Try the next fallback.
    }
  }

  return urls[0] || 'http://127.0.0.1:8545';
}

// Load configuration from environment
const PRIVATE_KEY = normalizePrivateKey(process.env.AGENT_PRIVATE_KEY);
const QWEN_API_KEY = process.env.QWEN_API_KEY;
const WS_PORT = parseInt(process.env.WS_PORT || '8080');
const DEPLOYMENT_NETWORK = process.env.DEPLOYMENT_NETWORK || 'mantleSepolia';
const DEPLOYMENT_DEFAULTS = readDeploymentDefaults(DEPLOYMENT_NETWORK);

// Contract addresses (update after deployment)
const ADDRESSES: ContractAddresses = {
  invoiceNFT: process.env.INVOICE_NFT_ADDRESS || DEPLOYMENT_DEFAULTS.invoiceNFT || '0x0000000000000000000000000000000000000000',
  yieldVault: process.env.YIELD_VAULT_ADDRESS || DEPLOYMENT_DEFAULTS.yieldVault || '0x0000000000000000000000000000000000000000',
  agentRouter: process.env.AGENT_ROUTER_ADDRESS || DEPLOYMENT_DEFAULTS.agentRouter || '0x0000000000000000000000000000000000000000',
  // Oracle: Pyth for production, MockOracle for local dev
  mockOracle: process.env.MOCK_ORACLE_ADDRESS,
  pythOracle: process.env.PYTH_ORACLE_ADDRESS || DEPLOYMENT_DEFAULTS.pythOracle,
  // Yield source: Aave V3 for real DeFi yields
  aaveYieldSource: process.env.AAVE_YIELD_ADDRESS || DEPLOYMENT_DEFAULTS.aaveYieldSource,
};

// Check if using production data sources
const isProduction = !!ADDRESSES.pythOracle || !!ADDRESSES.aaveYieldSource;

async function main() {
  const RPC_URL = await selectWorkingRpcUrl(MANTLE_SEPOLIA_RPC_FALLBACKS);

  console.log('');
  console.log('  ███████╗ █████╗ ██╗  ██╗████████╗ ██████╗ ██████╗ ██╗   ██╗');
  console.log('  ██╔════╝██╔══██╗██║ ██╔╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝');
  console.log('  █████╗  ███████║█████╔╝    ██║   ██║   ██║██████╔╝ ╚████╔╝ ');
  console.log('  ██╔══╝  ██╔══██║██╔═██╗    ██║   ██║   ██║██╔══██╗  ╚██╔╝  ');
  console.log('  ██║     ██║  ██║██║  ██╗   ██║   ╚██████╔╝██║  ██║   ██║   ');
  console.log('  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ');
  console.log('');

  // Validate environment before starting
  const validation = validateEnvironment(ADDRESSES);

  if (validation.warnings.length > 0) {
    console.log('⚠️  Environment Warnings:');
    validation.warnings.forEach((w) => console.log(`   - ${w}`));
    console.log('');
  }

  if (!validation.valid) {
    console.error('❌ Environment Validation Failed:');
    validation.errors.forEach((e) => console.error(`   - ${e}`));
    console.error('');
    console.error('Please configure the required environment variables.');
    console.error('See .env.example for reference.');
    process.exit(1);
  }
  console.log('  x402 AI-Managed B2B Payments');
  console.log('');
  console.log('='.repeat(60));
  console.log(`  📡 RPC: ${RPC_URL}`);
  console.log(`  🔌 WebSocket: ws://localhost:${WS_PORT}`);
  console.log(`  🔑 Wallet: ${PRIVATE_KEY ? '✅ Configured' : '❌ Read-only mode'}`);
  console.log(`  🤖 LLM: ${QWEN_API_KEY ? '✅ Qwen Cloud (AI)' : '⚡ Template fallback'}`);
  console.log(`  🧠 Memory: L1 (in-process)${process.env.REDIS_URL ? ' + Redis' : ''} | L2 file-backed${process.env.DATABASE_URL ? ' + pgvector' : ''} | L3 rules`);
  console.log('='.repeat(60));
  console.log('');
  console.log('  Data Sources:');
  console.log(`  📊 Oracle: ${ADDRESSES.pythOracle ? '✅ Pyth Network (Real-time)' : '⚠️  Mock Oracle (Simulated)'}`);
  console.log(`  💰 Yield: ${ADDRESSES.aaveYieldSource ? '✅ Aave V3 (Real DeFi)' : '⚠️  Simulated Yield'}`);
  if (!isProduction) {
    console.log('');
    console.log('  ⚠️  Running with SIMULATED data for demo.');
    console.log('  Set PYTH_ORACLE_ADDRESS and AAVE_YIELD_ADDRESS for production.');
  }
  console.log('='.repeat(60));

  // Validate contract addresses
  const zeroAddress = '0x0000000000000000000000000000000000000000';
  if (ADDRESSES.invoiceNFT === zeroAddress) {
    console.warn('\n⚠️  Contract addresses not configured.');
    console.log('   Set environment variables after deployment.\n');
  }

  // Create agent instance
  const agent = new VasmoAgent(RPC_URL, ADDRESSES, {
    privateKey: PRIVATE_KEY,
    qwenApiKey: QWEN_API_KEY,
    wsPort: WS_PORT,
    config: {
      minConfidence: 70,
      analysisInterval: 30000, // 30 seconds
      maxConcurrentAnalyses: 5,
      autoExecute: !!PRIVATE_KEY, // Only auto-execute if we have a key
    },
  });

  // Start the agent
  await agent.start();

  // Health check is now built into WebSocket server (same port)
  console.log(`  🏥 Health: http://localhost:${WS_PORT}/health`);

  // Handle graceful shutdown — await memory flush so no writes are lost.
  // A 5-second hard timeout ensures the process always exits even if a write
  // hangs (e.g. NFS mount unresponsive).
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 ${signal} received — flushing memory and shutting down...`);
    const hardExit = setTimeout(() => {
      console.error('⚠️  Graceful shutdown timed out after 5 s — forcing exit');
      process.exit(1);
    }, 5000);
    hardExit.unref(); // don't let the timer itself keep the process alive
    await agent.stop();
    clearTimeout(hardExit);
    process.exit(0);
  };

  process.on('SIGINT',  () => { shutdown('SIGINT').catch(console.error); });
  process.on('SIGTERM', () => { shutdown('SIGTERM').catch(console.error); });

  // Keep process alive
  console.log('\n✅ MemoriVault Agent is live. Press Ctrl+C to stop.\n');
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
