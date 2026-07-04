import { NextRequest, NextResponse } from "next/server"
import { getAuthorizationUrl } from "@/lib/quickbooks"
import { isQuickBooksConfigured } from "@/lib/quickbooks-demo"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  if (!isQuickBooksConfigured()) {
    return NextResponse.redirect(new URL("/dashboard/mint?quickbooks=demo", appUrl))
  }

  try {
    const state = crypto.randomUUID()
    const authUrl = getAuthorizationUrl(state)
    const response = NextResponse.redirect(authUrl)
    response.cookies.set("quickbooks_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    })
    return response
  } catch {
    return NextResponse.redirect(new URL("/dashboard/mint?error=quickbooks_auth_failed", appUrl))
  }
}

