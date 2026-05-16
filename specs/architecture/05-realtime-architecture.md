# Realtime Architecture

## Goals

- Multiplayer editing on the block tree with conflict-free merges.
- Sub-100ms keystroke acknowledgement (local) and sub-300ms remote echo.
- Awareness: presence avatars + remote cursor + selected block highlight.
- Offline support: edits replay on reconnect with full convergence.

## Choice: Yjs

Yjs is chosen for:
- Battle-tested CRDT with O(log n) updates.
- Provider-agnostic; we ship our own WS provider.
- Type-rich data model (Y.Doc, Y.Array, Y.Map, Y.Text, Y.XmlFragment).

Tiptap, Lexical, and ProseMirror are intentionally **not** used as the editor framework; we use Yjs directly as the document model and write a custom block-tree renderer (see `docs/frontend/05-editor.md`).

## Document model

Each page is one `Y.Doc` with this top-level shape:

```
Y.Doc
├── 'meta'        : Y.Map { title: Y.Text, icon: ..., cover: ... }
├── 'blockTree'   : Y.Array<Y.Map>     // blocks in document order? No: see below
├── 'blocks'      : Y.Map<blockId, Y.Map>  // block_id → block map
├── 'order'       : Y.Map<parentId, Y.Array<blockId>>  // adjacency
└── 'properties'  : Y.Map<propertyId, Y.Map>  // for database-row pages
```

Each block's `Y.Map` contains:

```
{
  type: string,                  // immutable for the life of the block
  content: Y.Map | Y.Text | Y.Array  // type-specific
  hasChildren: boolean,          // derived from order
}
```

For text-bearing blocks (paragraph, headings, todo, toggle, callout, quote), the `content` is a `Y.Text` with formatting via Yjs attributes (bold, italic, underline, strikethrough, code, color, link, mention, equation, date).

The block tree's adjacency lives in `order`: `order.get(parentId)` is a `Y.Array<blockId>`. Move/insert/delete operations mutate the appropriate array; CRDT semantics resolve concurrent moves naturally (intent-preserving).

## Gateway

`apps/api/src/ws/` exposes a WebSocket endpoint at `/ws/page/:pageId`. Per connection:

