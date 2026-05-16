export default function HomePage(): React.JSX.Element {
  return (
    <article className="editor">
      <header className="editor__header">
        <h1 className="editor__title">Home</h1>
        <p className="editor__subtitle">Your daily dashboard. Widgets land in Phase 17.</p>
      </header>
      <section className="editor__body">
        <p>
          Use the sidebar to navigate. Press <code>Cmd-K</code> for quick switcher (Phase 13).
        </p>
      </section>
    </article>
  );
}
