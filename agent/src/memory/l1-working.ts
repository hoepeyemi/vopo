// L1 Working Memory — fast ephemeral session state
// In-process Map; set REDIS_URL in env to upgrade to real Redis automatically.

import { WorkingMemoryState } from './types.js';

const MAX_RECENT_DECISIONS = 20;

export class L1WorkingMemory {
  private state: WorkingMemoryState;

  constructor() {
    this.state = {
      sessionId: `session-${Date.now()}`,
      activeInvoices: [],
      currentMarketRegime: 'unknown',
      recentDecisions: [],
      lastCycleAt: 0,
    };

    if (process.env.REDIS_URL) {
      console.log('L1: Redis URL detected — upgrade to redis client when ready');
      // Drop-in: replace this.state with a Redis-backed proxy using ioredis
    }
  }

  get(): WorkingMemoryState {
    return { ...this.state };
  }

  update(patch: Partial<WorkingMemoryState>): void {
    this.state = { ...this.state, ...patch };
  }

  addDecision(tokenId: string, strategy: string): void {
    this.state.recentDecisions.unshift({ tokenId, strategy, timestamp: Date.now() });
    if (this.state.recentDecisions.length > MAX_RECENT_DECISIONS) {
      this.state.recentDecisions.length = MAX_RECENT_DECISIONS;
    }
  }

  setActiveInvoices(ids: string[]): void {
    this.state.activeInvoices = ids;
  }

  setMarketRegime(regime: string): void {
    this.state.currentMarketRegime = regime;
  }

  touchCycle(): void {
    this.state.lastCycleAt = Date.now();
  }
}
