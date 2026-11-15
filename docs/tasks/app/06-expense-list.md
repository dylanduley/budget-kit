# 06: Expense list

A Table of this month's expenses, newest first, with a Delete button per row and an empty state.

**Depends on**: 02

**Parallel group**: 2 (with 03, 04, 05, 07)

## Conventions (identical in every app task)
- **Folders** (all under `apps/web/src/`): `lib/` pure TypeScript (no React, no `window`, no `Date.now()`); `state/` storage and the React provider; `features/<area>/` screen components; `test/` shared test helpers; `app/` Next.js route files only (`layout.tsx`, `page.tsx`, `globals.css`).
- **Imports**: library components and helpers only from `@budget-kit/ui` (lint blocks `@budget-kit/ui/src/*`); app modules through the `@/` alias (`@/lib/budget`).
- **Client boundary**: a file starts with `'use client';` only if it uses state, effects, refs, context or event handlers. `page.tsx` and `layout.tsx` stay server components. `lib/*`, `state/storage.ts` and `state/budgetReducer.ts` have no directive.
- **Styling**: no CSS files (other than the existing `app/globals.css`, unchanged), no `style` prop, no CSS Modules, and no native `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>` or `<dialog>` anywhere in `apps/web/src`. Tailwind classes only for layout and spacing on plain elements (`flex*`, `grid*`, `gap-*`, `p*-*`, `m*-*`, `max-w-*`, `w-full`, `items-*`, `justify-*`, `list-none`, and `sm:` variants of these), plus typography and token text colours (`text-2xl`, `font-semibold`, `text-text`, `text-text-muted`) on plain text elements (`h1`, `h3`, `p`). On library components `className` may contain only `w-full`, `self-*`, `justify-self-*`, `col-span-*`. Single column below 640px: any multi-column layout is behind `sm:`.
- **Structure**: plain semantic elements only (`main`, `section`, `h1`, `h3`, `p`, `ul`, `li`, `form`).
- **Action errors**: every call to a `useBudget().actions` function is wrapped in `try`/`catch`. A caught `RangeError` whose message is exactly `That change would make a total too large.` (`TOTAL_TOO_LARGE_MESSAGE`, task 02) is shown with that text; anything else is shown as `Something went wrong. Your budget was not changed.` The provider guarantees state and storage are unchanged; the screen keeps its form or dialog open with the user's values. The message goes in the `error` prop of the field the action came from when one fits (the library's Field announces it with `role="alert"`); otherwise in the **one permitted app-level alert**: `<p role="alert" data-part="action-error">{message}</p>`, placed directly after the control that triggered the action, rendered only while a message is shown, and cleared on the next edit or successful action in that form. App code has no other `role="alert"`, `role="status"` or `aria-live`.
- **Money**: integer cents in state, storage, props and function arguments. Converted to text only at the display edge with `formatMoney` from `@/lib/format` (which wraps the library's `formatCents`). No `parseFloat`, `toFixed`, `Number(` on text, `* 100` or `/ 100` on amounts. Amounts shown are exactly the numbers the `lib/budget.ts` functions return.
- **Dates**: ISO strings (`YYYY-MM-DD`, months `YYYY-MM`), compared as strings. Never parse them with `new Date(string)` (time-zone shifts). "Today" comes only from `useBudget().today` (task 02).
- **Copy**: English, sentence case; strings quoted in a task are exact.
- **Tests**: written by QA from the acceptance criteria, colocated as `<file>.test.ts(x)`; the builder does not write them. Tests import `describe`, `it`, `expect`, `vi` from `vitest` (no globals), use Testing Library and `@testing-library/user-event`, and render screens with the helpers in `src/test/` (task 02). jsdom has no layout, so visual behaviour goes under **Manual browser checks**, never into a test that cannot fail.
- **Done**: every acceptance criterion passes and `npm run check` passes.

## Files
- `apps/web/src/features/expenses/ExpenseList.tsx` (`'use client';`)
- `apps/web/src/features/BudgetApp.tsx`: add the import and `<ExpenseList />` at its line in README "BudgetApp order"; nothing else
- `apps/web/src/features/expenses/ExpenseList.test.tsx` (QA)
- Read-only: `lib/`, `state/`, `test/`. Task 04 also writes in `features/expenses/` but different files.

## API / Props
```ts
export function ExpenseList(): ReactElement | null;   // null unless ready
```
Reads `useBudget().state`, calls `actions.deleteExpense`. Rows from `expensesForMonth(state)`. Library: `Card`, `Table`, `Button`.

## Behaviour
- `<Card title="Expenses" description="Newest first.">` containing
  `<Table caption={`Expenses in ${formatMonth(state.month)}`} captionHidden rows={expensesForMonth(state)} getRowKey={(e) => e.id} …>`.
- Columns in order:

| key | header | cell | options |
|---|---|---|---|
| `date` | `Date` | `formatDate(date)` | `rowHeader` |
| `category` | `Category` | `categoryLabel(state, categoryId)` | |
| `note` | `Note` | the note (empty cell if `''`) | |
| `amount` | `Amount` | `formatMoney(amountCents)` | `numeric` |
| `actions` | `Actions` | `Button variant="secondary" size="sm"` text `Delete`, `aria-label="Delete {amount} {category} expense from {date}"` | |

  e.g. `Delete $82.47 Groceries expense from Nov 3, 2026`.
- **Empty state**: `emptyState={<p ref={emptyRef} tabIndex={-1}>No expenses yet this month.</p>}`.
- **Delete**: immediately calls `deleteExpense(id)` (no confirmation). Focus then moves, in the new list, to the Delete button at the same row position; if the deleted row was last, to the new last row's Delete button; if the list is now empty, to the empty-state paragraph. Delete buttons are tracked with a ref map keyed by expense id.

- **Action errors** (Conventions): if `deleteExpense` throws, the row stays, focus stays on its Delete button, and `<p role="alert" data-part="action-error">` with the message is shown directly after the Table, inside the Card. (A total-too-large error cannot come from a delete, but the same rule applies.) It clears on the next successful delete.

## Screens / states
Empty; `SCENARIO` (3 rows); a row in a removed category; a long note at 375px.

## Acceptance criteria
Render `renderWithBudget(<ExpenseList />, { state })`.
- [ ] `SCENARIO`: `getByRole('table', { name: 'Expenses in November 2026' })` exists; header cells `Date`, `Category`, `Note`, `Amount`, `Actions`; body rows in order: `Nov 5, 2026 | Eating out | Birthday dinner | $112.35`, `Nov 3, 2026 | Groceries | (empty) | $82.47`, `Nov 1, 2026 | Rent | November rent | $1,500.00`; each date cell is a row header (`rowheader` role).
- [ ] Newest first with ties: a state with expenses added in order `a` (`2026-11-05`), `b` (`2026-11-01`), `c` (`2026-11-05`) and `d` (`2026-10-31`) shows rows `c`, `a`, `b`; `d` is not shown.
- [ ] Delete buttons are named per row: `getByRole('button', { name: 'Delete $82.47 Groceries expense from Nov 3, 2026' })` exists, and the three names are distinct.
- [ ] Delete: clicking the Groceries delete button leaves two rows (Eating out, Rent), stored expenses have length 2 without `e2`, and focus is on `Delete $1,500.00 Rent expense from Nov 1, 2026`. Deleting the last row (`Rent`) moves focus to the Eating out button. Deleting the only remaining row shows `No expenses yet this month.` and focus is on that paragraph.
- [ ] Deleting never removes another expense: with two expenses identical except id, deleting one leaves the other (stored length 1, the remaining id is the other one).
- [ ] Empty: `createInitialState('2026-11')` shows the table with its headers and the single cell `No expenses yet this month.`
- [ ] Removed category: after `removeCategory('suggested-eating-out')`, the first row's category cell is `Removed category` and its button is named `Delete $112.35 Removed category expense from Nov 5, 2026`.
- [ ] Blank category name: a category renamed to `''` shows `Unnamed category`.
- [ ] Action error (`renderWithFakeBudget`, `state: SCENARIO`, `deleteExpense` throws `new Error('boom')`): clicking the Groceries delete button keeps three rows, keeps focus on that button, and shows `Something went wrong. Your budget was not changed.` in `[data-part="action-error"]` (`role="alert"`) after the table; the mock was called once with `'e2'`.
- [ ] Keyboard only: Tab reaches the table's scroll region and then each Delete button in row order; Enter or Space on a Delete button deletes that row.
- [ ] axe: `expectNoAxeViolations()` passes for empty, `SCENARIO`, after one delete, and removed-category states.
- [ ] Styling rules in Conventions hold (grep); no `any`, `@ts-ignore` or `@ts-expect-error`; `npm run check` passes.

## Manual browser checks
- At 375px the table scrolls horizontally inside its own region (the page does not); a 100-character note wraps or scrolls without breaking the layout.
- After each delete the focus ring is visible on the new target.

## Assumptions
- Delete has no confirmation and no undo (the brief asks for confirmation only on Reset).
- The caption is hidden because the Card title already names the section; the caption still names the table for assistive technology.
- Dates are shown as `Nov 5, 2026`.
- No sorting, filtering, paging or editing.

## Out of scope
- Adding expenses (04), totals (05).
- Changes to `lib/`, `state/`, test helpers or the library; if something is missing, report it.
