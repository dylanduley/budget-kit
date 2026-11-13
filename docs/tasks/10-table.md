# 10: Table

A data table driven by a columns config, with a required caption, right-aligned numeric columns and an empty state.

**Depends on**: 00

**Parallel group**: A

## Conventions (identical in every component task)
- **Folder**: one folder per component, `packages/ui/src/<Name>/`, containing `<Name>.tsx`, `<Name>.module.css`, `<Name>.stories.tsx` (builder) and `<Name>.test.tsx` (QA). No per-folder `index.ts`; named exports only; the public API is re-exported from `packages/ui/src/index.ts`.
- **Styling**: CSS Modules (`import styles from './<Name>.module.css'`). No new dependency: Vite/Storybook, Vitest and Next (`transpilePackages`) handle it, and `vite/client` and Next both ship the type declaration. Every colour, spacing, radius, font-size and shadow value is a `var(--bk-*)` token from `src/tokens.css`; colours use only semantic `--bk-color-*` tokens, in text/background pairs listed in `src/tokens.pairs.ts`. No Tailwind, no colour literals, no `style` prop for static styling.
- **State hooks**: variants and states are exposed as `data-*` attributes (named under Behaviour). CSS selects on them and tests query them; tests never assert on class names or computed styles (jsdom has no layout).
- **Props**: `className` is appended on the root element; `ref` (React 19 ref-as-prop, no `forwardRef`) and remaining native props go to the root, or for form fields to the native control.
- **Focus**: interactive elements show `box-shadow: var(--bk-focus-ring)` with `outline: 2px solid transparent` on `:focus-visible`; focus styling is never removed without this replacement.
- **Client boundary**: a file starts with `'use client';` only if it uses state, effects, refs or event handlers of its own (stated under Files).
- **Stories**: CSF3, `import type { Meta, StoryObj } from '@storybook/react-vite'`, `title: 'Components/<Name>'`, `satisfies Meta<typeof <Name>>`. `src/stories.a11y.test.tsx` picks up every story automatically.
- **Tests**: `<Name>.test.tsx` is written by QA from the acceptance criteria (Vitest globals, Testing Library, `@testing-library/user-event`); the builder does not create it.

## Files
- `packages/ui/src/Table/Table.tsx` (no `'use client'`; `useId` only)
- `packages/ui/src/Table/Table.module.css`
- `packages/ui/src/Table/Table.stories.tsx`
- `packages/ui/src/Table/Table.test.tsx` (QA)
- `packages/ui/src/index.ts`: add `export { Table, type TableColumn, type TableProps } from './Table/Table';`

## Props / API
```ts
export interface TableColumn<Row> {
  key: string;                       // unique within the table
  header: string;
  cell: (row: Row) => ReactNode;
  numeric?: boolean;                 // default false; right-aligns header and cells
  rowHeader?: boolean;               // default false; cells render as <th scope="row">
}

export interface TableProps<Row> {
  caption: string;                   // required
  captionHidden?: boolean;           // default false; true hides it visually only
  columns: TableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  emptyState?: ReactNode;            // default 'Nothing to show yet.'
  className?: string;                // appended on the scroll wrapper (root)
}

export function Table<Row>(props: TableProps<Row>): ReactElement;
```
The table renders whatever `cell` returns; money cells are formatted by the caller from integer cents.

## Behaviour
- Root: a scroll wrapper `<div role="region" aria-labelledby={captionId} tabindex="0">` with `overflow-x: auto`, so a wide table scrolls inside it on a phone and keyboard users can scroll it. Inside: one `<table>`.
- `<caption id={captionId}>` is always the table's first child. With `captionHidden` it gets `data-hidden="true"` and is hidden with the clip technique (never `display: none` / `visibility: hidden`).
- `<thead>`: one row with one `<th scope="col">` per column, text `header`, in `columns` order.
- `<tbody>`: one `<tr>` per row, in `rows` order, keyed by `getRowKey`; one cell per column: `<th scope="row">` if the column has `rowHeader`, else `<td>`.
- Numeric columns: the header `<th>` and every cell carry `data-numeric="true"`, styled `text-align: right` and `font-variant-numeric: tabular-nums`. Other cells are left-aligned and have no `data-numeric`.
- Empty state: when `rows` is empty, `<thead>` is still rendered and `<tbody>` holds a single `<tr>` with one `<td colSpan={columns.length} data-part="empty">` containing `emptyState`.
- Colours: header cells `--bk-color-text` on `--bk-color-surface-subtle`, `--bk-font-weight-semibold`; body cells `--bk-color-text` on `--bk-color-surface`; row-header cells same as body cells with `--bk-font-weight-medium`; empty-state text `--bk-color-text-muted`; visible caption `--bk-color-text-muted`, left-aligned; 1px `--bk-color-border` between rows. Cell padding and font size (`--bk-font-size-sm`) from tokens.
- No sorting, selection or pagination. Interactive content returned by `cell` (e.g. a delete button) stays in normal tab order.

