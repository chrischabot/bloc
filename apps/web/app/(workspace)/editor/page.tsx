'use client';

import { useState } from 'react';
import BlockRenderer, { type BlockObject } from '../../../components/BlockRenderer';
import DragHandle from '../../../components/DragHandle';
import FormattingToolbar, {
  type Annotation,
  type Color,
} from '../../../components/FormattingToolbar';
import SlashMenu from '../../../components/SlashMenu';

function makeBlock(type: string, payload: Record<string, unknown>, id: string): BlockObject {
  return {
    object: 'block',
    id,
    type,
    has_children: false,
    archived: false,
    [type]: payload,
  } as BlockObject;
}

const PT = (content: string) => ({
  type: 'text' as const,
  text: { content, link: null },
  plain_text: content,
  href: null,
  annotations: {
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
    code: false,
    color: 'default',
  },
});

const BLOCKS: BlockObject[] = [
  makeBlock('heading_1', { rich_text: [PT('Block playground')], color: 'default' }, 'h1'),
  makeBlock(
    'paragraph',
    { rich_text: [PT('Every block type — read-only.')], color: 'default' },
    'p1',
  ),
  makeBlock('heading_2', { rich_text: [PT('Headings')], color: 'default' }, 'h2'),
  makeBlock('heading_3', { rich_text: [PT('Heading 3')], color: 'default' }, 'h3'),
  makeBlock('bulleted_list_item', { rich_text: [PT('Bulleted item')], color: 'default' }, 'bul'),
  makeBlock('numbered_list_item', { rich_text: [PT('Numbered item')], color: 'default' }, 'num'),
  makeBlock('to_do', { rich_text: [PT('Walk the dog')], checked: true, color: 'default' }, 'td1'),
  makeBlock(
    'to_do',
    { rich_text: [PT('Reply to email')], checked: false, color: 'default' },
    'td2',
  ),
  makeBlock('quote', { rich_text: [PT('Stay hungry, stay foolish.')], color: 'default' }, 'q1'),
  makeBlock(
    'callout',
    {
      rich_text: [PT('Heads up — this is a callout.')],
      color: 'default',
      icon: { type: 'emoji', emoji: '💡' },
    },
    'ca1',
  ),
  makeBlock('divider', {}, 'd1'),
  makeBlock(
    'code',
    {
      rich_text: [PT('const x = 42;\nconsole.log(x);')],
      caption: [],
      language: 'typescript',
    },
    'c1',
  ),
  makeBlock('equation', { expression: 'E = mc^2' }, 'eq1'),
  makeBlock('bookmark', { url: 'https://www.notion.so/help', caption: [] }, 'bk1'),
];

export default function EditorPage(): React.JSX.Element {
  const [slashOpen, setSlashOpen] = useState(true);
  const [slashQuery, setSlashQuery] = useState('');
  const [activeAnno, setActiveAnno] = useState<Record<Annotation, boolean>>({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    code: false,
    link: false,
  });
  const [color, setColor] = useState<Color>('default');

  return (
    <article className="editor">
      <header className="editor__header">
        <h1 className="editor__title">Editor playground</h1>
        <p className="editor__subtitle">
          Read-only block rendering, plus the slash menu and formatting toolbar UI.
        </p>
      </header>

      <FormattingToolbar
        active={activeAnno}
        color={color}
        onToggle={(a) => setActiveAnno((curr) => ({ ...curr, [a]: !curr[a] }))}
        onColor={setColor}
        onComment={() => undefined}
      />

      <section className="editor__body">
        {BLOCKS.map((b) => (
          <div key={b.id} className="block-row">
            <DragHandle />
            <BlockRenderer block={b} />
          </div>
        ))}
      </section>

      <div className="slashmenu-host">
        <label className="slashmenu-host__label">
          Slash query:{' '}
          <input
            value={slashQuery}
            onChange={(e) => setSlashQuery(e.target.value)}
            placeholder="Type to filter…"
          />
        </label>
        <button type="button" onClick={() => setSlashOpen((v) => !v)}>
          {slashOpen ? 'Close' : 'Open'} menu
        </button>
        <SlashMenu
          open={slashOpen}
          query={slashQuery}
          onSelect={() => undefined}
          onClose={() => setSlashOpen(false)}
        />
      </div>
    </article>
  );
}
