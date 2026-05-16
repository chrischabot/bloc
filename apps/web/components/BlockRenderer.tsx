import type React from 'react';

export interface RichTextNode {
  type: 'text' | 'mention' | 'equation';
  plain_text: string;
  href: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  text?: { content: string; link: { url: string } | null };
  equation?: { expression: string };
  mention?: {
    type: 'user' | 'page' | 'database' | 'date' | 'link_preview' | 'template_mention';
    user?: { id: string };
    page?: { id: string };
    database?: { id: string };
    date?: { start: string; end?: string | null };
  };
}

export interface BlockObject {
  object: 'block';
  id: string;
  type: string;
  has_children: boolean;
  archived: boolean;
  [key: string]: unknown;
}

function colorClass(color: string): string {
  if (color === 'default') return '';
  return `rt-color-${color}`;
}

function RichText({ nodes }: { nodes: RichTextNode[] }): React.JSX.Element {
  return (
    <>
      {nodes.map((node, i) => {
        let content: React.ReactNode = node.plain_text;
        if (node.type === 'mention' && node.mention) {
          const m = node.mention;
          if (m.type === 'user') content = `@${node.plain_text || 'user'}`;
          else if (m.type === 'page') content = `↗ ${node.plain_text || 'page'}`;
          else if (m.type === 'database') content = `⌗ ${node.plain_text || 'database'}`;
          else if (m.type === 'date') content = `📅 ${m.date?.start ?? node.plain_text}`;
        }
        if (node.annotations.code) content = <code>{content}</code>;
        if (node.annotations.bold) content = <strong>{content}</strong>;
        if (node.annotations.italic) content = <em>{content}</em>;
        if (node.annotations.underline) content = <u>{content}</u>;
        if (node.annotations.strikethrough) content = <s>{content}</s>;
        if (node.href) {
          content = (
            <a href={node.href} target="_blank" rel="noopener noreferrer">
              {content}
            </a>
          );
        }
        return (
          <span key={`${i}-${node.plain_text}`} className={colorClass(node.annotations.color)}>
            {content}
          </span>
        );
      })}
    </>
  );
}

interface FileLike {
  type: 'external' | 'file';
  external?: { url: string };
  file?: { url: string };
  caption?: RichTextNode[];
  name?: string;
}

function fileUrl(payload: FileLike | undefined): string | null {
  if (!payload) return null;
  return payload.type === 'external'
    ? (payload.external?.url ?? null)
    : (payload.file?.url ?? null);
}

