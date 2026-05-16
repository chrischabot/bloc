'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBloc } from '../lib/use-bloc.ts';
import EditableBlock, {
  type EditableBlockData,
  buildPayload,
  plainTextOf,
} from './EditableBlock.tsx';
import SlashMenu from './SlashMenu.tsx';

interface PageDoc {
  id: string;
  title: string;
  icon: { type: string; emoji?: string } | null;
}

/** Coerce a page's properties title array to a plain string. */
function pageTitle(page: Record<string, unknown>): string {
  const properties = page['properties'] as Record<string, unknown> | undefined;
  if (properties !== undefined) {
    for (const v of Object.values(properties)) {
      if (v !== null && typeof v === 'object' && (v as { type?: string }).type === 'title') {
        const arr = (v as { title?: Array<{ plain_text?: string }> }).title;
        const text = arr?.map((n) => n.plain_text ?? '').join('') ?? '';
        if (text.length > 0) return text;
      }
    }
  }
  return 'Untitled';
}

const DEBOUNCE_MS = 350;

export default function EditablePage({ pageId }: { pageId: string }): React.JSX.Element {
  const { client, loading: sessionLoading } = useBloc();
  const [page, setPage] = useState<PageDoc | null>(null);
  const [blocks, setBlocks] = useState<EditableBlockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slashState, setSlashState] = useState<{
    blockId: string;
    rect: { top: number; left: number };
    query: string;
  } | null>(null);
  const blockRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const pendingTextRef = useRef<Map<string, string>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load page + blocks on mount.
  const refresh = useCallback(async () => {
    if (client === null) return;
    setLoading(true);
    setError(null);
    try {
      const pageRow = (await client.pages.retrieve({ page_id: pageId })) as unknown as Record<
        string,
        unknown
      >;
      const icon = pageRow['icon'] as { type: string; emoji?: string } | null;
      const titleValue =
        typeof pageRow['title'] === 'string' && (pageRow['title'] as string).length > 0
          ? (pageRow['title'] as string)
          : pageTitle(pageRow);
      setPage({
        id: pageId,
        title: titleValue,
        icon: icon ?? null,
      });
      const result = await client.blocks.children.list({ block_id: pageId, page_size: 100 });
      const live: EditableBlockData[] = result.results.map(
        (r) => r as unknown as EditableBlockData,
      );
      // Ensure at least one block so the editor isn't empty.
      if (live.length === 0) {
        const appended = await client.blocks.children.append({
          block_id: pageId,
          children: [
            {
              type: 'paragraph',
              paragraph: { rich_text: [], color: 'default' },
            },
          ],
        });
        setBlocks(appended.results as unknown as EditableBlockData[]);
      } else {
        setBlocks(live);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [client, pageId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Debounced sync of pending text changes back to the API.
  const flushPending = useCallback(async () => {
    if (client === null) return;
    const pending = pendingTextRef.current;
    if (pending.size === 0) return;
    const entries = Array.from(pending.entries());
    pending.clear();
    for (const [blockId, text] of entries) {
      const block = blocks.find((b) => b.id === blockId);
      if (block === undefined) continue;
      const payload = buildPayload(block.type, text, {
        checked: (block as unknown as { to_do?: { checked?: boolean } }).to_do?.checked,
      });
      try {
        await client.blocks.update({
          block_id: blockId,
          [block.type]: payload,
        });
      } catch {
        // Swallow — the UI keeps its optimistic state; user can retry.
      }
    }
  }, [blocks, client]);

  const scheduleFlush = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void flushPending();
    }, DEBOUNCE_MS);
  }, [flushPending]);

  const handleChangeText = useCallback(
    (id: string, text: string) => {
      pendingTextRef.current.set(id, text);
      // Update optimistic local state so type-changes / etc see the latest text.
      setBlocks((curr) =>
        curr.map((b) => {
          if (b.id !== id) return b;
          const payload = buildPayload(b.type, text, {
            checked: (b as unknown as { to_do?: { checked?: boolean } }).to_do?.checked,
          });
          return { ...b, [b.type]: payload } as EditableBlockData;
        }),
      );
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const handleChecked = useCallback(
    async (id: string, checked: boolean) => {
      if (client === null) return;
      const block = blocks.find((b) => b.id === id);
      if (block === undefined || block.type !== 'to_do') return;
      const text = plainTextOf(block);
      const payload = buildPayload('to_do', text, { checked });
      setBlocks((curr) =>
        curr.map((b) => (b.id === id ? ({ ...b, to_do: payload } as EditableBlockData) : b)),
      );
      try {
        await client.blocks.update({ block_id: id, to_do: payload });
      } catch {
        // ignore
      }
    },
    [blocks, client],
  );

  const handleInsertAfter = useCallback(
    async (id: string) => {
      if (client === null) return;
      try {
        const appended = await client.blocks.children.append({
          block_id: pageId,
          children: [{ type: 'paragraph', paragraph: { rich_text: [], color: 'default' } }],
          after: id,
        });
        const newBlock = appended.results[0] as unknown as EditableBlockData | undefined;
        if (newBlock === undefined) return;
        setBlocks((curr) => {
          const idx = curr.findIndex((b) => b.id === id);
          if (idx < 0) return [...curr, newBlock];
          const next = curr.slice();
          next.splice(idx + 1, 0, newBlock);
          return next;
        });
        // Focus the new block on the next tick.
        setTimeout(() => {
          const el = blockRefs.current.get(newBlock.id);
          el?.focus();
        }, 0);
      } catch {
        // ignore
      }
    },
    [client, pageId],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (client === null) return;
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx < 0) return;
      await flushPending();
      const prevId = idx > 0 ? (blocks[idx - 1]?.id ?? null) : null;
      setBlocks((curr) => curr.filter((b) => b.id !== id));
      try {
        await client.blocks.delete({ block_id: id });
      } catch {
        // ignore
      }
      if (prevId !== null) {
        setTimeout(() => {
          const el = blockRefs.current.get(prevId);
          el?.focus();
          // Move caret to end.
          if (el instanceof HTMLElement) {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
        }, 0);
      }
    },
    [blocks, client, flushPending],
  );

  const handleChangeType = useCallback(
    async (id: string, nextType: string) => {
      if (client === null) return;
      const block = blocks.find((b) => b.id === id);
      if (block === undefined || block.type === nextType) return;
      const text = plainTextOf(block);
      // Block types are immutable on existing rows in the API; insert a
      // replacement block immediately after, then archive the original.
      try {
        const appended = await client.blocks.children.append({
          block_id: pageId,
          children: [
            {
              type: nextType,
              [nextType]: buildPayload(nextType, text),
            },
          ],
          after: id,
        });
        const newBlock = appended.results[0] as unknown as EditableBlockData | undefined;
        if (newBlock === undefined) return;
        await client.blocks.delete({ block_id: id });
        setBlocks((curr) => {
          const idx = curr.findIndex((b) => b.id === id);
          if (idx < 0) return curr;
          const next = curr.slice();
          next.splice(idx, 1, newBlock);
          return next;
        });
        setTimeout(() => blockRefs.current.get(newBlock.id)?.focus(), 0);
      } catch {
        // ignore
      }
    },
    [blocks, client, pageId],
  );

  // Listen for the EditableBlock dropdown's custom event.
  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<{ blockId: string; type: string }>).detail;
      if (detail !== null && detail !== undefined) {
        void handleChangeType(detail.blockId, detail.type);
      }
    };
    window.addEventListener('bloc:editor:change-type', handler as EventListener);
    return () =>
      window.removeEventListener('bloc:editor:change-type', handler as EventListener);
  }, [handleChangeType]);

  const handleSlash = useCallback((id: string, anchor: DOMRect | null) => {
    if (anchor === null) {
      setSlashState({ blockId: id, rect: { top: 0, left: 0 }, query: '' });
      return;
    }
    setSlashState({
      blockId: id,
      rect: { top: anchor.bottom + window.scrollY + 4, left: anchor.left + window.scrollX },
      query: '',
    });
  }, []);

  const handleSlashSelect = useCallback(
    async (blockType: string) => {
      const slash = slashState;
      setSlashState(null);
      if (slash === null) return;
      // Most slash menu items map directly to block types; a few aliases.
      const finalType = mapSlashType(blockType);
      if (finalType === null) return;
      await handleChangeType(slash.blockId, finalType);
    },
    [handleChangeType, slashState],
  );

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el === null) {
      blockRefs.current.delete(id);
    } else {
      blockRefs.current.set(id, el);
    }
  }, []);

  const addBlock = useCallback(async () => {
    if (client === null || blocks.length === 0) return;
    const lastBlock = blocks[blocks.length - 1];
    if (lastBlock === undefined) return;
    await handleInsertAfter(lastBlock.id);
  }, [blocks, client, handleInsertAfter]);

  const handleTitleChange = useCallback(
    async (next: string) => {
      if (page === null || client === null) return;
      setPage({ ...page, title: next });
      try {
        await client.pages.update({ page_id: page.id, title: next });
        window.dispatchEvent(new Event('bloc:sidebar:refresh'));
      } catch {
        // Silent failure; will retry on next change.
      }
    },
    [page, client],
  );

  const archivePage = useCallback(async () => {
    if (client === null || page === null) return;
    await flushPending();
    try {
      await client.pages.update({ page_id: page.id, archived: true });
      window.dispatchEvent(new Event('bloc:sidebar:refresh'));
      window.location.href = '/';
    } catch {
      // ignore
    }
  }, [client, page, flushPending]);

  if (sessionLoading || loading) {
    return (
      <article className="editor" data-testid="editor-loading">
        <p>Loading…</p>
      </article>
    );
  }
  if (error !== null) {
    return (
      <article className="editor" data-testid="editor-error">
        <p>Error: {error}</p>
      </article>
    );
  }
  if (page === null) {
    return (
      <article className="editor" data-testid="editor-missing">
        <p>Page not found.</p>
      </article>
    );
  }

  return (
    <article className="editor editor--interactive" data-testid="editable-page">
      <header className="editor__header">
        <input
          className="editor__title-input"
          value={page.title}
          onChange={(e) => void handleTitleChange(e.target.value)}
          placeholder="Untitled"
          aria-label="Page title"
          data-testid="page-title"
        />
        <div className="editor__page-actions">
          <button
            type="button"
            onClick={archivePage}
            className="editor__archive"
            data-testid="page-archive"
          >
            Archive page
          </button>
        </div>
      </header>
      <section className="editor__body" data-testid="editor-body">
        {blocks.map((b, idx) => (
          <EditableBlock
            key={b.id}
            block={b}
            isFirst={idx === 0}
            isLast={idx === blocks.length - 1}
            onChangeText={handleChangeText}
            onChecked={handleChecked}
            onInsertAfter={handleInsertAfter}
            onDelete={handleDelete}
            onSlash={handleSlash}
            onFocus={() => undefined}
            onSelect={() => undefined}
            registerRef={registerRef}
          />
        ))}
      </section>
      <button
        type="button"
        className="editor__add-block"
        onClick={() => void addBlock()}
        data-testid="add-block"
      >
        + Add a block
      </button>
      {slashState !== null && (
        <div
          className="editor__slash-host"
          style={{
            position: 'absolute',
            top: slashState.rect.top,
            left: slashState.rect.left,
          }}
        >
          <SlashMenu
            open
            query={slashState.query}
            onSelect={(blockType) => void handleSlashSelect(blockType)}
            onClose={() => setSlashState(null)}
          />
        </div>
      )}
    </article>
  );
}

function mapSlashType(slashId: string): string | null {
  // Most ids in SlashMenu directly map to a block type. A handful do not.
  switch (slashId) {
    case 'paragraph':
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
    case 'bulleted_list_item':
    case 'numbered_list_item':
    case 'to_do':
    case 'toggle':
    case 'quote':
    case 'divider':
    case 'callout':
    case 'code':
    case 'equation':
    case 'image':
    case 'video':
    case 'file':
    case 'pdf':
    case 'bookmark':
    case 'embed':
    case 'table_of_contents':
    case 'breadcrumb':
    case 'synced_block':
      return slashId;
    case 'columns':
      return 'column_list';
    case 'mention':
    case 'date':
    case 'database_inline':
    case 'database_full':
      // Out of scope for the in-page block editor; surface in v1.1.
      return null;
    default:
      return null;
  }
}
