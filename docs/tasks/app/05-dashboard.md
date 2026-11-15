# 05: Dashboard

The month at a glance: Stats for income, planned, spent, left to spend and unplanned money (warned when negative, and not shown as a negative figure before income is entered), and per category a ProgressBar with an `Over budget` Badge when spending passes the plan, or a neutral `No plan set` Badge for categories planned at 0.

**Depends on**: 02

**Parallel group**: 2 (with 03, 04, 06, 07)

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
- `apps/web/src/features/dashboard/Dashboard.tsx` (`'use client';`: reads context)
- `apps/web/src/features/BudgetApp.tsx`: add the import and `<Dashboard />` at its line in README "BudgetApp order"; nothing else
- `apps/web/src/features/dashboard/Dashboard.test.tsx` (QA)
- Read-only: `lib/`, `state/`, `test/`

## API / Props
```ts
export function Dashboard(): ReactElement | null;   // null unless ready
```
Reads `useBudget().state`; all figures from `getTotals(state)` and `getCategorySummaries(state)`. Library: `Card`, `Stat`, `ProgressBar`, `Badge`.

## Behaviour
- **Summary**: `<Card title="Summary">` containing `<ul>` (grid: one column, `sm:grid-cols-2`) of five `<li><Stat … /></li>` in this order:

| label | value | tone | change |
|---|---|---|---|
| `Income` | `formatMoney(incomeCents)` | neutral | none |
| `Planned` | `formatMoney(plannedCents)` | neutral | none |
| `Spent` | `formatMoney(spentCents)` | neutral | none |
| `Left to spend` | `formatMoney(leftToSpendCents)` | `bad` if < 0, else neutral | if < 0: `Spent {formatMoney(-left)} more than your income` |
| `Unplanned money` | `formatMoney(unplannedCents)` | `bad` if < 0, else neutral | if < 0: `Planned {formatMoney(-unplanned)} more than your income`; if > 0: `Not yet assigned to a category` |

  **Before income is entered** (`hasIncome` false, i.e. income is 0), these two rows change, so a first-run user never sees a negative figure or a warning caused only by missing income:

| label | value | tone | change |
|---|---|---|---|
| `Left to spend` | `Not set` | neutral | `Enter your monthly income in Set up the month below` |
| `Unplanned money` | `Not set` | neutral | `Enter your monthly income in Set up the month below` |

  The library's `bad` tone adds a `!` marker and hidden `Bad:` text, and the `change` sentence states the problem in words, so the warning never depends on colour.
