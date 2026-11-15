# 01: Budget math

Pure functions and types for the whole budget: state shape, totals, per-category figures, adding and removing categories and expenses, month filtering and ordering, and the five suggested categories. Integer cents only; no React, no browser APIs, no clock.

**Depends on**: none

**Parallel group**: 0 (runs alone, first)

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
- `apps/web/src/lib/budget.ts` (no directive): everything under API below
- `apps/web/src/lib/format.ts` (no directive): `formatMoney`, `formatDate`
- `apps/web/src/lib/budget.test.ts`, `apps/web/src/lib/format.test.ts` (QA)

## API / Props
```ts
// budget.ts
export const MAX_CENTS = 99_999_999_999_999; // the MoneyField cap, 999,999,999,999.99

export interface Category { id: string; name: string; plannedCents: number }
export interface Expense { id: string; categoryId: string; amountCents: number; note: string; date: string }
export interface BudgetState {
  month: string;            // 'YYYY-MM': the month this budget is for
  incomeCents: number;
  categories: Category[];   // display order
  expenses: Expense[];      // insertion order (oldest added first)
}
export interface NewCategory { name: string; plannedCents: number }
export interface CategoryPatch { name?: string; plannedCents?: number }
export interface NewExpense { categoryId: string; amountCents: number; note: string; date: string }

export interface BudgetTotals {
  incomeCents: number;
  plannedCents: number;                  // sum of categories' plannedCents
  spentCents: number;                    // sum of this month's expenses, including removed categories
  leftToSpendCents: number;              // incomeCents - spentCents (may be negative)
  unplannedCents: number;                // incomeCents - plannedCents (may be negative)
  removedCategoriesSpentCents: number;   // part of spentCents whose categoryId is not in categories
  hasIncome: boolean;                    // incomeCents > 0
}
export interface CategorySummary {
  category: Category;
  spentCents: number;
  remainingCents: number;                // plannedCents - spentCents (may be negative)
  isOverBudget: boolean;                 // spentCents > plannedCents
  hasPlan: boolean;                      // plannedCents > 0
}

export const SUGGESTED_CATEGORIES: readonly Readonly<Category>[];
export function isIsoDate(value: string): boolean;
export function isIsoMonth(value: string): boolean;
export function monthOf(date: string): string;                     // RangeError unless isIsoDate
export function isDateInMonth(date: string, month: string): boolean;
export function formatMonth(month: string): string;                // RangeError unless isIsoMonth
export function defaultExpenseDate(month: string, today: string): string;
export function datesInMonth(month: string): string[];             // RangeError unless isIsoMonth
export function createInitialState(month: string): BudgetState;
export function sumCents(amounts: readonly number[]): number;
export function setIncome(state: BudgetState, incomeCents: number): BudgetState;
export function addCategory(state: BudgetState, input: NewCategory, id: string): BudgetState;
export function updateCategory(state: BudgetState, id: string, patch: CategoryPatch): BudgetState;
export function removeCategory(state: BudgetState, id: string): BudgetState;
export function addExpense(state: BudgetState, input: NewExpense, id: string): BudgetState;
export function deleteExpense(state: BudgetState, id: string): BudgetState;
export function expensesForMonth(state: BudgetState): Expense[];   // state.month only, newest first
export function getTotals(state: BudgetState): BudgetTotals;
export function getCategorySummaries(state: BudgetState): CategorySummary[];
export function categoryLabel(state: BudgetState, categoryId: string): string;
export function categoryNameError(state: BudgetState, name: string, exceptId?: string): string | null;

// format.ts
export function formatMoney(cents: number): string;   // '$1,505.18', '-$270.00'
export function formatDate(date: string): string;     // '2026-11-05' -> 'Nov 5, 2026'
```

## Behaviour
### General
- Every function is pure: it never mutates its arguments (including nested arrays and objects) and returns a new `BudgetState` when something changes. `updateCategory`, `removeCategory` and `deleteExpense` with an unknown id return the **same** state object (`===`).
- A **valid amount** is a safe integer with `0 <= amount <= MAX_CENTS`; an expense amount must also be `>= 1`. Invalid amounts throw `RangeError` (`setIncome`, `addCategory`, `updateCategory`, `addExpense`). So do `NaN`, `12.5`, `-1`, `MAX_CENTS + 1`.
- `sumCents` adds integers and throws `RangeError` if any input is not a safe integer or if a running total leaves the safe-integer range. All totals use it.

