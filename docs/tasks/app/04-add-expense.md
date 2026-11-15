# 04: Add expense

An `Add expense` button that opens a Dialog with a form for amount, category, note and date (a Select of the budget month's days). Valid input adds the expense; invalid input is blocked with field errors.

**Depends on**: 02

**Parallel group**: 2 (with 03, 05, 06, 07)

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
- `apps/web/src/features/expenses/expenseForm.ts` (no directive): pure validation
- `apps/web/src/features/expenses/AddExpense.tsx` (`'use client';`): trigger, Dialog and form
- `apps/web/src/features/BudgetApp.tsx`: add the import and `<AddExpense />` at its line in README "BudgetApp order"; nothing else
- `apps/web/src/features/expenses/expenseForm.test.ts`, `AddExpense.test.tsx` (QA)
- Read-only: `lib/`, `state/`, `test/`. Task 06 also writes in `features/expenses/` but different files.

## API / Props
```ts
// expenseForm.ts
export interface ExpenseFormValues { amountCents: number | null; categoryId: string; note: string; date: string }
export type ExpenseField = 'amount' | 'category' | 'note';   // the date comes from a Select and has no error state
export type ExpenseFormResult =
  | { ok: true; expense: NewExpense }
  | { ok: false; errors: Partial<Record<ExpenseField, string>> };
export const NOTE_MAX_LENGTH = 100;
export function validateExpenseForm(values: ExpenseFormValues, state: BudgetState): ExpenseFormResult;

// AddExpense.tsx
export function AddExpense(): ReactElement | null;   // null unless ready
```
Library: `Button`, `Dialog`, `MoneyField`, `Select`, `TextField`.

## Behaviour
### Validation (`validateExpenseForm`, checked in field order)
| field | rule | error |
|---|---|---|
| amount | `null` (empty or not a valid amount) | `Enter an amount like 12.50` |
| amount | `0` | `Enter an amount more than 0.00` |
| category | `''` or not a current category id | `Choose a category` |
| note | trimmed length > 100 | `Keep the note to 100 characters or fewer` |
Amounts must be at least 1 cent: refunds and negative amounts are not supported (MoneyField rejects `-5` with its own `Amount can't be negative`; the app never sets `allowNegative`); to undo a purchase, delete the expense (task 06). The form blocks submit with a clear error for an empty or `0` amount.

The date is not validated here: the Select only offers dates from `datesInMonth(state.month)`, and `addExpense` (task 01) still rejects any other date as a defence. On success `expense` is `{ categoryId, amountCents, note: note.trim(), date }`.

### Component
- With no categories: renders `<p>Add a category before adding expenses.</p>` instead of the button.
- Otherwise `<Button>` text `Add expense` (primary). It owns `const [open, setOpen] = useState(false)`; clicking sets it `true`.
- `<Dialog open={open} onClose={close} title="Add expense" initialFocusRef={amountRef}>`; because the Dialog renders nothing while closed, the form mounts fresh on every open (no leftover values or errors).
- Body: `<form id={formId} noValidate onSubmit={…}>` (`formId` from `useId`) with, in order:
  - `MoneyField` label `Amount (USD)`, `ref={amountRef}`;
  - `Select` label `Category`, `placeholder="Choose a category"`, controlled `value` starting `''`, options = current categories in state order, `{ value: id, label: categoryLabel(state, id) }`;
  - `TextField` label `Note`, hint `Optional`, `maxLength={100}`;
  - `Select` label `Date`, controlled `value` starting at `defaultExpenseDate(state.month, today)`, no placeholder, options `datesInMonth(state.month).map((d) => ({ value: d, label: formatDate(d) }))` (ascending, e.g. `Nov 1, 2026` … `Nov 30, 2026`).
- `actions`: `Button variant="secondary"` `Cancel` (closes), then `Button type="submit" form={formId}` `Save expense`. The submit button is outside the `<form>` element and linked by the `form` attribute, so Enter in a text field and clicking `Save expense` both submit.
- Submit (`preventDefault`): run `validateExpenseForm`. Errors → shown on their fields through each component's `error` prop (the library's Field announces them with `role="alert"`; the app adds no live region of its own); focus moves to the first invalid field; nothing is added; the dialog stays open. A field's submit error clears when that field is edited. Success → `actions.addExpense(expense)`, then `setOpen(false)`; the Dialog returns focus to the `Add expense` button.
- **Action errors** (Conventions): if `actions.addExpense` throws, the dialog stays open with every value kept and nothing is added. `That change would make a total too large.` goes in the `error` prop of `Amount (USD)` and focus moves to that field; any other error shows `Something went wrong. Your budget was not changed.` in `<p role="alert" data-part="action-error">` at the end of the form, after the `Note` and `Date` fields (inside the dialog body), and focus stays on `Save expense`. Editing any field clears it.
- Esc, the Dialog's close button and `Cancel` close without adding anything.
- Only this component opens this dialog; it never opens another one.

## Screens / states
Closed; no categories; open (empty); open with errors; after saving.

## Acceptance criteria
`validateExpenseForm` (unit, state `SCENARIO`):
- [ ] Valid `{ 8247, 'suggested-groceries', '  weekly shop ', '2026-11-03' }` → `{ ok: true, expense: { categoryId: 'suggested-groceries', amountCents: 8247, note: 'weekly shop', date: '2026-11-03' } }`.
- [ ] Each row of the validation table gives exactly that error for that field and no other errors when the other fields are valid; the result never has a `date` key, whatever the date value; category `'suggested-pets'` gives `Choose a category`; a 101-character note fails and a 100-character note passes.
- [ ] Amount, category and note all invalid → exactly those three errors at once.

