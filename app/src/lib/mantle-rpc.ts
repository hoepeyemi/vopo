import { fallback, http } from "viem"

function uniqueUrls(urls: Array<string | undefined>): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))]
}

export function getMantleSepoliaRpcUrls(): string[] {
  return uniqueUrls([
    process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC,
    process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_SELECTED,
    process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_FALLBACK_1,
    process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_FALLBACK_2,
    "https://rpc.sepolia.mantle.xyz",
    "https://mantle-sepolia.drpc.org",
    "https://5003.rpc.thirdweb.com/",
  ])
}

export function createMantleSepoliaTransport() {
  const urls = getMantleSepoliaRpcUrls()
  return fallback(urls.map((url) => http(url)))
}
