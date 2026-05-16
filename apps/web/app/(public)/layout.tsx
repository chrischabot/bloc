import type { ReactNode } from 'react';

export default function PublicLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="public-shell">{children}</div>;
}
