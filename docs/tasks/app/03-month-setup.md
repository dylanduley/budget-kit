# 03: Month setup

The "Set up the month" screen: monthly income, the category list (rename, change planned amount, remove) and a form to add a category. Starts with the five suggested categories from the initial state.

**Depends on**: 02

**Parallel group**: 2 (with 04, 05, 06, 07)

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
- `apps/web/src/features/setup/MonthSetup.tsx` (`'use client';`)
- `apps/web/src/features/BudgetApp.tsx`: add the import and `<MonthSetup key={generation} />` at its line in README "BudgetApp order" (after `<ExpenseList />`, before `<ResetMonth />`); nothing else
- `apps/web/src/features/setup/MonthSetup.test.tsx` (QA)
- Read-only: everything in `lib/`, `state/`, `test/`

## API / Props
```ts
export function MonthSetup(): ReactElement | null;   // renders null unless useBudget().status === 'ready'
```
Uses `useBudget().state` and `actions.setIncome`, `addCategory`, `updateCategory`, `removeCategory`. Library: `Card`, `MoneyField`, `TextField`, `Button`.

## Behaviour
- Root: `<Card title="Set up the month" description="Enter your monthly income and how much you plan to spend in each category.">`.
- **Income**: `MoneyField` label `Monthly income (USD)`.
- **Categories**: `<h3>Categories</h3>`, then a `<ul>` with one `<li>` per category in state order containing:
  - `TextField` label `Category {n} name` (n = 1-based position), value = the row's name draft (below);
  - `MoneyField` label `Category {n} planned (USD)`;
  - `Button variant="secondary" size="sm"` with visible text `Remove` and `aria-label="Remove {categoryLabel}"` (e.g. `Remove Rent`, `Remove Unnamed category`).
  - Layout: one column; from `sm:` a three-column grid (name, planned, button).
  - With no categories, instead of the list: `<p>No categories yet. Add one below.</p>`.
- **Add a category**: `<form aria-label="Add a category" noValidate>` with `TextField` label `New category name`, `MoneyField` label `New category planned (USD)`, and `Button type="submit"` text `Add category`.
- **Draft rule for every MoneyField here** (avoids the field resetting mid-typing): each field's `value` comes from a component-local `useState<number | null>`, initialised from state once on mount with `0` shown as `null` (empty). On change, the draft is set to what the field reports and the action is called with `cents ?? 0`. The draft is never re-synced from state afterwards; a reset remounts the screen through `key={generation}`. Category rows are keyed by category id.
- **Rename (draft, committed on blur)**: each row keeps a local `nameDraft` (initialised from the saved name) and an optional `nameError`. Typing changes only the draft; nothing is saved per keystroke. While typing, `nameError` is `categoryNameError(state, draft, id)` (live). On blur:
  - draft valid (`categoryNameError` is `null`): `updateCategory(id, { name: draft.trim() })`, the draft becomes the trimmed name, `nameError` clears (no call if the trimmed name equals the saved name);
  - draft invalid: nothing is saved, the draft **reverts** to the saved name, and `nameError` becomes `{error}. The name is still {saved name}.` (e.g. `Enter a category name. The name is still Rent.`, `You already have a category called Rent. The name is still Groceries.`). It clears on the next edit of that field.
  A blank or duplicate name is therefore never in saved state. Typing that is not yet blurred is not saved (a refresh mid-edit loses it).
- **Remove**: calls `removeCategory(id)` with no confirmation; that category's expenses are kept (task 01). Focus then moves to the `Remove` button of the row that took its place, else the new last row's `Remove`, else the `New category name` field.
- **Add**: on submit (`preventDefault`): `categoryNameError(state, name)` not `null` → that error on the name field; planned `null` (empty or not a valid amount) → error `Enter an amount like 250.00` on the planned field. If any error, focus moves to the first invalid field and nothing is added. Otherwise `addCategory({ name, plannedCents })`, both fields clear (name `''`, planned `null`), their errors clear, and focus moves to `New category name`. Editing a field clears its submit error.