export default function BlockRenderer({ block }: { block: BlockObject }): React.JSX.Element {
  const t = block.type;
  const payload = (block as unknown as Record<string, Record<string, unknown> | undefined>)[t];
  const richText = (payload?.['rich_text'] as RichTextNode[] | undefined) ?? [];

  switch (t) {
    case 'paragraph':
      return (
        <p className="block block--paragraph">
          <RichText nodes={richText} />
        </p>
      );
    case 'heading_1':
      return (
        <h1 className="block block--h1">
          <RichText nodes={richText} />
        </h1>
      );
    case 'heading_2':
      return (
        <h2 className="block block--h2">
          <RichText nodes={richText} />
        </h2>
      );
    case 'heading_3':
      return (
        <h3 className="block block--h3">
          <RichText nodes={richText} />
        </h3>
      );
    case 'bulleted_list_item':
      return (
        <li className="block block--bullet">
          <RichText nodes={richText} />
        </li>
      );
    case 'numbered_list_item':
      return (
        <li className="block block--numbered">
          <RichText nodes={richText} />
        </li>
      );
    case 'to_do':
      return (
        <div className={`block block--todo ${payload?.['checked'] ? 'is-checked' : ''}`}>
          <input
            type="checkbox"
            checked={Boolean(payload?.['checked'])}
            readOnly
            aria-label="todo"
          />
          <span>
            <RichText nodes={richText} />
          </span>
        </div>
      );
    case 'toggle':
      return (
        <details className="block block--toggle" open={Boolean(payload?.['_open'])}>
          <summary>
            <RichText nodes={richText} />
          </summary>
          <div className="block__children-placeholder">
            <em>Children load on expand</em>
          </div>
        </details>
      );
    case 'quote':
      return (
        <blockquote className="block block--quote">
          <RichText nodes={richText} />
        </blockquote>
      );
    case 'divider':
      return <hr className="block block--divider" />;
    case 'breadcrumb':
      return (
        <nav className="block block--breadcrumb" aria-label="Breadcrumb">
          <span>workspace</span>
          <span className="block__sep">›</span>
          <span>parent</span>
          <span className="block__sep">›</span>
          <span className="block__current">this page</span>
        </nav>
      );
    case 'table_of_contents':
      return (
        <nav className="block block--toc" aria-label="Table of contents">
          <ul>
            <li>
              <a href="#section-1">Section 1</a>
            </li>
            <li className="block__toc-indent">
              <a href="#section-1-1">Sub-section</a>
            </li>
            <li>
              <a href="#section-2">Section 2</a>
            </li>
          </ul>
        </nav>
      );
    case 'callout':
      return (
        <aside className="block block--callout">
          <span className="block__icon" aria-hidden>
            {(payload?.['icon'] as { emoji?: string } | undefined)?.emoji ?? '💡'}
          </span>
          <span>
            <RichText nodes={richText} />
          </span>
        </aside>
      );
    case 'code':
      return (
        <pre className="block block--code">
          <code data-language={(payload?.['language'] as string) ?? 'plain text'}>
            <RichText nodes={richText} />
          </code>
        </pre>
      );
    case 'equation':
      return (
        <div className="block block--equation">
          <code>{payload?.['expression'] as string}</code>
        </div>
      );
    case 'image': {
      const url = fileUrl(payload as unknown as FileLike);
      const caption = (payload?.['caption'] as RichTextNode[] | undefined) ?? [];
      return (
        <figure className="block block--image">
          {url ? <img src={url} alt={caption.map((c) => c.plain_text).join('') || ''} /> : null}
          {caption.length > 0 ? (
            <figcaption>
              <RichText nodes={caption} />
            </figcaption>
          ) : null}
        </figure>
      );
    }
    case 'video': {
      const url = fileUrl(payload as unknown as FileLike);
      return (
        <figure className="block block--video">
          {url ? (
            <video controls src={url} aria-label="Embedded video">
              <track kind="captions" />
            </video>
          ) : null}
        </figure>
      );
    }
    case 'audio': {
      const url = fileUrl(payload as unknown as FileLike);
      return (
        <figure className="block block--audio">
          {url ? (
            <audio controls src={url}>
              <track kind="captions" />
            </audio>
          ) : null}
        </figure>
      );
    }
    case 'file': {
      const url = fileUrl(payload as unknown as FileLike);
      const name = (payload?.['name'] as string) ?? 'File';
      return (
        <a
          className="block block--file"
          href={url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="block__icon">📎</span>
          <span>{name}</span>
        </a>
      );
    }
    case 'pdf': {
      const url = fileUrl(payload as unknown as FileLike);
      return (
        <div className="block block--pdf">
          {url ? <iframe title="PDF preview" src={url} width="100%" height="500" /> : null}
        </div>
      );
    }
    case 'bookmark':
      return (
        <a
          className="block block--bookmark"
          href={(payload?.['url'] as string) ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
        >
          {(payload?.['url'] as string) ?? 'Bookmark'}
        </a>
      );
    case 'embed':
      return (
        <div className="block block--embed">
          {payload?.['url'] ? (
            <iframe
              title="Embedded content"
              src={payload['url'] as string}
              width="100%"
              height="400"
            />
          ) : null}
        </div>
      );
    case 'link_preview':
      return (
        <a
          className="block block--link-preview"
          href={(payload?.['url'] as string) ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="block__icon">🔗</span>
          <span>{payload?.['url'] as string}</span>
        </a>
      );
    case 'link_to_page': {
      const pageId = payload?.['page_id'] as string | undefined;
      const databaseId = payload?.['database_id'] as string | undefined;
      const href = pageId ? `/page/${pageId}` : databaseId ? `/database/${databaseId}` : '#';
      return (
        <a className="block block--link-to-page" href={href}>
          <span className="block__icon" aria-hidden>
            {pageId ? '📄' : '⌗'}
          </span>
          <span>{pageId ? 'Linked page' : 'Linked database'}</span>
        </a>
      );
    }
    case 'child_page':
      return (
        <a className="block block--child-page" href={`/page/${block.id}`}>
          <span className="block__icon" aria-hidden>
            📄
          </span>
          <span>{(payload?.['title'] as string) ?? 'Untitled'}</span>
        </a>
      );
    case 'child_database':
      return (
        <a className="block block--child-database" href={`/database/${block.id}`}>
          <span className="block__icon" aria-hidden>
            ⌗
          </span>
          <span>{(payload?.['title'] as string) ?? 'Untitled'}</span>
        </a>
      );
    case 'column_list':
      return (
        <div className="block block--column-list" aria-label="Column layout">
          <div className="block__column-placeholder">
            <em>Column layout — children render as flex columns</em>
          </div>
        </div>
      );
    case 'column':
      return (
        <div className="block block--column">
          <div className="block__column-placeholder">
            <em>Column</em>
          </div>
        </div>
      );
    case 'table': {
      const width = Number((payload?.['table_width'] as number | undefined) ?? 3);
      const hasHeader = Boolean(payload?.['has_column_header']);
      const cols = Array.from({ length: width }, (_, i) => `col-${block.id}-${i}`);
      return (
        <div className="block block--table">
          <table>
            <tbody>
              {hasHeader && (
                <tr>
                  {cols.map((key, i) => (
                    <th key={`hdr-${key}`}>Column {i + 1}</th>
                  ))}
                </tr>
              )}
              <tr>
                {cols.map((key, i) => (
                  <td key={`td-${key}`}>Cell {i + 1}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
    case 'table_row': {
      const cells = (payload?.['cells'] as RichTextNode[][] | undefined) ?? [];
      return (
        <tr className="block block--table-row">
          {cells.map((cell, i) => (
            <td key={`cell-${i}-${cell.length}`}>
              <RichText nodes={cell} />
            </td>
          ))}
        </tr>
      );
    }
    case 'synced_block': {
      const syncedFrom = payload?.['synced_from'] as { block_id: string } | null | undefined;
      return (
        <div className={`block block--synced ${syncedFrom ? 'is-duplicate' : 'is-original'}`}>
          <span className="block__badge">Synced</span>
          <div className="block__children-placeholder">
            <em>
              {syncedFrom
                ? `Mirror of ${syncedFrom.block_id.slice(0, 8)}…`
                : 'Original sync source'}
            </em>
          </div>
        </div>
      );
    }
    default:
      return (
        <div className="block block--unsupported">
          [Unsupported block: <code>{t}</code>]
        </div>
      );
  }
}
