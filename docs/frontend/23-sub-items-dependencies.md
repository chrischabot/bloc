# Sub-items & Dependencies

Two database features built on top of self-referential relation properties.

## Sub-items

Enables hierarchical rows within a single database — e.g. tasks with sub-tasks.

### Enabling

Database menu → **Customize layout** → **Sub-items** toggle. Enabling:

1. Creates a dual-property self-relation on the database, with synced inverse:
   - `Parent item` — single-link relation back to the same DB.
   - `Sub-item` — multi-link relation, the inverse.
2. Reveals an expand chevron on table-view rows.
3. Reveals the sub-item add buttons in board / list / timeline views.

### UI behaviour

| View | Sub-items |
|------|-----------|
| Table | Expand chevron at left; sub-items render indented, with their own chevrons for grandchildren. + Add sub-item appears on hover at the bottom of an expanded group. |
| Board | Sub-items render as a stacked badge with count; clicking opens the parent with sub-items list. |
| List | Same indent pattern as table. |
| Calendar | Sub-items appear as smaller bars under parents. |
| Timeline | Sub-items render under the parent row; toggle "Show sub-items" in view settings. |

### Constraints

- A row cannot be its own ancestor (cycle prevention; 422 on attempt).
- Depth is unbounded in storage but UI shows max 6 levels; deeper levels collapse to "•••" with a click to expand.

## Dependencies

Models blocked-by / blocking relationships between rows of a date-bearing database (typically the timeline view).

### Enabling

Database menu → **Customize layout** → **Dependencies** → on. Settings:

- **Blocked-by property** — picks an existing relation (self-relation) or creates one.
- **Blocking property** — the dual / inverse.
- **Auto-shift dates when shifting predecessors** — on / off.

Behavior:

- Moving a predecessor's end date can push successors' start dates (when "auto-shift" is on).
- A directed line is drawn on timeline views from the predecessor's right edge to the successor's left edge.
- Cycles forbidden (422).

### Timeline visual

- Arrow heads drawn with `visx`.
- Hovering an arrow highlights both rows + reveals the dependency badge.
- Right-click an arrow → "Remove dependency".
- Drag from a row's right edge to another row's left edge creates a new dependency.

## Data model

These are internal uses of the existing `relation` property infrastructure with type-specific UI flags persisted on the database:

```jsonc
databases.config.sub_items = {
  parent_property_id: "uuid",
  child_property_id: "uuid"
}
databases.config.dependencies = {
  blocked_by_property_id: "uuid",
  blocking_property_id: "uuid",
  auto_shift: true,
  date_property_id: "uuid"      // which date drives the timeline
}
```

No separate tables required.

## API

- `PATCH /v1/databases/:id` accepts `config.sub_items` and `config.dependencies` payloads.
- Standard relation endpoints handle the relations themselves; the configurator wires up the inverse synced property.
- Auto-shift implemented as a server-side helper triggered on PATCH of a date property; emits the new dates as cascaded updates.

## Tests

- Unit: cycle detection.
- Integration: enabling sub-items creates two synced properties + sets config.
- E2E: drag a dependency in timeline, expand sub-items in table, verify persistence.
- Chaos: deliberate cycle attempts, deeply nested sub-trees (1000), bulk dependency mutation.
- Observability: sub-items toggle and dependency-add emit `database.config_changed` audit events.