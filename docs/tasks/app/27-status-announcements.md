# 27: Announce non-error changes with StatusMessage

Replaces app task 10, which was written before the redesign. Wires the library's `StatusMessage` (library task 15, merged) into the redesigned app so screen-reader users hear changes they cannot otherwise perceive without hunting for them: an expense added (from the header, on any page), an expense deleted (Spending), a category added through the dialog or a suggestion, a category removed (Plan), and the saved-data "replaced" message (shell). WCAG 4.1.3 Status Messages. The a11y reviews found the add-through-dialog cases silent: focus returns to the trigger and nothing says what happened.

Also changes the app convention text and the `styling.rules` test, which today forbid any status region other than the month label, so they allow exactly these library regions and nothing else.

**Depends on**: library task 15 (merged); app task 26 merged (both edit `AddCategoryDialog.tsx`, `PlanPage.test.tsx` and the same README bullet); app task 29 merged (both edit `AppShell.tsx`, `MonthSwitcher.test.tsx` and `styling.rules.test.ts`, and 29 moves the `Add expense` button, next to which a region lives)

**Parallel group**: G2 (runs alone, after G1; see `docs/tasks/followups-plan2.md`)

## Conventions (identical in every redesign app task, with the Live regions bullet as changed by this task)
- **Folders** (all under `apps/web/src/`): `lib/` pure TypeScript (no React, no `window`, no `Date.now()`); `state/` storage and the React provider; `features/<area>/` screen components; `test/` shared test helpers; `app/` Next.js route files only (`layout.tsx`, `page.tsx` files, `globals.css`).
- **Imports**: library components and helpers only from `@budget-kit/ui` (lint blocks `@budget-kit/ui/src/*`); app modules through the `@/` alias.
- **Client boundary**: a file starts with `'use client';` only if it uses state, effects, refs, context, event handlers or Next client hooks (`usePathname`, `useRouter`). `layout.tsx` and every `page.tsx` stay server components (they may export `metadata`). `lib/*`, `state/storage.ts` and `state/budgetReducer.ts` have no directive.
- **Styling**: no CSS files (other than the existing `app/globals.css`, unchanged), no `style` prop, no CSS Modules, and no native `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, `<dialog>` or `<a>` anywhere in `apps/web/src` (links come from the library `NavBar` with Next's `Link`). Tailwind classes only for layout and spacing on plain elements (`flex*`, `grid*`, `gap-*`, `p*-*`, `m*-*`, `max-w-*`, `w-full`, `items-*`, `justify-*`, `list-none`, and `sm:` variants of these), plus typography and token text colours (`text-2xl`, `font-semibold`, `text-text`, `text-text-muted`) on plain text elements (`h1`, `h3`, `p`). On library components `className` may contain only `w-full`, `self-*`, `justify-self-*`, `col-span-*`. Single column below 640px: any multi-column layout is behind `sm:`.
- **Structure**: plain semantic elements only (`header`, `main`, `section`, `div`, `h1`, `h3`, `p`, `ul`, `li`, `form`).
- **Action errors**: every call to a `useBudget().actions` function is wrapped in `try`/`catch`. A caught `RangeError` whose message is exactly `That change would make a total too large.` (`TOTAL_TOO_LARGE_MESSAGE`) is shown with that text; anything else is shown as `Something went wrong. Your budget was not changed.` The provider guarantees state and storage are unchanged; the screen keeps its form or dialog open with the user's values. The message goes in the `error` prop of the field the action came from when one fits; otherwise in the **one permitted app-level alert**: `<p role="alert" data-part="action-error">{message}</p>`, placed directly after the control that triggered the action, rendered only while a message is shown, and cleared on the next edit or successful action in that form. `useBudget().viewMonth` is navigation, not an action, and needs no `try`.
- **Live regions** (changed by this task): app code writes no `role="status"`, `aria-atomic` or `aria-relevant` itself and has exactly one raw `aria-live`: the month switcher's month label (task 22, `aria-live="polite"`). Other announcements use the library's `StatusMessage`, once in each of `features/shell/AppShell.tsx`, `features/expenses/AddExpense.tsx`, `features/expenses/ExpenseList.tsx` and `features/plan/CategoriesCard.tsx`, with the exact messages of app task 27.
- **Money**: integer cents in state, storage, props and function arguments. Converted to text only at the display edge with `formatMoney` from `@/lib/format`. No `parseFloat`, `toFixed`, `Number(` on text, `* 100` or `/ 100` on amounts. Amounts shown are exactly the numbers the `lib/` functions return.
- **Dates**: ISO strings (`YYYY-MM-DD`, months `YYYY-MM`), compared as strings. Never `new Date(string)`. "Today" comes only from `useBudget().today`.
- **Copy**: English, sentence case; strings quoted in a task are exact.
- **Tests**: written by QA from the acceptance criteria, colocated as `<file>.test.ts(x)`; the builder does not write them. Tests import from `vitest` (no globals), use Testing Library and `@testing-library/user-event`, and use the helpers in `src/test/`. From task 21 on, `next/navigation` and `next/link` are mocked in `src/test/setup.ts`. jsdom has no layout: visual behaviour goes under **Manual browser checks**.
- **Done**: every acceptance criterion passes and `npm run check` passes.

## Files
- `apps/web/src/features/expenses/AddExpense.tsx`: one hidden `StatusMessage` (expense added); the `Dialog` is rendered only while open; the form reports the saved expense to `AddExpense`
- `apps/web/src/features/expenses/ExpenseList.tsx`: one hidden `StatusMessage` (expense deleted)
- `apps/web/src/features/plan/CategoriesCard.tsx`: one hidden `StatusMessage` (category added, category removed); `AddCategoryDialog` is rendered only while open
- `apps/web/src/features/plan/AddCategoryDialog.tsx`: one new required prop `onAdded`, called after a successful `addCategory`; nothing else
- `apps/web/src/features/shell/AppShell.tsx`: the invalid/replaced `<p>` becomes a visible `StatusMessage`; nothing else (the header is task 29's)
- `docs/tasks/app/README.md` and `docs/tasks/app/25-whole-app-acceptance.md`: the text under "Docs" below
- QA, new tests: `AddExpense.test.tsx`, `ExpenseList.test.tsx`, `PlanPage.test.tsx` (new `describe` block at the end), a new whole-app file `features/shell/App.announcements.test.tsx`, `styling.rules.test.ts` (only the `alerts and live regions` describe block)
- QA, existing tests to update (listed with the change under "Existing tests")
- Read-only: `MonthSwitcher.tsx` (its label stays a raw `aria-live` `<p>`), `Suggestions.tsx`, `CategoryRow.tsx`, `IncomeCard.tsx`, `DeleteAllData.tsx`, `HistoryPage.tsx`, `Dashboard.tsx`, `lib/`, `state/`, `test/`, `packages/ui/**`

## API / Props
- Library: `StatusMessage` from `@budget-kit/ui`, props `message: string` (`''` renders an empty region), `announceKey?: string | number` (change it to announce the same text again), `visuallyHidden?: boolean`. It renders `<div role="status" aria-live="polite" aria-atomic="true" data-part="status-message" data-visually-hidden="true"?>` with the text in `<span data-part="status-text">`.
- `AddCategoryDialogProps` gains `onAdded: (id: string) => void`, called with the id `addCategory` returned, before `onClose`. Nothing else changes in its API.
- No new exports, no new files outside tests.

## Behaviour
### Where the regions live and why
One region per owner of the change, not one app-wide announcer: each component already owns the action, its focus move and its dialog, so it knows when it is safe to speak, and no new context is needed. Every region is outside any dialog (dialogs are portalled; while one is open everything else, including the header and `main`, is `inert`, and a live region inside an inert subtree may not be announced).

| # | owner | region | rendered | text changes | message |
|---|---|---|---|---|---|
| 1 | `AddExpense` (header, every page) | `<StatusMessage visuallyHidden …/>` directly after the `Add expense` Button | whenever the button is | after a successful save, once the dialog has gone and focus is back on `Add expense` | `Expense added: {amount} for {category} on {date}.` + left-to-spend sentence |
| 2 | `ExpenseList` (Spending) | `<StatusMessage visuallyHidden …/>` inside the `Expenses in {Month YYYY}` Card, directly after the Table (before the no-categories paragraph and the action-error paragraph) | whenever the Card is, also with an empty table | after a successful `deleteExpense`, once focus has moved | `Expense deleted: {amount} for {category} on {date}.` + left-to-spend sentence |
| 3 | `CategoriesCard` (Plan) | `<StatusMessage visuallyHidden …/>` inside the `Categories` Card, as the last child of the `div` that holds the rows and Suggestions | whenever the Card is, also with no categories | after a successful add (dialog or suggestion) or remove, once focus has moved and the dialog has gone | added: `Category added: {name}.` + ` Planned: {planned}.` when planned > 0; removed: `Category removed: {name}.` |
| 4 | `AppShell` (`main`) | the existing `loadStatus === 'invalid'` paragraph becomes `<StatusMessage message={…} />`, visible, same place | only while `loadStatus === 'invalid'` (as today) | when the first successful save replaces the unreadable data, once any dialog has gone | `Your saved budget couldn't be read, so a new one was started. Your first change will replace the saved data.` → `Your saved budget couldn't be read and has been replaced.` |

Placeholders: `{amount}` = `formatMoney(amountCents)`; `{category}` = `categoryLabel(state, categoryId)`; `{date}` = `formatDate(date)`; `{name}` = `categoryLabel(state, id)` (for removal, taken **before** the removal); `{planned}` = `formatMoney(plannedCents)`. The left-to-spend sentence is ` Left to spend: {left}.` with `{left}` = `formatMoney(getTotals(stateAfter).leftToSpendCents)`, added only when `getTotals(stateAfter).hasIncome` is true; `stateAfter` is the viewed month's state after the change (read from `useBudget().state` once the change has rendered, never computed by arithmetic in the screen).

### Examples (today `2026-11-14`)
| start | user does | message |
|---|---|---|
| `SCENARIO` (income $3,200.00, spent $1,694.82) | Add expense `20` / Groceries / Nov 14, 2026 | `Expense added: $20.00 for Groceries on Nov 14, 2026. Left to spend: $1,485.18.` |
| `SCENARIO` | Add expense `2000` / Transport / Nov 10, 2026 | `Expense added: $2,000.00 for Transport on Nov 10, 2026. Left to spend: -$494.82.` |
| `{ ...SCENARIO, incomeCents: 0 }` | Add expense `20` / Groceries / Nov 14, 2026 | `Expense added: $20.00 for Groceries on Nov 14, 2026.` |
| `BOOK`, Previous month (October viewed) | Add expense `10` / Rent / default date | `Expense added: $10.00 for Rent on Oct 1, 2026. Left to spend: -$504.82.` |
| `SCENARIO`, on Spending | Delete `Delete $82.47 Groceries expense from Nov 3, 2026` | `Expense deleted: $82.47 for Groceries on Nov 3, 2026. Left to spend: $1,587.65.` |
| `SCENARIO` without the Eating out category | Delete the Nov 5 expense | `Expense deleted: $112.35 for Removed category on Nov 5, 2026. Left to spend: $1,617.53.` |
| `SCENARIO`, on Plan | Add category `Pets` / `25` | `Category added: Pets. Planned: $25.00.` |
| `SCENARIO`, on Plan | Add category `Pets` / empty | `Category added: Pets.` |
| `SCENARIO` with only Rent | Click `Add Groceries` | `Category added: Groceries.` |
| `SCENARIO`, on Plan | Click `Remove Groceries` | `Category removed: Groceries.` |
| storage `'not json'`, on Plan | type `3200` in income (or the first successful Add category) | `Your saved budget couldn't be read and has been replaced.` |

### Rules
- **Regions exist first**: regions 1–3 are rendered with `message=""` as soon as their owner renders in the ready state, and are never rendered conditionally on having a message. Region 4 starts with the invalid text, as today.
- **Order: focus first, then the text.** A region's text changes in a render **after** the one that moved focus or removed a dialog: the handler records what happened (for example in a ref or in state that does not feed the region), and an effect that runs after the focus move sets the message. Reason: when the text changes before focus moves, NVDA and VoiceOver often drop the polite message when they speak the newly focused control; and a change made while `inert` is still on the page may not be spoken at all.
- **Dialogs are mounted only while open.** `AddExpense` renders `{open ? <Dialog open …> : null}` and `CategoriesCard` renders `{dialogOpen ? <AddCategoryDialog open … /> : null}` (as `DeleteAllData` already does). The library Dialog lifts `inert` and returns focus in its effect cleanup; when the Dialog unmounts, that cleanup runs before the parent's effects in the same commit, so the parent's effect sees focus back on the trigger and no `inert`. (With a Dialog that stays mounted with `open={false}`, the cleanup runs one render later, after the parent's text has already changed.)
- **Lint**: an effect that calls a state setter may be flagged by `react-hooks/set-state-in-effect`. Where it is, use one `// eslint-disable-next-line react-hooks/set-state-in-effect` directly above the call, preceded by the why-comment `// Announce only after focus has moved and any dialog has gone.` At most one such disable per file; no other suppression.
- **Repeat announcements**: regions 1–3 pass an `announceKey` that increases on every successful action of that region, so two identical messages in a row are both announced.
- **Failures announce nothing**: when the action throws, the region's text and `announceKey` are unchanged; the error shows as today. Cancel and Esc announce nothing.
- **Messages stay until replaced** by the next message from the same region (no timers, no clearing), or until the owner remounts (page navigation; the Plan cards also remount on a month change).
- **Region 4 deferral**: `AppShell` shows the replaced text only from the render after the one in which `savedDataReplaced` became true (an effect sets a local flag), so a first change made in a dialog is spoken after the dialog has gone.
- **Not announced** (planner default): income and planned edits and their effect on totals (would speak on every keystroke), renames, month changes (the switcher label already announces), page navigation (Next's route announcer), the unavailable-storage message, the first-run line, the new-month and past-month notes, and **Delete all data** (it already moves focus to `All data deleted. You're starting fresh with {Month YYYY}.`, which is read on focus; a status message as well would say it twice).
- No other markup changes; every existing focus behaviour (after delete, remove, suggestion, dialogs) is unchanged.

### Docs
In `docs/tasks/app/README.md`:
1. Under "Conventions for the whole app", insert after the **Action errors** bullet:
   ```text
   - **Status announcements** (app task 27): non-error changes are announced only through the library's `StatusMessage`, used exactly once in each of `features/shell/AppShell.tsx` (saved data replaced, visible), `features/expenses/AddExpense.tsx` (expense added), `features/expenses/ExpenseList.tsx` (expense deleted) and `features/plan/CategoriesCard.tsx` (category added or removed). Each region is rendered before its text changes, and its text changes only after any focus move and after any dialog has closed. App code writes no `role="status"`, `aria-atomic` or `aria-relevant`, its only raw `aria-live` is the month switcher's label, and `<p role="alert" data-part="action-error">` stays the only app-level alert.
   ```
2. In "Decided by the lead", bullet **Accepted as is**, replace:
   ```text
   page-level messages are plain elements and are not announced (except the focused post-reset confirmation)
   ```
   with:
   ```text
   page-level messages are plain elements and are not announced, except the StatusMessage announcements of app task 27 and the focused Delete all data confirmation
   ```
   (The same bullet also carries task 26's sentence; leave it as 26 left it.)

In `docs/tasks/app/25-whole-app-acceptance.md` (built; these two passages are updated so the latest whole-app rule matches the code):
3. In Conventions, replace the line:
   ```text
   - **Live regions**: app code has no `role="status"` and no `aria-live`, with one exception: the month switcher's month label (task 22) is `aria-live="polite"`.
   ```
   with:
   ```text
   - **Live regions**: app code writes no `role="status"`, `aria-atomic` or `aria-relevant` itself and has exactly one raw `aria-live`: the month switcher's month label (task 22, `aria-live="polite"`). Other announcements use the library's `StatusMessage`, once in each of `features/shell/AppShell.tsx`, `features/expenses/AddExpense.tsx`, `features/expenses/ExpenseList.tsx` and `features/plan/CategoriesCard.tsx` (app task 27).
   ```
4. Under "Styling and structure", replace `exactly one `aria-live` (task 22);` with `exactly one raw `aria-live` (task 22) and `<StatusMessage` only in the four files of app task 27;`.

`CLAUDE.md` does not change (it has no live-region rule). `docs/specs/app-redesign.md` decision 16 ("One app-level live region") is left to the lead (open question in the follow-ups plan).

### `styling.rules.test.ts` (only the `alerts and live regions` describe block)
- The test `there is no role="status" and exactly one aria-live (the month label)` is renamed `app code writes no role="status", aria-atomic or aria-relevant, and exactly one raw aria-live (the month label)`. It keeps every current assertion (no `role="status"` / `role: 'status'` in source; the only `aria-live`/`ariaLive` is on a `<p>` with `aria-live="polite"` in `features/month/MonthSwitcher.tsx`) and adds: no source file matches `/aria-atomic|ariaAtomic|aria-relevant|ariaRelevant/`.
- New test `<StatusMessage> is used exactly once in each of the four announcing files and nowhere else`: over every non-test code file, the per-file count of `/<StatusMessage\b/g` (comments stripped), keeping only files with a non-zero count, equals exactly `{ 'features/expenses/AddExpense.tsx': 1, 'features/expenses/ExpenseList.tsx': 1, 'features/plan/CategoriesCard.tsx': 1, 'features/shell/AppShell.tsx': 1 }`.
- New test `every live region on the page is a library StatusMessage or the month label`: for each state in the table below, rendered with `renderApp`, every element matching `[role="status"], [aria-live]` either has `data-part="status-message"`, or is the `p[aria-live="polite"]` inside the page banner whose text is the viewed month (`November 2026`); the counts are exactly as listed.

| state | path | `[data-part="status-message"]` | month label |
|---|---|---|---|
| `SCENARIO` | `/` | 1 | 1 |
| `SCENARIO` | `/spending` | 2 | 1 |
| `SCENARIO` | `/plan` | 2 | 1 |
| `SCENARIO` | `/history` | 1 | 0 |
| storage `'not json'` | `/` | 1 | 1 |
| storage `'not json'` | `/spending` | 2 | 1 |
| storage `'not json'` | `/plan` | 2 | 1 |
| storage `'not json'` | `/history` | 1 | 0 |

- The `role="alert"` test (`the only role="alert" is <p role="alert" data-part="action-error">`, count 6) is unchanged and passes. No other describe block changes in this task (`className values` count stays as task 29 left it: `StatusMessage` gets no `className`).

### Existing tests
Update these (they would fail once a region exists); each keeps its intent: no app-made live regions, no stray alerts.
- `features/month/MonthSwitcher.test.tsx`, test `the label has aria-live="polite", is the only live region, and its text changes in place`: rename to `… is the only raw live region …`; replace `expect(document.querySelectorAll('[aria-live], [role="status"]')).toHaveLength(1)` with: `document.querySelectorAll('[aria-live]:not([data-part="status-message"]), [role="status"]:not([data-part="status-message"])')` has length 1 (the header's Add expense region is the other one).
- `features/expenses/ExpenseList.test.tsx`, test `the Spending page renders the list and still has no other alerts/live regions from it`: keep `queryByRole('alert')` absent; replace `expect(screen.queryByRole('status')).not.toBeInTheDocument()` with: `getAllByRole('status')` has exactly 2 elements, each `[data-part="status-message"][data-visually-hidden="true"]` with empty text content.
- `styling.rules.test.ts`, test `there is no role="status" and exactly one aria-live (the month label)`: renamed and extended as above.

Checked and left unedited (they still pass):
- `features/history/HistoryPage.test.tsx`, `the confirmation is plain (not an alert or status) and stays until leaving the page`: after Delete all data the month has no categories, so `Add expense` and its region are gone and History has no region of its own: still 0.
- `features/dashboard/Dashboard.test.tsx`, `has no alert, status or live region` (renders the Overview page alone, no shell).
- Source-only checks that grep for the literal `role="status"` or `aria-live` in `AddExpense.tsx`, `ExpenseList.tsx` and `features/plan/*` (`AddExpense.test.tsx` `role=alert appears once in AddExpense.tsx …`, `ExpenseList.test.tsx` `only one role="alert" (action-error) and no status or aria-live`, `PlanPage.test.tsx` `no style prop, native controls, live regions, any or ts-ignore`): `<StatusMessage` contains neither string.
- `AddExpense.test.tsx`, `AddExpense.tsx displays no money text (formatMoney is only needed for display and none is shown)`: its regex (`formatCents|toLocaleString|Intl\.`) still passes; its title becomes inaccurate, so QA renames it to `AddExpense.tsx formats money only through formatMoney` without changing the assertion.
- `AppShell.test.tsx` saved-data tests and `App.a11y.test.tsx` `main order: …` (text-based; the text is the same).

## Screens / states
Populated (`SCENARIO`) on each path with the regions empty; after adding an expense; after deleting one; after adding a category (dialog, suggestion); after removing one; invalid saved data before and after the first change (typed income, and via the Add category dialog); no categories.

## Acceptance criteria
"Region n" is the element described in the table under Behaviour, captured **before** the action. "Its text" is `region.textContent`. A **focus snapshot** is taken with a `focusin` listener on `document` added before the action: on each `focusin` it records `event.target` and the region's text at that moment.

Regions exist before they change:
- [ ] Every row of the region-count table passes (see `styling.rules.test.ts`), and in each of those states every region 1–3 has `data-visually-hidden="true"` and empty text, and region 4 (storage `'not json'`) has no `data-visually-hidden` and the invalid text.
- [ ] Region 1 is the next element sibling of the `Add expense` button; region 2 is inside the region named `Expenses in November 2026`; region 3 is inside the region named `Categories`; region 4 is inside `main`. None is inside `[role="dialog"]` or `[data-bk-dialog-root]` at any time.

Expense added (`AddExpense.test.tsx`; past month in `App.announcements.test.tsx`):
- [ ] `renderWithBudget(<AddExpense />, { state: SCENARIO })`: capture region 1; add `20` / Groceries / default date (Nov 14): the dialog closes, focus is on `Add expense`, and the **same element** has text exactly `Expense added: $20.00 for Groceries on Nov 14, 2026. Left to spend: $1,485.18.`
- [ ] Order: the focus snapshot for `Add expense` (focus returned by the Dialog) recorded region 1's text as `''`; at that moment `document.querySelector('[inert]')` was `null` (record it in the same listener). After the save completes, the text is the message and `region.closest('[inert]')` is `null`.
- [ ] Each Examples row for Add expense gives exactly its message (overspent `-$494.82`; no income → no left-to-spend sentence; October via `renderApp({ book: BOOK })`, Previous month, then Add expense → `… on Oct 1, 2026. Left to spend: -$504.82.`).
- [ ] Repeat: from `{ ...SCENARIO, incomeCents: 0 }`, adding `5` / Groceries / Nov 14 twice gives the same text both times, and the `[data-part="status-text"]` span after the second save is a different node from the one after the first.
- [ ] Failure: with `renderWithFakeBudget(<AddExpense />, …)` and `addExpense` throwing `new Error('boom')`, Save shows the existing action error, the dialog stays open, and region 1's text is still `''`. Cancel and Esc: text still `''`.
- [ ] While the dialog is open, region 1 has an `[inert]` ancestor (it is outside the dialog), and no `[role="status"]` exists inside the dialog.

Expense deleted (`ExpenseList.test.tsx`, through `renderApp({ state: SCENARIO, path: '/spending' })`):
- [ ] Click `Delete $82.47 Groceries expense from Nov 3, 2026`: focus moves as before (to the next Delete button); the focus snapshot for that button recorded region 2's text as `''`; then the same element has exactly `Expense deleted: $82.47 for Groceries on Nov 3, 2026. Left to spend: $1,587.65.`
- [ ] Deleting the last remaining expense: region 2 still exists (the empty-state paragraph is shown and focused) and holds that expense's message.
- [ ] Removed category: the Examples row gives exactly `Expense deleted: $112.35 for Removed category on Nov 5, 2026. Left to spend: $1,617.53.`
- [ ] Repeat: in a state with income `0` and two expenses `{ amountCents: 500, categoryId: 'suggested-groceries', note: '', date: '2026-11-03' }` (ids `a`, `b`), deleting one then the other gives `Expense deleted: $5.00 for Groceries on Nov 3, 2026.` both times, with a new `status-text` node the second time.
- [ ] Failure: with `renderWithFakeBudget(<ExpenseList />, …)` and `deleteExpense` throwing, the action error shows and region 2's text is unchanged.

Category added and removed (`PlanPage.test.tsx`, new `describe` block; `renderWithBudget(<PlanPage />, { state: SCENARIO })` unless stated):
- [ ] Dialog: click `Add category`, type `Pets`, `25`, click `Save category`: the dialog closes, focus is on `Add category`, the focus snapshot for `Add category` recorded region 3's text as `''` and no `[inert]` element; then region 3 has exactly `Category added: Pets. Planned: $25.00.` With Planned empty: `Category added: Pets.`
- [ ] Suggestion: with `{ ...SCENARIO, categories: SCENARIO.categories.slice(0, 1), expenses: [] }`, click `Add Groceries`: focus moves to `Category 2 planned (USD)` (unchanged); the focus snapshot for that field recorded region 3's text as `''`; then region 3 has exactly `Category added: Groceries.`
- [ ] Remove: click `Remove Groceries`: focus is on `Remove Transport` (unchanged); the focus snapshot for it recorded `''`; then region 3 has exactly `Category removed: Groceries.` Removing the only remaining category leaves region 3 in the DOM with that category's message and shows `No categories yet. Add your own, or start from a suggestion below.`
- [ ] Repeat: add suggestion `Rent`, remove it, add `Rent` again (from a state without Rent): the two `Category added: Rent.` messages are in different `status-text` nodes.
- [ ] Failures: with `renderWithFakeBudget(<PlanPage />, …)`: `addCategory` throwing on Save (dialog stays open with the error), on a suggestion (Suggestions' action error), and `removeCategory` throwing (row action error): region 3's text is unchanged in each case. Cancel and Esc in the dialog: unchanged.
- [ ] `AddCategoryDialog`'s `onAdded` is called exactly once, with the id `addCategory` returned (`'fake-id'` under `renderWithFakeBudget`), only on a successful save, before the dialog closes.

Saved data replaced (`App.announcements.test.tsx`):
- [ ] Storage `'not json'`, path `/plan`: capture region 4 (it has `role="status"` and the invalid text); type `3200` into `Monthly income (USD)`: the **same element** now has text exactly `Your saved budget couldn't be read and has been replaced.`; after `refresh()` neither message is shown (existing behaviour).
- [ ] Storage `'not json'`, path `/plan`, first change through the dialog: Add category `Pets` / `25`, Save: the focus snapshot for `Add category` recorded region 4's text as the invalid text and no `[inert]` element; afterwards region 4 has the replaced text.
- [ ] Storage `'not json'`, path `/history`, Delete all data → confirm: region 4 has the replaced text; focus is on `All data deleted. You're starting fresh with November 2026.` (unchanged); no region holds an `All data deleted` message.

Nothing else is announced (`App.announcements.test.tsx`):
- [ ] From `SCENARIO` on `/plan`, record every `[data-part="status-message"]` text; then type `5` into `Monthly income (USD)`, change `Category 1 planned (USD)`, rename `Groceries` to `Food` and Tab, click `Previous month` if enabled, navigate to Overview and back: every region's text is unchanged (still `''`).
- [ ] The unavailable-storage message and the first-run line are still plain `<p>` elements with no `role` and no `aria-live`.

Rules, conventions and existing tests:
- [ ] The three `styling.rules.test.ts` changes under Behaviour are made and pass; the `role="alert"` test is unchanged and passes.
- [ ] Each existing test under "Existing tests" is updated as described there (the rest pass unedited), and each updated test still fails if an app file adds `<div role="status">` or `<p aria-live="polite">` (QA proves it once by adding one temporarily to `OverviewPage.tsx`, then reverts).
- [ ] The README and task 25 text under Docs is changed exactly (grep for `**Status announcements** (app task 27)`, `StatusMessage announcements of app task 27`, and in task 25 for `exactly one raw \`aria-live\``).
- [ ] `eslint-disable` lines: `git diff` adds at most one per changed file, each exactly `// eslint-disable-next-line react-hooks/set-state-in-effect` directly after the why-comment given under Rules.

Blanket:
- [ ] axe: `expectNoAxeViolations()` passes on the full page (via `renderApp`) after an expense is added, after one is deleted, after a category is added and removed, and in both invalid-data states.
- [ ] No arithmetic on amounts (the `money and dates` rules pass; totals come from `getTotals`); no `any`, `@ts-ignore` or `@ts-expect-error`; `npm run check` passes.

## Manual browser checks (`npm run dev`; the a11y-reviewer, then the lead)
jsdom proves the regions exist, keep their identity and get the exact text after focus has moved; it cannot prove a screen reader speaks them. Check with VoiceOver + Safari and NVDA + Firefox or Chrome:
- Add an expense with the keyboard from each page: after Save, focus returns to `Add expense` and `Expense added: … Left to spend: ….` is spoken once, after the button name.
- Delete two expenses in a row on Spending: each message is spoken once, after the focused Delete button's name; two identical expenses are both announced.
- On Plan: Add category through the dialog (spoken after `Add category` is focused), `Add Groceries` (spoken after the planned field's name), Remove (spoken after the next Remove button's name).
- In a fresh profile, set `localStorage['budget-kit:budget']` to `not json`, reload, add a category through the dialog: `Your saved budget couldn't be read and has been replaced.` is spoken after the dialog closes.
- Typing in income, planned and name fields speaks only field errors (when there are any), never a status message. Changing month speaks only the month label.
- Visual: nothing new is visible except that the invalid-data message looks as before (same text, colour and spacing as the old paragraph; note any difference); no extra gap after `Add expense`, after the expense table, or in the Categories card (hidden regions are absolutely positioned), at 375px and 1280px.

## Assumptions
- One region per owner (four `StatusMessage` uses), not an app-wide announcer context: each owner knows when its focus move and dialog are done; the cost is up to three regions on a page (header, page, saved-data) plus the month label.
- The month label stays a raw `aria-live` `<p>`: converting it to `StatusMessage` would lose its `font-semibold` styling (library components accept only layout classes) and buys nothing.
- Totals are announced only inside the expense messages (left to spend), not on income or planned keystrokes. Category messages mention the planned amount only for the dialog case with an amount, not totals.
- Messages are visually hidden (sighted users see the row appear or disappear and focus move); the saved-data message stays visible as today.
- Delete all data gets no status message: focus already moves to its confirmation paragraph.
- Messages stay in their hidden region until replaced, so a screen-reader user browsing past `Add expense` later may hear the last message with an outdated left-to-spend. Accepted.
- Exact wording as in the Examples; English only.

## Out of scope
- Library changes (task 15 owns `StatusMessage`); the month label; Dashboard, History and DeleteAllData changes.
- Announcing totals while typing, renames, month changes or Delete all data.
- A toast or any visible confirmation.