### Action errors (Conventions, "Action errors")
| action call | where the message is shown |
|---|---|
| `setIncome` | `error` prop of `Monthly income (USD)` |
| `updateCategory` planned | `error` prop of that row's `Category {n} planned (USD)` |
| `updateCategory` name (on blur) | `error` prop of that row's `Category {n} name`; the field reverts to the saved name as for an invalid name |
| `addCategory`: the total error | `error` prop of `New category planned (USD)` |
| `addCategory`: any other error | `<p role="alert" data-part="action-error">` directly after the `Add category` button, inside the form |
| `removeCategory` | `<p role="alert" data-part="action-error">` directly after that row's `Remove` button, inside its `<li>` |
After a failed action nothing is saved, the typed draft stays as typed (it is not reverted, except names), the add form keeps its values, and focus stays where it was. The message clears on the next edit of that field or form, or the next successful action from the same control.

## Screens / states
First run (five suggested, empty amounts); filled; a blank name; no categories; add-category errors shown.

## Acceptance criteria
Render with `renderWithBudget(<MonthSetup />)` unless stated; "stored" means `readStored()`.
- [ ] First run: income field empty; five rows named `Rent`, `Groceries`, `Transport`, `Utilities`, `Eating out` in that order; each planned field empty; heading `Set up the month` (level 2) and `Categories` (level 3).
- [ ] Labels state the unit: the money fields' accessible names are exactly `Monthly income (USD)`, `Category 1 planned (USD)` … `Category 5 planned (USD)` and `New category planned (USD)`; text fields are `Category 1 name` … and `New category name`.
- [ ] Field errors come from the library only: each visible field error has `role="alert"`; the file's only own `role="alert"` is the permitted `<p role="alert" data-part="action-error">`, and it has no `role="status"` or `aria-live` (grep).
- [ ] Action errors, total too large (render with `renderWithFakeBudget`, `state: SCENARIO`, each action overridden to `throw new RangeError('That change would make a total too large.')`): typing `5` in `Monthly income (USD)` shows `That change would make a total too large.` as that field's error; typing in `Category 1 planned (USD)` shows it on that field; submitting the add form with `Pets` / `25` shows it on `New category planned (USD)`, keeps `Pets` and `25` in the fields, and keeps focus on the form. In each case the error element has `role="alert"` and the mock was called once.
- [ ] Action errors, unexpected (`actions` overridden to `throw new Error('boom')`): submitting the add form shows `Something went wrong. Your budget was not changed.` in `[data-part="action-error"]` right after `Add category`, with the fields kept; clicking `Remove Groceries` shows the same text inside the Groceries list item and the row stays; tabbing out of a renamed `Category 1 name` shows it on that field and the field shows `Rent` again. Editing the form or field removes the message.
- [ ] Real overflow (no fake): `renderWithBudget` with a state of 90 categories each at `MAX_CENTS` plus one at `0`; typing `999999999999.99` into the last planned field shows `That change would make a total too large.` on it (from the 11th digit on, since each keystroke is an action), and `readStored()` has that category at `999999999900` (the last keystroke that fitted: `9999999999`), with the planned total still a safe integer.
- [ ] Typing `3,200` into `Monthly income (USD)` and tabbing away shows `3,200.00` and stored `incomeCents` is `320000`. Typing `12.5` gives stored `1250` while the field still shows `12.5` before blur.
- [ ] Draft rule: select all in an income field holding `3,200.00`, press Backspace, type `45`: the field shows `45` (never `0.00`) and stored income is `4500`; after clearing it completely the field stays empty and stored income is `0`.
- [ ] Typing `abc` into `Category 1 planned (USD)` and tabbing away shows `Enter an amount like 12.50`; stored `plannedCents` for Rent is `0`.
- [ ] Planned amounts typed for all five (`1500`, `400`, `120`, `150`, `100`) give stored `plannedCents` `150000`, `40000`, `12000`, `15000`, `10000`.
- [ ] Rename commits on blur: typing ` Food ` into `Category 2 name` saves nothing while focus stays (stored name still `Groceries`, `setItemCalls` unchanged); after Tab the stored name is `Food`, the field shows `Food`, and the button is named `Remove Food`.
- [ ] Blank name is never saved: clearing `Category 1 name` shows `Enter a category name` with `aria-invalid="true"` while focused; after Tab the field shows `Rent` again, the error reads `Enter a category name. The name is still Rent.`, and stored names are unchanged. Typing in the field again removes the error.
- [ ] Duplicate name is never saved: typing `rent` (any case, with spaces) into `Category 2 name` shows `You already have a category called Rent`; after Tab the field shows `Groceries`, the error reads `You already have a category called Rent. The name is still Groceries.`, and stored names are unchanged. Renaming `Rent` to `RENT` (same category) is allowed and saves `RENT`.
- [ ] After any sequence of edits in these tests, the stored names are all non-blank and unique ignoring case and surrounding spaces (assert on `readStored()`).
- [ ] Seeded with `SCENARIO`, the fields show `3,200.00`, `1,500.00`, `400.00`, `120.00`, `150.00`, `100.00`.
- [ ] Remove: clicking `Remove Groceries` leaves four rows (`Rent`, `Transport`, `Utilities`, `Eating out`), stored categories have length 4, stored expenses are unchanged (seeded `SCENARIO`: still 3), and focus is on `Remove Transport`. Removing the last row moves focus to the new last row's Remove button; removing the only row shows `No categories yet. Add one below.` and focuses `New category name`.
- [ ] Add: typing `Pets` and `25` and clicking `Add category` adds a sixth row `Pets` with planned `25.00`, stored `{ name: 'Pets', plannedCents: 2500 }` with id `'id-1'`, both add fields empty, and focus on `New category name`. Pressing Enter in `New category planned (USD)` also submits.
- [ ] Add errors: submitting with both fields empty shows `Enter a category name` and `Enter an amount like 250.00`, focuses `New category name`, and adds nothing (stored categories still 5). With name `Pets` and planned `abc`, submitting adds nothing and focus moves to the planned field. Name `   ` counts as empty. Name ` groceries ` shows `You already have a category called Groceries` and adds nothing. Planned `0` is valid.
- [ ] Remount on reset: rendering `<MonthSetup key={generation} />` from a probe, then calling `actions.resetMonth()` after typing income `500`, shows an empty income field and the five suggested names.
- [ ] Keyboard only: income, every name and planned field, every Remove button and the add form are reachable with Tab in DOM order, and adding a category works with keyboard alone.
- [ ] axe: `expectNoAxeViolations()` passes in the first-run, `SCENARIO`, blank-name, no-categories and add-errors states.
- [ ] Styling rules in Conventions hold (grep the file: no `style=`, no native controls, only allowed classes).
- [ ] No `any`, `@ts-ignore` or `@ts-expect-error`; `npm run check` passes.

## Manual browser checks
- At 375px wide each row stacks (name, planned, button) with no horizontal scroll; at 640px and up the row is one line.
- Focus ring visible on every field and button, including after a Remove moves focus.
- In VoiceOver or NVDA each money field reads its `(USD)` label (the `$` prefix is hidden from assistive technology by the library), and a field error is announced when it appears (library `role="alert"`).

## Assumptions
- Planned amounts and income may be `0`; an empty or invalid field stores `0` (MoneyField reports both as `null`, README "Decided by the lead").
- Money labels say `(USD)` because the app is dollars-only and the `$` prefix is hidden from assistive technology (lead decision).
- Names must be non-blank and unique (trimmed, case-insensitive) (lead decision). Chosen flow: a draft per row, committed on blur, reverted with an explanatory error if invalid; names are not saved per keystroke.
- Removing a category has no confirmation and keeps its expenses.
- Ordinal labels (`Category 2 name`) are used so every field has a unique, stable accessible name.
- No reordering and no limit on the number of categories.

## Out of scope
- The dashboard, expenses, reset (other tasks).
- Changes to `lib/`, `state/`, test helpers or the library; if something is missing, report it.
