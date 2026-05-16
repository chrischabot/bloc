'use client';

import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';

export interface EditableBlockData {
  id: string;
  type: string;
  archived: boolean;
  has_children: boolean;
  // Per-type payload; we tolerate any shape and pull what we need.
  [key: string]: unknown;
}

interface RichTextNode {
  type: 'text' | 'mention' | 'equation';
  plain_text: string;
  text?: { content: string; link: { url: string } | null };
}

const DEFAULT_ANNOTATIONS = {
  bold: false,
  italic: false,
  strikethrough: false,
  underline: false,
  code: false,
  color: 'default' as const,
};

/** Coerce a block's rich_text array into a flat plain string. */
export function plainTextOf(block: EditableBlockData): string {
  const payload = (block as unknown as Record<string, Record<string, unknown> | undefined>)[
    block.type
  ];
  const rt = payload?.['rich_text'] as RichTextNode[] | undefined;
  if (!Array.isArray(rt)) return '';
  return rt
    .map((n) => {
      const pt = n.plain_text;
      if (typeof pt === 'string' && pt.length > 0) return pt;
      return n.text?.content ?? '';
    })
    .join('');
}

/** Build a payload for a block-type update from a plain string. */
export function buildPayload(
  type: string,
  text: string,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  const base = {
    rich_text:
      text.length === 0
        ? []
        : [
            {
              type: 'text',
              text: { content: text, link: null },
              plain_text: text,
              href: null,
              annotations: { ...DEFAULT_ANNOTATIONS },
            },
          ],
  };
  switch (type) {
    case 'paragraph':
    case 'bulleted_list_item':
    case 'numbered_list_item':
    case 'quote':
    case 'toggle':
      return { ...base, color: 'default' };
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
      return { ...base, color: 'default', is_toggleable: false };
    case 'to_do':
      return { ...base, color: 'default', checked: extras['checked'] === true };
    case 'callout':
      return {
        ...base,
        color: 'default',
        icon: extras['icon'] ?? { type: 'emoji', emoji: '💡' },
      };
    case 'code':
      return {
        ...base,
        caption: [],
        language: typeof extras['language'] === 'string' ? extras['language'] : 'plain text',
      };
    case 'equation':
      return { expression: text.length > 0 ? text : 'x' };
    case 'divider':
      return {};
    case 'breadcrumb':
      return {};
    case 'table_of_contents':
      return { color: 'default' };
    default:
      return { ...base, color: 'default' };
  }
}

export interface EditableBlockProps {
  block: EditableBlockData;
  isFirst: boolean;
  isLast: boolean;
  onChangeText: (id: string, text: string) => void;
  onChecked: (id: string, checked: boolean) => void;
  onInsertAfter: (id: string) => void;
  onDelete: (id: string) => void;
  onSlash: (id: string, anchor: DOMRect | null) => void;
  onFocus: (id: string) => void;
  onSelect: (id: string, hasSelection: boolean) => void;
  /** Provided by parent so we can imperatively focus newly created blocks. */
  registerRef: (id: string, el: HTMLElement | null) => void;
}

/** Map block type to the contenteditable HTML tag we render. */
function tagFor(type: string): 'div' | 'h1' | 'h2' | 'h3' | 'li' | 'blockquote' | 'pre' {
  switch (type) {
    case 'heading_1':
      return 'h1';
    case 'heading_2':
      return 'h2';
    case 'heading_3':
      return 'h3';
    case 'bulleted_list_item':
    case 'numbered_list_item':
    case 'to_do':
    case 'toggle':
      return 'li';
    case 'quote':
      return 'blockquote';
    case 'code':
      return 'pre';
    default:
      return 'div';
  }
}

function classFor(type: string): string {
  return `editor-block editor-block--${type.replace(/_/g, '-')}`;
}

