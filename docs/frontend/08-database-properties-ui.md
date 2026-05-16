# Database Properties UI

## Cell editor catalogue

Each property type renders both a **display cell** (in table/board/list) and an **inline editor** (popover on activation).

| Type | Display cell | Editor |
|------|--------------|--------|
| `title` | Truncated text; clickable | Inline text input (rich) |
| `rich_text` | Truncated text | Inline rich-text input (popover when long) |
| `number` | Right-aligned formatted | Numeric input with format |
| `select` | Tag (color-pill) | Searchable single-select; create option on enter |
| `multi_select` | Stack of tags overflow `+N` | Searchable multi-select; chips with delete |
| `status` | Tag with group color band | Single-select grouped by group |
| `date` | Formatted date / range | Calendar + time inputs; "Include time" toggle; "Reminder" |
| `people` | Avatar stack | Searchable people picker; chips |
| `files` | File chips | Upload + URL inputs; chips with delete |
| `checkbox` | Centred checkbox | Inline toggle |
| `url` | Truncated, clickable | URL input with validation |
| `email` | Truncated, clickable mailto | Email input |
| `phone_number` | Truncated, clickable tel | Phone input |
| `formula` | Formatted result | Read-only display; "View formula" reveals the expression |
| `relation` | Stack of page chips | Searchable page picker scoped to the target DB |
| `rollup` | Computed display | Read-only; "Configure" jumps to schema edit |
| `created_time` / `last_edited_time` | Formatted | Read-only |
| `created_by` / `last_edited_by` | Avatar | Read-only |

## Editor specifics

### Select / multi_select / status

- Search input at top.
- Existing options listed with their colors.
- Each option row: chip + checkmark (selected) + menu (edit color, rename, delete).
- "Create new option" appears at the bottom when search text doesn't match any option.

### Date

- Calendar grid (month).
- Inputs: "From", "To" (optional), "Include time" → time picker, time-zone selector.
- "Clear" button at bottom-right.
- Recurring date config (deferred).

### Files

- Upload area (drag and drop) + "Embed link" tab + "Upload" button.
- Existing files listed with thumb, name, size, replace, delete.

## Filter UI

Opens via the **Filter** button in the view toolbar.

```
┌─────────────────────────────────────────────────────┐
│ + Add filter        + Add filter group              │
│                                                     │
│ [Property ▼] [Operator ▼] [Operand]    ⨯           │
│ [Property ▼] [Operator ▼] [Operand]    ⨯           │
│  Where ⟨and ▼⟩                                      │
└─────────────────────────────────────────────────────┘
```

- Property dropdown: filterable list of all properties.
- Operator dropdown: depends on property type (see `docs/api/schemas/filters.md`).
- Operand: type-appropriate input.
- Combinator chip (and / or) between rows.
- + Add filter group → nested compound (depth ≤ 2).
- "Delete filter" via row's ⨯.
- Live preview: rows re-query as you build the filter.

## Sort UI

Opens via the **Sort** button.

```
+ Add sort
[Property ▼]  Ascending / Descending  ⨯  ⠿ (drag)
```

- Drag to reorder.
- Up to 8 sorts.

## Group-by UI (board / calendar / timeline)

- Property selector.
- Hidden columns / categories toggle.
- "No group" column visibility toggle.

## Properties panel

Opens via **Properties** button. Lists every property:

- Toggle visibility.
- Drag to reorder.
- Click to open per-property settings (type, options, format).

## Schema edit (database settings)

- "+ New property" → choose type → set name → confirm.
- Existing property: rename, change type (with warning + data coercion preview), delete.

## Tests

- Unit per cell editor.
- Playwright: every filter operator end-to-end; sort reordering; group-by switching.
- Visual snapshot per cell editor state (empty, single value, many values, error).