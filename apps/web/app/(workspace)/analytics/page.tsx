import AnalyticsDashboard from '../../../components/AnalyticsDashboard';

export default function AnalyticsRoute(): React.JSX.Element {
  return (
    <article className="editor">
      <header className="editor__header">
        <h1 className="editor__title">Analytics</h1>
        <p className="editor__subtitle">
          Web Vitals, page-view totals, and top UI actions for the workspace. Beacon data ingested
          from the frontend at <code>/v1/analytics/beacon</code>.
        </p>
      </header>
      <section className="editor__body">
        <AnalyticsDashboard />
      </section>
    </article>
  );
}
