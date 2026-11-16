# 24: History page and Delete all data

The History page: one table row per month (newest first) with income, spent and left, a `View` button that opens that month on Overview, and a `Start over` card whose `Delete all data` replaces today's Reset month. Spec: `docs/specs/app-redesign.md` (History, decisions 8, 11, 17, 18).

**Depends on**: app 21

**Parallel group**: Redesign C (with 22 and 23)

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
- `apps/web/src/features/history/HistoryPage.tsx`: replace the temporary paragraph (keep `h1` and loading)
- `apps/web/src/features/history/MonthsTable.tsx`, `DeleteAllData.tsx` (each `'use client';`)
- QA: `features/history/HistoryPage.test.tsx`; in `styling.rules.test.ts` change only the "actions are never destructured" pattern (add `deleteAllData`, remove `resetMonth`) and the scan list (add `features/history/*`)

## API
```ts
export function HistoryPage(): ReactElement;
export function MonthsTable(): ReactElement | null;
export function DeleteAllData(): ReactElement | null;
```
Uses `useBudget()` (`book`, `currentMonth`, `viewMonth`, `actions.deleteAllData`), `monthSummaries` from `@/lib/months`, `formatMonth`, `formatMoney`, `useRouter()` from `next/navigation`. Library: `Card`, `Table`, `Button`, `Dialog`.

## Behaviour
- HistoryPage (ready): `<h1>History</h1>`, `<MonthsTable />`, `<DeleteAllData />`.
- **MonthsTable**: `<Card title="Your months" description="Every month you have used, newest first. Choose View to see a month's details.">` with `<Table caption="Months" captionHidden …>` over `monthSummaries(book, currentMonth)`. The card title is `Your months`, not `Months`, so the card region and the table region have different names (changed in app 25 QA, commit c6104ea; the caption stays `Months`):
  - `Month` (row header): `formatMonth(month)`, plus ` (this month)` when `month === currentMonth`;
  - `Income` (numeric): `hasIncome ? formatMoney(incomeCents) : 'Not set'`;
  - `Spent` (numeric): `formatMoney(spentCents)`;
  - `Left` (numeric): `hasIncome ? formatMoney(leftToSpendCents) : 'Not set'`;
  - `Actions`: `<Button variant="secondary" size="sm" aria-label="View {Month YYYY}">View</Button>` → `viewMonth(month)` then `router.push('/')`.
  - There is always at least one row (the current month).
- **DeleteAllData**: `<Card title="Start over" description="Delete every month saved in this browser and begin again.">` with `<Button variant="secondary">Delete all data</Button>` (always rendered, so focus can return to it). It opens `<Dialog title="Delete all data?" initialFocusRef={cancelRef}>`: body `<p>This deletes the income, categories and expenses of every month saved in this browser. You can't undo this.</p>`; actions `<Button variant="secondary">Cancel</Button>` then `<Button variant="danger">Delete all data</Button>`.
  - Cancel, Esc, close button: nothing changes; focus returns to the trigger.
  - Confirm: `actions.deleteAllData()`; the dialog closes; the card shows `<p tabIndex={-1}>All data deleted. You're starting fresh with {formatMonth(currentMonth)}.</p>` and focuses it in an effect after the dialog has closed (today's post-reset focus pattern); it stays until the page is reloaded or left.
  - Action error: dialog stays open, action-error paragraph inside it, nothing changes.

Examples (cents → cells):
| Month | incomeCents | spentCents | Row text |
|---|---|---|---|
| 2026-11 (current) | 320000 | 169482 | `November 2026 (this month)`, `$3,200.00`, `$1,694.82`, `$1,505.18` |
| 2026-10 | 300000 | 349482 | `October 2026`, `$3,000.00`, `$3,494.82`, `-$494.82` |
| 2026-09 | 0 | 2000 | `September 2026`, `Not set`, `$20.00`, `Not set` |

## Acceptance criteria
Render `renderApp({ path: '/history', … })`.
- [ ] Seeded `BOOK`, today `'2026-11-14'`: table `Months` has two body rows, in order, with exactly the first two rows of the Examples table (cell text via `getAllByRole('row')` / `within`). Adding a September month (income 0, one 2000 expense) to the seed gives a third row matching the third example.
- [ ] Seeded `BOOK`, today `'2026-12-02'`: three rows; the first is `December 2026 (this month)`, `$3,200.00`, `$0.00`, `$3,200.00` (copied, not stored); storage untouched.
- [ ] Empty storage: one row `November 2026 (this month)`, `Not set`, `$0.00`, `Not set`.
- [ ] `View October 2026`: `testRouter.push` called once with `'/'`; Overview `h1` shows with `Income $3,000.00` and `Left to spend -$494.82` and Spending by category for October (Groceries `$1,994.82 of $400.00, over by $1,594.82`, `Over budget`); `setItemCalls` unchanged.
- [ ] `Delete all data` opens `Delete all data?` with the exact body text and focus on `Cancel`; Cancel, Esc and the close button (each from a fresh open) close it with storage byte-identical and focus on the trigger.
- [ ] Confirming: `readStoredBook()` is `{ months: [] }`; the table shows one row `November 2026 (this month)`, `Not set`, `$0.00`, `Not set`; `All data deleted. You're starting fresh with November 2026.` is `document.activeElement`; on `/` the welcome line shows and `/plan` shows the suggestions; after `refresh()` still empty. Confirming while viewing October (via `View` then back to History) also leaves the viewed month as November.
- [ ] The dialog's `Delete all data` has `data-variant="danger"`; the trigger does not. While the dialog is open the header's `Add expense` has an `[inert]` ancestor and `getAllByRole('dialog')` has one element.
- [ ] Action error (`renderWithFakeBudget`-based render of `<DeleteAllData />`, `deleteAllData` throwing `new Error('boom')`): dialog stays open with `Something went wrong. Your budget was not changed.` in `[data-part="action-error"]`; no confirmation paragraph.
- [ ] Keyboard only: Tab reaches the table region, each `View` button, then `Delete all data`; Enter on `View September 2026`-style buttons works.
- [ ] `expectNoAxeViolations()` for: `BOOK`; empty; dialog open; after deleting.
- [ ] Styling rules hold; no `any`, `@ts-ignore` or `@ts-expect-error`; `npm run check` passes.

## Manual browser checks
- 375px: the table scrolls inside its region (library behaviour); `View` buttons reachable; the dialog fits.
- Screen reader: `View October 2026` is announced with the month; negative Left reads with "minus".
- After `View`, the browser lands on Overview at the top showing October, and the header says it is a past month (once task 22 is merged).

## Assumptions
- History has no month switcher (spec decision 3) and no per-category breakdown (decision 17).
- `View` is a Button that changes app state and then navigates (not a link), because the month is not in the URL (decision 5).
- `Delete all data` is the only destructive action in the app; it clears every month at once.

## Out of scope
- Deleting a single month, export, charts, comparing months; library changes.
