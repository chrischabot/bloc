export interface RealtimeEvent {
  /** Monotonically increasing global sequence. */
  seq: number;
  /** `block.appended` | `block.updated` | `block.deleted` | `page.updated` | `page.archived`. */
  type: string;
  /** Page the event is associated with. */
  pageId: string;
  /** Workspace id (used for ACL when fanning out). */
  workspaceId: string;
  /** Free-form payload (block id, etc.). */
  data: Record<string, unknown>;
  /** Server timestamp in ms. */
  ts: number;
}

const MAX_EVENTS_PER_PAGE = 1024;

class RealtimeBus {
  private seq = 0;
  private readonly events = new Map<string, RealtimeEvent[]>();
  private readonly listeners = new Map<string, Set<(event: RealtimeEvent) => void>>();

  publish(input: Omit<RealtimeEvent, 'seq' | 'ts'>): RealtimeEvent {
    this.seq += 1;
    const event: RealtimeEvent = {
      seq: this.seq,
      ts: Date.now(),
      ...input,
    };
    const buf = this.events.get(input.pageId) ?? [];
    buf.push(event);
    if (buf.length > MAX_EVENTS_PER_PAGE) {
      buf.splice(0, buf.length - MAX_EVENTS_PER_PAGE);
    }
    this.events.set(input.pageId, buf);
    const subs = this.listeners.get(input.pageId);
    if (subs !== undefined) {
      for (const fn of subs) {
        try {
          fn(event);
        } catch {
          // Swallow — listeners are isolated.
        }
      }
    }
    return event;
  }

  /** Fetch events for a page strictly greater than `sinceSeq`. */
  since(pageId: string, sinceSeq: number, limit = 100): RealtimeEvent[] {
    const buf = this.events.get(pageId) ?? [];
    return buf.filter((e) => e.seq > sinceSeq).slice(0, limit);
  }

  subscribe(pageId: string, fn: (event: RealtimeEvent) => void): () => void {
    const set = this.listeners.get(pageId) ?? new Set();
    set.add(fn);
    this.listeners.set(pageId, set);
    return () => {
      const current = this.listeners.get(pageId);
      if (current !== undefined) {
        current.delete(fn);
        if (current.size === 0) this.listeners.delete(pageId);
      }
    };
  }

  /** Reset state (test helper). */
  reset(): void {
    this.seq = 0;
    this.events.clear();
    this.listeners.clear();
  }
}

/** Process-wide singleton. */
export const realtimeBus = new RealtimeBus();
