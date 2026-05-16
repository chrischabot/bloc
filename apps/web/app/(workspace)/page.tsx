export default function WorkspaceHome(): React.JSX.Element {
  return (
    <article className="editor">
      <header className="editor__header">
        <h1 className="editor__title">Welcome to Bloc</h1>
        <p className="editor__subtitle">
          A byte-perfect, pixel-perfect rebuild. Phase 7 ships the shell — block editor and database
          views land in Phase 8 and 9.
        </p>
      </header>
      <section className="editor__body">
        <p>
          Use the sidebar to navigate. The API is available at <code>/v1/*</code>
          and the internal v3 surface at <code>/api/v3/*</code>.
        </p>
        <p>Try the slash menu — coming in Phase 8.</p>
      </section>
    </article>
  );
}
