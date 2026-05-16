import type React from 'react';
import type { PropertyDef, RowObject } from './TableView';

function titleOf(row: RowObject, titleProp: PropertyDef): string {
  const v = row.properties[titleProp.name];
  if (!v) return '';
  const arr = v['title'] as Array<{ plain_text?: string }> | undefined;
  return arr?.map((n) => n.plain_text).join('') ?? '';
}

export default function GalleryView({
  properties,
  rows,
}: {
  properties: PropertyDef[];
  rows: RowObject[];
}): React.JSX.Element {
  const titleProp = properties.find((p) => p.type === 'title');
  if (!titleProp) return <div className="dbview__empty">Title property missing.</div>;
  return (
    <div className="galleryview">
      {rows.map((row) => (
        <article key={row.id} className="galleryview__card">
          <div className="galleryview__cover" aria-hidden>
            {(titleOf(row, titleProp) || 'A').slice(0, 1).toUpperCase()}
          </div>
          <h3 className="galleryview__title">{titleOf(row, titleProp) || 'Untitled'}</h3>
        </article>
      ))}
      {rows.length === 0 && <div className="dbview__empty">No cards.</div>}
    </div>
  );
}
