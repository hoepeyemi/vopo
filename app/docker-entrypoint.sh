#!/bin/sh
# Replaces build-time placeholder strings in the Next.js bundle with the actual
# runtime values from the container's env (sourced from .env.app on the server).
# This lets all NEXT_PUBLIC_* vars live solely on the server — no GitHub secrets.
set -e

CHUNK_DIR="/app/.next/static/chunks"

replace() {
  local placeholder="$1"
  local value="$2"
  if [ -n "$value" ]; then
    find "$CHUNK_DIR" -name "*.js" -exec sed -i "s|${placeholder}|${value}|g" {} +
  fi
}

replace "__VOPO_AGENT_WS_URL__"    "${NEXT_PUBLIC_AGENT_WS_URL}"
replace "__VOPO_APP_URL__"         "${NEXT_PUBLIC_APP_URL}"
replace "__VOPO_WC_PROJECT_ID__"   "${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID}"
replace "__VOPO_MANTLE_RPC__"      "${NEXT_PUBLIC_MANTLE_SEPOLIA_RPC}"
replace "__VOPO_MANTLE_RPC_SEL__"  "${NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_SELECTED}"
replace "__VOPO_MANTLE_RPC_FB1__"  "${NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_FALLBACK_1}"
replace "__VOPO_MANTLE_RPC_FB2__"  "${NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_FALLBACK_2}"

exec node server.js
