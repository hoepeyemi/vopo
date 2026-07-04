const fs = require("fs");
const path = require("path");

const TIMEOUT_MS = 4000;
const CHAIN_ID = "0x138b";
const OUT_FILE = path.join(__dirname, "..", ".env.local");

const CANDIDATES = [
  process.env.MANTLE_SEPOLIA_RPC,
  process.env.MANTLE_SEPOLIA_RPC_SELECTED,
  process.env.MANTLE_SEPOLIA_RPC_FALLBACK_1,
  process.env.MANTLE_SEPOLIA_RPC_FALLBACK_2,
  "https://rpc.sepolia.mantle.xyz",
  "https://mantle-sepolia.drpc.org",
  "https://5003.rpc.thirdweb.com/",
  "https://mantle-sepolia.gateway.tenderly.co",
  "https://testnet-rpc.etherspot.io/v1/5003",
].filter(Boolean);

async function probeRpc(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return false;
    }

    const json = await response.json().catch(() => null);
    if (!json || typeof json.result !== "string") {
      return false;
    }

    return json.result.toLowerCase() === CHAIN_ID;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  for (const url of CANDIDATES) {
    if (await probeRpc(url)) {
      fs.writeFileSync(OUT_FILE, `MANTLE_SEPOLIA_RPC_SELECTED=${url}\n`, "utf8");
      console.log(`Selected Mantle Sepolia RPC: ${url}`);
      return;
    }
  }

  throw new Error(
    [
      "Could not reach any Mantle Sepolia RPC endpoint.",
      "Try setting MANTLE_SEPOLIA_RPC manually to a working public/private RPC.",
    ].join(" ")
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
