> Superseded by 26: written before the redesign.

# 09: Invalid money text warns and is not saved

In Set up the month, invalid text in `Monthly income (USD)` or a `Category {n} planned (USD)` field no longer saves `$0`. The saved amount is kept, and the library's error shows as soon as the text is invalid, not only on blur. Clearing a field still saves `0` (unchanged).

Why: these fields save on every keystroke, and MonthSetup calls the action with `cents ?? 0`. MoneyField reports `null` for both empty and invalid text, so a stray keystroke (`3,200.00x`), a bad paste (`1,2,3`) or a 13th digit silently replaced a saved amount with `0`, and the error appeared only after leaving the field.

**Depends on**: library task 14 (MoneyField `onChange(cents, result)` and `validateOn`) merged

**Parallel group**: F2 (runs alone; may start while library task 15 is still in progress)

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
- `apps/web/src/features/setup/MonthSetup.tsx`: the income handler, the category-row planned handler, and `validateOn="change"` on those two MoneyFields; nothing else
- `docs/tasks/app/README.md`: the one sentence under Behaviour, "Docs"
- QA: `apps/web/src/features/setup/MonthSetup.test.tsx` (add tests; existing tests must still pass), and one test in `apps/web/src/features/BudgetApp.e2e.test.tsx`
- Read-only: `AddExpense.tsx`, `expenseForm.ts` (must not change), everything in `lib/`, `state/`, `test/`, and `packages/ui/**`

## API / Props
No new exports. `MonthSetup(): ReactElement | null` unchanged. Uses MoneyField's `onChange(cents, result)` and `validateOn` from library task 14 (`result` is a `MoneyParseResult` from `@budget-kit/ui`).

## Behaviour
Applies to **`Monthly income (USD)`** and every **`Category {n} planned (USD)`**, the fields that save on each keystroke. Each gets `validateOn="change"` and a handler `(cents, result)`:

| what the field reports | today | after this task |
|---|---|---|
| valid amount (`result.ok`, `cents` not null) | draft = cents; action with cents | unchanged |
| empty (`result.ok`, `cents === null`) | draft = null; action with `0` | unchanged |
| invalid (`result.ok === false`) | draft = null; action with `0` | **no action call; draft not changed**; the field's own action error (if any) is cleared, and the library's parse error shows at once |

