# Pages

## Creating

- From sidebar — hover any node, click `+`.
- From the canvas — anywhere a child page can live, type `/page`.
- From keyboard — ⌘N / Ctrl+N creates a new page at workspace root.

## Layouts

The page header has three layout modes (per-page setting):

| Layout | What |
|---|---|
| **Default** | Compact header, body below |
| **Full-width** | Removes the maximum-width constraint on the body |
| **Cover** | Adds a large cover image at the top |

For database pages (a database row that you've opened), there's also:

- **Side peek** — opens in a slide-over panel from the database view. Closing returns to the database.
- **Side preview** — like side peek but pinned (Q&A surface keeps it open while you click around).
- **Modal** — center-screen modal.
- **Full page** — navigates into the row as a normal page.

The default mode is configured per database; users can override with the open-mode picker.

## Icons & covers

- Click the page title's icon slot → emoji, upload an image, or "External URL" (any URL Bloc can fetch).
- Click "Add cover" near the top — choose from gallery, upload, or random unsplash via the integration.

## Properties

A page that lives inside a database is a database row. Its properties appear above the canvas as a key/value list. Click any to edit; properties respect the schema's type.

## Page menu

The "⋯" in the top-right of the canvas. Sections:

- Style — full-width, small text, font.
- Layout — default / cover.
- Page customization — show backlinks, comments mode.
- Open in side peek.
- Version history.
- Copy link.
- Move to.
- Duplicate.
- Delete (archive).
- Export — Markdown / PDF / HTML.

## Reading mode

`⌘⇧L` / `Ctrl+Shift+L` — non-editable view. Useful for review, presentations, and reading long docs.

## Versions

Page menu → **Version history**. Opens the version panel; click any version to preview. Restore by duplicating the version into the current page (Bloc doesn't destructively overwrite — restoring creates a new version with the restored content).