Component (render `renderWithBudget(<AddExpense />, { state: SCENARIO })` unless stated):
- [ ] Closed: an `Add expense` button and no dialog. Seeded with zero categories: no button, the text `Add a category before adding expenses.`.
- [ ] Opens in a Dialog: clicking `Add expense` shows `getByRole('dialog', { name: 'Add expense' })`; focus is on `Amount (USD)`; the `Date` select has 30 options from `Nov 1, 2026` to `Nov 30, 2026` with values `2026-11-01` … `2026-11-30`, and `Nov 14, 2026` (value `2026-11-14`) is selected; with a `2026-10` budget and today `'2026-11-14'` it has 31 October options and `Oct 1, 2026` is selected; with a `2028-02` budget it has 29 options ending `Feb 29, 2028`; the category select shows `Choose a category` and lists `Rent`, `Groceries`, `Transport`, `Utilities`, `Eating out` in that order.
- [ ] Option list follows state: seeded with a category renamed to `Food` and a sixth `Pets`, the options are the six current labels; a removed category is not listed.
- [ ] Labels state the unit: the amount field's accessible name is exactly `Amount (USD)`; the other fields are `Category`, `Note`, `Date`.
- [ ] Saves: amount `82.47`, category `Groceries`, note `weekly shop`, date option `Nov 3, 2026`, click `Save expense` → dialog gone, focus on `Add expense`, stored expenses have length 4 and the last is `{ id: 'id-1', categoryId: 'suggested-groceries', amountCents: 8247, note: 'weekly shop', date: '2026-11-03' }`.
- [ ] Enter submits: the same values with Enter pressed in `Note` save the expense.
- [ ] Blocks submit while the amount is empty: leaving `Amount (USD)` empty, choosing a category and clicking `Save expense` keeps the dialog open, shows `Enter an amount like 12.50` with `aria-invalid="true"` on the amount input, focuses it, and stored expenses are still 3. The same with amount `abc` (still 3 expenses; the visible error may be MoneyField's own `Enter an amount like 12.50`). With amount `0`, the error is `Enter an amount more than 0.00`. Typing `-5` and tabbing away shows `Amount can't be negative`, and submitting adds nothing.
- [ ] Errors on every invalid field: submitting the untouched form shows the amount and category errors (no date error exists), focus goes to `Amount (USD)`, and each error element has `role="alert"` (from the library); choosing a category removes only the category error.
- [ ] Action error, total too large (`renderWithFakeBudget`, `state: SCENARIO`, `addExpense` overridden to `throw new RangeError('That change would make a total too large.')`): a valid submit keeps the dialog open, shows that text as the `Amount (USD)` error (`role="alert"`, `aria-invalid="true"`), focuses the amount field, and keeps the amount, category, note and date values; the mock was called once.
- [ ] Action error, unexpected (`addExpense` throws `new Error('boom')`): the dialog stays open and `[data-part="action-error"]` with `role="alert"` reads `Something went wrong. Your budget was not changed.`; the fields keep their values; editing the note removes the message; a second submit after the override is removed (re-render without it) closes the dialog.
- [ ] Real overflow: `renderWithBudget` seeded with 90 Transport expenses of `MAX_CENTS` in November; adding `999999999999.99` shows the total error on the amount field and `readStored()` still has 90 expenses.
- [ ] Cancel, Esc and the close button each close the dialog, return focus to `Add expense`, and leave stored expenses at 3. Reopening after a cancelled, half-filled form shows empty fields and no errors.
- [ ] No floats: typing `0.10`, saving, then `0.20`, saving, stores `10` and `20`.
- [ ] While open, the `Add expense` trigger has an ancestor with `inert` (the library makes the page behind inert).
- [ ] Keyboard only: open with Enter on the trigger, fill every field (choose the category and date with arrow keys), save with Enter in `Note`; then open and close with Esc.
- [ ] axe: `expectNoAxeViolations()` passes closed, open, and open with all errors shown.
- [ ] Styling rules in Conventions hold (grep); no `any`, `@ts-ignore` or `@ts-expect-error`; `npm run check` passes.

## Manual browser checks
- At 375×667 the dialog fits, the body scrolls if needed, and `Cancel` / `Save expense` stay visible.
- On a phone, `Amount (USD)` opens the decimal keypad.
- Focus ring visible on each field and button; after saving with the mouse, focus is back on `Add expense` (Chrome, Firefox; Safari's known pointer-focus limitation is acceptable and noted by the library).
- The date Select on a phone opens the native picker list of the month's days, scrollable to the end of the month.

## Assumptions
- The date is the library's `Select` of the budget month's days (lead decision), so no format error is possible. The library's Select and TextField render at the same height (lead's library follow-up), so the app adds no styling for it.
- The date must be in the budget's month (lead decision), guaranteed by the option list; it defaults to today, or the 1st of the budget month if today is in another month (a budget not yet rolled over).
- The category must be chosen (no preselected category).
- Submit is blocked by validation on submit, not by disabling `Save expense` (a disabled button gives no reason and cannot be focused).
- Note is optional, at most 100 characters.
- Field errors are announced by the library's Field (`role="alert"`, lead's library follow-up); the app still moves focus to the first invalid field.
- Saving closes the dialog (no "save and add another").

## Out of scope
- Refunds and negative or zero amounts (lead decision: amounts are at least 1 cent; delete the expense instead).
- Editing an existing expense; the list (06); categories (03).
- Changes to `lib/`, `state/`, test helpers or the library; if something is missing, report it.
