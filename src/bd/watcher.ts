import type { BeadsData, Issue } from '../types';
import { loadBeads } from './parser';

export type UpdateCallback = (data: BeadsData) => void;

export interface BeadsWatcherOptions {
  intervalMs?: number;
  load?: (beadsPath: string) => Promise<BeadsData>;
  onError?: (error: unknown) => void;
}

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function issueSnapshot(issue: Issue): Record<string, unknown> {
  return {
    ...issue,
    labels: [...(issue.labels ?? [])].sort(),
    dependencies: [...issue.dependencies]
      .map((edge) => canonicalize(edge))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    children: issue.children ? [...issue.children].sort() : undefined,
    blockedBy: issue.blockedBy ? [...issue.blockedBy].sort() : undefined,
    blocks: issue.blocks ? [...issue.blocks].sort() : undefined,
  };
}

export function beadsFingerprint(data: BeadsData): string {
  return JSON.stringify(data.issues.map(issueSnapshot).sort((left, right) =>
    String(left.id).localeCompare(String(right.id)),
  ));
}

/** Poll bd serially and publish only changed, successful snapshots. */
export class BeadsWatcher {
  private readonly callbacks = new Set<UpdateCallback>();
  private readonly intervalMs: number;
  private readonly load: (beadsPath: string) => Promise<BeadsData>;
  private readonly onError: (error: unknown) => void;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private inFlight: Promise<void> | null = null;
  private pending = false;
  private generation = 0;
  private lastFingerprint: string | null = null;
  private lastGoodData: BeadsData | null = null;

  constructor(private readonly beadsPath: string, options: BeadsWatcherOptions = {}) {
    this.intervalMs = options.intervalMs ?? 5_000;
    this.load = options.load ?? loadBeads;
    this.onError = options.onError ?? ((error) => console.error('Error polling beads:', error));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      void this.reload().finally(() => {
        if (this.running) this.timer = setTimeout(tick, this.intervalMs);
      });
    };
    this.timer = setTimeout(tick, this.intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = false;
    this.generation++;
  }

  subscribe(callback: UpdateCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /** Queue one reload. Concurrent requests collapse into the same serial drain. */
  reload(): Promise<void> {
    this.pending = true;
    if (!this.inFlight) {
      this.inFlight = this.drain().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  getLastGoodData(): BeadsData | null {
    return this.lastGoodData;
  }

  private async drain(): Promise<void> {
    while (this.pending) {
      this.pending = false;
      const generation = this.generation;
      try {
        const data = await this.load(this.beadsPath);
        if (generation !== this.generation) continue;
        const fingerprint = beadsFingerprint(data);
        this.lastGoodData = data;
        if (fingerprint !== this.lastFingerprint) {
          this.lastFingerprint = fingerprint;
          this.notifySubscribers(data);
        }
      } catch (error) {
        this.onError(error);
      }
    }
  }

  private notifySubscribers(data: BeadsData): void {
    for (const callback of this.callbacks) {
      try {
        callback(data);
      } catch (error) {
        this.onError(error);
      }
    }
  }
}
