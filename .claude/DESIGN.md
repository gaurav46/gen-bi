# Design System Brief

> Source of truth for all Gen-BI UI work. Documents the existing shadcn/ui + Tailwind v4 design system
> with teal/cyan primary direction layered on top. Downstream agents use this for design-aware decisions.

## Design Personality

Clean and professional BI tool. Neutral palette with a single teal/cyan accent. Data is the star --
dense layouts that respect power users while maintaining clear visual hierarchy for business users.
Desktop-first (1024px+).

## Color Tokens

The project uses oklch color space throughout. The existing token system in
`packages/frontend/src/index.css` is fully intact -- only `--primary`, `--ring`, `--sidebar-primary`,
and `--sidebar-ring` change from neutral monochrome to teal/cyan.

### Light mode `:root` overrides (teal/cyan primary)

```css
--primary: oklch(0.55 0.15 195);          /* teal-600 equivalent */
--primary-foreground: oklch(0.985 0 0);   /* white text on primary */
--ring: oklch(0.55 0.15 195);             /* match primary for focus rings */
--sidebar-primary: oklch(0.55 0.15 195);
--sidebar-ring: oklch(0.55 0.15 195);
```

### Dark mode `.dark` overrides

```css
--primary: oklch(0.75 0.15 195);          /* teal-400 equivalent, readable on dark */
--primary-foreground: oklch(0.145 0 0);   /* dark text on bright primary */
--ring: oklch(0.75 0.15 195);
--sidebar-primary: oklch(0.75 0.15 195);
--sidebar-ring: oklch(0.75 0.15 195);
```

### Tokens that stay unchanged

All other tokens remain as-is from the shadcn neutral base:

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | Page background |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Body text |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Card surfaces |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Subdued backgrounds |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | Secondary text |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | Borders |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Error/delete |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Secondary actions |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Hover/active states |

### Chart colors (unchanged)

Light: orange `oklch(0.646 0.222 41.116)`, teal `oklch(0.6 0.118 184.704)`, navy `oklch(0.398 0.07 227.392)`, yellow `oklch(0.828 0.189 84.429)`, amber `oklch(0.769 0.188 70.08)`

### Semantic status colors (new -- add to index.css)

Use for connection status, sync progress, and validation states:

```css
--success: oklch(0.60 0.15 155);      /* green -- connected, complete */
--warning: oklch(0.75 0.15 85);       /* amber -- syncing, pending */
--info: oklch(0.55 0.15 195);         /* teal -- same as primary */
```

In Tailwind, reference via `text-primary`, `bg-primary`, `border-primary`, etc. For semantic colors,
add them to `@theme inline` the same way destructive is handled.

## Typography

### Font stack

Use system fonts. No custom font loading -- keeps the tool fast and avoids layout shift.

