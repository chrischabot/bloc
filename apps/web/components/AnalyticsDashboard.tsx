import type React from 'react';

interface VitalsSummary {
  count: number;
  p50: number;
  p95: number;
}

export interface AnalyticsSummaryProps {
  pageViews: number;
  webVitals: Record<string, VitalsSummary>;
  uiActions: Record<string, number>;
}

const SAMPLE: AnalyticsSummaryProps = {
  pageViews: 1247,
  webVitals: {
    LCP: { count: 543, p50: 1450, p95: 2870 },
    INP: { count: 712, p50: 95, p95: 230 },
    CLS: { count: 421, p50: 8, p95: 41 },
    FCP: { count: 510, p50: 620, p95: 1140 },
    TTFB: { count: 488, p50: 240, p95: 620 },
  },
  uiActions: {
    'slash.open': 432,
    'page.created': 218,
    'block.appended': 1604,
    'database.query': 92,
    'share.opened': 56,
  },
};

function formatMs(value: number, metric: string): string {
  if (metric === 'CLS') return `${(value / 1000).toFixed(2)}`;
  return `${value} ms`;
}

export default function AnalyticsDashboard({
  summary = SAMPLE,
}: {
  summary?: AnalyticsSummaryProps;
}): React.JSX.Element {
  const sortedActions = Object.entries(summary.uiActions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return (
    <section className="analytics" aria-label="Analytics summary">
      <header className="analytics__header">
        <h2>Workspace analytics</h2>
        <p className="analytics__hint">Last 10,000 events.</p>
      </header>

      <div className="analytics__row">
        <article className="analytics__card analytics__card--hero">
          <h3>Page views</h3>
          <p className="analytics__metric">{summary.pageViews.toLocaleString()}</p>
        </article>

        <article className="analytics__card">
          <h3>Top UI actions</h3>
          <ol className="analytics__actions">
            {sortedActions.map(([action, count]) => (
              <li key={action} className="analytics__action">
                <span className="analytics__action-name">{action}</span>
                <span className="analytics__action-count">{count.toLocaleString()}</span>
              </li>
            ))}
            {sortedActions.length === 0 && <li className="analytics__empty">No UI actions yet.</li>}
          </ol>
        </article>
      </div>

      <div className="analytics__grid">
        {Object.entries(summary.webVitals).map(([metric, vital]) => (
          <article key={metric} className="analytics__card">
            <h3>{metric}</h3>
            <p className="analytics__metric">{formatMs(vital.p50, metric)}</p>
            <p className="analytics__sub">
              p95 {formatMs(vital.p95, metric)} · n {vital.count.toLocaleString()}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
