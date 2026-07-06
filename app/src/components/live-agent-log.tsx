'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { AgentLogEntry } from '@/hooks/use-agent-websocket'

interface LogEntry {
  id: number
  time: string
  message: string
  type: 'info' | 'success' | 'warning' | 'action' | 'memory'
}

const AGENT_MESSAGES = [
  { message: 'checking aave v3 supply rates...', type: 'info' as const },
  { message: 'USDC APY: 4.25% (stable)', type: 'success' as const },
  { message: 'monitoring active deposits...', type: 'info' as const },
  { message: 'pyth price feed healthy', type: 'success' as const },
  { message: 'scanning for yield opportunities...', type: 'info' as const },
  { message: 'vault strategy: conservative mode', type: 'info' as const },
  { message: 'rebalance check: no action needed', type: 'success' as const },
  { message: 'fetching MNT/USD from pyth...', type: 'info' as const },
  { message: 'MNT price: $0.082 (+0.5%)', type: 'success' as const },
  { message: 'risk assessment: LOW', type: 'success' as const },
  { message: 'next rebalance window: 4h', type: 'info' as const },
  { message: 'aggressive pool APY: 7.1%', type: 'success' as const },
  { message: 'liquidity depth: sufficient', type: 'success' as const },
  { message: 'gas price: 5000 gwei (optimal)', type: 'info' as const },
  { message: 'heartbeat: all systems nominal', type: 'success' as const },
]

interface LiveAgentLogProps {
  maxEntries?: number
  className?: string
  compact?: boolean
  liveEntries?: AgentLogEntry[]
}

export function LiveAgentLog({
  maxEntries = 6,
  className,
  compact = false,
  liveEntries,
}: LiveAgentLogProps) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [messageIndex, setMessageIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const isLive = liveEntries !== undefined

  // When real WS entries are provided, use them directly
  useEffect(() => {
    if (!isLive) return
    const mapped: LogEntry[] = liveEntries.slice(-maxEntries).map(e => ({
      id: e.id,
      time: e.time,
      message: e.message,
      type: e.entryType,
    }))
    setEntries(mapped)
  }, [liveEntries, maxEntries, isLive])

  // Generate initial simulated entries (only when no live feed)
  useEffect(() => {
    if (isLive) return
    const now = new Date()
    const initialEntries: LogEntry[] = []

    for (let i = 0; i < 3; i++) {
      const msg = AGENT_MESSAGES[(messageIndex + i) % AGENT_MESSAGES.length]
      const time = new Date(now.getTime() - (3 - i) * 4000)
      initialEntries.push({
        id: i,
        time: formatTime(time),
        message: msg.message,
        type: msg.type,
      })
    }

    setEntries(initialEntries)
    setMessageIndex(3)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Simulated ticker (only when no live feed)
  useEffect(() => {
    if (isLive) return
    const interval = setInterval(() => {
      const msg = AGENT_MESSAGES[messageIndex % AGENT_MESSAGES.length]

      setEntries(prev => {
        const newEntry: LogEntry = {
          id: Date.now(),
          time: formatTime(new Date()),
          message: msg.message,
          type: msg.type,
        }

        const updated = [...prev, newEntry]
        return updated.slice(-maxEntries)
      })

      setMessageIndex(prev => prev + 1)
    }, 3500 + Math.random() * 2000)

    return () => clearInterval(interval)
  }, [messageIndex, maxEntries, isLive])

  return (
    <div
      ref={containerRef}
      className={cn('space-y-0', className)}
    >
      {entries.map((entry, index) => (
        <div
          key={entry.id}
          className={cn(
            'flex items-start gap-3 py-2 border-b border-[#1f1f1f] last:border-b-0',
            'log-entry-animate',
            index === entries.length - 1 && 'animate-fade-in'
          )}
        >
          <span className="text-[#444444] select-none">&gt;</span>
          <span className={cn(
            'text-[#666666] tabular-nums shrink-0',
            compact ? 'w-16' : 'w-20'
          )}>
            {entry.time}
          </span>
          <span className={cn(
            'flex-1',
            entry.type === 'success' && 'text-[#10b981]',
            entry.type === 'warning' && 'text-[#f59e0b]',
            entry.type === 'action' && 'text-[#8b5cf6]',
            entry.type === 'memory' && 'text-[#60a5fa]',
            entry.type === 'info' && 'text-[#e5e5e5]'
          )}>
            {entry.message}
          </span>
        </div>
      ))}
    </div>
  )
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