### Dates and months
- `isIsoDate`: exactly `^\d{4}-\d{2}-\d{2}$` (ASCII digits) and a real calendar date with Gregorian leap years. `isIsoMonth`: `^\d{4}-(0[1-9]|1[0-2])$`.
- `monthOf('2026-11-14')` → `'2026-11'`. `isDateInMonth(date, month)` is `isIsoDate(date) && monthOf(date) === month`.
- `formatMonth` uses fixed English month names: `'2026-11'` → `'November 2026'`, `'2027-01'` → `'January 2027'`.
- `defaultExpenseDate(month, today)`: `today` if it is in `month`, otherwise `${month}-01`.
- `datesInMonth(month)`: every ISO date of that month, ascending, from `${month}-01` to the last day (Gregorian leap years: divisible by 4, except centuries not divisible by 400). Integer arithmetic only, no `Date`. It feeds the add-expense date `Select` (task 04), so every value it returns passes `isDateInMonth(value, month)`.

| month | length | first | last |
|---|---|---|---|
| `'2026-02'` | 28 | `'2026-02-01'` | `'2026-02-28'` |
| `'2028-02'` | 29 | `'2028-02-01'` | `'2028-02-29'` |
| `'1900-02'` | 28 | `'1900-02-01'` | `'1900-02-28'` |
| `'2000-02'` | 29 | `'2000-02-01'` | `'2000-02-29'` |
| `'2026-11'` | 30 | `'2026-11-01'` | `'2026-11-30'` |
| `'2026-12'` | 31 | `'2026-12-01'` | `'2026-12-31'` |
| `'2026-13'`, `'2026-1'`, `''` | throws `RangeError` | | |

| input | `isIsoDate` | | input | `isIsoDate` |
|---|---|---|---|---|
| `'2026-11-14'` | true | | `'2026-11-31'` | false |
| `'2028-02-29'` | true | | `'2026-02-29'`, `'1900-02-29'` | false |
| `'2000-02-29'` | true | | `'2026-13-01'`, `'2026-00-10'` | false |
| `'2026-1-5'`, `' 2026-11-14'`, `'2026-11-14T00:00'` | false | | `''`, `'２０２６-11-14'` | false |

### State changes
- `SUGGESTED_CATEGORIES`, in order: `{ id: 'suggested-rent', name: 'Rent' }`, `suggested-groceries` / `Groceries`, `suggested-transport` / `Transport`, `suggested-utilities` / `Utilities`, `suggested-eating-out` / `Eating out`, each `plannedCents: 0`.
- `createInitialState(month)` → `{ month, incomeCents: 0, categories: <copies of the five suggested>, expenses: [] }`; `RangeError` unless `isIsoMonth(month)`. Two calls return objects that share no arrays or category objects.
- `setIncome` replaces `incomeCents`.
- `categoryNameError(state, name, exceptId?)`: `'Enter a category name'` if `name.trim()` is empty; `'You already have a category called {other}'` if another category (ignoring the one with id `exceptId`) has the same name after trimming both and comparing case-insensitively (`toLowerCase()`), where `{other}` is that category's trimmed name; otherwise `null`.
- `addCategory` appends `{ id, name: input.name.trim(), plannedCents }`. Throws `Error` if `id` is already used by a category, or if `categoryNameError(state, input.name)` is not `null` (blank or duplicate).
- `updateCategory` applies `patch` to the matching category. `name` is stored exactly as given (no trimming, no validation), so a caller can echo typing if it wants to. Callers that commit a name must check `categoryNameError(state, name, id)` first and pass the trimmed name; the month-setup screen (task 03) never commits a blank or duplicate name.
- `removeCategory` removes the category and **keeps its expenses**: they still count in `spentCents` and in `removedCategoriesSpentCents`.
- `addExpense` appends `{ id, categoryId, amountCents, note: input.note.trim(), date }` (the UI can only offer dates from `datesInMonth`, but the month check stays as a defence). Throws `Error` if `id` is already used by an expense or `categoryId` is not a current category; `RangeError` if the amount is invalid or `!isDateInMonth(date, state.month)`.
- `deleteExpense` removes that expense only.

### Reading
- `expensesForMonth(state)`: expenses with `monthOf(date) === state.month`, sorted by `date` descending; equal dates keep the later-added expense first. Expenses from other months (possible only in hand-made state) are excluded from the list **and from every total**.
- `getCategorySummaries` returns one entry per current category, in category order; expenses of removed categories are not in any entry. `isOverBudget` is `spentCents > plannedCents` (so a category planned at 0 with any spending is over); `hasPlan` is `plannedCents > 0`, so the dashboard can show unplanned categories neutrally.
- `getTotals(...).hasIncome` is `incomeCents > 0`; the dashboard uses it to avoid showing a misleading negative "left to spend" before income is entered.
- `categoryLabel`: the category's trimmed name; `'Unnamed category'` if that is empty; `'Removed category'` if no category has that id.
- `formatMoney(cents)`: `'$' + formatCents(cents)` for `cents >= 0`, `'-$' + formatCents(-cents)` for negatives; `RangeError` (from `formatCents`) for non-integers. `formatDate` uses fixed English short month names, no leading zero on the day.