- The parse error wording is the library's (`Enter an amount like 12.50`, `Amount can't be negative`, `Amount is too large`); the app adds no text of its own.
- On blur with invalid text: nothing happens in the app. The field keeps the typed text and the error (library behaviour); the saved amount is unchanged. Nothing is reverted.
- The saved amount comes back on the next load: after a refresh the field shows the saved amount (the draft initialises from state, as today).
- Leaving the draft unchanged is what keeps MoneyField from replacing the typed text (task 14: text is reset only when `value` changes to something the field did not report). Do not set the draft to `null` on invalid input.
- **Not changed**: the add-category form (`New category planned (USD)` keeps blur errors and its submit check `Enter an amount like 250.00`), AddExpense's `Amount (USD)` (it keeps `(cents) => …`, blur errors and its submit check), the draft rule, the rename flow, action-error handling.
- Docs: in `docs/tasks/app/README.md`, "Decided by the lead", bullet **Accepted as is**, replace this text:
  ```text
  MoneyField reports `null` for both empty and invalid text (empty or invalid income/planned stores 0; forms treat both as missing)
  ```
  with:
  ```text
  MoneyField reports `null` for both empty and invalid text, with the parse result as a second argument; an empty income/planned field stores 0, while invalid text is not saved and shows the library error at once (task 09); forms treat both as missing
  ```

### Examples (seeded with `SCENARIO`: income `320000`, Rent planned `150000`)
| user does, in `Monthly income (USD)` | field shows | error (immediately) | stored `incomeCents` |
|---|---|---|---|
| click at the end of `3,200.00`, type `x` | `3,200.00x` | `Enter an amount like 12.50` | `320000` |
| then Backspace | `3,200.00` | none | `320000` |
| select all, paste `1,2,3` | `1,2,3` | `Enter an amount like 12.50` | `320000` |
| select all, paste `1000000000000` | `1000000000000` | `Amount is too large` | `320000` |
| select all, type `-` | `-` | `Enter an amount like 12.50` | `320000` |
| select all, type `45` | `45` | none | `4500` |
| clear the field | `` | none | `0` |

## Screens / states
Income with invalid text (error shown, focus still in the field); a planned field with invalid text after blur; seeded `SCENARIO` after refresh.

## Acceptance criteria
Render with `renderWithBudget(<MonthSetup />, { state: SCENARIO })` unless stated; "stored" means `readStored()`; "no save" means `setItemCalls` is unchanged since just before the step.
- [ ] Stray keystroke is not saved: click at the end of `Monthly income (USD)` (`3,200.00`) and type `x`: the field shows `3,200.00x`; **before any blur**, an element with `role="alert"` and text `Enter an amount like 12.50` is the field's error (its accessible description includes it) and the field has `aria-invalid="true"`; stored `incomeCents` is `320000`; no save. After Tab: the field still shows `3,200.00x`, the error is still shown, stored is `320000`.
- [ ] Fixing it: from that state, Backspace: the error and `aria-invalid` are gone without blurring, the field shows `3,200.00`, stored is `320000`.
- [ ] Bad paste is not saved: select all in `Category 1 planned (USD)` (`1,500.00`) and paste `1,2,3`: error `Enter an amount like 12.50` shown before blur, stored Rent `plannedCents` `150000`, no save; same field, select all and paste `1000000000000`: `Amount is too large` before blur, stored `150000`, no save.
- [ ] Every row of the Examples table gives exactly the listed field text, error and stored value (income field).
- [ ] Invalid input never calls an action: with `renderWithFakeBudget(<MonthSetup />, { state: SCENARIO })`, select all in `Monthly income (USD)` and type `abc`: `actions.setIncome` is called 0 times; select all in `Category 2 planned (USD)` and type `-`: `actions.updateCategory` is called 0 times. Typing `5` after selecting all calls `setIncome` once with `500`.
- [ ] Clearing still saves 0 (unchanged): select all in `Monthly income (USD)`, Backspace: field empty, no error, stored `incomeCents` `0`. The existing draft-rule test (`45` after clearing shows `45`, stored `4500`) still passes.
- [ ] Refresh restores the saved amount: after typing `x` at the end of the income field, `refresh()` shows `3,200.00` with no error.
- [ ] Action error then invalid text: with actions overridden to throw `new RangeError('That change would make a total too large.')`, select all in income and type `5`: that message is the field's error and `setIncome` was called once; then type `x` (`5x`): the only error on the field is `Enter an amount like 12.50`, and `setIncome` is still called once in total.
- [ ] Totals unchanged on the page: `renderWithBudget(<BudgetApp />, { state: SCENARIO })`, type `x` at the end of `Monthly income (USD)`: the Stats still read `Income $3,200.00` and `Left to spend $1,505.18` (in `BudgetApp.e2e.test.tsx`).
- [ ] Add-category form unchanged: name `Pets` with planned `abc` adds nothing and focuses the planned field; submitting with both empty shows `Enter a category name` and `Enter an amount like 250.00` (existing tests pass unchanged). In that form, typing `abc` without blurring shows no alert (it keeps blur timing).
- [ ] AddExpense unchanged: `git diff --stat main` shows no change to `features/expenses/AddExpense.tsx` or `features/expenses/expenseForm.ts`, and `AddExpense.test.tsx` and `expenseForm.test.ts` pass without edits (including `amount "abc": dialog stays open, error shown, nothing stored`).
- [ ] Existing `MonthSetup.test.tsx` tests pass unchanged. (The two "abc … stores 0" tests still pass because they clear the field first, which saves 0 by design; QA adds the tests above instead of editing them.)
- [ ] The README sentence is replaced exactly as under Behaviour (grep for `invalid text is not saved`).
- [ ] axe: `expectNoAxeViolations()` passes with the income field showing `3,200.00x` and its error.
- [ ] Styling and source rules hold (`styling.rules.test.ts` passes unchanged); no `any`, `@ts-ignore` or `@ts-expect-error`; `npm run check` passes.

## Manual browser checks (`npm run dev`)
- With a saved budget, click at the end of `Monthly income (USD)` and type a letter: the red error appears at once under the field, the dashboard figures above do not change, and after a page refresh the field shows the saved amount.
- Type `1,200` into a cleared planned field: the error shows briefly at `1,` and disappears at `1,200`. Note whether that flash is distracting (report it; see the follow-ups plan, risks).
- VoiceOver or NVDA: the error is announced when it appears while typing (library `role="alert"`); report if typing `1,200` causes repeated announcements that get in the way.
- 375px wide: the error text under a planned field wraps inside the row with no horizontal scroll.

## Assumptions
- The fix covers the fields that save on each keystroke (income and the category rows). The add-category form and AddExpense already treat `null` as missing on submit and are left unchanged.
- Invalid text is left in the field with the library error until the user fixes it; it is not reverted on blur (unlike names). The saved amount is still visible on the dashboard and comes back on refresh.
- The library's wording is used as is; no "The amount is still $3,200.00" suffix (the library shows its parse error in place of the app's `error` prop, so a suffix would need another library change).
- Empty still means `0` (lead decision in README).

## Out of scope
- Library changes (task 14 owns them); changing the add-category form or AddExpense.
- Debouncing, or holding back errors for half-typed amounts such as `1,`.
- Status announcements (task 10).
