# Page Header

## Structure (top → bottom)

1. **Cover area** (optional) — full-width image, 280 px tall, with re-position drag handle and "Change cover / Reposition / Remove" actions on hover.
2. **Icon** — 78×78 (with cover present) or 40×40 (no cover); positioned overlapping cover by 16 px; clickable to open icon picker.
3. **Title** — `--font-size-title`, weight 700, editable in-place.
4. **Properties strip** (only when page is a database row) — each property displayed as `Name: <value>`; click value to edit; "+ Add a property" at the end.
5. **Page actions strip**:
   - "Add comment" inline button (when no comments yet).
   - "Add icon" / "Add cover" / "Add comment" appears as ghost buttons under title when absent and on hover.

## Cover

- Source: external URL or uploaded file.
- Built-in galleries: Gradients, Solid colors, Patterns, Photo (Unsplash).
- Reposition: drag vertically while in reposition mode; persisted as `cover.position_y` (0–100).

## Icon

- Sources: Emoji (default), Upload, Link, Random.
- Emoji picker uses the standard emoji data set, grouped by category, searchable, with skin-tone selection.

## Title

- ContentEditable `<h1>`.
- Placeholder when empty: "Untitled".
- Enter / Shift+Enter: move focus to first body block.

## Properties strip (database-row pages)

- Two-column visual structure: label (left) + value (right).
- Hover row: edit chip lights up.
- "+ Add a property" at the bottom adds a property to the parent database.
- Hidden when page is not a database row.

## Share

The Share dialog is invoked from the TopBar Share button:

- Tabs: **Share** and **Publish**.
- Share tab:
  - "Invite" combobox to type emails / usernames.
  - List of current shares with role dropdown (Full access / Can edit / Can edit content (database parents only) / Can comment / Can view) and remove.
  - "Anyone at <workspace>" toggle with role.
  - Page parent inherits notice with link.
- Publish tab:
  - "Publish to web" toggle.
  - When on: public URL, expiry, allow-edit, allow-comment, search-engine indexing toggles.
  - "Copy URL" button.

## Tests

- Unit: header layout with/without cover/icon/properties.
- Playwright: change cover, change icon, edit title, edit property value, share dialog flows.
- Visual: each combination at light + dark.