| `formatMoney` input | output | | `formatDate` input | output |
|---|---|---|---|---|
| `0`, `-0` | `$0.00` | | `'2026-11-05'` | `Nov 5, 2026` |
| `7` | `$0.07` | | `'2026-01-31'` | `Jan 31, 2026` |
| `150518` | `$1,505.18` | | `'2026-12-01'` | `Dec 1, 2026` |
| `-27000` | `-$270.00` | | | |
| `99999999999999` | `$999,999,999,999.99` | | | |
| `12.5` | throws `RangeError` | | | |

### Worked examples (QA uses these exact numbers)
Base state **S**: `month '2026-11'`, `incomeCents 320000`; categories Rent `150000`, Groceries `40000`, Transport `12000`, Utilities `15000`, Eating out `10000` (the suggested ids); expenses added in order:
`e1` Rent `150000` `2026-11-01` note `'November rent'`; `e2` Groceries `8247` `2026-11-03` note `''`; `e3` Eating out `11235` `2026-11-05` note `'Birthday dinner'`.

| Case | income | planned | spent | left to spend | unplanned | removed spent | notes |
|---|---|---|---|---|---|---|---|
| S | 320000 | 227000 | 169482 | 150518 | 93000 | 0 | `hasIncome` true. Groceries spent 8247, remaining 31753, not over, `hasPlan` true; Eating out spent 11235, remaining −1235, **over**, `hasPlan` true; Transport spent 0, remaining 12000 |
| S, then `deleteExpense(e2)` | 320000 | 227000 | 161235 | 158765 | 93000 | 0 | Groceries spent 0, remaining 40000 |
| S, then `removeCategory('suggested-eating-out')` | 320000 | 217000 | 169482 | 150518 | 103000 | 11235 | 4 summaries; `categoryLabel(…, 'suggested-eating-out')` is `'Removed category'`; e3 still in `expensesForMonth` |
| S with `incomeCents 0` | 0 | 227000 | 169482 | −169482 | −227000 | 0 | `hasIncome` false (figures still computed) |
| S with `incomeCents 200000` | 200000 | 227000 | 169482 | 30518 | −27000 | 0 | |
| S plus Transport `200000` on `2026-11-10` | 320000 | 227000 | 369482 | −49482 | 93000 | 0 | Transport over, remaining −188000 |
| `createInitialState('2026-11')` | 0 | 0 | 0 | 0 | 0 | 0 | `hasIncome` false; 5 summaries, all spent 0, remaining 0, not over, `hasPlan` false |
| Groceries planned 8247, spent 8247 | | | | | | | exactly at plan: **not** over, remaining 0 |
| Transport planned 0, one expense of 1 | | | | | | | over, remaining −1, `hasPlan` false |
| Transport planned 1, one expense of 1 | | | | | | | not over, remaining 0, `hasPlan` true |
| income `MAX_CENTS`, three Transport expenses of `MAX_CENTS` | 99999999999999 | | 299999999999997 | −199999999999998 | | | exact |
| 91 expenses of `MAX_CENTS` | | | throws `RangeError` | | | | total passes 2^53 − 1 |

Cent-exactness: expenses `10`, `20` → spent `30`; three of `1999` → `5997`.

Ordering: expenses added in order `a` (`2026-11-05`), `b` (`2026-11-01`), `c` (`2026-11-05`), `d` (`2026-10-31`) in a `2026-11` state → `expensesForMonth` returns `[c, a, b]`; `d` is excluded and not counted.

## Screens / states
None (no UI).

