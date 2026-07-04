"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useChainId } from "wagmi"
import { ArrowLeft, ExternalLink, Shield, CircleAlert, Loader2 } from "lucide-react"
import { parseUnits } from "viem"
import { toast } from "sonner"
import { useInvoice } from "@/hooks/use-invoice-nft"
import { useDeposit, useDepositToVault } from "@/hooks/use-yield-vault"
import { getInvoiceNFTAddress } from "@/lib/contracts/addresses"
import { TerminalNav } from "@/components/terminal-nav"
import { StatusBar } from "@/components/ui/status-bar"
import { Button } from "@/components/ui/button"
import { InvoiceDepositForm } from "@/features/portfolio/components/InvoiceDepositForm"

function formatDate(value: Date | undefined) {
  return value ? value.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "Unknown"
}

function InvoiceDetailContent() {
  const params = useParams<{ tokenId: string }>()
  const chainId = useChainId()
  const contractAddress = getInvoiceNFTAddress(chainId)
  const [showDeposit, setShowDeposit] = useState(false)
  const [pendingDeposit, setPendingDeposit] = useState<{ principal: string; strategy: number } | null>(null)
  const tokenId = useMemo(() => {
    const raw = params?.tokenId
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) ? parsed : undefined
  }, [params?.tokenId])

  const { invoice, isLoading, error } = useInvoice(tokenId)
  const { deposit, refetch: refetchDeposit } = useDeposit(tokenId)
  const {
    approve,
    deposit: depositToVault,
    isApproving,
    isApproveConfirming,
    isApproveSuccess,
    isDepositing,
    isDepositConfirming,
    isDepositSuccess,
    resetApprove,
  } = useDepositToVault()

  useEffect(() => {
    if (!isApproveSuccess || !pendingDeposit || tokenId === undefined) {
      return
    }

    depositToVault({
      tokenId: BigInt(tokenId),
      strategy: pendingDeposit.strategy as 0 | 1 | 2,
      principal: parseUnits(pendingDeposit.principal, 18),
    })
    setPendingDeposit(null)
  }, [isApproveSuccess, pendingDeposit, depositToVault, tokenId])

  useEffect(() => {
    if (isDepositSuccess) {
      toast.success("Invoice deposited for yield", {
        description: "The invoice is now active in the yield vault.",
      })
      setShowDeposit(false)
      setPendingDeposit(null)
      resetApprove()
      refetchDeposit()
    }
  }, [isDepositSuccess, resetApprove, refetchDeposit])

  const handleDeposit = (principal: string, selectedStrategy: number) => {
    if (tokenId === undefined) return

    setPendingDeposit({ principal, strategy: selectedStrategy })
    approve(BigInt(tokenId))
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] bg-grid noise-overlay scan-line pb-8">
      <TerminalNav />

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/dashboard">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4" />
              back to portfolio
            </Button>
          </Link>
          <div className="text-[11px] uppercase tracking-[0.25em] text-[#666666]">
            invoice detail
          </div>
        </div>

        <div className="terminal-card p-6 md:p-8">
          {isLoading ? (
            <div className="text-sm text-[#666666]">loading invoice...</div>
          ) : error || !invoice ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#ef4444]">
                <CircleAlert className="w-4 h-4" />
                <h1 className="text-lg font-bold">Invoice not found</h1>
              </div>
              <p className="text-sm text-[#666666]">
                Token #{tokenId ?? "unknown"} is not available on the connected chain yet. If you just minted it, wait for confirmation and refresh the page.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard/mint">
                  <Button>
                    mint another invoice
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="secondary">
                    view portfolio
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.25em] text-[#666666] mb-2">
                    vasmo invoice #{tokenId}
                  </div>
                  <h1 className="text-2xl font-bold text-[#10b981]">
                    {deposit?.active ? "Earning Yield" : invoice.statusLabel}
                  </h1>
                  <p className="text-sm text-[#666666] mt-2">
                    Privacy-preserving invoice commitment stored on Mantle Sepolia.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded border border-[#10b981]/20 bg-[#10b981]/10 px-4 py-2 text-sm">
                  <Shield className="w-4 h-4 text-[#10b981]" />
                  <span className="text-[#d7fff1]">chain secured</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#1f1f1f] bg-[#111111] p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[#666666] mb-2">commitments</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-[#666666]">data</span>
                      <span className="font-mono text-right break-all">{invoice.dataCommitment}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#666666]">amount</span>
                      <span className="font-mono text-right break-all">{invoice.amountCommitment}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[#1f1f1f] bg-[#111111] p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[#666666] mb-2">timeline</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-[#666666]">due date</span>
                      <span>{formatDate(invoice.dueDate)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#666666]">created</span>
                      <span>{formatDate(invoice.createdAt)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#666666]">issuer</span>
                      <span className="font-mono text-right break-all">{invoice.issuer}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#1f1f1f] bg-[#111111] p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#666666] mb-3">risk profile</div>
                <div className="grid gap-4 sm:grid-cols-3 text-sm">
                  <div>
                    <div className="text-[#666666]">risk score</div>
                    <div className="mt-1 text-lg font-bold">{invoice.riskScore}/100</div>
                  </div>
                  <div>
                    <div className="text-[#666666]">payment probability</div>
                    <div className="mt-1 text-lg font-bold">{invoice.paymentProbability}/100</div>
                  </div>
                  <div>
                    <div className="text-[#666666]">owner</div>
                    <div className="mt-1 font-mono break-all">{invoice.owner ?? "unavailable"}</div>
                  </div>
                </div>
              </div>

              {!deposit?.active && invoice.status === 0 && (
                <div className="rounded-lg border border-[#1f1f1f] bg-[#111111] p-4 space-y-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[#666666] mb-1">yield</div>
                    <div className="text-sm text-[#d6d6d6]">
                      This invoice is minted and ready to deposit into the yield vault.
                    </div>
                  </div>

                  {showDeposit ? (
                    <InvoiceDepositForm
                      tokenId={String(tokenId)}
                      isApproving={isApproving}
                      isApproveConfirming={isApproveConfirming}
                      isDepositing={isDepositing}
                      isDepositConfirming={isDepositConfirming}
                      onDeposit={handleDeposit}
                      onCancel={() => setShowDeposit(false)}
                    />
                  ) : (
                    <Button onClick={() => setShowDeposit(true)}>
                      start earning yield
                      {(isApproving || isApproveConfirming || isDepositing || isDepositConfirming) && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                    </Button>
                  )}
                </div>
              )}

              {deposit?.active && (
                <div className="rounded-lg border border-[#10b981]/20 bg-[#10b981]/10 p-4 text-sm">
                  <div className="text-[#10b981] font-semibold mb-2">earning yield</div>
                  <div className="grid gap-2 sm:grid-cols-2 text-[#d6d6d6]">
                    <div>strategy: {deposit.strategyLabel}</div>
                    <div>principal: ${Number(deposit.principal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div>accrued yield: ${Number(deposit.accruedYield).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div>deposited: {formatDate(deposit.depositTime)}</div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Link href={`/dashboard/mint?invoice=${tokenId}`}>
                  <Button>
                    mint another
                  </Button>
                </Link>
                <a
                  href={`https://explorer.mantle.xyz/address/${contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded border border-[#1f1f1f] px-4 py-2 text-sm text-[#d6d6d6] hover:border-[#10b981]/40 hover:text-white transition-colors"
                >
                  explorer
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </div>
      </main>

      <StatusBar status="online" network="MANTLE SEPOLIA" />
    </div>
  )
}

export default function InvoiceDetailPage() {
  return <InvoiceDetailContent />
}
