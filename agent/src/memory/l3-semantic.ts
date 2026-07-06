// L3 Semantic Memory — distilled "rules of thumb" condensed from episodic events
// Persisted as JSON. Retrieved by domain keyword matching.
// Decay: composite score = confidence×0.4 + recencyScore×0.4 + hitScore×0.2
// Rules below PRUNE_THRESHOLD are removed; LLM re-evaluates borderline ones.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { SemanticMemory } from './types.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'l3-semantic.json');
const MAX_RULES = 200;
// Half-life of ~90 days for an unaccessed rule
const DECAY_LAMBDA = 0.008;
const MS_PER_DAY = 86_400_000;
const PRUNE_THRESHOLD = 0.12;   // composite score below this → prune candidate
const BORDERLINE_BAND = 0.08;   // within this above threshold → ask LLM before pruning

export class L3SemanticMemory {
  private rules: SemanticMemory[] = [];

  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(STORE_PATH)) {
        this.rules = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as SemanticMemory[];
      }
    } catch {
      this.rules = [];
    }
  }

  private persist(): void {
    fs.writeFileSync(STORE_PATH, JSON.stringify(this.rules, null, 2), 'utf8');
  }

  add(rule: string, domain: SemanticMemory['domain'], evidence: string[], confidence: number): SemanticMemory {
    const keywords = rule
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const semantic: SemanticMemory = {
      id: randomUUID(),
      rule,
      evidence,
      confidence,
      domain,
      keywords,
      hitCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.rules.push(semantic);

    // Evict oldest/lowest-confidence rules when over cap
    if (this.rules.length > MAX_RULES) {
      this.rules.sort((a, b) => a.confidence - b.confidence || a.createdAt - b.createdAt);
      this.rules.splice(0, this.rules.length - MAX_RULES);
    }

    this.persist();
    return semantic;
  }

  // Retrieve top-k rules relevant to a query string via keyword overlap
  query(queryText: string, topK = 3): SemanticMemory[] {
    if (this.rules.length === 0) return [];

    const queryWords = new Set(
      queryText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3),
    );

    const scored = this.rules.map((r) => {
      const overlap = r.keywords.filter((k) => queryWords.has(k)).length;
      const score = overlap / Math.max(r.keywords.length, 1);
      return { rule: r, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK).filter((s) => s.score > 0).map((s) => s.rule);

    for (const r of top) {
      r.hitCount++;
      r.updatedAt = Date.now();
    }
    if (top.length > 0) this.persist();

    return top;
  }

  // Compute a composite relevance score for a rule (0–1).
  // Uses time-decay on age + a hit-frequency component + the stored confidence.
  private ruleScore(rule: SemanticMemory): number {
    const ageDays = (Date.now() - rule.createdAt) / MS_PER_DAY;
    const recencyScore = Math.exp(-DECAY_LAMBDA * ageDays);
    // Hits beyond 10 contribute little extra; cap at 1
    const hitScore = Math.min(rule.hitCount / 10, 1);
    return rule.confidence / 100 * 0.4 + recencyScore * 0.4 + hitScore * 0.2;
  }

  // Prune L3 rules whose composite score falls below threshold.
  // Borderline rules (within BORDERLINE_BAND above threshold) are passed to the
  // optional LLM evaluator before deciding; definite misses are dropped immediately.
  // Returns pruned count.
  async applyDecay(
    llmEvaluate?: (content: string) => Promise<number>,
  ): Promise<number> {
    const definiteKeep: SemanticMemory[] = [];
    const definitePrune: SemanticMemory[] = [];
    const borderline: SemanticMemory[] = [];

    for (const rule of this.rules) {
      const score = this.ruleScore(rule);
      if (score >= PRUNE_THRESHOLD + BORDERLINE_BAND) {
        definiteKeep.push(rule);
      } else if (score < PRUNE_THRESHOLD) {
        definitePrune.push(rule);
      } else {
        borderline.push(rule);
      }
    }

    // Ask LLM for borderline rules — keep if LLM score (0–1) ≥ 0.5
    const borderlineKept: SemanticMemory[] = [];
    if (llmEvaluate && borderline.length > 0) {
      await Promise.all(
        borderline.map(async (rule) => {
          try {
            const llmScore = await llmEvaluate(rule.rule);
            if (llmScore >= 0.5) {
              borderlineKept.push(rule);
            } else {
              definitePrune.push(rule);
            }
          } catch {
            // On error, keep the rule — safer than dropping it
            borderlineKept.push(rule);
          }
        }),
      );
    } else {
      // No LLM available: keep borderline rules (conservative)
      borderlineKept.push(...borderline);
    }

    const before = this.rules.length;
    this.rules = [...definiteKeep, ...borderlineKept];
    const pruned = before - this.rules.length;

    if (pruned > 0) this.persist();
    return pruned;
  }

  getAll(): SemanticMemory[] {
    return [...this.rules];
  }

  count(): number {
    return this.rules.length;
  }
}