## Acceptance criteria
- [ ] Every row of the worked-examples table gives exactly the listed figures from `getTotals` and `getCategorySummaries` (all fields checked with `toEqual`, including `isOverBudget`).
- [ ] The cent-exactness and ordering examples give exactly the listed results.
- [ ] Every `isIsoDate`, `formatMoney`, `formatDate` and `formatMonth` example gives the listed output.
- [ ] `datesInMonth` gives exactly the listed length, first and last entry for every row; each result is strictly ascending with consecutive days, every entry passes `isIsoDate` and `isDateInMonth(entry, month)`, and the listed invalid months throw `RangeError`. For all 12 months of 2026 the lengths are 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31.
- [ ] `defaultExpenseDate('2026-11', '2026-11-14')` is `'2026-11-14'`; `defaultExpenseDate('2026-10', '2026-11-14')` is `'2026-10-01'`.
- [ ] Immutability: with a deep-frozen state (`Object.freeze` on the state, its arrays and every category and expense), every state-changing function runs without throwing a `TypeError`, and a `structuredClone` taken before the call still `toEqual`s the input afterwards.
- [ ] Unknown ids: `updateCategory`, `removeCategory` and `deleteExpense` with id `'nope'` return the same object (`toBe`).
- [ ] Removing a category keeps its expenses: after `removeCategory` in the table row, `state.expenses` still has length 3.
- [ ] Validation throws: `setIncome` with `-1`, `12.5`, `NaN`, `MAX_CENTS + 1` throws `RangeError`, and `MAX_CENTS` and `0` do not; `addExpense` throws `RangeError` for amount `0`, and for date `'2026-12-01'` or `'2026-11-31'` in a `2026-11` state; `Error` for an unknown `categoryId` and for a duplicate expense id; `addCategory` throws `Error` for name `'   '` and for a duplicate id; `createInitialState('2026-13')` throws `RangeError`.
- [ ] `addCategory` stores `'  Pets '` as `'Pets'`; `updateCategory(…, { name: ' Pets ' })` stores `' Pets '`; `addExpense` stores note `'  lunch '` as `'lunch'`.
- [ ] `categoryNameError` on `SCENARIO`: `''` and `'   '` → `'Enter a category name'`; `'groceries'`, `' GROCERIES '` → `'You already have a category called Groceries'`; `'Groceries'` with `exceptId 'suggested-groceries'` → `null`; `'Groceries'` with `exceptId 'suggested-rent'` → the duplicate error; `'Pets'` → `null`.
- [ ] `addCategory` on `SCENARIO` throws `Error` for name `' rent '` (duplicate) and `''`; `updateCategory(SCENARIO, 'suggested-rent', { name: '' })` does not throw and stores `''` (raw).
- [ ] `categoryLabel` returns `'Unnamed category'` for a category named `'  '` and `'Removed category'` for a missing id.
- [ ] `createInitialState` returns the five suggested categories in order with the listed ids and names and `plannedCents: 0`; mutating the result of one call does not change a second call's result or `SUGGESTED_CATEGORIES`.
- [ ] No floats: `budget.ts` and `format.ts` contain no `parseFloat`, `toFixed`, `Math.round`, `/ 100`, `* 100`, `Date.now`, `new Date(` or `Intl` (grep prints nothing).
- [ ] No React or browser code: neither file imports `react` or references `window`, `document` or `localStorage` (grep).
- [ ] Typed exactly as under API; no `any`, `@ts-ignore` or `@ts-expect-error` in non-test files.
- [ ] `npm run check` passes.

## Assumptions
- **Left to spend = income − spent** (lead decision), not planned − spent. `hasIncome` lets the UI avoid a misleading negative figure at first run.
- **Unplanned money = income − planned**, warned when negative (task 05).
- Over budget means strictly more than planned; spending exactly the plan is not over.
- Removing a category keeps its expenses; they are labelled "Removed category" and still count as spent (lead decision).
- Category names must be non-blank and unique (trimmed, case-insensitive) when added or committed (lead decision); `updateCategory` stays unvalidated so the UI controls when a name is committed.
- `isOverBudget` stays strictly `spent > planned` (lead decision); `hasPlan` lets the UI treat categories planned at 0 neutrally.
- Expense dates must be inside the budget month (`state.month`); there is one month per budget, and the budget never rolls over by itself (lead decision; rollover is a user-confirmed reset, tasks 02 and 07).
- Ids are passed in (generated by the provider in task 02), so the functions are deterministic.
- Equal-date ordering uses insertion order; no timestamp is stored.
- `MAX_CENTS` matches the MoneyField cap. Totals are **not** capped by `budget.ts` (only single amounts are); totals that would exceed `Number.MAX_SAFE_INTEGER` throw. The provider (task 02, N1/N2) keeps every held state safe to total and rejects an overflowing change with `That change would make a total too large.`, which screens show to the user.
- Dollars only (`$`); English month names.

## Out of scope
- React, storage, UI, ids, the clock.
- Multiple months, recurring expenses, currencies, editing an existing expense, refunds or negative expenses (amounts are at least 1 cent).
- New dependencies.