```
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

This is Tailwind's default `font-sans`. No override needed.

### Dense type scale

For a data-dense BI tool, use smaller defaults than typical:

| Use | Class | Size |
|---|---|---|
| Page title | `text-lg font-semibold` | 18px |
| Section heading | `text-sm font-semibold` | 14px |
| Body / table cell | `text-sm` | 14px |
| Metadata label | `text-xs text-muted-foreground` | 12px |
| Badge / tag | `text-xs font-medium` | 12px |
| Monospace (SQL, types) | `text-xs font-mono` | 12px |

Avoid `text-base` (16px) as the default body size -- `text-sm` (14px) is the workhorse for dense layouts.
Reserve `text-base` and above for landing pages or onboarding flows.

### Weight usage

- `font-normal` (400): body text, table cells
- `font-medium` (500): labels, badges, nav items
- `font-semibold` (600): headings, active nav items
- `font-bold` (700): avoid in the app shell; reserve for marketing

## Spacing (Dense Rules)

Dense means tighter than Tailwind defaults. These are the spacing rules for the app:

| Context | Padding | Gap | Tailwind classes |
|---|---|---|---|
| Page container | `p-4` | -- | `p-4` |
| Card body | `p-3` | `gap-2` | `p-3 space-y-2` |
| Table cell | `px-3 py-1.5` | -- | `px-3 py-1.5` |
| Table header | `px-3 py-2` | -- | `px-3 py-2 font-medium` |
| Form field stack | -- | `gap-1.5` | `space-y-1.5` |
| Inline items | -- | `gap-1.5` | `gap-1.5` |
| Section separator | `my-3` | -- | `my-3` |
| Nav items | `px-2 py-1.5` | `gap-0.5` | `px-2 py-1.5` |

General rule: when in doubt, use `gap-2` (8px) between items and `p-3` (12px) for container padding.
Avoid `p-6` or larger inside the app shell.

### Radius

Base radius is `0.625rem` (10px) from the existing config. Use as-is:

- `rounded-lg` (var(--radius)): cards, dialogs
- `rounded-md` (var(--radius) - 2px): buttons, inputs
- `rounded-sm` (var(--radius) - 4px): badges, small elements

## App Shell Layout

### Sidebar

| Property | Value |
|---|---|
| Expanded width | `w-56` (224px) |
| Collapsed width | `w-14` (56px) -- icon-only |
| Background | `bg-sidebar` |
| Border | `border-r border-sidebar-border` |
| Transition | `transition-[width] duration-200` |

### Navigation items (Phase 1)

1. **Schema Explorer** -- primary workspace
2. **Settings** -- connection config

### Navigation items (future slices)

3. Query Editor
4. Dashboards

Each nav item: icon + label when expanded, icon-only with tooltip when collapsed.
Active state: `bg-sidebar-accent text-sidebar-accent-foreground`.

### Main content area

```
<div class="flex h-screen">
  <aside class="...sidebar classes...">...</aside>
  <main class="flex-1 overflow-auto p-4">...</main>
</div>
```

No max-width constraint on main content -- it fills available space. The old `App.css` rule
`#root { max-width: 1280px }` should be removed once the app shell is built.

### Responsive behavior

- **1024px+**: full sidebar + content
- **Below 1024px**: sidebar collapses to icon-only by default, overlay on tap
- **Below 640px**: sidebar hidden, hamburger menu. Minimal support -- not a priority.

## Schema Explorer Layout

### Structure

```
Sidebar | Schema Explorer
         |--[ Search/Filter bar ]---------------------|
         |--[ Table list (left) ]--[ Detail (right) ]-|
```

### Table list panel

- Width: `w-72` (288px) or `w-80` (320px), fixed
- Scrollable list of tables/views
- Each item: table icon + name + row count badge
- Click to select and show columns in detail panel
- Search input at top filters the list

### Detail panel (columns view)

- Fills remaining width
- Table header: table name (`text-lg font-semibold`) + type badge (TABLE/VIEW)
- Column list as a dense table:

| Column | Type | Nullable | FK | Idx |
|---|---|---|---|---|
| `id` | `int4` | -- | -- | PK |
| `user_id` | `int4` | -- | `users.id` | FK |
| `name` | `varchar` | YES | -- | -- |

- Column name: `text-sm font-mono`
- Type: `text-xs font-mono text-muted-foreground`
- Nullable: show "YES" in `text-xs text-muted-foreground` or leave blank
- FK indicator: link text in `text-xs text-primary` (clickable to navigate)
- Index indicator: badge `text-xs` with PK/UQ/IDX

### Expand/collapse

Tables in the list panel can expand inline to preview columns without selecting.
Use a chevron icon (`ChevronRight`/`ChevronDown`) for the toggle.

## Data Table Patterns

For any tabular metadata display:

- Use `<table>` with `text-sm` base
- Header row: `bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide`
- Cell padding: `px-3 py-1.5`
- Row hover: `hover:bg-muted/50`
- Row borders: `border-b border-border`
- Zebra striping: not needed if hover state is present
- Monospace for data types, column names, SQL: `font-mono text-xs`
- Null/empty values: `text-muted-foreground italic`

## Progress/Status Patterns

For multi-step flows (connect -> discover -> analyze -> embed):

### Step indicator

Horizontal stepper with 4 states:

- **Completed**: `text-primary` + `Check` icon
- **Active/In progress**: `text-primary` + spinner (or pulsing dot)
- **Pending**: `text-muted-foreground` + circle outline
- **Error**: `text-destructive` + `AlertCircle` icon

Steps connected by a line: `border-t-2 border-border` (completed: `border-primary`).

### Connection status badge

