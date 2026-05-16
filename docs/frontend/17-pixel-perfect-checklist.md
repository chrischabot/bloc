# Pixel-Perfect Acceptance Checklist

Walk this checklist for Phase 13. Each item: take a side-by-side screenshot of our app and notion.so (at the same viewport, theme, and locale), attach to the release notes, tick the box.

The agent uses the `Browser Operator` tool on `notion.so` reference URLs to capture upstream screenshots, and Playwright to capture ours.

## Global

- [ ] Light theme background `#ffffff`; dark theme `#191919`.
- [ ] Body text color matches token within ΔE < 1.
- [ ] Cursor caret thickness, blink rate, and color match.
- [ ] Selection background color matches.
- [ ] Focus ring shape and color match.
- [ ] Scrollbar styling (thin, themed) matches.

## Sidebar

- [ ] Workspace switcher position, padding, and chevron position.
- [ ] Quick action row order: Search · Updates · Settings · New page.
- [ ] Section header chevron rotation animation timing (120 ms ease-out).
- [ ] Row hover background opacity (8% in light, 6% in dark).
- [ ] Active page row: accent strip on left, font weight 600, background.
- [ ] Page icon size (16×16), spacing to title (6 px).
- [ ] Drag handle visibility on hover at exact 16-px left offset.
- [ ] Footer order: Templates · Import · Trash · Help · New page.

## TopBar

- [ ] Height 48 px.
- [ ] Breadcrumb truncation behaviour with three+ ancestors.
- [ ] Share button outline + label.
- [ ] Bell + favourite + more buttons size 28×28 with 4 px gap.
- [ ] Shadow under top bar when content scrolls (1 px hairline).

## Page header

- [ ] Cover aspect ratio + height (280 px).
- [ ] Icon size 78 with cover, 40 without; vertical offset −16 with cover.
- [ ] Title font size 40 / line-height 48 / weight 700 / margin-top 8.
- [ ] "Add icon / Add cover / Add comment" buttons rendered on hover (or always when empty), 8 px gap.

## Editor

- [ ] Body font 16 px / 24 line-height; serif and mono variants tested.
- [ ] Block gutter 96 px on ≥ xl; 24 px on ≤ md.
- [ ] Drag handle + plus icons at exact y-baseline of first line.
- [ ] Bulleted list bullet glyph and indent.
- [ ] Numbered list numbering across non-numbered siblings.
- [ ] To-do checkbox size 16×16, checked state animation.
- [ ] Toggle chevron rotation 90° on open, 220 ms.
- [ ] Code block padding, font (mono), language picker placement.
- [ ] Callout layout (icon 32, padding, background variants).
- [ ] Quote left border thickness 3 px, italic.
- [ ] Equation block centring.
- [ ] Image alignment toolbar appears at exact distance on hover.
- [ ] Table cells with grid lines, header row toggle, plus buttons on edges.
- [ ] Column-list resize handle and minimum widths.
- [ ] Synced block badge "Synced" position and color.

## Slash menu

- [ ] Width 360 px, item height 32 px, icon 20×20 with 12 px gap to label.
- [ ] Section headers font size 12, weight 600, color `--text-tertiary`.
- [ ] Active item background, keyboard cycle behaviour.

## Formatting toolbar

- [ ] Floating position offset 8 px above selection.
- [ ] Group separators (1 px lines) between transform / annotations / color / extras.
- [ ] Active annotation highlight.

## Database — table view

- [ ] Header row sticky on vertical scroll.
- [ ] First column sticky on horizontal scroll.
- [ ] Column resize handle 4-px hit area.
- [ ] Row height comfortable 34, compact 28.
- [ ] Summary row at bottom on enable.

## Database — board view

- [ ] Column header layout: title + count badge + add card.
- [ ] Card padding, shadow on drag.
- [ ] Hidden columns dropdown.

## Database — gallery view

- [ ] Card minimum 240, gap 16.

## Database — list view

- [ ] Single divider between rows, property chip gap 8.

## Database — calendar view

- [ ] Month grid 7×6, day cell aspect ratio.
- [ ] Event bars vertical alignment.

## Database — timeline view

