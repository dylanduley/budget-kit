# 26: Invalid money text warns and is not saved

Replaces app task 09, which was written before the redesign. On the Plan page, invalid text in `Monthly income (USD)` or a `Category {n} planned (USD)` field no longer saves `$0`. The saved amount is kept, and the library's error shows as soon as the text is invalid, not only on blur. Clearing a field still saves `0` (unchanged). The Add category dialog no longer adds a category at $0.00 when its `Planned (USD)` text is invalid.

Why: the income and planned fields save on every keystroke and call the action with `cents ?? 0`. MoneyField reports `null` for both empty and invalid text, so a stray keystroke (`3,200.00x`), a bad paste (`1,2,3`) or a 13th digit silently replaced a saved amount with `0`, and the error appeared only after leaving the field. The Add category dialog has the same defect on submit: Name `Pets` with Planned `abc` adds Pets at $0.00. Library task 14 (merged) gives MoneyField `onChange(cents, result)` and `validateOn`, which this task uses.

**Depends on**: library task 14 (merged); app tasks 20–25 (merged)

**Parallel group**: G1 (with 28 and 29; see `docs/tasks/followups-plan2.md`)

## Conventions (identical in every redesign app task)
- **Folders** (all under `apps/web/src/`): `lib/` pure TypeScript (no React, no `window`, no `Date.now()`); `state/` storage and the React provider; `features/<area>/` screen components; `test/` shared test helpers; `app/` Next.js route files only (`layout.tsx`, `page.tsx` files, `globals.css`).
- **Imports**: library components and helpers only from `@budget-kit/ui` (lint blocks `@budget-kit/ui/src/*`); app modules through the `@/` alias.
- **Client boundary**: a file starts with `'use client';` only if it uses state, effects, refs, context, event handlers or Next client hooks (`usePathname`, `useRouter`). `layout.tsx` and every `page.tsx` stay server components (they may export `metadata`). `lib/*`, `state/storage.ts` and `state/budgetReducer.ts` have no directive.
- **Styling**: no CSS files (other than the existing `app/globals.css`, unchanged), no `style` prop, no CSS Modules, and no native `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, `<dialog>` or `<a>` anywhere in `apps/web/src` (links come from the library `NavBar` with Next's `Link`). Tailwind classes only for layout and spacing on plain elements (`flex*`, `grid*`, `gap-*`, `p*-*`, `m*-*`, `max-w-*`, `w-full`, `items-*`, `justify-*`, `list-none`, and `sm:` variants of these), plus typography and token text colours (`text-2xl`, `font-semibold`, `text-text`, `text-text-muted`) on plain text elements (`h1`, `h3`, `p`). On library components `className` may contain only `w-full`, `self-*`, `justify-self-*`, `col-span-*`. Single column below 640px: any multi-column layout is behind `sm:`.
- **Structure**: plain semantic elements only (`header`, `main`, `section`, `div`, `h1`, `h3`, `p`, `ul`, `li`, `form`).
- **Action errors**: every call to a `useBudget().actions` function is wrapped in `try`/`catch`. A caught `RangeError` whose message is exactly `That change would make a total too large.` (`TOTAL_TOO_LARGE_MESSAGE`) is shown with that text; anything else is shown as `Something went wrong. Your budget was not changed.` The provider guarantees state and storage are unchanged; the screen keeps its form or dialog open with the user's values. The message goes in the `error` prop of the field the action came from when one fits; otherwise in the **one permitted app-level alert**: `<p role="alert" data-part="action-error">{message}</p>`, placed directly after the control that triggered the action, rendered only while a message is shown, and cleared on the next edit or successful action in that form. `useBudget().viewMonth` is navigation, not an action, and needs no `try`.
- **Live regions**: app code has no `role="status"` and no `aria-live`, with one exception: the month switcher's month label (task 22) is `aria-live="polite"`. (App task 27 changes this rule; this task adds no live region.)
- **Money**: integer cents in state, storage, props and function arguments. Converted to text only at the display edge with `formatMoney` from `@/lib/format`. No `parseFloat`, `toFixed`, `Number(` on text, `* 100` or `/ 100` on amounts. Amounts shown are exactly the numbers the `lib/` functions return.
- **Dates**: ISO strings (`YYYY-MM-DD`, months `YYYY-MM`), compared as strings. Never `new Date(string)`. "Today" comes only from `useBudget().today`.
- **Copy**: English, sentence case; strings quoted in a task are exact.
- **Tests**: written by QA from the acceptance criteria, colocated as `<file>.test.ts(x)`; the builder does not write them. Tests import from `vitest` (no globals), use Testing Library and `@testing-library/user-event`, and use the helpers in `src/test/`. From task 21 on, `next/navigation` and `next/link` are mocked in `src/test/setup.ts`. jsdom has no layout: visual behaviour goes under **Manual browser checks**.
- **Done**: every acceptance criterion passes and `npm run check` passes.

## Files
- `apps/web/src/features/plan/IncomeCard.tsx`: the change handler and `validateOn="change"` on its MoneyField; nothing else
- `apps/web/src/features/plan/CategoryRow.tsx`: `handlePlannedChange` and `validateOn="change"` on the planned MoneyField; nothing else (names, Remove and their errors unchanged)
- `apps/web/src/features/plan/AddCategoryDialog.tsx`: the `Planned (USD)` MoneyField (`validateOn="change"`, a ref, an "invalid" flag from the parse result) and the submit check; nothing else (props, Name field, actions, copy unchanged)
- `docs/tasks/app/README.md`: the one sentence under Behaviour, "Docs"
- QA: `apps/web/src/features/plan/PlanPage.test.tsx` (add a new `describe` block at the end of the file. Four existing tests encode the old behaviour, where invalid text stored 0, and are rewritten: `invalid 12.345 shows a field error on blur and 0 is stored`, `total too large is shown on the income field; generic for other errors; clears on next edit`, `a total-too-large error on Planned clears when Planned is edited, and a later success closes the dialog`, and `planned edit failing: total too large and generic land on that row planned field only`. All other existing tests must still pass unedited)
- Read-only: `features/expenses/AddExpense.tsx`, `features/expenses/expenseForm.ts` (must not change), `features/plan/CategoriesCard.tsx`, `Suggestions.tsx`, `actionMessage.ts`, everything in `lib/`, `state/`, `test/`, and `packages/ui/**`

## API / Props
No new exports and no prop changes. `IncomeCard`, `CategoryRow`, `AddCategoryDialog` keep their signatures. Uses MoneyField's `onChange(cents, result)` and `validateOn` from library task 14 (`result` is a `MoneyParseResult` from `@budget-kit/ui`: empty is `result.ok && result.cents === null`; valid is `result.ok && result.cents !== null`; invalid is `result.ok === false`).

## Behaviour
### Fields that save as typed: `Monthly income (USD)` and every `Category {n} planned (USD)`
Each gets `validateOn="change"` and a handler `(cents, result)`:

| what the field reports | today | after this task |
|---|---|---|
| valid amount (`result.ok`, `cents` not null) | draft = cents; action with cents | unchanged |
| empty (`result.ok`, `cents === null`) | draft = null; action with `0` | unchanged |
| invalid (`result.ok === false`) | draft = null; action with `0` | **no action call; draft not changed**; that field's own action error (if any) is cleared; the library's parse error shows at once |

- The parse error wording is the library's (`Enter an amount like 12.50`, `Amount can't be negative`, `Amount is too large`); the app adds no text of its own.
- On blur with invalid text nothing happens in the app. The field keeps the typed text and the error (library behaviour); the saved amount is unchanged. Nothing is reverted.
- After a refresh or a month change (the Plan cards remount, keyed by month), the field shows the saved amount: the draft initialises from state, as today.
- Leaving the draft unchanged is what keeps MoneyField from replacing the typed text (task 14: text is reset only when `value` changes to something the field did not report). Do not set the draft to `null` on invalid input.
- Intermediate valid keystrokes are still saved, as today: typing `1,200` into a cleared field saves `100` at `1`, saves nothing at `1,`, `1,2`, `1,20` (invalid, error shown), and saves `120000` at `1,200`.

### Add category dialog, `Planned (USD)`
- Gets `validateOn="change"`, so `abc` shows `Enter an amount like 12.50` while typing.
- Its handler keeps `setPlanned(cents)` and the existing clearing of errors, and also records whether the text is invalid (`result.ok === false`).
- On submit (Save category button or Enter in either field): the existing name check runs first. If the name has a problem, behaviour is unchanged (name error, focus on Name). Otherwise, if the planned text is invalid: `addCategory` is **not** called, the dialog stays open with the typed values, and focus moves to `Planned (USD)`, whose library error is already showing. No app text is added.
- Empty Planned still adds the category at `0` (unchanged); a valid amount adds it with that amount (unchanged).

### Not changed
AddExpense's `Amount (USD)` (it keeps `(cents) => …`, blur-time errors and its submit check), the draft rule (`0` shows as an empty field), the rename flow, Remove, Suggestions, action-error handling, every string.

### Docs
In `docs/tasks/app/README.md`, "Decided by the lead", bullet **Accepted as is**, replace this text:
```text
MoneyField reports `null` for both empty and invalid text (empty or invalid income/planned stores 0; forms treat both as missing)
```
with:
```text
MoneyField reports `null` for both empty and invalid text, with the parse result as a second argument; an empty income or planned field stores 0, while invalid text is not saved and shows the library error at once (app task 26); the Add category dialog does not save while its Planned text is invalid; AddExpense treats both as missing
```

### Examples (seeded with `SCENARIO`: income `320000`, Rent planned `150000`; on `/plan`)
| user does, in `Monthly income (USD)` | field shows | error (immediately, before blur) | stored `incomeCents` |
|---|---|---|---|
| click at the end of `3,200.00`, type `x` | `3,200.00x` | `Enter an amount like 12.50` | `320000` |
| then Backspace | `3,200.00` | none | `320000` |
| select all, paste `1,2,3` | `1,2,3` | `Enter an amount like 12.50` | `320000` |
| select all, paste `1000000000000` | `1000000000000` | `Amount is too large` | `320000` |
| select all, type `-` | `-` | `Enter an amount like 12.50` | `320000` |
| select all, type `-5` | `-5` | `Amount can't be negative` | `320000` |
| select all, type `45` | `45` | none | `4500` |
| clear the field | `` | none | `0` |

| Add category dialog: Name / Planned typed | on Save |
|---|---|
| `Pets` / `abc` | dialog stays open; nothing added; focus on `Planned (USD)`; error `Enter an amount like 12.50` |
| `Pets` / `-5` | dialog stays open; nothing added; error `Amount can't be negative` |
| `Pets` / `25` | `Pets` added with `plannedCents` `2500`; dialog closes (unchanged) |
| `Pets` / empty | `Pets` added with `plannedCents` `0` (unchanged) |
| empty / `abc` | `Enter a category name` on Name, focus on Name, nothing added |

## Screens / states
Income with invalid text (error shown, focus still in the field); a planned field with invalid text after blur; Add category dialog with invalid Planned after Save; seeded `SCENARIO` after refresh.

## Acceptance criteria
Render with `renderWithBudget(<PlanPage />, { state: SCENARIO })` unless stated; "stored" means `readStored()`; "no save" means `storage.setItemCalls` is unchanged since just before the step.

Income and planned fields:
- [ ] Stray keystroke is not saved: click at the end of `Monthly income (USD)` (`3,200.00`) and type `x`: the field shows `3,200.00x`; **before any blur**, an element with `role="alert"` and text `Enter an amount like 12.50` is the field's error (its accessible description includes it) and the field has `aria-invalid="true"`; stored `incomeCents` is `320000`; no save. After Tab: the field still shows `3,200.00x`, the error is still shown, stored is `320000`.
- [ ] Fixing it: from that state, Backspace: the error and `aria-invalid` are gone without blurring, the field shows `3,200.00`, stored is `320000`.
- [ ] Bad paste is not saved: select all in `Category 1 planned (USD)` (`1,500.00`) and paste `1,2,3`: error `Enter an amount like 12.50` shown before blur, stored Rent `plannedCents` `150000`, no save; same field, select all and paste `1000000000000`: `Amount is too large` before blur, stored `150000`, no save.
- [ ] Every row of the first Examples table gives exactly the listed field text, error and stored value.
- [ ] Typing `1,200` into a cleared `Category 2 planned (USD)`: stored Groceries `plannedCents` is `100` after `1`, still `100` after `1,`, `1,2` and `1,20` (each showing `Enter an amount like 12.50`), and `120000` after `1,200` (no error).
- [ ] Invalid input never calls an action: with `renderWithFakeBudget(<PlanPage />, { state: SCENARIO })`, select all in `Monthly income (USD)` and type `abc`: `actions.setIncome` is called 0 times; select all in `Category 2 planned (USD)` and type `-`: `actions.updateCategory` is called 0 times. Then select all in income and type `5`: `setIncome` is called once, with `500`.
- [ ] Clearing still saves 0 (unchanged): the existing tests `seeded income shows formatted and clearing it stores 0 and leaves the field empty` and `clearing a planned field stores 0 and stays empty` pass unedited.
- [ ] Refresh restores the saved amount: after typing `x` at the end of the income field, `refresh()` shows `3,200.00` with no error.
- [ ] Action error then invalid text: with `renderWithFakeBudget` and `setIncome` throwing `new RangeError('That change would make a total too large.')`, select all in income and type `5`: that message is the field's error and `setIncome` was called once; then type `x` (`5x`): the only alert on the field is `Enter an amount like 12.50`, and `setIncome` is still called once in total. Then Backspace (`5`): `setIncome` is called a second time with `500`, and the field shows that action error again (the action threw again).
- [ ] Totals unchanged elsewhere: `renderApp({ state: SCENARIO, path: '/plan' })`, type `x` at the end of `Monthly income (USD)`, click nav `Overview`: the Stats read `Income $3,200.00` and `Left to spend $1,505.18`.

Add category dialog:
- [ ] Invalid planned blocks Save: open `Add category`, type `Pets` in `Name` and `abc` in `Planned (USD)`: before blur, `Planned (USD)` has `aria-invalid="true"` and the error `Enter an amount like 12.50`. Click `Save category`: the dialog is still open, `Name` still `Pets`, `Planned (USD)` still `abc` and focused, no category named `Pets` exists, no save.
- [ ] Same with Enter pressed inside `Planned (USD)` instead of clicking Save: same result.
- [ ] With `renderWithFakeBudget(<PlanPage />, { state: SCENARIO })`: Pets / `abc` → Save calls `actions.addCategory` 0 times; Pets / `-5` → 0 times with `Amount can't be negative` shown; then select all in Planned, type `25`, Save → called once with `{ name: 'Pets', plannedCents: 2500 }` and the dialog closes.
- [ ] Name problem first: empty Name with Planned `abc`, Save: `Enter a category name` on Name, focus on `Name`, nothing added.
- [ ] Empty Planned still adds at 0: Pets / empty → stored `Pets` with `plannedCents` `0`, dialog closed (existing tests pass unedited).

Unchanged parts:
- [ ] AddExpense unchanged: `git diff --stat main` (the branch base) shows no change to `features/expenses/AddExpense.tsx` or `features/expenses/expenseForm.ts`, and `AddExpense.test.tsx` and `expenseForm.test.ts` pass without edits (including `amount "abc": dialog stays open, error shown, nothing stored`).
- [ ] Every existing test in `PlanPage.test.tsx` passes unedited except the four rewritten under Files (QA commit daa1112 rewrote them because they asserted that invalid text stored 0). QA otherwise only appends a new `describe` block.
- [ ] The README sentence is replaced exactly as under Docs (grep for `invalid text is not saved and shows the library error at once (app task 26)`; the old text `empty or invalid income/planned stores 0` is gone).

Blanket:
- [ ] axe: `expectNoAxeViolations()` passes on `/plan` (through `renderApp`) with the income field showing `3,200.00x` and its error, and with the Add category dialog open showing the Planned error.
- [ ] `styling.rules.test.ts` passes unchanged (still 4 MoneyFields, every label ending ` (USD)`); no `any`, `@ts-ignore` or `@ts-expect-error`; `npm run check` passes.

## Manual browser checks (`npm run dev`)
- With a saved budget, on Plan, click at the end of `Monthly income (USD)` and type a letter: the red error appears at once under the field; Overview's figures do not change; after a page refresh the field shows the saved amount.
- Type `1,200` into a cleared planned field: the error shows at `1,` and disappears at `1,200`. Report whether the flash is distracting (see the follow-ups plan, risks).
- VoiceOver or NVDA: the error is announced when it appears while typing (library `role="alert"`); report whether typing `1,200` causes repeated announcements that get in the way.
- Add category dialog: `Pets` / `abc`, press Enter: the dialog stays, focus is in Planned, the error is spoken.
- 375px wide: the error text under a planned field wraps inside the row with no horizontal scroll.

## Assumptions
- The fix covers the fields that save on each keystroke (income and the category rows), and the Add category dialog's Planned field, because the dialog had the same silent-$0 defect on submit. The dialog uses `validateOn="change"` too, so the error is visible even when the user presses Enter without leaving the field (the library would otherwise only show it on blur).
- Invalid text is left in the field with the library error until the user fixes it; it is not reverted on blur (unlike names).
- The library's wording is used as is; no "The amount is still $3,200.00" suffix (a parse error replaces the app's `error` prop, so a suffix would need a library change).
- Empty still means `0` (lead decision).
- AddExpense is unchanged: it already treats `null` as missing on submit and shows its own `Enter an amount like 12.50`.
- Preserved behaviour 8 in `docs/tasks/redesign-plan.md` ("empty (and unparseable) stores 0") is intentionally changed for unparseable text; that plan is history and is not edited.

## Out of scope
- Library changes; changing AddExpense.
- Debouncing, or holding back errors for half-typed amounts such as `1,`.
- Status announcements (app task 27).
