const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const CHAIN_ID = 5003;
const API_URL = "https://api.etherscan.io/v2/api";
const MANTLE_SEPOLIA_PYTH_ADDRESS = "0x98046Bd286715D3B0BC227Dd7a956b83D8978603";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, "..", ".env"));
loadEnvFile(path.join(__dirname, "..", ".env.local"));
loadEnvFile(path.join(__dirname, "..", "..", ".env"));

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || process.env.MANTLESCAN_API_KEY;
if (!ETHERSCAN_API_KEY) {
  throw new Error("Set ETHERSCAN_API_KEY or MANTLESCAN_API_KEY in contracts/.env before running verification.");
}

const deploymentPath = path.join(__dirname, "..", "deployments", "mantleSepolia.json");
const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

const rpcUrls = [
  process.env.MANTLE_SEPOLIA_RPC,
  process.env.MANTLE_SEPOLIA_RPC_SELECTED,
  process.env.MANTLE_SEPOLIA_RPC_FALLBACK_1,
  process.env.MANTLE_SEPOLIA_RPC_FALLBACK_2,
  "https://rpc.sepolia.mantle.xyz",
  "https://mantle-sepolia.drpc.org",
  "https://5003.rpc.thirdweb.com/",
].filter(Boolean);

if (rpcUrls.length === 0) {
  throw new Error("No Mantle Sepolia RPC URL configured.");
}

const provider = new ethers.JsonRpcProvider(rpcUrls[0], CHAIN_ID);
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

function readArtifact(relativePath) {
  const artifactPath = path.join(__dirname, "..", "artifacts", relativePath);
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

function findBuildInfoFor(sourceName, contractName) {
  const buildInfoDir = path.join(__dirname, "..", "artifacts", "build-info");
  const files = fs.existsSync(buildInfoDir)
    ? fs.readdirSync(buildInfoDir).filter((file) => file.endsWith(".json"))
    : [];

  for (const file of files) {
    const buildInfo = JSON.parse(fs.readFileSync(path.join(buildInfoDir, file), "utf8"));
    if (buildInfo?.input && buildInfo?.output?.contracts?.[sourceName]?.[contractName]) {
      return buildInfo;
    }
  }

  throw new Error(`Could not find build-info for ${sourceName}:${contractName}`);
}

function normalizeHex(value) {
  return value.startsWith("0x") ? value : `0x${value}`;
}

async function getLiveConstructorArgs(address, contractAbi, selectorFns) {
  const contract = new ethers.Contract(address, contractAbi, provider);
  const values = [];
  for (const fn of selectorFns) {
    values.push(await contract[fn]());
  }
  return values;
}

async function getVerificationState(address) {
  const url = new URL(API_URL);
  url.searchParams.set("chainid", String(CHAIN_ID));
  url.searchParams.set("module", "contract");
  url.searchParams.set("action", "getsourcecode");
  url.searchParams.set("address", address);
  url.searchParams.set("apikey", ETHERSCAN_API_KEY);

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`getsourcecode request failed for ${address}: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const result = Array.isArray(payload.result) ? payload.result[0] : undefined;
  return {
    verified: Boolean(result && result.SourceCode && result.SourceCode.trim()),
    result,
    payload,
  };
}

async function submitVerification(target) {
  const artifact = readArtifact(target.artifactPath);
  const buildInfo = findBuildInfoFor(artifact.sourceName, artifact.contractName);
  const compilerVersion = buildInfo.solcLongVersion.startsWith("v")
    ? buildInfo.solcLongVersion
    : `v${buildInfo.solcLongVersion}`;
  const input = JSON.parse(JSON.stringify(buildInfo.input));
  if (target.legacySourceOverride) {
    input.sources[target.legacySourceOverride.sourcePath] = {
      content: fs.readFileSync(target.legacySourceOverride.filePath, "utf8"),
    };
  }
  const sourceCode = JSON.stringify(input);
  const constructorArgs = target.constructorArgs.length
    ? abiCoder.encode(target.constructorTypes, target.constructorArgs).replace(/^0x/, "")
    : "";

  const body = new URLSearchParams({
    apikey: ETHERSCAN_API_KEY,
    module: "contract",
    action: "verifysourcecode",
    chainid: String(CHAIN_ID),
    contractaddress: target.address,
    sourceCode,
    codeformat: "solidity-standard-json-input",
    contractname: `${artifact.sourceName}:${artifact.contractName}`,
    compilerversion: compilerVersion,
    optimizationUsed: buildInfo.input.settings.optimizer?.enabled ? "1" : "0",
    runs: String(buildInfo.input.settings.optimizer?.runs ?? 0),
    evmVersion: buildInfo.input.settings.evmVersion || "default",
    licenseType: "3",
    constructorArguments: constructorArgs,
  });

  const response = await fetch(`${API_URL}?chainid=${CHAIN_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Verification request failed for ${target.name}: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const guid = payload.result;
  if (!guid || typeof guid !== "string") {
    throw new Error(`Verification submission failed for ${target.name}: ${JSON.stringify(payload)}`);
  }

  return { guid, payload };
}

async function pollVerification(guid, name, address) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const url = new URL(API_URL);
    url.searchParams.set("chainid", String(CHAIN_ID));
    url.searchParams.set("module", "contract");
    url.searchParams.set("action", "checkverifystatus");
    url.searchParams.set("guid", guid);
    url.searchParams.set("apikey", ETHERSCAN_API_KEY);

    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      if (response.status === 403 && address) {
        const state = await getVerificationState(address);
        if (state.verified) {
          return { ok: true, result: "Verified via source lookup fallback", payload: state.payload };
        }
        continue;
      }
      throw new Error(`Status check failed for ${name}: HTTP ${response.status}`);
    }

    const payload = await response.json();
    const status = String(payload.status ?? "");
    const result = String(payload.result ?? "");

    if (status === "1") {
      return { ok: true, result, payload };
    }

    if (/already verified/i.test(result)) {
      return { ok: true, result, payload };
    }

    if (/pending/i.test(result) || /queue/i.test(result)) {
      continue;
    }

    if (status === "0" && result && !/pending/i.test(result)) {
      return { ok: false, result, payload };
    }
  }

  return { ok: false, result: "Timed out waiting for verification status", payload: null };
}

