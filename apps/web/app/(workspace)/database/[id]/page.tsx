'use client';

import { useParams } from 'next/navigation';
import EditableDatabase from '../../../../components/EditableDatabase.tsx';

export default function DatabaseRoute(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  if (id.length === 0) {
    return (
      <article className="editor">
        <p>Missing database id.</p>
      </article>
    );
  }
  return <EditableDatabase databaseId={id} />;
}
