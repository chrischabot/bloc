import type { ReactNode } from 'react';
import QuickSwitcher from '../../components/QuickSwitcher.tsx';
import Sidebar from '../../components/Sidebar.tsx';
import TopBar from '../../components/TopBar.tsx';
import WebVitalsBeacon from '../../components/WebVitalsBeacon.tsx';

export default function WorkspaceLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="shell">
      <TopBar />
      <div className="shell-body">
        <Sidebar />
        <main className="content">{children}</main>
      </div>
      <QuickSwitcher />
      <WebVitalsBeacon />
    </div>
  );
}
