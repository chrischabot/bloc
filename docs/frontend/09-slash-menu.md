# Slash Menu

Triggers on `/` typed in any text-bearing block when at the start of the block's content or after a space.

## Layout

```
┌────────────────────────────────────────────────────┐
│ Basic blocks                                       │
│  [icon] Text         Just start writing            │
│  [icon] Heading 1    Big section heading           │
│  [icon] Heading 2    Medium section heading        │
│  ...                                                │
│ Media                                              │
│  [icon] Image        Upload or embed with a link   │
│  ...                                                │
│ Embeds                                             │
│  [icon] PDF                                        │
│  ...                                                │
│ Advanced blocks                                    │
│  [icon] Table of contents                          │
│  ...                                                │
│ Inline                                             │
│  [icon] Mention a person                           │
│  [icon] Mention a page                             │
│  [icon] Date or reminder                           │
│  [icon] Equation                                   │
└────────────────────────────────────────────────────┘
```

- Width 360 px, max height 480 px (scrolls).
- Search filters by name + keyword (e.g. `/h1`, `/todo`, `/check`).
- Sections: Basic blocks, Media, Embeds, Advanced blocks, Inline, Database, Suggested (recent + AI).
- Each item: 24×24 icon, name, hint description (greyed).
- Active item highlighted; preview of result rendered to the right (deferred — Notion shows a screenshot).

## Keyboard

- `↑ / ↓` move; loops at ends.
- `Enter` confirm.
- `Esc` close.
- `→` enter submenu for items with sub-options (e.g. Database → Inline / Full page).
- Typing filters live; the search string after `/` is `query`; on space the slash is rejected and `/` becomes literal.

## Items

Full list (with keywords used to match):

| Item | Block type | Keywords |
|------|------------|----------|
| Text | paragraph | text, paragraph, p |
| Heading 1 | heading_1 | h1, heading, # |
| Heading 2 | heading_2 | h2, heading, ## |
| Heading 3 | heading_3 | h3, heading, ### |
| Bulleted list | bulleted_list_item | bullet, ul, - |
| Numbered list | numbered_list_item | numbered, ol, 1. |
| To-do list | to_do | todo, task, check, [] |
| Toggle list | toggle | toggle, > |
| Quote | quote | quote, " |
| Divider | divider | divider, --- |
| Link to page | link_to_page | link, mention |
| Callout | callout | callout, info |
| Code | code | code, ``` |
| Equation | equation block | equation, latex, math |
| Page | child_page | page, sub-page |
| Synced block | synced_block | sync |
| Table of contents | table_of_contents | toc |
| Breadcrumb | breadcrumb | breadcrumb |
| Columns | column_list (preset 2) | columns, 2col, layout |
| Image | image | image, picture |
| Video | video | video |
| Audio | audio | audio (via file block) |
| File | file | file |
| PDF | pdf | pdf |
| Bookmark | bookmark | bookmark |
| Embed | embed | embed, iframe |
| Mention a person | inline mention | @ |
| Mention a page | inline mention | @page |
| Date or reminder | inline date | date, today |
| Database — inline | child_database (inline) | db, database |
| Database — full page | child_database | db, full |

Database type subitems (inline / full page) appear in a submenu.

## Behaviour

- On selection: replaces the current paragraph if empty; otherwise inserts a new block below.
- For block types with parameters (e.g. Image, Embed, Mention), a follow-up popover collects the parameter.

## Tests

- Unit: filter algorithm.
- Playwright: type "/h1", press Enter; verify heading_1 created with focus.
- Visual: menu open with empty filter; with filter "tab".