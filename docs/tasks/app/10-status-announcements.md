# 10: Announce non-error changes with StatusMessage

Wires the library's `StatusMessage` (task 15) into the app so screen-reader users hear four kinds of change they cannot otherwise perceive without hunting for them: an expense added, an expense deleted (both with the new left to spend), a category removed, and the saved-data "replaced" message. WCAG 4.1.3 Status Messages. Also changes the app convention and the `styling.rules` test that today forbid any status region, so they allow exactly these library regions and nothing else.

**Depends on**: library task 15 (`StatusMessage`) merged; app task 09 merged (both edit `MonthSetup.tsx` and `MonthSetup.test.tsx`)

**Parallel group**: F3 (runs alone, last)

## Conventions (identical in every app task)
- **Folders** (all under `apps/web/src/`): `lib/` pure TypeScript (no React, no `window`, no `Date.now()`); `state/` storage and the React provider; `features/<area>/` screen components; `test/` shared test helpers; `app/` Next.js route files only (`layout.tsx`, `page.tsx`, `globals.css`).
- **Imports**: library components and helpers only from `@budget-kit/ui` (lint blocks `@budget-kit/ui/src/*`); app modules through the `@/` alias (`@/lib/budget`).
- **Client boundary**: a file starts with `'use client';` only if it uses state, effects, refs, context or event handlers. `page.tsx` and `layout.tsx` stay server components. `lib/*`, `state/storage.ts` and `state/budgetReducer.ts` have no directive.
- **Styling**: no CSS files (other than the existing `app/globals.css`, unchanged), no `style` prop, no CSS Modules, and no native `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>` or `<dialog>` anywhere in `apps/web/src`. Tailwind classes only for layout and spacing on plain elements (`flex*`, `grid*`, `gap-*`, `p*-*`, `m*-*`, `max-w-*`, `w-full`, `items-*`, `justify-*`, `list-none`, and `sm:` variants of these), plus typography and token text colours (`text-2xl`, `font-semibold`, `text-text`, `text-text-muted`) on plain text elements (`h1`, `h3`, `p`). On library components `className` may contain only `w-full`, `self-*`, `justify-self-*`, `col-span-*`. Single column below 640px: any multi-column layout is behind `sm:`.
- **Structure**: plain semantic elements only (`main`, `section`, `h1`, `h3`, `p`, `ul`, `li`, `form`).
- **Action errors**: every call to a `useBudget().actions` function is wrapped in `try`/`catch`. A caught `RangeError` whose message is exactly `That change would make a total too large.` (`TOTAL_TOO_LARGE_MESSAGE`, task 02) is shown with that text; anything else is shown as `Something went wrong. Your budget was not changed.` The provider guarantees state and storage are unchanged; the screen keeps its form or dialog open with the user's values. The message goes in the `error` prop of the field the action came from when one fits (the library's Field announces it with `role="alert"`); otherwise in the **one permitted app-level alert**: `<p role="alert" data-part="action-error">{message}</p>`, placed directly after the control that triggered the action, rendered only while a message is shown, and cleared on the next edit or successful action in that form. App code has no other `role="alert"`, and writes no `role="status"`, `aria-live` or `aria-atomic` itself.
- **Status announcements** (new in this task): non-error changes are announced only through the library's `StatusMessage`, one region in each of `BudgetApp`, `AddExpense`, `ExpenseList` and `MonthSetup`, rendered whenever that part of the screen is shown (before its message changes), with the exact messages of task 10.
- **Money**: integer cents in state, storage, props and function arguments. Converted to text only at the display edge with `formatMoney` from `@/lib/format` (which wraps the library's `formatCents`). No `parseFloat`, `toFixed`, `Number(` on text, `* 100` or `/ 100` on amounts. Amounts shown are exactly the numbers the `lib/budget.ts` functions return.
- **Dates**: ISO strings (`YYYY-MM-DD`, months `YYYY-MM`), compared as strings. Never parse them with `new Date(string)` (time-zone shifts). "Today" comes only from `useBudget().today` (task 02).
- **Copy**: English, sentence case; strings quoted in a task are exact.
- **Tests**: written by QA from the acceptance criteria, colocated as `<file>.test.ts(x)`; the builder does not write them. Tests import `describe`, `it`, `expect`, `vi` from `vitest` (no globals), use Testing Library and `@testing-library/user-event`, and render screens with the helpers in `src/test/` (task 02). jsdom has no layout, so visual behaviour goes under **Manual browser checks**, never into a test that cannot fail.
- **Done**: every acceptance criterion passes and `npm run check` passes.

## Files
- `apps/web/src/features/expenses/AddExpense.tsx`: one `StatusMessage`, the added message
- `apps/web/src/features/expenses/ExpenseList.tsx`: one `StatusMessage`, the deleted message
- `apps/web/src/features/setup/MonthSetup.tsx`: one `StatusMessage`, the removed message
- `apps/web/src/features/BudgetApp.tsx`: the invalid/replaced `<p>` becomes a visible `StatusMessage`
- `docs/tasks/app/README.md`: the convention text under "Docs" below
- QA, new tests: `AddExpense.test.tsx`, `ExpenseList.test.tsx`, `MonthSetup.test.tsx`, `BudgetApp.e2e.test.tsx`, `styling.rules.test.ts`
- QA, existing tests that assert "no status region" and must be updated (they would fail once a region exists):
  - `features/reset/MonthNotice.test.tsx`, test `the full app adds no live regions when closed`
  - `features/setup/MonthSetup.test.tsx`, test `no role=status, aria-live or stray alert at rest, with field errors, or with action errors`
  - `features/expenses/ExpenseList.test.tsx`, test `BudgetApp renders the list and still has no other alerts/live regions from it`
  - `styling.rules.test.ts`, test `there is no role="status" and no aria-live` (rename and extend, below)
  These keep their intent (no app-made live regions, no stray alerts) with the new rule: every `[role="status"]` or `[aria-live]` element is a library `[data-part="status-message"]` region, and in their states its text is empty. Unaffected and left alone: `Dashboard.test.tsx` and `ResetMonth.test.tsx` (they render screens that get no region), and the source-only checks in `AddExpense.test.tsx`, `ExpenseList.test.tsx`, `MonthSetup.test.tsx` and `resetRules.test.ts` (the app source still contains no `role="status"`, `aria-live` or `aria-atomic`).
- Read-only: `Dashboard.tsx`, `MonthNotice.tsx`, `ResetMonth*.tsx`, `lib/`, `state/`, `test/`, `packages/ui/**`

## API / Props
No new exports or props. Library: `StatusMessage` (`message`, `announceKey`, `visuallyHidden`) from `@budget-kit/ui`.

## Behaviour
### The four regions and their exact messages
`{amount}` is `formatMoney(amountCents)`, `{category}` is `categoryLabel(state, categoryId)`, `{date}` is `formatDate(date)`, `{left}` is `formatMoney(getTotals(stateAfter).leftToSpendCents)` where `stateAfter` is the budget state after the change. The ` Left to spend: {left}.` sentence is added only when `getTotals(stateAfter).hasIncome` is true.

| # | where | region | when its text changes | message |
|---|---|---|---|---|
| 1 | `AddExpense` | `<StatusMessage visuallyHidden …>` directly after the `Add expense` button (outside the Dialog), rendered whenever the button is | after a successful save, **once the dialog has closed** | `Expense added: {amount} for {category} on {date}.` + ` Left to spend: {left}.` |
| 2 | `ExpenseList` | `<StatusMessage visuallyHidden …>` inside the `Expenses` Card, after the Table (before the action-error paragraph), rendered also when the table is empty | after a successful `deleteExpense` | `Expense deleted: {amount} for {category} on {date}.` + ` Left to spend: {left}.` |
| 3 | `MonthSetup` | `<StatusMessage visuallyHidden …>` inside the `Set up the month` Card, after the categories list (or its `No categories yet` paragraph), rendered also when there are no categories | after a successful `removeCategory` | `Category removed: {category}.` with the label taken **before** the removal |
| 4 | `BudgetApp` | the existing `loadStatus === 'invalid'` paragraph becomes `<StatusMessage message={savedDataReplaced ? REPLACED_MESSAGE : INVALID_MESSAGE} />` (visible, same place, same texts) | when the first change replaces the unreadable data | `Your saved budget couldn't be read and has been replaced.` |

Examples:
- `SCENARIO` (income $3,200.00, spent $1,694.82), add `20` / Groceries / Nov 14, 2026 → `Expense added: $20.00 for Groceries on Nov 14, 2026. Left to spend: $1,485.18.`
- `SCENARIO`, add `2000` / Transport / Nov 10, 2026 → `Expense added: $2,000.00 for Transport on Nov 10, 2026. Left to spend: -$494.82.`
- First run (income 0), add `20` / Groceries / Nov 14, 2026 → `Expense added: $20.00 for Groceries on Nov 14, 2026.`
- `SCENARIO`, delete the Groceries Nov 3 expense → `Expense deleted: $82.47 for Groceries on Nov 3, 2026. Left to spend: $1,587.65.`
- `SCENARIO` with Eating out removed, delete the Nov 5 expense → `Expense deleted: $112.35 for Removed category on Nov 5, 2026. Left to spend: $1,617.53.`
- `SCENARIO`, remove Groceries → `Category removed: Groceries.`

### Rules
- **Regions exist first**: each region is rendered (with `message=""`) as soon as its screen is ready, so it is in the DOM before its text changes. It is never rendered conditionally on having a message.
- **Messages stay until replaced** by the next message from the same region (no timers, no clearing). `MonthSetup`'s region starts empty again after a reset because the screen remounts (`key={generation}`).
- **Repeat announcements**: regions 1–3 pass an `announceKey` that increases on every successful action, so two identical messages in a row (two `$5.00` Groceries expenses on the same day) are both announced.
- **Failures announce nothing new**: when the action throws, the region's text and `announceKey` are unchanged; the error shows as today.
- **Totals** come from `getTotals` on the state after the change, never from arithmetic in the screen. Either compute the message from the current state after the change has rendered (for example in an effect), or with the pure functions on the state before it (`getTotals(deleteExpense(state, id))`). For AddExpense the effect route also satisfies the dialog rule below.
- **Dialog and inert**: while the Add expense Dialog is open the rest of the page is `inert`, and a live region inside an inert subtree may not be announced. Region 1's text must change only after the Dialog has closed and `inert` has been removed (for example: store the saved expense in state on success, and set the message in a `useEffect` that runs when `open` is `false`; React runs the Dialog's cleanup, which lifts `inert`, before the parent's effect).
- **Not announced** (planner default, see Assumptions): income and planned edits and their effect on totals, renames, adding a category, the unavailable-storage message, the first-run line, the rollover notice and reset (reset already moves focus to its confirmation).
- No other markup changes; focus behaviour after delete and remove is unchanged.

### Docs
In `docs/tasks/app/README.md`:
1. Under "Conventions for the whole app", insert after the **Action errors** bullet:
   ```text
   - **Status announcements**: non-error changes are announced only through the library's `StatusMessage` (library task 15): one region in each of `BudgetApp`, `AddExpense`, `ExpenseList` and `MonthSetup`, rendered before its message changes, with the exact messages of app task 10 (expense added, expense deleted, category removed, saved data replaced). App code writes no `role="status"`, `aria-live` or `aria-atomic` itself, and `<p role="alert" data-part="action-error">` stays the only app-level alert.
   ```
2. In "Decided by the lead", bullet **Accepted as is**, replace:
   ```text
   page-level messages are plain elements and are not announced (except the focused post-reset confirmation)
   ```
   with:
   ```text
   page-level messages are plain elements and are not announced, except the focused post-reset confirmation and the StatusMessage announcements of task 10
   ```
`CLAUDE.md` does not change: it has no rule about live regions, and "if the app needs a component that doesn't exist, report it" is what library task 15 answers. The conventions blocks in the built task files 03–08 are left as they were (history); this task file and the README are the current rule.

## Screens / states
Populated (`SCENARIO`) with all regions empty; after adding an expense; after deleting one; after removing a category; invalid saved data before and after the first change; no categories (AddExpense shows its paragraph and has no region).

## Acceptance criteria
### Regions exist before they change
- [ ] `renderWithBudget(<BudgetApp />, { state: SCENARIO })`, once ready: exactly 3 elements match `[role="status"]`, every one is `[data-part="status-message"]` with `data-visually-hidden="true"` and empty text; there is no `[aria-live]` element that is not one of them; there is no `role="alert"`.
- [ ] Same with categories `[]` and no expenses: exactly 2 regions (ExpenseList, MonthSetup).
- [ ] Storage `'not json'`: exactly 4 regions; the BudgetApp one has no `data-visually-hidden` and the text `Your saved budget couldn't be read, so a new one was started. Your first change will replace the saved data.`

### Expense added (`AddExpense.test.tsx`, plus e2e)
- [ ] With `renderWithBudget(<AddExpense />, { state: SCENARIO })`: capture the region (the `[role="status"]` that is the next element sibling of the `Add expense` button) **before** opening the dialog; add `20` / Groceries / default date (Nov 14): the dialog closes and the **same element** has text exactly `Expense added: $20.00 for Groceries on Nov 14, 2026. Left to spend: $1,485.18.`
- [ ] Not while inert: a `MutationObserver` on that region (`childList`, `subtree`, `characterData`), set up before Save, sees at least one mutation, and at every mutation callback `region.closest('[inert]')` is `null` and `document.querySelector('[role="dialog"]')` is `null`.
- [ ] Overspending and no income: from `SCENARIO`, adding `2000` / Transport / Nov 10 gives `… Left to spend: -$494.82.`; from first run (income 0), adding `20` / Groceries gives exactly `Expense added: $20.00 for Groceries on Nov 14, 2026.`
- [ ] Repeat: from first run (income 0, so no left-to-spend sentence), adding `20` / Groceries / Nov 14 twice leaves the same text both times, and the `[data-part="status-text"]` span after the second save is a different node from the one after the first.
- [ ] Failure: with `renderWithFakeBudget` and `addExpense` throwing `new Error('boom')`, Save shows the existing action error, the dialog stays open, and the region's text is still empty.
- [ ] Cancel or Esc: the region's text is unchanged.

### Expense deleted (`ExpenseList.test.tsx`)
- [ ] `SCENARIO`: capture the region inside the `Expenses` region; click `Delete $82.47 Groceries expense from Nov 3, 2026`: the same element's text is exactly `Expense deleted: $82.47 for Groceries on Nov 3, 2026. Left to spend: $1,587.65.`; focus moves as before (to the next Delete button).
- [ ] Deleting the last remaining expense: the region still exists (the empty-state paragraph is shown) and holds that expense's message.
- [ ] Removed category: with Eating out removed from `SCENARIO`, deleting the Nov 5 expense gives `Expense deleted: $112.35 for Removed category on Nov 5, 2026. Left to spend: $1,617.53.`
- [ ] Repeat: in a state with income `0` and two expenses `{ amountCents: 500, categoryId: 'suggested-groceries', date: '2026-11-03' }` (different ids), deleting one then the other gives `Expense deleted: $5.00 for Groceries on Nov 3, 2026.` both times, and the `status-text` span is a new node the second time.
- [ ] Failure: with `deleteExpense` throwing, the action error shows and the region's text is unchanged.

### Category removed (`MonthSetup.test.tsx`)
- [ ] `SCENARIO`: click `Remove Groceries`: the region inside `Set up the month` has text exactly `Category removed: Groceries.`; focus is on `Remove Transport` (unchanged). Removing the only remaining category leaves the region in the DOM with that category's message and shows `No categories yet. Add one below.`
- [ ] Failure: with `removeCategory` throwing, the action error shows in the row and the region's text is unchanged.

### Saved data replaced (`BudgetApp.e2e.test.tsx`)
- [ ] Storage `'not json'`: capture the element with the invalid-data text (it has `role="status"`); type `3200` into `Monthly income (USD)`: the **same element** now has text exactly `Your saved budget couldn't be read and has been replaced.`; the existing saved-data assertions (old text gone, new text shown, neither after `refresh()`) still pass.

### Nothing else is announced
- [ ] In `SCENARIO`, record every region's text; then type `5` into `Monthly income (USD)`, change `Category 1 planned (USD)`, rename `Groceries` to `Food` and Tab, add a category `Pets` / `25`: every region's text is unchanged (still empty).
- [ ] The unavailable-storage message and the first-run line are still plain `<p>` elements with no role.

### Rules and conventions (`styling.rules.test.ts`)
- [ ] The test `there is no role="status" and no aria-live` is renamed `app code writes no role="status", aria-live or aria-atomic itself` and also forbids `aria-atomic` and `aria-relevant` in app source; it still passes.
- [ ] New test: `<StatusMessage` appears exactly once in each of `features/BudgetApp.tsx`, `features/expenses/AddExpense.tsx`, `features/expenses/ExpenseList.tsx`, `features/setup/MonthSetup.tsx`, and in no other non-test file (count matches, list the files).
- [ ] New test: in the full `SCENARIO` page, every `[role="status"]` and `[aria-live]` element is `[data-part="status-message"]` (so any app-made region would fail it).
- [ ] The `role="alert"` test (`the only role="alert" is <p role="alert" data-part="action-error">`) is unchanged and passes.
- [ ] Each test listed under Files as "must be updated" is updated as described there, and the updated version still fails if an app file adds `<div role="status">` (QA proves it once by adding one temporarily, then reverts).
- [ ] The README text under Docs is changed exactly (grep for `**Status announcements**` and for `StatusMessage announcements of task 10`).

### Blanket
- [ ] axe: `expectNoAxeViolations()` passes on the full page after an expense is added, after one is deleted, after a category is removed, and in both invalid-data states.
- [ ] No arithmetic added on amounts (the `money and dates` rules pass); no `any`, `@ts-ignore` or `@ts-expect-error`; `npm run check` passes.

## Manual browser checks (`npm run dev`; the a11y-reviewer, then the lead)
jsdom proves the regions exist, keep their identity and get the exact text at the right moment; it cannot prove a screen reader speaks them. Check by hand with VoiceOver + Safari and NVDA + Firefox or Chrome:
- Add an expense with the keyboard: after Save, focus returns to `Add expense` and `Expense added: … Left to spend: ….` is spoken once, after the button name (not lost because the dialog was open).
- Delete two expenses in a row: each message is spoken once, after the focused Delete button's name; two identical expenses are both announced.
- Remove a category: `Category removed: Groceries.` is spoken after the focus moves.
- In a fresh profile, set `localStorage['budget-kit:budget']` to `not json`, reload, type an income: `Your saved budget couldn't be read and has been replaced.` is spoken.
- Typing in income, planned and name fields speaks only field errors (when there are any), never a status message.
- Visual: nothing new is visible except that the invalid-data paragraph looks exactly as before (same text, colour and spacing); no extra gap appears after `Add expense`, after the expense table, or in Set up the month (hidden regions are absolutely positioned), at 375px and 1280px.

## Assumptions
- One region per screen, not one app-wide announcer: no new context or provider, and each screen owns its message. The cost is up to four regions on the page.
- Totals are announced only as part of the expense added/deleted messages (left to spend), not on every income or planned keystroke, which would speak on each digit. Category removal does not mention totals.
- Messages are visually hidden (sighted users see the row appear or disappear); the saved-data message stays visible as it is today.
- Messages stay in their hidden region until replaced, so a screen-reader user browsing past `Add expense` later may hear the last message. Accepted for now.
- Exact wording as in the table; English only.

## Out of scope
- Library changes (task 15 owns `StatusMessage`); Dashboard, MonthNotice and ResetMonth changes.
- Announcing totals while typing, adding a category, renames, or reset.
- A toast or any visible confirmation.
