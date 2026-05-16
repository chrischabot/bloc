# Realtime & sync

## Goals

- Two browser tabs on the same page **converge** under concurrent edits in ≤ 200 ms.
- A user who goes offline for minutes and reconnects has their edits **replayed** on top of the server's current state.
- Presence — cursor positions, "X is editing" — shows up in ≤ 1 s.

## Protocol shape

The realtime channel is a WebSocket at `wss://<host>/v1/realtime/ws?token=<bearer>`. The bearer can either ride the `Authorization` header (when the WS implementation supports custom headers) or the `token` query param (browsers).

Once open, the server sends a `hello` frame:

```json
{ "type": "hello", "session_id": "uuid", "server_clock": 12345 }
```

The client subscribes to channels:

```json
{ "type": "subscribe", "channel": "page:<page_id>" }
```

…and receives `event` frames with the body of the change. Frame kinds:

| `type` | Direction | Purpose |
|---|---|---|
| `hello` | server→client | Handshake, gives session id and server clock |
| `subscribe` / `unsubscribe` | client→server | Channel join/leave |
| `event` | server→client | Authoritative change happened |
| `op` | client→server | Optimistic local op for fan-out and CRDT merge |
| `presence` | both | Cursor / selection updates |
| `ack` | server→client | Server has accepted an op (with `op_id`) |
| `nack` | server→client | Rejected op (with reason) |
| `ping` / `pong` | both | Keepalive |

## Convergence model

Bloc uses **per-page operation logs** with a **last-writer-wins** policy on individual field writes plus a **fractional-index** ordering on block reorders. The state lives in Postgres in two tables: `page_updates` (the log) and `page_version_snapshots` (occasional snapshots to bound replay cost).

A client's lifecycle:

1. Connect, subscribe to `page:<id>`.
2. Server replies with the last few hundred `page_updates` since the snapshot the client knows, or a fresh snapshot if the client has none.
3. Client applies updates in clock order to its in-memory state.
4. Local edits become `op` frames; the server appends to the log and broadcasts an `event`.
5. On reconnect after offline, the client replays its queued ops in order — the server idempotency check (`op_id`) prevents double-apply.

## Offline queue

The web client journals every op in IndexedDB with its `op_id` before sending. On reconnect:

1. Pull missed events since the last seen `server_clock`.
2. Rebase the local queue on top (the protocol allows commutative reordering for block edits).
3. Drain the queue. Each `ack` removes the op from IndexedDB; each `nack` surfaces a conflict to the UI.

## Presence

Presence updates are broadcast on the same channel but with `type: 'presence'`. They're not persisted — only fanned out to subscribers. The server expires a presence record 15 s after the last update from that session.

## Versions & history

Periodically (per-page write-rate dependent) the server snapshots the page state and writes a `page_version` row. The version history surface at `/v1/pages/{id}/versions` reads this table; restoring a version writes a new op to the log that overwrites the current state, preserving the history line.

## Operational notes

- Clients **must** authenticate the WS — anonymous connections are refused.
- The server enforces a per-connection rate limit on `op` frames (default 100/s/conn) and disconnects abusive clients.
- WS messages are counted by `ws_messages_total{direction,kind}` and timed by `ws_message_duration_seconds{kind}` (see [Reporting › Metrics](../reporting/03-metrics.md)).