- Connected: `bg-success/10 text-success` + dot
- Disconnected: `bg-destructive/10 text-destructive` + dot
- Syncing: `bg-warning/10 text-warning` + spinner

### Toast/notification

Use shadcn Sonner (toast) for transient feedback. Keep it minimal.

## Icon Usage

Lucide icons throughout (configured in `components.json`). Standard size: `size-4` (16px).
Dense contexts can use `size-3.5` (14px).

| Concept | Icon | Usage |
|---|---|---|
| Schema/database | `Database` | Nav, page headers |
| Table | `Table2` | Table list items |
| View | `Eye` | View list items |
| Column | `Columns3` | Column section headers |
| Primary key | `Key` | PK indicator |
| Foreign key | `Link` | FK indicator |
| Index | `Zap` | Index indicator |
| Settings | `Settings` | Nav item |
| Search | `Search` | Filter inputs |
| Expand/collapse | `ChevronRight` / `ChevronDown` | Tree toggles |
| Connection | `Plug` | Connection status |
| Query | `Terminal` | Query editor nav (future) |
| Dashboard | `LayoutDashboard` | Dashboards nav (future) |
| Refresh/sync | `RefreshCw` | Sync actions |
| Check/success | `Check` | Completed steps |
| Error/alert | `AlertCircle` | Error states |
| Close | `X` | Dialogs, dismissals |
| Menu | `PanelLeftClose` / `PanelLeft` | Sidebar toggle |

## Component Inventory

### Already installed (shadcn/ui)

- `Button` (with `xs`, `sm`, `default`, `lg`, `icon` sizes + variants)
- `Input`
- `Label`
- `Card` (CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
- `Checkbox`

### Install for Phase 1

These are needed for the schema explorer and settings slices:

| Component | Why |
|---|---|
| `Sidebar` | App shell navigation |
| `Table` | Schema column display |
| `Badge` | Type badges, status indicators |
| `Tooltip` | Collapsed sidebar labels, truncated text |
| `Collapsible` | Expandable table rows in schema list |
| `ScrollArea` | Scrollable table list and detail panels |
| `Separator` | Section dividers |
| `Skeleton` | Loading states |
| `Sonner` | Toast notifications |
| `Dialog` | Connection form, confirmations |
| `Select` | Form dropdowns |
| `Tabs` | Future: switching between table/view filters |

### Install command

```bash
cd packages/frontend && npx shadcn@latest add sidebar table badge tooltip collapsible scroll-area separator skeleton sonner dialog select tabs
```

## Component Conventions

- **Class merging**: use `cn()` from `@/lib/utils` for all conditional classes
- **Variants**: use `class-variance-authority` (cva) for multi-variant components (already used in Button)
- **Slots**: components use `data-slot` attributes for styling hooks
- **File structure**: one component per file in `@/components/ui/`
- **App components**: non-shadcn components go in `@/components/` (not `ui/`)

## Accessibility Constraints

- **Focus**: all interactive elements use `focus-visible:ring-[3px] focus-visible:ring-ring/50` (from Button pattern)
- **Touch targets**: minimum `h-8` (32px) for dense controls, `h-9` (36px) for primary actions. Below 44px is acceptable for desktop-first -- touch is secondary.
- **Color contrast**: teal primary (`oklch(0.55 0.15 195)`) on white background passes WCAG AA for large text (3:1+). For small text, use on `--primary-foreground` or as a background with white text.
- **Keyboard nav**: sidebar items, table rows, and tree nodes must be keyboard-navigable
- **Reduced motion**: respect `prefers-reduced-motion` -- disable transitions/animations. The existing `App.css` already checks this for the logo spin.

## Quality Checklist

- [ ] Teal primary tokens injected into `index.css` (both light and dark)
- [ ] Color contrast passes WCAG AA (4.5:1 normal text, 3:1 large text)
- [ ] All interactive elements have visible focus states
- [ ] Dense spacing applied consistently (`text-sm` base, `p-3` cards, `px-3 py-1.5` cells)
- [ ] Sidebar collapses cleanly at narrow widths
- [ ] Keyboard navigation works for sidebar, table list, column table
- [ ] Loading states use Skeleton components, not blank space
- [ ] `prefers-reduced-motion` respected


[x] Reviewed
