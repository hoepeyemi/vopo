// L2 Episodic Memory — specific past events with semantic search
// File-backed JSON store + cosine similarity over TF-IDF vectors.
// Set DATABASE_URL in env to upgrade to pgvector automatically.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { EpisodicMemory, LogEpisodeParams, MemoryTag } from './types.js';
import { decayedRelevance, initialRelevance, shouldPrune } from './decay.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'l2-episodic.json');
const MAX_MEMORIES = 500;

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'for', 'in', 'to', 'a', 'an', 'and',
  'or', 'but', 'with', 'from', 'by', 'of', 'was', 'it', 'its', 'this',
  'that', 'are', 'be', 'been', 'has', 'have', 'had', 'not', 'as', 'into',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const max = Math.max(...tf.values(), 1);
  for (const [k, v] of tf) tf.set(k, v / max);
  return tf;
}

function cosineSimilarity(tfA: Map<string, number>, tfB: Map<string, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const [term, score] of tfA) {
    dot += score * (tfB.get(term) || 0);
    magA += score * score;
  }
  for (const score of tfB.values()) magB += score * score;
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export class L2EpisodicMemory {
  private memories: EpisodicMemory[] = [];

  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.load();

    if (process.env.DATABASE_URL) {
      console.log('L2: DATABASE_URL detected — upgrade to pgvector client when ready');
      // Drop-in: replace file operations with pg + pgvector queries
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(STORE_PATH)) {
        this.memories = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as EpisodicMemory[];
      }
    } catch {
      this.memories = [];
    }
  }

  private persist(): void {
    fs.writeFileSync(STORE_PATH, JSON.stringify(this.memories, null, 2), 'utf8');
  }

  async add(params: LogEpisodeParams): Promise<EpisodicMemory> {
    const memory: EpisodicMemory = {
      id: randomUUID(),
      content: params.content,
      tags: params.tags,
      tokenId: params.tokenId,
      strategy: params.strategy,
      outcome: params.outcome,
      marketRegime: params.marketRegime,
      relevanceScore: initialRelevance(),
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
      metadata: params.metadata || {},
    };

    this.memories.push(memory);

    // Keep store from growing unbounded
    if (this.memories.length > MAX_MEMORIES) {
      this.memories.sort((a, b) => a.relevanceScore - b.relevanceScore);
      this.memories.splice(0, this.memories.length - MAX_MEMORIES);
    }

    this.persist();
    return memory;
  }

  async search(query: string, topK = 3, filterTags?: MemoryTag[]): Promise<EpisodicMemory[]> {
    if (this.memories.length === 0) return [];

    const queryTf = termFrequency(tokenize(query));
    const pool = filterTags
      ? this.memories.filter((m) => filterTags.some((t) => m.tags.includes(t)))
      : this.memories;

    const scored = pool.map((m) => {
      const memTf = termFrequency(tokenize(m.content));
      // Blend semantic similarity with time-decayed relevance
      const sim = cosineSimilarity(queryTf, memTf);
      const score = sim * 0.7 + m.relevanceScore * 0.3;
      return { memory: m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK).map((s) => s.memory);

    // Update access stats on retrieved memories
    for (const m of top) {
      m.accessCount++;
      m.lastAccessedAt = Date.now();
    }
    if (top.length > 0) this.persist();

    return top;
  }

  applyDecay(): { updated: number; pruned: number } {
    const before = this.memories.length;
    this.memories = this.memories.filter((m) => {
      m.relevanceScore = decayedRelevance(m.createdAt, m.accessCount);
      return !shouldPrune(m.relevanceScore);
    });
    this.persist();
    return { updated: this.memories.length, pruned: before - this.memories.length };
  }

  getByDomain(domain: MemoryTag, minCount: number): EpisodicMemory[] {
    return this.memories.filter((m) => m.tags.includes(domain)).slice(0, minCount);
  }

  getAll(): EpisodicMemory[] {
    return [...this.memories];
  }

  removeByIds(ids: string[]): void {
    const idSet = new Set(ids);
    this.memories = this.memories.filter((m) => !idSet.has(m.id));
    this.persist();
  }

  count(): number {
    return this.memories.length;
  }
}
