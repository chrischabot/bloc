import { beforeEach, describe, expect, it } from 'vitest';
import { realtimeBus } from './bus.ts';

beforeEach(() => {
  realtimeBus.reset();
});

describe('realtime bus', () => {
  it('publish + since returns events in order with monotonic seq', () => {
    const a = realtimeBus.publish({
      type: 'block.appended',
      pageId: 'p1',
      workspaceId: 'w1',
      data: {},
    });
    const b = realtimeBus.publish({
      type: 'block.updated',
      pageId: 'p1',
      workspaceId: 'w1',
      data: {},
    });
    expect(b.seq).toBe(a.seq + 1);
    const events = realtimeBus.since('p1', 0);
    expect(events.map((e) => e.seq)).toEqual([a.seq, b.seq]);
  });

  it('since with non-zero cursor returns only newer events', () => {
    const a = realtimeBus.publish({
      type: 'x',
      pageId: 'p2',
      workspaceId: 'w1',
      data: {},
    });
    const b = realtimeBus.publish({
      type: 'y',
      pageId: 'p2',
      workspaceId: 'w1',
      data: {},
    });
    const events = realtimeBus.since('p2', a.seq);
    expect(events.length).toBe(1);
    expect(events[0]!.seq).toBe(b.seq);
  });

  it('subscribe fires for new events and unsubscribe stops delivery', () => {
    const received: number[] = [];
    const unsub = realtimeBus.subscribe('p3', (e) => received.push(e.seq));
    const a = realtimeBus.publish({
      type: 'x',
      pageId: 'p3',
      workspaceId: 'w1',
      data: {},
    });
    expect(received).toEqual([a.seq]);
    unsub();
    realtimeBus.publish({
      type: 'y',
      pageId: 'p3',
      workspaceId: 'w1',
      data: {},
    });
    expect(received).toEqual([a.seq]);
  });

  it('caps buffer at MAX_EVENTS_PER_PAGE (oldest dropped)', () => {
    for (let i = 0; i < 1100; i++) {
      realtimeBus.publish({
        type: 'x',
        pageId: 'p4',
        workspaceId: 'w1',
        data: { i },
      });
    }
    const events = realtimeBus.since('p4', 0, 10_000);
    expect(events.length).toBe(1024);
  });

  it('isolates events by pageId', () => {
    realtimeBus.publish({
      type: 'x',
      pageId: 'p5',
      workspaceId: 'w1',
      data: {},
    });
    realtimeBus.publish({
      type: 'y',
      pageId: 'p6',
      workspaceId: 'w1',
      data: {},
    });
    expect(realtimeBus.since('p5', 0).length).toBe(1);
    expect(realtimeBus.since('p6', 0).length).toBe(1);
    expect(realtimeBus.since('p7', 0).length).toBe(0);
  });
});
