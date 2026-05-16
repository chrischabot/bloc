# Database Page Layouts

Beyond views, each database controls how an **individual row's page** is laid out and which auxiliary sections appear. This is the "Customize layout" surface (database menu → **Customize page**).

Reference: `screenshots/database-customize-page.png`, `database-customize-properties.png`, `database-customize-backlinks.png`, `database-customize-comments.png`.

## Customize page panel

Opens as a right-side drawer (480 px). Sections:

### Page section

- **Open as**: `Side peek` (default) | `Center peek` | `Full page`. Persists per database.
- **Layout**: `Default` | `Side-by-side` (properties on the right rail with the body content on the left).
- **Show backlinks**: `Expanded` | `Show in popover` | `Off` (see screenshot `database-customize-backlinks.png`).
- **Show comments**: `Expanded` | `Show in popover` | `Off` (see screenshot `database-customize-comments.png`).
- **Show discussions**: same options.

### Properties section

Drag-and-drop list of each property with a per-property visibility mode (see `database-customize-properties.png`):

| Mode | Effect on the row page |
|------|------------------------|
| `Always show` | Always rendered in the properties strip |
| `Hide when empty` | Rendered only when the property has a non-null value |
| `Always hide` | Never rendered; reachable only via "More properties" |

Drag handle reorders. Six-dot icon on the left; mode dropdown on the right.

### Sub-items & Dependencies

- **Sub-items**: on / off (see `docs/frontend/23-sub-items-dependencies.md`).
- **Dependencies**: on / off + configurator.

### Lock database

A workspace-level toggle (see `screenshots/database-lock.png`):

- When **locked**, the database **schema** is read-only to all but the locker / admins; rows can still be added unless the row-edit permission is also restricted.
- Locking also disables: column add/remove/rename, view add/remove/rename, filter/sort changes on existing views (unlocking via the same menu).
- Distinct from **locked view** (per `docs/frontend/07-database-views.md#view-permissions`) and **locked page** (per `docs/frontend/11-page-header.md`).

### Permission level: Can edit content

A database-only permission tier (`can_edit_content`; see `screenshots/database-can-edit-content.png` and `docs/architecture/06-authentication.md`). Grantees can create / edit / delete rows but **cannot**:

- Add / remove / rename properties.
- Add / remove / reorder views or change view filters / sorts / group-by.
- Edit automations or buttons configured at the database level.
- Change lock state.

Surface in the Share dialog as a dedicated row dropdown option visible only when the parent resource is a database. Surface in the Customize-page drawer's permission badge ("Can edit content") next to each grantee.

## Data model additions

```
databases.config += {
  open_as: 'side_peek' | 'center_peek' | 'full_page',
  page_layout: 'default' | 'side_by_side',
  backlinks: 'expanded' | 'popover' | 'off',
  comments: 'expanded' | 'popover' | 'off',
  discussions: 'expanded' | 'popover' | 'off',
  property_visibility: [ { property_id, mode: 'always'|'hide_empty'|'always_hide' }, ... ],
  locked: bool,
  locked_by: uuid|null,
  locked_at: timestamptz|null
}
```

## API

- `PATCH /v1/databases/:id` accepts every `config.*` field above.
- `POST /v1/databases/:id/lock` / `DELETE /v1/databases/:id/lock` — convenience endpoints; admin/owner only.

## Tests

- E2E: open a database row page; change properties to "Hide when empty"; verify a null-valued row hides it while a populated row shows it.
- E2E: lock the database; non-owner attempts to add a property → 403.
- Visual: side-by-side layout matches reference screenshot.
- Observability: lock/unlock + property-visibility changes emit `audit_events`.