## Stories required
`Default` (expense-like rows: date, category, note, right-aligned amount), `WithRowHeader` (first column as row header), `HiddenCaption`, `Empty` (default empty text), `CustomEmptyState`, `WithRowAction` (last column renders a native `<button type="button">` named `Delete <note>` per row; Button, task 01, may not be merged yet, so do not import or style it), `NarrowViewport` (in a 320px-wide container, to show horizontal scrolling).

## Acceptance criteria
Spec:
- [ ] Real `<table>` with `<th scope>`: `getByRole('table', { name: <caption> })` finds a `<table>` element; every column produces a `columnheader` that is a `<th scope="col">` with the column's `header` text, in order.
- [ ] Caption required (can be visually hidden): omitting `caption` is a type error; the `<caption>` is the first child of the `<table>` and contains the caption text; with `captionHidden` it is still in the DOM with `data-hidden="true"`, the table's accessible name is unchanged, and its CSS rule does not use `display: none` or `visibility: hidden`.
- [ ] Columns config and rows: with 3 rows and 4 columns, `<tbody>` has 3 rows of 4 cells each, in `rows` and `columns` order, each containing what `cell(row)` returned.
- [ ] A column with `rowHeader` renders its body cells as `<th scope="row">`; all other body cells are `<td>`.
- [ ] Right-aligned numeric columns: for a column with `numeric`, its header and every one of its body cells have `data-numeric="true"`, and no cell of a non-numeric column has that attribute; in the `Default` story in Storybook the amount header and amounts are right-aligned and digits line up.
- [ ] Optional empty state: with `rows={[]}` the header row is still rendered and `<tbody>` contains exactly one row with one `<td>` whose `colspan` equals the number of columns and whose text is `Nothing to show yet.`; with `emptyState={<p>No expenses yet</p>}` that content is shown instead. With one or more rows, no `[data-part="empty"]` exists.
- [ ] `getRowKey` is used for React keys: rendering rows and then re-rendering with the first row removed logs no React key warning (`console.error` spy).
- [ ] The scroll wrapper has `role="region"`, `tabindex="0"`, and an accessible name equal to the caption.
- [ ] In `NarrowViewport` in Storybook, the table scrolls horizontally inside the wrapper (the page itself does not scroll sideways), and the wrapper can be focused with Tab and scrolled with the arrow keys.
- [ ] `Table` is generic: `cell: (row) => row.note` type-checks against the row type with no cast, and a `cell` reading a property the row type lacks is a type error.

Blanket:
- [ ] Typed props exactly as under Props / API; no `any`, `@ts-ignore` or `@ts-expect-error` in non-test files.
- [ ] Uses tokens: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' Table.module.css` prints nothing; every colour, spacing, radius, font-size and shadow declaration is a `var(--bk-*)`; only the colours listed under Behaviour are used.
- [ ] Visible focus: in Storybook, tabbing to the scroll wrapper shows the `--bk-focus-ring` ring.
- [ ] Keyboard only: in `WithRowAction`, Tab reaches the wrapper and then each row's button in row order, and Enter activates it.
- [ ] Every story listed under Stories required exists under `Components/Table`.
- [ ] `npm run test:a11y` lists every Table story with no axe violations, and the Storybook Accessibility panel shows no violations (including colour contrast) for each story.
- [ ] `Table`, `TableColumn` and `TableProps` are importable from `@budget-kit/ui`.
- [ ] `npm run check` passes.

## Assumptions
- Columns use a `cell` render function rather than a property key, so the app can render formatted cents and action buttons with full typing.
- `getRowKey` is required (no index keys), because the app deletes rows.
- The default empty text is `Nothing to show yet.`.
- The table sits in a focusable scroll region so it works below 640px; this adds one tab stop per table.
- `captionHidden` exists because the spec allows a visually hidden caption; the caption is visible by default.

## Out of scope
- Sorting, filtering, pagination, row selection, sticky headers, column resizing.
- Importing Button or any other component, including in stories.
- Anything in `apps/web`.
- Editing `tokens.css` or `tokens.pairs.ts` (task 00 owns them; if a pair is missing, append it at the end of the array and name it in your report).
- New dependencies: report the need instead of installing.