- **By category**: `<Card title="Spending by category">` containing a `<ul>` with one `<li>` per summary in category order.
  - **Planned** (`hasPlan` true): `<ProgressBar label={categoryLabel} value={spentCents} max={plannedCents} formatValue={formatMoney} />` (the library shows `$82.47 of $400.00`, or `…, over by $12.35`, and colours by its own thresholds); then if `isOverBudget`: `<Badge variant="danger">Over budget</Badge>`, else `<p>{formatMoney(remainingCents)} left</p>`.
  - **Not planned** (`hasPlan` false, planned 0): **no ProgressBar** (with `max` 0 the library's bar shows the danger tone for any spending); instead `<p>{categoryLabel}</p>`, `<Badge variant="neutral">No plan set</Badge>` and `<p>Spent {formatMoney(spentCents)}</p>`. No `Over budget` badge and no danger colour, even though `isOverBudget` is true when spent > 0.
  - With no categories: `<p>No categories yet. Add one in Set up the month below.</p>`.
  - If `removedCategoriesSpentCents > 0`, after the list: `<p>The Spent total includes {formatMoney(removedCategoriesSpentCents)} from removed categories, which are not listed above.</p>` This explains why the Spent stat is more than the categories shown add up to. Not rendered when the amount is 0.
- No interactive elements; nothing is focusable.

## Screens / states
First run (all zero, no income, nothing planned); a first expense in an unplanned category; `SCENARIO` (one category over); overspent (left to spend negative); over-planned (unplanned negative); no categories; removed-category spending.

## Acceptance criteria
Render `renderWithBudget(<Dashboard />, { state })`; expected strings are literals, not computed with `formatMoney` in the test.
- [ ] `SCENARIO`: the five Stats read `Income $3,200.00`, `Planned $2,270.00`, `Spent $1,694.82`, `Left to spend $1,505.18`, `Unplanned money $930.00`, in that order; `Unplanned money` shows `Not yet assigned to a category`; no Stat has `data-tone="bad"`.
- [ ] `SCENARIO` categories: progressbars named `Rent`, `Groceries`, `Transport`, `Utilities`, `Eating out` in order. `Groceries` has `aria-valuetext` `$82.47 of $400.00` and the text `$317.53 left`. `Eating out` has `aria-valuetext` `$112.35 of $100.00, over by $12.35` and an `Over budget` badge in its list item. Exactly one `Over budget` badge on the page.
- [ ] Boundary: `SCENARIO` with Groceries planned `8247` shows `$0.00 left` and no badge for Groceries; with Transport planned `1` and one Transport expense of `2`, Transport shows `Over budget`; with Transport planned `0` and one expense of `1`, Transport shows `No plan set` and no `Over budget`.
- [ ] Deleting an expense: `SCENARIO` without `e2` shows `Spent $1,612.35`, `Left to spend $1,587.65`, Groceries `$0.00 of $400.00` and `$400.00 left`.
- [ ] Overspent: `SCENARIO` plus a Transport expense `200000` on `2026-11-10`: `Left to spend -$494.82`, that Stat has `data-tone="bad"` and the text `Spent $494.82 more than your income`; Transport shows `Over budget`.
- [ ] Over-planned: `SCENARIO` with income `200000`: `Unplanned money -$270.00`, `data-tone="bad"`, text `Planned $270.00 more than your income`; `Left to spend $305.18`.
- [ ] Not by colour alone: in every over state above, the warning is present as text (`Over budget`, `over by`, `more than your income`) and the `bad` Stats contain the hidden text `Bad:`; the unplanned-category state is told apart by the text `No plan set`.
- [ ] First run (`createInitialState('2026-11')`): `Income $0.00`, `Planned $0.00`, `Spent $0.00`; `Left to spend` and `Unplanned money` show `Not set` with `Enter your monthly income in Set up the month below`, neither has `data-tone="bad"`, and no `-$` appears anywhere on the page. No progressbars; five `No plan set` badges; five `Spent $0.00`; no `Over budget`.
- [ ] Income set, nothing spent: first-run state with income `320000` shows `Left to spend $3,200.00` and `Unplanned money $3,200.00` with `Not yet assigned to a category`; `Not set` is gone.
- [ ] Zero income still hides the negative: `SCENARIO` with income `0` shows `Not set` for both rows (not `-$1,694.82` / `-$2,270.00`); `Spent $1,694.82` and `Planned $2,270.00` still show.
- [ ] First expense, no plan: first-run state plus one Groceries expense of `8247` shows, in the Groceries item, the text `Groceries`, a `No plan set` badge with `data-variant="neutral"` and `Spent $82.47`; there is no progressbar named `Groceries`, no `Over budget` badge and no element with `data-tone="danger"` on the page. Setting Groceries planned to `5000` replaces it with a progressbar `$82.47 of $50.00, over by $32.47` and an `Over budget` badge (`data-variant="danger"`).
- [ ] No categories: `No categories yet. Add one in Set up the month below.`; Stats still shown.
- [ ] Removed category: `SCENARIO` after `removeCategory('suggested-eating-out')`: four progressbars (no `Eating out`), `Spent $1,694.82`, `Planned $2,170.00`, `Unplanned money $1,030.00`, and `The Spent total includes $112.35 from removed categories, which are not listed above.` With `SCENARIO` unchanged, no element contains `from removed categories`.
- [ ] Large amounts: income `99999999999999` and three Transport expenses of `99999999999999` show `Spent $2,999,999,999,999.97` and `Left to spend -$1,999,999,999,999.98`.
- [ ] Headings `Summary` and `Spending by category` are level 2.
- [ ] axe: `expectNoAxeViolations()` passes in every state listed under Screens / states.
- [ ] Styling rules in Conventions hold (grep); no `any`, `@ts-ignore` or `@ts-expect-error`; `npm run check` passes.

## Manual browser checks
- At 375px the Stats are one column; at 640px and up two columns; no horizontal scroll with the large-amounts state.
- Over-budget rows are distinguishable in a greyscale screenshot (badge and `over by` text).

## Assumptions
- Left to spend = income − spent; unplanned = income − planned (task 01).
- "Warn if negative" is the `bad` Stat tone plus a sentence; no separate alert (the library has no alert component, README "Decided by the lead").
- Positive unplanned money gets a neutral explanatory line; zero gets none.
- The prompts say `below` because the dashboard sits above Set up the month (lead's page order); they are plain text, with no link, scrolling or focus movement.
- Before income is entered, both `Left to spend` (lead decision) and `Unplanned money` (my extension: it would otherwise show a negative warning as soon as anything is planned) show `Not set` with a prompt. "Before income is entered" is `incomeCents === 0`; a user whose real income is 0 sees the same.
- Categories planned at 0 never get a bar or the danger colour (lead decision); their spending is shown as text beside a neutral `No plan set` badge.
- The ProgressBar's own amber "nearly there" tone (above 80%) is kept; only spending over plan gets the badge.
- Expenses of removed categories are summed on one line, not listed per category.

## Out of scope
- Adding or editing anything; charts; comparisons with other months.
- Changes to `lib/`, `state/`, test helpers or the library; if something is missing, report it.
