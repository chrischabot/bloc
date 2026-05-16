# Design System

All tokens live in `packages/ui/src/tokens/` and are exposed as CSS custom properties on `<html data-theme="light|dark">`. Components consume tokens — never hardcoded values.

## Colors

### Theme switching

`<html data-theme="light">` is default. Dark mode flips by toggling to `data-theme="dark"`. Tokens below show the **light** values first and **dark** values second.

### Surface (background) tokens

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--bg-primary` | `#ffffff` | `#191919` | App background, page background |
| `--bg-secondary` | `#f7f7f5` | `#202020` | Sidebar, hovered list rows |
| `--bg-tertiary` | `#ededec` | `#2f2f2f` | Code blocks, callouts, table headers |
| `--bg-overlay` | `rgba(15, 15, 15, 0.6)` | `rgba(15, 15, 15, 0.85)` | Modal scrim |
| `--bg-hover` | `rgba(55, 53, 47, 0.08)` | `rgba(255, 255, 255, 0.06)` | Hover surface for interactive rows |
| `--bg-active` | `rgba(55, 53, 47, 0.16)` | `rgba(255, 255, 255, 0.12)` | Pressed / selected |

### Text tokens

| Token | Light | Dark |
|-------|-------|------|
| `--text-primary` | `rgb(55, 53, 47)` | `rgba(255, 255, 255, 0.81)` |
| `--text-secondary` | `rgba(55, 53, 47, 0.65)` | `rgba(255, 255, 255, 0.6)` |
| `--text-tertiary` | `rgba(55, 53, 47, 0.4)` | `rgba(255, 255, 255, 0.4)` |
| `--text-placeholder` | `rgba(55, 53, 47, 0.3)` | `rgba(255, 255, 255, 0.3)` |
| `--text-inverse` | `#ffffff` | `#191919` |

### Border tokens

| Token | Light | Dark |
|-------|-------|------|
| `--border-default` | `rgba(55, 53, 47, 0.16)` | `rgba(255, 255, 255, 0.094)` |
| `--border-strong` | `rgba(55, 53, 47, 0.3)` | `rgba(255, 255, 255, 0.16)` |
| `--border-divider` | `rgba(55, 53, 47, 0.09)` | `rgba(255, 255, 255, 0.07)` |

### Accent

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--accent-primary` | `#2383e2` | `#529cca` | Links, primary CTAs |
| `--accent-primary-hover` | `#1a6dbb` | `#75b8e8` | |
| `--accent-focus` | `#2383e2` | `#529cca` | Focus rings |
| `--accent-danger` | `#eb5757` | `#ff7369` | Destructive |
| `--accent-success` | `#0f7b6c` | `#4dab9a` | |

### Rich-text colors (the 19-value palette)

These power the user-selectable rich-text colors and option colors. Match the values used by notion.so.

| Token | Light fg | Dark fg | Light bg | Dark bg |
|-------|----------|---------|----------|---------|
| `default` | `var(--text-primary)` | `var(--text-primary)` | transparent | transparent |
| `gray` | `#787774` | `#9b9b9b` | `#f1f1ef` | `#2f2f2f` |
| `brown` | `#9f6b53` | `#bb8a73` | `#f4eeee` | `#4a3228` |
| `orange` | `#d9730d` | `#c47d3a` | `#fbecdd` | `#5c3b23` |
| `yellow` | `#cb912f` | `#cab74a` | `#fbf3db` | `#564328` |
| `green` | `#448361` | `#529e72` | `#edf3ec` | `#243d30` |
| `blue` | `#337ea9` | `#5a91b9` | `#e7f3f8` | `#143a4e` |
| `purple` | `#9065b0` | `#a37bcb` | `#f4f0f7` | `#3c2d49` |
| `pink` | `#c14c8a` | `#cc6798` | `#fbeef5` | `#4e2c3c` |
| `red` | `#d44c47` | `#df5452` | `#fdebec` | `#522e2a` |

Background-only (`_background` variants) use the bg column with transparent fg — body text inherits `--text-primary`.

## Typography

### Font stack

```
--font-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol";
--font-serif: Lyon, ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
--font-mono: "SF Mono", ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace;
```

`Lyon` is licensed; for the open replica use `Source Serif Pro` (variable) — visually indistinguishable at body sizes.

### Type scale

| Token | Size (px) | Line-height | Weight | Use |
|-------|-----------|-------------|--------|-----|
| `--font-size-xs` | 12 | 16 | 400 | Captions, meta |
| `--font-size-sm` | 14 | 20 | 400 | Body small, UI |
| `--font-size-md` | 16 | 24 | 400 | Body, default editor |
| `--font-size-lg` | 18 | 28 | 400 | Lead paragraph |
| `--font-size-h3` | 20 | 28 | 600 | Heading 3 |
| `--font-size-h2` | 30 | 36 | 700 | Heading 2 |
| `--font-size-h1` | 40 | 48 | 700 | Heading 1 |
| `--font-size-title` | 40 | 48 | 700 | Page title |

Editor body has `letter-spacing: -0.005em` and `font-variation-settings: "wght" 400` (when variable font in use).

### Page typography options

User-toggleable on each page (matches Notion):

- **Default** (sans-serif body).
- **Serif** (serif body).
- **Mono** (monospace body).

Implemented as `data-font="default|serif|mono"` on the editor root.

## Spacing

8-px base scale exposed as tokens:

```
--space-0:   0;
--space-0.5: 2px;
--space-1:   4px;
--space-2:   8px;
--space-3:   12px;
--space-4:   16px;
--space-5:   20px;
--space-6:   24px;
--space-8:   32px;
--space-10:  40px;
--space-12:  48px;
--space-16:  64px;
```

## Radii

```
--radius-sm: 3px;
--radius-md: 4px;     /* buttons, inputs */
--radius-lg: 6px;     /* cards, callouts */
--radius-xl: 10px;    /* modals */
--radius-full: 9999px;
```

## Shadows

```
--shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
--shadow-sm: 0 2px 4px rgba(0,0,0,0.06);
--shadow-md: rgba(15,15,15,0.05) 0px 0px 0px 1px, rgba(15,15,15,0.1) 0px 3px 6px, rgba(15,15,15,0.2) 0px 9px 24px;  /* popover */
--shadow-lg: 0 16px 32px rgba(0,0,0,0.16);
```

Dark theme:
```
--shadow-md: rgba(0,0,0,0.1) 0px 0px 0px 1px, rgba(0,0,0,0.2) 0px 5px 10px, rgba(0,0,0,0.4) 0px 15px 40px;
```

## Iconography

- 1px stroke, 16/20/24 px sizes.
- Source: lucide-react where possible; custom SVGs in `packages/ui/src/icons/` for the rest (six-dot drag handle, plus-button, slash-icon).
- Emoji rendering: native (browser) but with `font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", emoji` to maximise consistency.

## Cursors

- Default: `default`.
- Text: `text` in editable blocks.
- Drag handle hover: `grab`; while dragging: `grabbing`.

## Motion

See `00-ui-overview.md#animation-system`.

## Density

Two density modes:

- **comfortable** (default): line-height 24px @ 16px body.
- **compact**: line-height 20px @ 14px body.

Per-user setting. Toggled via Settings → Appearance.

## Tokens packaged

`packages/ui/src/tokens/index.ts` exposes types:

```ts
export type ColorToken = '--bg-primary' | '--bg-secondary' | ... ;
export type SpaceToken = '--space-0' | ... ;
```

…so consumers get autocomplete. A CSS file is generated by `tools/codegen/tokens.ts` from the same source.