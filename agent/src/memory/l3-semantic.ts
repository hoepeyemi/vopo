// L3 Semantic Memory — distilled "rules of thumb" condensed from episodic events
// Persisted as JSON. Retrieved by domain keyword matching.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { SemanticMemory } from './types.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'l3-semantic.json');

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
    const top = scored.slice(0, topK).map((s) => s.rule);

    for (const r of top) {
      r.hitCount++;
      r.updatedAt = Date.now();
    }
    if (top.length > 0) this.persist();

    return top;
  }

  getAll(): SemanticMemory[] {
    return [...this.rules];
  }

  count(): number {
    return this.rules.length;
  }
}