export default function EditableBlock(props: EditableBlockProps): React.JSX.Element {
  const { block } = props;
  const ref = useRef<HTMLElement | null>(null);

  // Register imperative ref with parent so newly inserted blocks can focus.
  useEffect(() => {
    props.registerRef(block.id, ref.current);
    return () => props.registerRef(block.id, null);
  }, [block.id, props.registerRef]);

  // Initialise contenteditable text on mount and when block id changes.
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const text = plainTextOf(block);
    if (el.textContent !== text) {
      el.textContent = text;
    }
  }, [block.id, block]);

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLElement>) => {
      const el = e.currentTarget;
      const text = el.textContent ?? '';
      props.onChangeText(block.id, text);
    },
    [block.id, props.onChangeText],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const el = e.currentTarget;
      const text = el.textContent ?? '';
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        props.onInsertAfter(block.id);
        return;
      }
      if (e.key === 'Backspace' && text.length === 0 && !props.isFirst) {
        e.preventDefault();
        props.onDelete(block.id);
        return;
      }
      if (e.key === '/' && text.length === 0) {
        // Defer to next tick so the `/` doesn't enter the field.
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        props.onSlash(block.id, rect);
      }
    },
    [block.id, props.isFirst, props.onDelete, props.onInsertAfter, props.onSlash],
  );

  const handleSelect = useCallback(() => {
    const sel = window.getSelection();
    const hasSelection =
      sel !== null && sel.toString().length > 0 && ref.current?.contains(sel.anchorNode) === true;
    props.onSelect(block.id, hasSelection);
  }, [block.id, props.onSelect]);

  const handleFocus = useCallback(() => {
    props.onFocus(block.id);
  }, [block.id, props.onFocus]);

  if (block.type === 'divider') {
    return (
      <div
        className="editor-block editor-block--divider-wrap"
        data-block-id={block.id}
        data-testid={`block-${block.id}`}
        data-block-type="divider"
      >
        <hr />
      </div>
    );
  }

  const Tag = tagFor(block.type);
  const todoChecked =
    block.type === 'to_do'
      ? Boolean((block as unknown as { to_do?: { checked?: boolean } }).to_do?.checked)
      : false;
  const placeholder = placeholderFor(block.type);

  const className = classFor(block.type) + (todoChecked ? ' is-checked' : '');

  return (
    <div
      className="editor-row"
      data-block-id={block.id}
      data-testid={`block-${block.id}`}
      data-block-type={block.type}
    >
      <div className="editor-row__gutter" aria-hidden>
        {block.type === 'to_do' ? (
          <input
            type="checkbox"
            checked={todoChecked}
            onChange={(e) => props.onChecked(block.id, e.target.checked)}
            aria-label="Toggle to-do"
            data-testid={`todo-${block.id}`}
          />
        ) : (
          <span className="editor-row__bullet" aria-hidden>
            {block.type === 'bulleted_list_item' ? '•' : null}
            {block.type === 'numbered_list_item' ? '·' : null}
            {block.type === 'toggle' ? '▸' : null}
            {block.type === 'callout' ? '💡' : null}
          </span>
        )}
      </div>
      <Tag
        ref={(el: HTMLElement | null) => {
          ref.current = el;
        }}
        className={className}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onMouseUp={handleSelect}
        onKeyUp={handleSelect}
        onFocus={handleFocus}
        spellCheck
        role="textbox"
        aria-multiline={false}
      />
      <button
        type="button"
        className="editor-row__delete"
        aria-label="Delete block"
        data-testid={`delete-${block.id}`}
        onClick={() => props.onDelete(block.id)}
      >
        ×
      </button>
      {/* For tests: visible block type selector */}
      <select
        className="editor-row__type"
        value={block.type}
        onChange={(e) => {
          // Re-use slash handler with anchor=null and pre-selected type via custom event.
          window.dispatchEvent(
            new CustomEvent('bloc:editor:change-type', {
              detail: { blockId: block.id, type: e.target.value },
            }),
          );
        }}
        aria-label="Change block type"
        data-testid={`type-${block.id}`}
      >
        <option value="paragraph">Text</option>
        <option value="heading_1">Heading 1</option>
        <option value="heading_2">Heading 2</option>
        <option value="heading_3">Heading 3</option>
        <option value="bulleted_list_item">Bulleted list</option>
        <option value="numbered_list_item">Numbered list</option>
        <option value="to_do">To-do</option>
        <option value="toggle">Toggle</option>
        <option value="quote">Quote</option>
        <option value="callout">Callout</option>
        <option value="code">Code</option>
        <option value="equation">Equation</option>
        <option value="divider">Divider</option>
      </select>
    </div>
  );
}

function placeholderFor(type: string): string {
  switch (type) {
    case 'heading_1':
      return 'Heading 1';
    case 'heading_2':
      return 'Heading 2';
    case 'heading_3':
      return 'Heading 3';
    case 'bulleted_list_item':
      return 'List item';
    case 'numbered_list_item':
      return 'List item';
    case 'to_do':
      return 'To-do';
    case 'toggle':
      return 'Toggle';
    case 'quote':
      return 'Quote';
    case 'callout':
      return 'Callout';
    case 'code':
      return 'Code';
    case 'equation':
      return 'Equation';
    default:
      return "Type '/' for commands";
  }
}