async function verifyContract(target) {
  if (!target.address || target.address === ethers.ZeroAddress) {
    return { name: target.name, status: "skipped", reason: "No address configured" };
  }

  const code = await provider.getCode(target.address);
  if (code === "0x") {
    return { name: target.name, status: "skipped", reason: "No contract code at address" };
  }

  const currentState = await getVerificationState(target.address);
  if (currentState.verified) {
    return { name: target.name, status: "already-verified" };
  }

  const { guid } = await submitVerification(target);
  const finalState = await pollVerification(guid, target.name, target.address);
  if (!finalState.ok) {
    throw new Error(`${target.name} verification failed: ${finalState.result}`);
  }

  return { name: target.name, status: "verified", guid, result: finalState.result };
}

async function main() {
  const pythOracleAbi = [
    "function pyth() view returns (address)",
    "function nativeUsdFeed() view returns (bytes32)",
  ];
  const aaveYieldSourceAbi = ["function pool() view returns (address)"];
  const yieldVaultAbi = ["function invoiceNFT() view returns (address)"];
  const agentRouterAbi = [
    "function invoiceNFT() view returns (address)",
    "function yieldVault() view returns (address)",
  ];

  const targets = [
    {
      name: "InvoiceNFT",
      address: deployment.invoiceNFT,
      artifactPath: path.join("src", "InvoiceNFT.sol", "InvoiceNFT.json"),
      constructorArgs: [],
      constructorTypes: [],
      legacySourceOverride: {
        filePath: path.join(__dirname, "..", "src", "legacy", "InvoiceNFT.sol"),
        sourcePath: "src/InvoiceNFT.sol",
      },
    },
    {
      name: "YieldVault",
      address: deployment.yieldVault,
      artifactPath: path.join("src", "YieldVault.sol", "YieldVault.json"),
      constructorArgs: await getLiveConstructorArgs(deployment.yieldVault, yieldVaultAbi, ["invoiceNFT"]),
      constructorTypes: ["address"],
    },
    {
      name: "AgentRouter",
      address: deployment.agentRouter,
      artifactPath: path.join("src", "AgentRouter.sol", "AgentRouter.json"),
      constructorArgs: await getLiveConstructorArgs(deployment.agentRouter, agentRouterAbi, ["invoiceNFT", "yieldVault"]),
      constructorTypes: ["address", "address"],
    },
    {
      name: "PrivacyRegistry",
      address: deployment.privacyRegistry,
      artifactPath: path.join("src", "PrivacyRegistry.sol", "PrivacyRegistry.json"),
      constructorArgs: [],
      constructorTypes: [],
    },
    {
      name: "PythOracle",
      address: deployment.pythOracle,
      artifactPath: path.join("src", "PythOracle.sol", "PythOracle.json"),
      constructorArgs: await getLiveConstructorArgs(deployment.pythOracle, pythOracleAbi, ["pyth", "nativeUsdFeed"]),
      constructorTypes: ["address", "bytes32"],
    },
    {
      name: "AaveV3YieldSource",
      address: deployment.aaveYieldSource,
      artifactPath: path.join("src", "AaveV3YieldSource.sol", "AaveV3YieldSource.json"),
      constructorArgs: await getLiveConstructorArgs(deployment.aaveYieldSource, aaveYieldSourceAbi, ["pool"]),
      constructorTypes: ["address"],
    },
  ];

  console.log("=== Mantle Sepolia Verification ===");
  console.log("RPC:", rpcUrls[0]);
  console.log("Explorer API:", `${API_URL}?chainid=${CHAIN_ID}`);

  const results = [];
  for (const target of targets) {
    try {
      const result = await verifyContract(target);
      results.push(result);
      if (result.status === "verified") {
        console.log(`✓ ${target.name} verified`);
      } else if (result.status === "already-verified") {
        console.log(`↺ ${target.name} already verified`);
      } else {
        console.log(`- ${target.name} skipped: ${result.reason}`);
      }
    } catch (error) {
      results.push({ name: target.name, status: "failed", reason: error.message });
      console.error(`✗ ${target.name} failed: ${error.message}`);
    }
  }

  const failed = results.filter((item) => item.status === "failed");
  if (failed.length > 0) {
    process.exitCode = 1;
    console.error("\nSome contracts failed verification:");
    for (const item of failed) {
      console.error(`- ${item.name}: ${item.reason}`);
    }
    return;
  }

  console.log("\nVerification pass complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
