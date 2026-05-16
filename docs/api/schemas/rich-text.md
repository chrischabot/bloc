# Rich Text Schema

Every block that carries inline text uses a `rich_text` array. The array is the canonical representation of formatted, mentioned, and equation-bearing inline content.

## Top-level

```ts
type RichText = RichTextText | RichTextMention | RichTextEquation;
```

Every variant shares this base:

```jsonc
{
  "type": "text" | "mention" | "equation",
  "annotations": {
    "bold": false,
    "italic": false,
    "strikethrough": false,
    "underline": false,
    "code": false,
    "color": "default"
  },
  "plain_text": "rendered fallback string",
  "href": "https://... | null"
}
```

`plain_text` is server-computed on every response and must be derived from the structured payload; clients should not write it.

## `text`

```jsonc
{
  "type": "text",
  "text": {
    "content": "string",
    "link": { "url": "https://..." } | null
  },
  "annotations": { ... },
  "plain_text": "string",
  "href": "url | null"
}
```

- `content`: the rendered string; max 2000 chars per node.
- `link.url`: optional; mirrors `href`.
- `href` is the resolved URL: equals `link.url` when set, otherwise null.

## `mention`

A mention references another object. Six subtypes:

```jsonc
{
  "type": "mention",
  "mention": {
    "type": "user" | "page" | "database" | "date" | "link_preview" | "template_mention",
    // exactly one of:
    "user":      { /* user object */ },
    "page":      { "id": "uuid" },
    "database":  { "id": "uuid" },
    "date":      { "start": "2026-05-15", "end": null, "time_zone": null },
    "link_preview": { "url": "https://..." },
    "template_mention": { /* see below */ }
  },
  "annotations": { ... },
  "plain_text": "rendered fallback",
  "href": "url | null"
}
```

### Template mentions

```jsonc
{
  "type": "template_mention",
  "template_mention": {
    "type": "template_mention_date" | "template_mention_user",
    "template_mention_date": "today" | "now",
    "template_mention_user": "me"
  }
}
```

## `equation`

```jsonc
{
  "type": "equation",
  "equation": { "expression": "E = mc^2" },
  "annotations": { ... },
  "plain_text": "E = mc^2",
  "href": null
}
```

- `expression` is a LaTeX/KaTeX string. Rendered with KaTeX on the client.

## Annotations

| Field | Type | Default |
|-------|------|---------|
| `bold` | bool | false |
| `italic` | bool | false |
| `strikethrough` | bool | false |
| `underline` | bool | false |
| `code` | bool | false |
| `color` | enum (see below) | `"default"` |

### Color enum

Foreground colors: `default | gray | brown | orange | yellow | green | blue | purple | pink | red`

Background colors: `gray_background | brown_background | orange_background | yellow_background | green_background | blue_background | purple_background | pink_background | red_background`

The full set of 19 values is normative. UI palettes in `docs/frontend/01-design-system.md#colors` map each token to its HSL values.

## Length limits

| Constraint | Value |
|-----------|-------|
| Max rich_text array length per block | 100 nodes |
| Max content per text node | 2000 chars |
| Max URL length | 2000 chars |

Exceeding limits returns `400 invalid_request` with `details.path` pointing to the offending node.

## Validation (Zod)

`packages/shared/src/rich-text.ts` exports `RichTextSchema = z.discriminatedUnion('type', [...])`. Inputs are validated with `.strict()` everywhere.

## Tests

- Unit tests for every annotation combination round-trip via the schema.
- Contract tests assert API responses match this shape exactly, including `plain_text` derivation.
- Visual tests render every annotation combination and snapshot the result.