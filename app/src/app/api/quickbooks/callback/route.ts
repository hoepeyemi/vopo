import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens } from "@/lib/quickbooks"
import { isQuickBooksConfigured } from "@/lib/quickbooks-demo"
import { storeQuickBooksTokens } from "@/lib/quickbooks-session"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const realmId = searchParams.get("realmId") || searchParams.get("realm_id")
  const state = searchParams.get("state")
  const stateCookie = request.cookies.get("quickbooks_oauth_state")?.value

  if (!isQuickBooksConfigured()) {
    return NextResponse.redirect(new URL("/dashboard/mint?quickbooks=demo", appUrl))
  }

  if (!code || !realmId) {
    return NextResponse.redirect(new URL("/dashboard/mint?error=quickbooks_auth_failed", appUrl))
  }

  if (stateCookie && state && stateCookie !== state) {
    return NextResponse.redirect(new URL("/dashboard/mint?error=quickbooks_auth_failed", appUrl))
  }

  try {
    const tokens = await exchangeCodeForTokens(code, realmId)
    storeQuickBooksTokens(tokens)

    const response = NextResponse.redirect(new URL("/dashboard/mint?quickbooks=success", appUrl))
    response.cookies.delete("quickbooks_oauth_state")
    return response
  } catch {
    return NextResponse.redirect(new URL("/dashboard/mint?error=quickbooks_auth_failed", appUrl))
  }
}

