import type React from 'react';

export default function DragHandle(): React.JSX.Element {
  return (
    <div className="draghandle" aria-hidden>
      <button type="button" className="draghandle__btn" title="Add a new block" aria-label="Add">
        ＋
      </button>
      <button type="button" className="draghandle__btn" title="Drag to move" aria-label="Drag">
        ⠿
      </button>
    </div>
  );
}
