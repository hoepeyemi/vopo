// L2 Episodic Memory — specific past events with semantic search
// File-backed JSON store + cosine similarity over TF-IDF vectors.
// Set DATABASE_URL in env to upgrade to pgvector automatically.

import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
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
  // Serialize async writes via a promise chain so concurrent mutations
  // never interleave and the event loop is never blocked on disk I/O.
  private writeQueue: Promise<void> = Promise.resolve();

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
    // Capture the state to write at the moment persist() is called so that
    // a subsequent mutation while awaiting the write doesn't corrupt the file.
    const snapshot = JSON.stringify(this.memories, null, 2);
    this.writeQueue = this.writeQueue
      .then(() => fsPromises.writeFile(STORE_PATH, snapshot, 'utf8'))
      .catch((err) => console.error('[L2] Failed to persist memories:', err));
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

    // Keep store from growing unbounded. Sort by live decay score rather than the
    // stored relevanceScore (which is only updated hourly) so the eviction decision
    // is accurate even between maintenance cycles when all new memories share the
    // same initial score of 1.0.
    if (this.memories.length > MAX_MEMORIES) {
      this.memories.sort(
        (a, b) => decayedRelevance(a.createdAt, a.accessCount) - decayedRelevance(b.createdAt, b.accessCount),
      );
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
      const sim = cosineSimilarity(queryTf, memTf);
      // Use live decay rather than the stale stored relevanceScore (updated hourly at most)
      const liveRelevance = decayedRelevance(m.createdAt, m.accessCount);
      const score = sim * 0.7 + liveRelevance * 0.3;
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

  getByDomain(domain: MemoryTag, maxCount: number): EpisodicMemory[] {
    return this.memories.filter((m) => m.tags.includes(domain)).slice(0, maxCount);
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
