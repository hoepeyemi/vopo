import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  // Only use static export + basePath for GitHub Pages deployment
  ...(isGitHubPages ? {
    output: "export",
    basePath: "/vopo",
  } : {
    output: "standalone",
  }),
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  webpack(config) {
    // @wagmi/core's tempo connector does `import('accounts')` with a
    // turbopackOptional comment that webpack doesn't understand.
    // Stub it so webpack doesn't fail on the missing package.
    config.resolve.alias = {
      ...config.resolve.alias,
      accounts: false,
    };
    return config;
  },
};

export default nextConfig;
