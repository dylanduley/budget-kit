# 20: Months, storage v2 and the provider

Turn the one-month state into a book of months: pure month functions, storage version 2 with a version 1 migration, a provider that exposes the viewed month (as `state`, so existing screens keep working), month navigation, and `deleteAllData` in place of `resetMonth`. Removes the reset/rollover screens, whose behaviour no longer exists. Spec: `docs/specs/app-redesign.md` (Month model, Storage v1 → v2, First run).

**Depends on**: none (app 01–08 are merged)

**Parallel group**: Redesign A (with library 20 and 21). Touches no library file.

## Conventions (identical in every redesign app task)
- **Folders** (all under `apps/web/src/`): `lib/` pure TypeScript (no React, no `window`, no `Date.now()`); `state/` storage and the React provider; `features/<area>/` screen components; `test/` shared test helpers; `app/` Next.js route files only (`layout.tsx`, `page.tsx` files, `globals.css`).
- **Imports**: library components and helpers only from `@budget-kit/ui` (lint blocks `@budget-kit/ui/src/*`); app modules through the `@/` alias.
- **Client boundary**: a file starts with `'use client';` only if it uses state, effects, refs, context, event handlers or Next client hooks (`usePathname`, `useRouter`). `layout.tsx` and every `page.tsx` stay server components (they may export `metadata`). `lib/*`, `state/storage.ts` and `state/budgetReducer.ts` have no directive.
- **Styling**: no CSS files (other than the existing `app/globals.css`, unchanged), no `style` prop, no CSS Modules, and no native `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, `<dialog>` or `<a>` anywhere in `apps/web/src` (links come from the library `NavBar` with Next's `Link`). Tailwind classes only for layout and spacing on plain elements (`flex*`, `grid*`, `gap-*`, `p*-*`, `m*-*`, `max-w-*`, `w-full`, `items-*`, `justify-*`, `list-none`, and `sm:` variants of these), plus typography and token text colours (`text-2xl`, `font-semibold`, `text-text`, `text-text-muted`) on plain text elements (`h1`, `h3`, `p`). On library components `className` may contain only `w-full`, `self-*`, `justify-self-*`, `col-span-*`. Single column below 640px: any multi-column layout is behind `sm:`.
- **Structure**: plain semantic elements only (`header`, `main`, `section`, `div`, `h1`, `h3`, `p`, `ul`, `li`, `form`).
- **Action errors**: every call to a `useBudget().actions` function is wrapped in `try`/`catch`. A caught `RangeError` whose message is exactly `That change would make a total too large.` (`TOTAL_TOO_LARGE_MESSAGE`) is shown with that text; anything else is shown as `Something went wrong. Your budget was not changed.` The provider guarantees state and storage are unchanged; the screen keeps its form or dialog open with the user's values. The message goes in the `error` prop of the field the action came from when one fits; otherwise in the **one permitted app-level alert**: `<p role="alert" data-part="action-error">{message}</p>`, placed directly after the control that triggered the action, rendered only while a message is shown, and cleared on the next edit or successful action in that form. `useBudget().viewMonth` is navigation, not an action, and needs no `try`.
- **Live regions**: app code has no `role="status"` and no `aria-live`, with one exception: the month switcher's month label (task 22) is `aria-live="polite"`.
- **Money**: integer cents in state, storage, props and function arguments. Converted to text only at the display edge with `formatMoney` from `@/lib/format`. No `parseFloat`, `toFixed`, `Number(` on text, `* 100` or `/ 100` on amounts. Amounts shown are exactly the numbers the `lib/` functions return.
- **Dates**: ISO strings (`YYYY-MM-DD`, months `YYYY-MM`), compared as strings. Never `new Date(string)`. "Today" comes only from `useBudget().today`.
- **Copy**: English, sentence case; strings quoted in a task are exact.
- **Tests**: written by QA from the acceptance criteria, colocated as `<file>.test.ts(x)`; the builder does not write them. Tests import from `vitest` (no globals), use Testing Library and `@testing-library/user-event`, and use the helpers in `src/test/`. From task 21 on, `next/navigation` and `next/link` are mocked in `src/test/setup.ts`. jsdom has no layout: visual behaviour goes under **Manual browser checks**.
- **Done**: every acceptance criterion passes and `npm run check` passes.

## Files
- `apps/web/src/lib/months.ts` (new, no directive)
- `apps/web/src/lib/budget.ts`: `createInitialState` returns no categories; `SUGGESTED_CATEGORIES` is replaced by `SUGGESTED_CATEGORY_NAMES`; nothing else changes
- `apps/web/src/state/storage.ts`: version 2, migration
- `apps/web/src/state/budgetReducer.ts`: remove the `reset` action
- `apps/web/src/state/BudgetProvider.tsx`: book of months, viewed month, `viewMonth`, `deleteAllData`
- `apps/web/src/features/BudgetApp.tsx`: remove `<MonthNotice />`, `<ResetMonth />` and their imports; `MonthSetup`'s key becomes `` `${budget.viewedMonth}:${budget.generation}` ``; nothing else (this file is deleted in task 21)
- Delete `apps/web/src/features/reset/` (all six files: `MonthNotice.tsx`, `ResetMonth.tsx`, `ResetMonthDialog.tsx` and their three tests)
- Test helpers: `src/test/renderWithBudget.tsx`, `src/test/renderWithFakeBudget.tsx`, `src/test/fixtures.ts` (add `OCTOBER`, `BOOK`)
- QA: `lib/months.test.ts` (new); update `lib/budget.test.ts`, `state/storage.test.ts`, `state/budgetReducer.test.ts`, `state/BudgetProvider.test.tsx`, `test/renderWithBudget.test.tsx`, `test/renderWithFakeBudget.test.tsx`; delete `features/BudgetApp.e2e.test.tsx` and `features/BudgetApp.a11y.test.tsx` (their replacements are task 25); in `features/BudgetApp.test.tsx`, `BudgetApp.hydration.test.tsx`, `styling.rules.test.ts`, `features/setup/MonthSetup.test.tsx`, `features/dashboard/Dashboard.test.tsx`, `features/expenses/*.test.tsx` change only what breaks because of this task's API (the removed `reset` folder in the scan list, five pre-filled categories, `resetMonth`, `isOtherMonth`) and list every change in the report

## API
```ts
// lib/budget.ts (changed)
export const SUGGESTED_CATEGORY_NAMES: readonly string[]; // ['Rent', 'Groceries', 'Transport', 'Utilities', 'Eating out'], frozen
export function createInitialState(month: string): BudgetState; // { month, incomeCents: 0, categories: [], expenses: [] }

// lib/months.ts (new, pure)
export interface BudgetBook { months: BudgetState[] }   // ascending by month, unique months
export interface MonthSummary {
  month: string;
  incomeCents: number;
  spentCents: number;
  leftToSpendCents: number;   // income − spent, from getTotals
  hasIncome: boolean;
  isStored: boolean;
}
export const EMPTY_BOOK: BudgetBook;                                      // { months: [] }, frozen
export function findMonth(book: BudgetBook, month: string): BudgetState | undefined;
export function copySourceFor(book: BudgetBook, month: string): BudgetState | undefined; // latest stored month < month
export function startMonth(book: BudgetBook, month: string): BudgetState;
export function monthToShow(book: BudgetBook, month: string): BudgetState;   // findMonth ?? startMonth
export function putMonth(book: BudgetBook, state: BudgetState): BudgetBook;  // insert or replace, keeps order; returns a new book
export function availableMonths(book: BudgetBook, currentMonth: string): string[]; // stored ∪ {currentMonth}, ascending
export function adjacentMonth(months: readonly string[], month: string, step: -1 | 1): string | null;
export function monthSummaries(book: BudgetBook, currentMonth: string): MonthSummary[]; // newest first, one per available month

// state/storage.ts (changed)
export const STORAGE_KEY = 'budget-kit:budget';
export const STORAGE_VERSION = 2;
export type LoadResult =
  | { status: 'empty' }
  | { status: 'loaded'; book: BudgetBook; fromVersion: 1 | 2 }
  | { status: 'invalid'; reason: 'corrupt' | 'unsupported-version' }
  | { status: 'unavailable' };
export function isBudgetState(value: unknown): value is BudgetState;     // unchanged (one month)
export function canBeTotalled(state: BudgetState): boolean;               // unchanged
export function parseStoredBudget(raw: string | null): LoadResult;        // pure
export function serializeBook(book: BudgetBook): string;                  // JSON of { version: 2, book }
export function loadBudget(storage: StorageLike | null): LoadResult;      // never throws
export function saveBook(storage: StorageLike | null, book: BudgetBook): boolean; // never throws
// serializeBudget and saveBudget are removed.

// state/budgetReducer.ts: BudgetAction loses { type: 'reset' }; otherwise unchanged.

// state/BudgetProvider.tsx (changed)
export interface BudgetActions {
  setIncome(incomeCents: number): void;
  addCategory(input: NewCategory): string;
  updateCategory(id: string, patch: CategoryPatch): void;
  removeCategory(id: string): void;
  addExpense(input: NewExpense): string;
  deleteExpense(id: string): void;
  deleteAllData(): void;                    // replaces resetMonth
}
export type BudgetContextValue =
  | { status: 'loading' }
  | {
      status: 'ready';
      state: BudgetState;                   // the viewed month: stored, or started in memory
      book: BudgetBook;                     // what is stored (or would be, if saving fails)
      viewedMonth: string;                  // === state.month
      months: string[];                     // availableMonths(book, currentMonth)
      isViewedMonthStored: boolean;
      copiedFromMonth: string | null;       // when not stored: copySourceFor(...)?.month ?? null; when stored: null
      today: string;
      currentMonth: string;
      generation: number;                   // 0 after load, +1 on every deleteAllData
      loadStatus: LoadResult['status'];
      savedDataReplaced: boolean;
      viewMonth(month: string): void;       // stable; throws RangeError if month is not in `months`
      actions: BudgetActions;               // stable
    };
// BudgetProviderProps, TOTAL_TOO_LARGE_MESSAGE, BudgetContext, useBudget: unchanged.
```

### Test helpers
```ts
// renderWithBudget.tsx: options gain `book`; `state` still works
export interface RenderWithBudgetOptions {
  storage?: MemoryStorage;
  state?: BudgetState;   // seeds serializeBook({ months: [state] })
  book?: BudgetBook;     // seeds serializeBook(book). Pass at most one of storage / state / book.
  today?: string;        // default '2026-11-14'
}
// result: user, storage, refresh() as today, plus
//   readStored(): BudgetState | null      // the stored month equal to monthOf(today), or null (keeps old tests working)
//   readStoredBook(): BudgetBook | null   // parseStoredBudget(...).book when loaded, else null

// renderWithFakeBudget.tsx: options gain `book?` (default { months: [state] }) and `viewMonth?` override;
// the ready value is derived exactly as the provider derives it (months, isViewedMonthStored, copiedFromMonth)
// with viewedMonth = state.month; returns `viewMonth` as a vi.fn alongside the action mocks; deleteAllData is a mock.

// fixtures.ts: add
export const OCTOBER: BudgetState; // month '2026-10', income 300000, the SCENARIO categories with the same ids/names/plans,
                                   // expenses: o1 Rent 150000 '2026-10-01' 'October rent'; o2 Groceries 199482 '2026-10-12' '';
                                   // spent 349482, left -49482
export const BOOK: BudgetBook;     // { months: [OCTOBER, SCENARIO] }
```

## Behaviour
### Months (`lib/months.ts`)
- `copySourceFor(book, m)`: the stored month with the greatest `month` that is `< m` (string comparison), or `undefined`.
- `startMonth(book, m)`: if a copy source exists, `{ month: m, incomeCents: source.incomeCents, categories: source.categories mapped to fresh objects with the same id, name, plannedCents, expenses: [] }`; else `createInitialState(m)`. Never mutates `book`. Throws `RangeError` for a non-ISO month.
- `putMonth`: replaces the month with the same `month`, or inserts keeping ascending order.
- `availableMonths`: sorted ascending, unique. `adjacentMonth(list, m, -1)` is the element before `m` in `list`, or `null` at the start or when `m` is not in `list`; `+1` likewise.
- `monthSummaries`: for each available month, newest first, `monthToShow` then `getTotals`: `{ incomeCents, spentCents, leftToSpendCents, hasIncome, isStored }`.

Examples:
| book | call | result |
|---|---|---|
| `BOOK` | `availableMonths(BOOK, '2026-11')` | `['2026-10', '2026-11']` |
| `BOOK` | `availableMonths(BOOK, '2026-12')` | `['2026-10', '2026-11', '2026-12']` |
| `{ months: [OCTOBER] }` | `startMonth(…, '2026-12')` | month `'2026-12'`, income `300000`, the 5 OCTOBER categories (same ids, plans `150000, 40000, 12000, 15000, 10000`), no expenses |
| `EMPTY_BOOK` | `startMonth(…, '2026-11')` | `{ month: '2026-11', incomeCents: 0, categories: [], expenses: [] }` |
| `{ months: [SCENARIO] }` | `startMonth(…, '2026-10')` (clock moved back) | empty October (no earlier month) |
| `BOOK` | `monthSummaries(BOOK, '2026-11')` | `[{ month: '2026-11', incomeCents: 320000, spentCents: 169482, leftToSpendCents: 150518, hasIncome: true, isStored: true }, { month: '2026-10', incomeCents: 300000, spentCents: 349482, leftToSpendCents: -49482, hasIncome: true, isStored: true }]` |
| `BOOK` | `adjacentMonth(['2026-10','2026-11'], '2026-10', -1)` | `null` |

### Storage
- Stored value: `JSON.stringify({ version: 2, book: { months } })`.
- `parseStoredBudget`: `null` → `empty`. Unparseable, non-object, missing or non-integer `version` → `invalid/corrupt`.
  - `version: 1`: today's rules on `state` (fields, `isBudgetState`, `canBeTotalled`, unknown fields dropped) → `{ status: 'loaded', book: { months: [state] }, fromVersion: 1 }`.
  - `version: 2`: `book` must be an object whose `months` is an array; every element passes `isBudgetState` and `canBeTotalled`; no two elements share `month` → `{ status: 'loaded', book (copied with known fields only, sorted ascending by month), fromVersion: 2 }`. Any failure → `invalid/corrupt`. Category and expense ids must be unique **within** a month; the same id in two months is valid (copied months share category ids).
  - any other integer → `invalid/unsupported-version`.
- `loadBudget`/`saveBook` never throw (as today).

### Provider
- Load (one effect after mount, as today): `loaded` → that book; anything else → `EMPTY_BOOK`. `viewedMonth` = `currentMonth` = `monthOf(today)`. **Loading never writes**, including a version 1 value (it stays byte-identical until the first change, which writes version 2).
- `state` = `monthToShow(book, viewedMonth)`. It must be referentially stable across renders while nothing changed (memoise), so screens that depend on `state` in effects behave as today.
- Every data action: `base = monthToShow(book, viewedMonth)`; `next = budgetReducer(base, action)`; if `next === base` → no change, no save (N3); if `!canBeTotalled(next)` → throw `RangeError(TOTAL_TOO_LARGE_MESSAGE)` with nothing changed (N2); else `book = putMonth(book, next)`, save, update. Reducer errors propagate with nothing changed. A no-op on a month that is only shown (not stored) does not store it.
- `deleteAllData()`: `book = EMPTY_BOOK`, `viewedMonth = currentMonth`, `generation + 1`, save `{ version: 2, book: { months: [] } }`.
- `viewMonth(m)`: if `m` is not in `months`, throw `RangeError`; else set `viewedMonth` (no save, no storage access, `generation` unchanged).
- `savedDataReplaced` (N4), `defaultCreateId` (N5), unavailable storage, failed saves ignored: as today. `loadStatus` is `'loaded'` for both versions.
- `actions` and `viewMonth` are stable across renders.

## Acceptance criteria
Months (unit):
- [ ] Every row of the Examples table holds (`toEqual`); `startMonth` output shares no object with the input (mutating it does not change `book`), and a deep-frozen `book` does not throw.
- [ ] `putMonth(BOOK, { ...OCTOBER, incomeCents: 1 })` replaces October (2 months, October income 1); `putMonth(BOOK, createInitialState('2026-09'))` gives months `['2026-09','2026-10','2026-11']`; `BOOK` is unchanged.
- [ ] `monthSummaries({ months: [OCTOBER] }, '2026-11')` has November first with `isStored: false`, income `300000`, spent `0`, left `300000`; and `{ months: [{ ...createInitialState('2026-09'), expenses: [one 2000 expense] }] }` gives September `hasIncome: false`, spent `2000`.
- [ ] `createInitialState('2026-11')` has `categories: []`; `SUGGESTED_CATEGORY_NAMES` equals `['Rent', 'Groceries', 'Transport', 'Utilities', 'Eating out']` and is frozen.

Storage (unit):
- [ ] `serializeBook(BOOK)` then `parseStoredBudget` → `loaded`, `fromVersion: 2`, book `toEqual` `BOOK`. Stored months out of order (`[SCENARIO, OCTOBER]`) load sorted.
- [ ] Version 1: `JSON.stringify({ version: 1, state: SCENARIO })` → `loaded`, `fromVersion: 1`, book `{ months: [SCENARIO] }`. Every version-1 invalid case in today's `storage.test.ts` is still `invalid/corrupt`.
- [ ] Version 2 invalid → `invalid/corrupt`: `book` missing; `book.months` not an array; one month with `incomeCents: 1250.5`; two months both `'2026-11'`; one month with 91 categories at `MAX_CENTS`; a month with duplicate expense ids. Valid: the same category id in two different months.
- [ ] `version: 3` and `version: 0` → `invalid/unsupported-version`.
- [ ] Unknown fields (`book.theme`, `months[0].note`, `months[0].categories[0].colour`) are dropped.
- [ ] `loadBudget`/`saveBook` with throwing or `null` storage: `unavailable` / `false`, never throw.

Provider (`renderWithBudget` with a probe):
- [ ] **Migration without writing**: storage holding `{"version":1,"state":SCENARIO}`, today `'2026-11-14'`: `state` equals `SCENARIO`, `loadStatus` `loaded`, `setItemCalls` `0`, stored string byte-identical. After `setIncome(500)` the stored value parses as version 2 with one month (`2026-11`, income 500) and the raw JSON has `"version":2`.
- [ ] **Migration of an older month**: the same version 1 value with today `'2026-12-02'`: `viewedMonth` `'2026-12'`, `state` = December copied from November (income `320000`, 5 categories with SCENARIO's ids and plans, no expenses), `isViewedMonthStored` false, `copiedFromMonth` `'2026-11'`, `months` `['2026-11','2026-12']`, `setItemCalls` `0`.
- [ ] **New month stored on first change only**: seeded `BOOK`, today `'2026-12-02'`: `readStoredBook()` still has 2 months; after `addExpense` (Rent, 2000, `'2026-12-03'`) it has 3, December has the 5 copied categories and that one expense, and November is unchanged (`toEqual` SCENARIO). A no-op (`deleteExpense('nope')`) on the unstored December leaves `setItemCalls` at 0 and `readStoredBook()` with 2 months.
- [ ] **Months are independent**: seeded `BOOK`, `viewMonth('2026-10')`, `updateCategory('suggested-groceries', { name: 'Food' })`: October's category is `Food`, November's is still `Groceries`.
- [ ] **Past months editable**: after `viewMonth('2026-10')`, `addExpense` dated `'2026-10-20'` is stored in October; one dated `'2026-11-01'` throws the task 01 date `RangeError` with nothing changed.
- [ ] **viewMonth**: never writes (`setItemCalls` unchanged); `viewMonth('2026-09')` with `BOOK` throws `RangeError`; `state.month` follows `viewedMonth`; `actions` and `viewMonth` are the same functions (`toBe`) before and after.
- [ ] **deleteAllData**: seeded `BOOK`, `viewMonth('2026-10')`, `deleteAllData()`: `readStoredBook()` `{ months: [] }`, `viewedMonth` `'2026-11'`, `state` `createInitialState('2026-11')`, `generation` 1, `months` `['2026-11']`; after `refresh()` the same.
- [ ] **First run**: empty storage → `state` `createInitialState('2026-11')`, `book` `{ months: [] }`, `months` `['2026-11']`, `copiedFromMonth` null, `loadStatus` `empty`.
- [ ] **Stable state**: with no actions, `useBudget().state` is the same object (`toBe`) across two re-renders caused by an unrelated parent state change.
- [ ] Preserved from task 02 (re-run with v2 seeding): invalid data handling and byte-identical raw value; `savedDataReplaced` (N4); totals safety on load (N1, per month) and on action (N2, including on an unstored December copied from a month whose categories sum near the limit); no-ops (N3); ids (N5); storage unavailable; `getToday`/`createId` never called during render; `useBudget` throws outside a provider.
- [ ] `renderWithBudget({ book: BOOK })`: `setItemCalls` 0 after ready; `readStored()` returns SCENARIO (today's month); `readStoredBook()` returns `BOOK`. `renderWithFakeBudget` returns a ready value with `months` `['2026-11']` for `state: SCENARIO` and a `viewMonth` mock.

Blanket:
- [ ] `features/reset/` no longer exists; `grep -rn "resetMonth\|isOtherMonth\|SUGGESTED_CATEGORIES\b\|serializeBudget\|saveBudget" apps/web/src` prints nothing.
- [ ] Every remaining test passes; the report lists each test file changed or deleted and why.
- [ ] No `any`, `@ts-ignore` or `@ts-expect-error` in non-test files; `npm run check` passes; `npm run build -w @budget-kit/web` succeeds.

## Manual browser checks
- With a version 1 value saved by the current `main` app (set income, add an expense), switch to this branch and `npm run dev`: the same figures appear; DevTools shows the stored value still `"version":1`; change the income: it becomes `"version":2` with one month.
- Same with the browser clock (or stored month) one month earlier: the page shows the new month with the old income and categories and no expenses, and nothing is written until a change.

## Assumptions
- The whole stored value is rejected if any month is invalid (no partial recovery), as today.
- No limit on the number of months.
- The copy source is the latest **earlier** stored month only; with the clock moved back before every stored month, the current month starts empty.
- Between this task and task 21 the old single page still renders (without reset or rollover, and starting with no categories on a first run). It is never released in that state.

## Out of scope
- Any page, route, navigation or switcher UI (tasks 21–24); the Plan page's suggestions (23); History (24).
- Library changes.
