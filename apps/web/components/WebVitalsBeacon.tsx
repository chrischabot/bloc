'use client';

import { Bloc } from '@bloc/sdk';
import type React from 'react';
import { useEffect } from 'react';

const API_BASE =
  typeof process !== 'undefined' && process.env['NEXT_PUBLIC_API_URL']
    ? process.env['NEXT_PUBLIC_API_URL']
    : 'http://localhost:3001';

function devBearer(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const w = params.get('w') ?? '00000000-0000-0000-0000-000000000001';
    const u = params.get('u') ?? '00000000-0000-0000-0000-000000000002';
    return `Bearer test_${w}_${u}`;
  }
  return 'Bearer test_00000000-0000-0000-0000-000000000001_00000000-0000-0000-0000-000000000002';
}

type WebVitalMetric = 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP';

/** Layout-shift entry shape (not exposed on the standard PerformanceEntry type). */
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

/** Largest-contentful-paint entry shape. */
interface LargestContentfulPaintEntry extends PerformanceEntry {
  startTime: number;
  renderTime: number;
}

export default function WebVitalsBeacon({
  authToken,
}: {
  authToken?: string;
}): React.JSX.Element | null {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
      return undefined;
    }
    const client = new Bloc({ auth: authToken ?? devBearer(), baseUrl: API_BASE });

    function send(metric: WebVitalMetric, value: number): void {
      void client.analytics
        .beacon({ kind: 'web_vital', metric, value: Math.round(value) })
        .catch(() => undefined);
    }

    const observers: PerformanceObserver[] = [];

    // LCP — largest-contentful-paint.
    try {
      const lcp = new PerformanceObserver((list) => {
        const entries = list.getEntries() as LargestContentfulPaintEntry[];
        const last = entries[entries.length - 1];
        if (last) send('LCP', last.startTime);
      });
      lcp.observe({ type: 'largest-contentful-paint', buffered: true });
      observers.push(lcp);
    } catch {
      // Browser doesn't support LCP.
    }

    // FCP — paint.
    try {
      const fcp = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformancePaintTiming[]) {
          if (entry.entryType === 'paint' && entry.startTime > 0) {
            send('FCP', entry.startTime);
            break;
          }
        }
      });
      fcp.observe({ type: 'paint', buffered: true });
      observers.push(fcp);
    } catch {
      // Browser doesn't support paint timing.
    }

    // INP — event timing.
    try {
      const inp = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceEventTiming[]) {
          if (entry.duration > 40) send('INP', entry.duration);
        }
      });
      inp.observe({ type: 'event', buffered: true });
      observers.push(inp);
    } catch {
      // Browser doesn't support event timing.
    }

    // CLS — layout shift (session-window sum × 1000 for integer storage).
    try {
      let cls = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as LayoutShiftEntry[]) {
          if (entry.hadRecentInput) continue;
          cls += entry.value ?? 0;
        }
        send('CLS', cls * 1000);
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      observers.push(clsObserver);
    } catch {
      // Browser doesn't support layout shift.
    }

    // TTFB — navigation timing.
    try {
      const nav = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (nav && nav.responseStart > 0) {
        send('TTFB', nav.responseStart - nav.requestStart);
      }
    } catch {
      // Navigation timing unavailable.
    }

    // Page view beacon.
    void client.analytics.beacon({ kind: 'page_view' }).catch(() => undefined);

    return () => {
      for (const o of observers) o.disconnect();
    };
  }, [authToken]);

  return null;
}