- [ ] Axis ticks and zoom levels.
- [ ] Bar drag handles 4 px.

## Comments

- [ ] Yellow highlight color matches.
- [ ] Thread card padding and avatar position.
- [ ] Inbox layout per tab.

## Share dialog

- [ ] Tabs Share / Publish.
- [ ] Role dropdown row, member row layout.

## Animations

- [ ] Sidebar collapse 320 ms.
- [ ] Modal scrim fade 220 ms.
- [ ] Toggle chevron 220 ms.
- [ ] Toast slide-in 120 ms.

## Reduced motion

- [ ] All non-essential animations honour `prefers-reduced-motion`.

## Localisation (optional v1)

- [ ] Latin extended characters render correctly in title and body.
- [ ] RTL stub: editor remains LTR; UI does not break in RTL locale.

## AI surfaces

- [ ] Writer popover anchor offset 8 px, width 480 px, shadow `--shadow-md`.
- [ ] Streaming tokens appear with the soft typing animation; cancel via Esc.
- [ ] Q&A modal centred top, sources accordion renders with greyed breadcrumb.
- [ ] Agent panel right-edge full-height, 480 px on ≥ xl; tool-call cards collapsed by default.
- [ ] AI Block "Re-generate" placement (top-right) and disabled state during run.
- [ ] AI Autofill column-header AI badge size 14×14 and tooltip "Auto-filled by Notion AI".
- [ ] Meeting Notes capture waveform, elapsed time HH:MM:SS, pause / stop button states.

## Sites / Publishing

- [ ] Publish dialog tabs **Share** / **Publish** alignment matches reference.
- [ ] Custom-domain DNS wizard step list styling.
- [ ] Public renderer top navbar height 56 px; sub-page tree drawer on `≤md`.
- [ ] Footer "Powered by Notion" right-aligned, 12 px text.

## Buttons & Automations

- [ ] Button block pill (default) padding 4 / 12, radius `--radius-md`, hover `--bg-hover`.
- [ ] Button block hover-gear at exact right edge offset.
- [ ] Step editor list: drag handle six-dot, "+ Add step" CTA at the bottom.
- [ ] Automation enabled toggle position (right of automation row).

## Forms

- [ ] Form page max-width 720 px, centred.
- [ ] Required-field marker red asterisk after the label.
- [ ] Submit button full-width on `<md`, auto on `≥md`.
- [ ] Confirmation message card padding and emoji.

## Charts

- [ ] Each chart kind axis label position and color.
- [ ] Legend positions (top/right/bottom/none) honoured.
- [ ] Tooltip shape and shadow on hover.
- [ ] Donut centre value & label typography.

## Sub-items & Dependencies

- [ ] Table expand chevron rotation 90° on open.
- [ ] Sub-item indentation 24 px per level.
- [ ] Timeline dependency arrow head shape, stroke `--text-tertiary`, hover highlight.
- [ ] Drag-to-create dependency cursor changes to crosshair.

## Home

- [ ] Greeting font size 30 px, weight 700.
- [ ] Widget grid gap 16 px; card radius `--radius-lg`.
- [ ] Widget overflow menu opens via three-dots IconButton at the top-right.

## Database page layouts

- [ ] Customize-page drawer width 480 px, sections collapsible.
- [ ] Properties list mode dropdown items "Always show / Hide when empty / Always hide".
- [ ] Backlinks / Comments / Discussions dropdown options "Expanded / Show in popover / Off".
- [ ] Lock-database toggle visual matches reference.

## Backlinks & Reminders

- [ ] Backlinks popover pill rendered above first body block.
- [ ] Backlink row hover background.
- [ ] Reminder pill bell icon size 12×12, "Notified" check tick at the right.

## Wikis & Verification

- [ ] Verification chip variants (verified / expiring / expired / unverified) with exact colors.
- [ ] Wiki index columns Title / Owner / Verification / Last edited.
- [ ] Turn-into-wiki confirmation dialog body text.

## Final sign-off

- [ ] All Playwright visual diffs < 1%.
- [ ] All cross-cutting items in `docs/PLAN.md#cross-cutting` ticked.
- [ ] Release notes attach the comparison screenshot bundle.