'use client';

import { useParams } from 'next/navigation';
import EditablePage from '../../../../components/EditablePage.tsx';

export default function PageRoute(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  if (id.length === 0) {
    return (
      <article className="editor">
        <p>Missing page id.</p>
      </article>
    );
  }
  return <EditablePage pageId={id} />;
}
