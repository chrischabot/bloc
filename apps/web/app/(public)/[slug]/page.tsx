import { notFound } from 'next/navigation';

interface PublicPagePayload {
  object: 'publication';
  slug: string;
  page_id: string;
  show_toc: boolean;
  show_navbar: boolean;
}

async function fetchPublication(slug: string): Promise<PublicPagePayload | null> {
  const baseUrl = process.env['API_URL'] ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${baseUrl}/v1/sites/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicPagePayload;
  } catch {
    return null;
  }
}

export default async function PublicSlugPage({
  params,
}: {
  params: { slug: string };
}): Promise<React.JSX.Element> {
  const pub = await fetchPublication(params.slug);
  if (pub === null) {
    notFound();
  }
  return (
    <article className="public-page">
      <header className="public-page__header">
        <h1>Published page</h1>
        <p className="public-page__meta">slug: {pub.slug}</p>
      </header>
      <section className="public-page__body">
        <p>
          This is the public renderer. Block content rendering is hydrated client-side from
          <code>/v1/blocks/{pub.page_id}/children</code>.
        </p>
      </section>
      <footer className="public-page__footer">
        <a href="https://bloc.local" target="_blank" rel="noopener noreferrer">
          Powered by Bloc
        </a>
      </footer>
    </article>
  );
}