1. Auth: bearer token in `Sec-WebSocket-Protocol` header (or query string for env that doesn't allow custom protocols).
2. Permission: read access to the page is required to subscribe; comment access required to send awareness; edit access required to send updates.
3. Bind to a `Y.Doc` materialised from the Postgres-persisted snapshot.
4. Forward `update` and `awareness` messages to peers on the same page.

## Persistence

- Snapshot strategy: every Yjs update is appended to `block_updates` table:

  | Column | Type |
  |--------|------|
  | `page_id` | uuid |
  | `clock`   | bigint |
  | `update`  | bytea |
  | `created_at` | timestamptz |

- A background compactor merges updates older than 60s into a single snapshot row to keep tail latency low.
- On client connect, server sends the snapshot + outstanding updates; client `Y.applyUpdate`s them and from there on receives live updates.
- The Postgres `blocks` table is also kept in sync — but it is derived state. The Yjs document is the source of truth for an open page; the relational projection is computed on flush and on demand for REST reads.

This dual-projection is the most subtle part of the system. The projection rules are:

- On WS update for a page, the gateway:
  1. Applies the update to the Y.Doc.
  2. Diffs the affected blocks against last-known state.
  3. Issues Postgres upserts/deletes within a transaction.
  4. Emits Redis pub/sub `block.mutated` for REST cache invalidation and search indexing.
- On REST `PATCH /v1/blocks/...`, the API:
  1. Acquires an advisory lock on the page.
  2. If the Y.Doc is in-memory (someone is editing), apply the REST mutation as a Yjs update so the change broadcasts to live editors.
  3. If not, mutate Postgres directly and append a synthetic Yjs update to `block_updates` so future readers converge.

## Awareness

Yjs awareness carries:

- `user`: `{ id, name, color, avatar_url }`
- `cursor`: `{ blockId, anchor, head }`
- `selection`: `{ start, end }` within a cell or a block
- `view`: `{ databaseId, viewId, scrollTop }` for collaborative DB view scrolling (optional, not required for v1)

Awareness state is transient; not persisted.

## Reconnection

- Client buffers updates locally (IndexedDB via `y-indexeddb`) while offline.
- On reconnect: client sends its state vector → server diffs and streams missing updates → client also sends its outstanding updates → server applies and broadcasts.
- Convergence is guaranteed by Yjs.

## Load characteristics

- Target: 50 simultaneous editors per page; p99 keystroke local-echo < 16ms (client-only), remote echo < 80ms over LAN-equivalent (test target).
- Each WS connection: ~30 KB resident memory + 1 file descriptor + 1 outbound writer task.
- Horizontal scaling: WS gateway is sticky-routed per page (consistent hashing on `pageId`). Cross-node sync via Redis pub/sub.

## Offline mode

The web app, the desktop wrapper (Electron / Tauri), and the mobile clients all support full offline editing. Reading the offline-mode design correctly is the difference between "reasonable parity" and "actually works on a flight".

### Per-device store

- Client stores every page the user has opened (and every page transitively reachable from their sidebar via the "offline forest" rules below) in a **SQLite** database via `wa-sqlite` (browser) / `better-sqlite3` (desktop) / native (mobile).
- Each page is stored as its Yjs binary state plus a derived blocks-table projection for fast searches when offline.
- Per-device store size capped (configurable per platform; defaults: 500 MB on web, 5 GB on desktop, 2 GB on mobile). LRU eviction on overflow keyed by last-opened-at, excluding pages the user has explicitly pinned for offline.

### Offline forest

The set of pages preserved offline is the **transitive closure** rooted at:

1. Every page in the user's sidebar (Favourites, Private, Shared, Teamspaces) at depth ≤ 3.
2. Every page the user has opened in the last 30 days.
3. Every page the user has explicitly pinned.

A background "forest sync" job reconciles this set on app open and every 15 minutes while online. Pages removed from the forest are evicted within 24 hours of their next eligibility check.

### Sync queue

- Every local edit becomes a Yjs update applied immediately to the local doc; the binary update is also written to a **sync queue** table.
- When online, the queue drains: each update is sent over the WS to the gateway; on ack the local row is deleted.
- Conflicts: Yjs is CRDT so binary updates merge by construction. The only path with non-CRDT semantics is rich-text where two clients delete the same text range concurrently; in that case Yjs's deletion semantics preserve both intents (i.e. nothing comes back to life).
- Rebases: on reconnect, the client first fetches the server's state vector, sends only its missing updates, and applies the server's missing updates locally.

### Conflict resolution at the property level

Page properties on database rows are JSON values, not Yjs documents. Conflict policy:

- `title` / `rich_text` properties are stored as Yjs `Y.Text` for collaborative editing — these merge cleanly.
- Scalar properties (`number`, `select`, `status`, `checkbox`, `date`, `url`, `email`, `phone_number`) use last-writer-wins with a `version` column. On conflict, the loser's local change is rolled back and the user sees a non-blocking toast: "Property updated by Alice".
- `multi_select` / `people` / `files` / `relation` (set-typed) merge by set union when the offline edit was additive and by last-writer-wins when both sides removed and re-added.

### Indicators

- A banner at the top of the editor reads "Offline — your changes are saved on this device and will sync when you're back online" while disconnected.
- The sidebar's sync icon spins while the queue drains; a number appears if > 1 update is queued.

### Tests

- Integration: take a Playwright session offline (`context.setOffline(true)`), edit, reconnect, assert remote sees the changes within 2s.
- Chaos: queue persists across browser-tab refresh; queue larger than 50 MB; conflict on a scalar property; deletion of a page that the offline forest still references.
- Load: 5-min offline window with 1000 edits replays in < 10 s on reconnect.