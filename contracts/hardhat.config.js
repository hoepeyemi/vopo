require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

const fs = require("fs");
const path = require("path");

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

loadEnvFile(path.join(__dirname, ".env"));
loadEnvFile(path.join(__dirname, ".env.local"));
loadEnvFile(path.join(__dirname, "..", ".env"));

const MANTLE_SEPOLIA_RPC_FALLBACKS = [
  process.env.MANTLE_SEPOLIA_RPC,
  process.env.MANTLE_SEPOLIA_RPC_SELECTED,
  process.env.MANTLE_SEPOLIA_RPC_FALLBACK_1,
  process.env.MANTLE_SEPOLIA_RPC_FALLBACK_2,
  "https://rpc.sepolia.mantle.xyz",
  "https://mantle-sepolia.drpc.org",
  "https://5003.rpc.thirdweb.com/",
].filter(Boolean);

const optimizerSettings = {
  optimizer: {
    enabled: true,
    runs: 200,
  },
  evmVersion: "cancun",
  viaIR: true,
};

/** @type import('hardhat/config').HardhatUserConfig */
const PRIVATE_KEY = process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== "your_private_key_here"
  ? [process.env.PRIVATE_KEY]
  : [];

module.exports = {
  solidity: {
    version: "0.8.26",
    settings: optimizerSettings,
  },
  networks: {
    mantleSepolia: {
      url:
        process.env.MANTLE_SEPOLIA_RPC ||
        process.env.MANTLE_SEPOLIA_RPC_SELECTED ||
        MANTLE_SEPOLIA_RPC_FALLBACKS[0] ||
        "https://rpc.sepolia.mantle.xyz",
      chainId: 5003,
      accounts: PRIVATE_KEY,
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 120000,
  },
};
