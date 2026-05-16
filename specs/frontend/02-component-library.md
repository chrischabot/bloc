# Component Library (Primitives)

All primitives live in `packages/ui/src/components/` and are themed exclusively through design tokens.

## Inventory

| Component | Purpose |
|-----------|---------|
| `Button` | Primary, secondary, ghost, danger variants. Icon-only via `<IconButton/>`. |
| `IconButton` | Square 28×28 (sm) / 32×32 (md) / 40×40 (lg) with centred icon |
| `Tooltip` | Hover/focus only; 250ms delay; arrow optional |
| `Popover` | Floating panel anchored to trigger; close on outside click + Esc |
| `Menu` | Keyboard-navigable list of items; supports nested submenus |
| `ContextMenu` | Right-click variant; uses Popover internals |
| `Dialog` | Modal with scrim; trap focus; restore focus on close |
| `Drawer` | Right-edge slide-over for settings sub-pages |
| `Toast` | Bottom-right transient notifications; auto-dismiss 4s |
| `Toggle` | Boolean toggle (Switch) |
| `Checkbox` | Tri-state supported |
| `RadioGroup` | |
| `Select` | Single-select dropdown |
| `Combobox` | Autocomplete + free input |
| `MultiCombobox` | Combobox with chip array (for multi-select / people / relation pickers) |
| `Tabs` | Horizontal tab bar; view tabs in databases use a styled variant |
| `Tag` | Pill with color, label, optional close X |
| `Avatar` | User avatar; gradient fallback by user id hash |
| `AvatarStack` | Up to 3 visible + `+N` overflow |
| `Skeleton` | Loading placeholder |
| `Spinner` | Small inline loader |
| `Resizer` | Drag handle for column / sidebar resize |
| `DragHandle` | Six-dot icon trigger |
| `EmojiPicker` | Native emoji picker (uses `emoji-mart`-compatible data set; styled to match Notion) |
| `IconPicker` | Emoji + upload + URL tabs |
| `DatePicker` | Calendar + time inputs |
| `ColorPicker` | 19-value palette grid |
| `Slider` | For column-width / opacity controls |
| `KeyboardKey` | Renders a styled `<kbd>` |

## Variants and props

Each component has an explicit Zod/TS variant schema; no string-typed props for variants. Example:

```tsx
type ButtonProps = {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;
```

## Behavioural contracts

- **Focus management.** Modal/Dialog/Popover/Menu trap focus; restore on close. Use `react-aria` or a small custom hook in `packages/ui/src/hooks/`.
- **Escape.** Every overlay closes on Esc; Esc bubbles to next overlay on stack.
- **Outside-click.** Popover/Menu closes on outside pointerdown unless a trigger maintains hover (sub-menu hover bridge).
- **Keyboard.** Menu / Combobox / Select: ↑ ↓ to navigate, Enter to confirm, Tab to commit selection in combobox.
- **Aria.** Every interactive component has appropriate role / aria-expanded / aria-selected. Verified by axe in tests.

## Story coverage

Every component has stories under `packages/ui/stories/<Component>.stories.tsx` covering:

- Default
- All variants
- Disabled
- Loading (where applicable)
- Edge cases (long content, RTL, very long labels)

## Tests

- Unit: Vitest + Testing Library for all components; ≥ 90% line coverage.
- A11y: axe assertion on every story.
- Visual: snapshot per story, compared against `reference/screenshots/components/`.