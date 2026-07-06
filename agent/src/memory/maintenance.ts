// Background memory maintenance — runs hourly
// 1. Apply time-decay to all L2 memories
// 2. Prune memories that have decayed below threshold
// 3. Condense clusters of L2 memories into L3 rules via Qwen-Turbo

import { L2EpisodicMemory } from './l2-episodic.js';
import { L3SemanticMemory } from './l3-semantic.js';
import { CONDENSE_THRESHOLD } from './decay.js';
import { MemoryEvent, MemoryTag } from './types.js';
import type { LLMService } from '../llm.js';

const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const DOMAINS: Array<{ tag: MemoryTag; l3Domain: 'yield' | 'risk' | 'market' | 'user' | 'gas' }> = [
  { tag: 'yield-strategy', l3Domain: 'yield' },
  { tag: 'market-regime', l3Domain: 'market' },
  { tag: 'invoice-outcome', l3Domain: 'risk' },
  { tag: 'gas-optimization', l3Domain: 'gas' },
  { tag: 'user-preference', l3Domain: 'user' },
];

export class MemoryMaintenance {
  private timer: NodeJS.Timeout | null = null;
  private warmupTimer: NodeJS.Timeout | null = null;
  private onEvent: (event: MemoryEvent) => void;

  constructor(
    private l2: L2EpisodicMemory,
    private l3: L3SemanticMemory,
    private llm: LLMService,
    onEvent: (event: MemoryEvent) => void,
  ) {
    this.onEvent = onEvent;
  }

  start(): void {
    if (this.timer) return;
    // Run once after a short warmup, then every hour
    this.warmupTimer = setTimeout(
      () => { this.run().catch((e) => console.error('Memory maintenance warmup error:', e)); },
      5 * 60 * 1000,
    );
    this.timer = setInterval(
      () => { this.run().catch((e) => console.error('Memory maintenance error:', e)); },
      MAINTENANCE_INTERVAL_MS,
    );
    console.log('🧠 Memory maintenance scheduler started (runs every 60 min)');
  }

  stop(): void {
    if (this.warmupTimer) {
      clearTimeout(this.warmupTimer);
      this.warmupTimer = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async run(): Promise<void> {
    console.log('🧹 Running memory maintenance...');

    // Step 1: Apply decay and prune expired memories
    const { pruned } = this.l2.applyDecay();
    if (pruned > 0) {
      this.onEvent({
        type: 'pruned',
        tier: 'L2',
        memoryId: 'batch',
        summary: `Pruned ${pruned} outdated episodic memories (relevance below threshold)`,
        timestamp: Date.now(),
        reason: 'time-decay below 0.08 threshold',
      });
      console.log(`🗑️  Pruned ${pruned} stale L2 memories`);
    }

    // Step 2: Condense L2 clusters into L3 rules per domain
    for (const { tag, l3Domain } of DOMAINS) {
      await this.condenseCluster(tag, l3Domain);
    }

    console.log(`✅ Memory maintenance complete. L2: ${this.l2.count()} | L3: ${this.l3.count()}`);
  }

  private async condenseCluster(
    tag: MemoryTag,
    domain: 'yield' | 'risk' | 'market' | 'user' | 'gas',
  ): Promise<void> {
    const episodes = this.l2.getByDomain(tag, 50);
    if (episodes.length < CONDENSE_THRESHOLD) return;

    // Take the oldest episodes (they have the most stable signal)
    const candidates = episodes
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 10);

    const rule = await this.llm.condenseMemories(candidates.map((e) => e.content));
    if (!rule) return;

    const semantic = this.l3.add(rule, domain, candidates.map((e) => e.id), 75);

    // Remove condensed episodes from L2 (they're now distilled)
    this.l2.removeByIds(candidates.map((e) => e.id));

    this.onEvent({
      type: 'condensed',
      tier: 'L3',
      memoryId: semantic.id,
      summary: `Condensed ${candidates.length} ${tag} episodes → rule: "${rule.slice(0, 80)}..."`,
      timestamp: Date.now(),
      reason: `${candidates.length} memories condensed from domain ${domain}`,
      domain,
      sourceIds: candidates.map((e) => e.id),
    });

    console.log(`🧬 Condensed ${candidates.length} L2 [${tag}] → L3 rule: "${rule.slice(0, 60)}..."`);
  }
}
