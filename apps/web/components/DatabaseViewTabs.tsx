'use client';

import type React from 'react';
import { useState } from 'react';
import BoardView from './BoardView';
import CalendarView from './CalendarView';
import GalleryView from './GalleryView';
import ListView from './ListView';
import TableView, { type PropertyDef, type RowObject } from './TableView';
import TimelineView from './TimelineView';

type ViewType = 'table' | 'board' | 'gallery' | 'list' | 'calendar' | 'timeline';

const VIEW_LABEL: Record<ViewType, string> = {
  table: 'Table',
  board: 'Board',
  gallery: 'Gallery',
  list: 'List',
  calendar: 'Calendar',
  timeline: 'Timeline',
};

export default function DatabaseViewTabs({
  properties,
  rows,
  groupBy = 'Status',
}: {
  properties: PropertyDef[];
  rows: RowObject[];
  groupBy?: string;
}): React.JSX.Element {
  const [view, setView] = useState<ViewType>('table');
  return (
    <div className="dbview-tabs">
      <nav className="dbview-tabs__bar" aria-label="View tabs">
        {(Object.keys(VIEW_LABEL) as ViewType[]).map((v) => (
          <button
            key={v}
            type="button"
            className={`dbview-tabs__tab ${view === v ? 'is-active' : ''}`}
            onClick={() => setView(v)}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </nav>
      <div className="dbview-tabs__pane">
        {view === 'table' && <TableView properties={properties} rows={rows} />}
        {view === 'board' && <BoardView properties={properties} rows={rows} groupBy={groupBy} />}
        {view === 'gallery' && <GalleryView properties={properties} rows={rows} />}
        {view === 'list' && <ListView properties={properties} rows={rows} />}
        {view === 'calendar' && <CalendarView properties={properties} rows={rows} />}
        {view === 'timeline' && <TimelineView properties={properties} rows={rows} />}
      </div>
    </div>
  );
}
