'use client';

import type React from 'react';

export type Annotation = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'link';

export const COLORS = [
  'default',
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
] as const;
export type Color = (typeof COLORS)[number];

interface Props {
  active: Record<Annotation, boolean>;
  color: Color;
  onToggle: (a: Annotation) => void;
  onColor: (c: Color) => void;
  onComment: () => void;
}

const ANNO_LABEL: Record<Annotation, string> = {
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  code: 'Code',
  link: 'Link',
};

const ANNO_GLYPH: Record<Annotation, string> = {
  bold: 'B',
  italic: 'I',
  underline: 'U',
  strikethrough: 'S',
  code: '<>',
  link: '🔗',
};

export default function FormattingToolbar({
  active,
  color,
  onToggle,
  onColor,
  onComment,
}: Props): React.JSX.Element {
  return (
    <div className="formatbar" role="toolbar" aria-label="Text formatting">
      <div className="formatbar__group">
        <select aria-label="Block type" className="formatbar__select">
          <option>Text</option>
          <option>Heading 1</option>
          <option>Heading 2</option>
          <option>Heading 3</option>
          <option>Quote</option>
          <option>Callout</option>
        </select>
      </div>
      <div className="formatbar__group">
        {(['bold', 'italic', 'underline', 'strikethrough', 'code', 'link'] as Annotation[]).map(
          (a) => (
            <button
              key={a}
              type="button"
              className={`formatbar__btn ${active[a] ? 'is-active' : ''}`}
              onClick={() => onToggle(a)}
              aria-label={ANNO_LABEL[a]}
              aria-pressed={active[a]}
            >
              <span className={a === 'italic' ? 'italic-glyph' : ''}>{ANNO_GLYPH[a]}</span>
            </button>
          ),
        )}
      </div>
      <div className="formatbar__group">
        <select
          aria-label="Color"
          className="formatbar__select"
          value={color}
          onChange={(e) => onColor(e.target.value as Color)}
        >
          {COLORS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="formatbar__group">
        <button type="button" className="formatbar__btn" onClick={onComment} aria-label="Comment">
          💬
        </button>
      </div>
    </div>
  );
}
