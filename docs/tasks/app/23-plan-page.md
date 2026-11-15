# 23: Plan page

Replace today's "Set up the month" section with the Plan page: an `Income` card, a `Categories` card with one row per category (ghost `Remove` the same height as the fields), an `Add category` dialog instead of the always-visible form, and one-click suggestions instead of five pre-filled categories. Spec: `docs/specs/app-redesign.md` (Plan, First run, decisions 12–14).

**Depends on**: app 21 (library 21 is useful for the manual check but not required)

**Parallel group**: Redesign C (with 22 and 24)

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
- `apps/web/src/features/plan/PlanPage.tsx`: replace the temporary body (keep `h1` and loading)
- `apps/web/src/features/plan/IncomeCard.tsx`, `CategoriesCard.tsx`, `CategoryRow.tsx`, `AddCategoryDialog.tsx`, `Suggestions.tsx` (each `'use client';`)
- Delete `apps/web/src/features/setup/` (`MonthSetup.tsx`, `MonthSetup.test.tsx`)
- QA: `features/plan/PlanPage.test.tsx` (and per-component tests if wanted); in `styling.rules.test.ts` change only the populated-state money-label check (expected labels below) and its scan list (`features/plan/*` instead of `features/setup/MonthSetup.tsx`)

## API
```ts
export function PlanPage(): ReactElement;
// Internal to features/plan (exported only for tests):
export function IncomeCard(): ReactElement | null;
export function CategoriesCard(): ReactElement | null;
export interface AddCategoryDialogProps { open: boolean; onClose: () => void; }
export function AddCategoryDialog(props: AddCategoryDialogProps): ReactElement | null;
```
Uses `useBudget()` (`state`, `viewedMonth`, `generation`, `actions`), `categoryNameError`, `categoryLabel`, `SUGGESTED_CATEGORY_NAMES`. Library: `Card`, `MoneyField`, `TextField`, `Button`, `Dialog`.

## Behaviour
- PlanPage (ready): `<h1>Plan</h1>`, then `<IncomeCard key={k} />` and `<CategoriesCard key={k} />` with `k = `${viewedMonth}:${generation}``, so drafts reset when the month changes or data is deleted.
- **IncomeCard**: `<Card title="Income">` with `MoneyField` `Monthly income (USD)`; behaviour exactly as today (each change calls `setIncome(cents ?? 0)`; empty field when income is 0; action errors on the field).
- **CategoriesCard**: `<Card title="Categories" description="What you plan to spend in each category." action={<Button variant="secondary">Add category</Button>}>`; the button opens `AddCategoryDialog` (state owned here).
  - No categories: `<p>No categories yet. Add your own, or start from a suggestion below.</p>`.
  - Otherwise `<ul role="list" className="m-0 flex list-none flex-col gap-4 p-0">` of `CategoryRow`s (keep the existing eslint comment about Safari list semantics).
  - Then `<Suggestions />`.
- **CategoryRow** (`<li className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">`): `TextField` `Category {n} name`, `MoneyField` `Category {n} planned (USD)`, and `<Button variant="ghost" className="justify-self-start">Remove</Button>` with `aria-label="Remove {categoryLabel}"`, **default size `md`** (40px, the fields' height). Rename on blur, duplicate-name error `{problem}. The name is still {name}.`, planned saved as typed, action errors, focus after Remove (next row's Remove, else previous row's Remove, else the `Add category` button): all exactly as today's `MonthSetup` rows.
- **AddCategoryDialog**: `<Dialog title="Add category" initialFocusRef={nameRef} actions={Cancel (secondary), Save category (submit)}>` with a `form` (`noValidate`) holding `TextField` `Name` and `MoneyField` `Planned (USD)` with `hint="Optional. Leave empty for $0.00."`.
  - Submit: `categoryNameError(state, name)` → error on `Name` and focus it; else `actions.addCategory({ name, plannedCents: planned ?? 0 })`; on success the dialog closes and focus returns to `Add category` (library Dialog); the dialog's fields are empty the next time it opens.
  - Errors: `That change would make a total too large.` on `Planned (USD)`; anything else in the action-error paragraph inside the dialog; the dialog stays open with the values.
- **Suggestions**: when at least one name in `SUGGESTED_CATEGORY_NAMES` is not already a category of the viewed month (compare `trim().toLowerCase()`): `<div className="flex flex-col gap-3">` with `<h3 className="font-semibold text-text">Suggestions</h3>` and a `<ul role="list" className="m-0 flex list-none flex-wrap gap-2 p-0">` of `<li><Button variant="secondary">Add {name}</Button></li>` in the list's order, unused names only. Clicking adds `{ name, plannedCents: 0 }` and moves focus to the new row's `Category {n} planned (USD)` field. Action errors in an action-error paragraph after the list. When every name is used, renders nothing.

Money input → stored cents (MoneyField parsing, unchanged): `3200` → `320000`; `1,500` → `150000`; `82.47` → `8247`; `$40` → `4000`; empty → `0`; `12.345` → field error from the library and `0` stored (known behaviour; the follow-up invalid-money warning on branch `docs/plan-followups` addresses it and now belongs in `features/plan/`).

## Acceptance criteria
Render `renderApp({ path: '/plan', … })`.
- [ ] Empty storage: `h1` `Plan`; regions `Income` and `Categories`; `Monthly income (USD)` empty; `No categories yet. Add your own, or start from a suggestion below.`; heading `Suggestions` (level 3) and buttons `Add Rent`, `Add Groceries`, `Add Transport`, `Add Utilities`, `Add Eating out` in that order; no `Category 1 name` field; `setItemCalls` 0.
- [ ] Clicking `Add Groceries`: a row with `Category 1 name` = `Groceries` and an empty `Category 1 planned (USD)` that has focus; `Add Groceries` is gone, the other four remain; stored November has one category `Groceries` with `plannedCents: 0`. Typing `400` stores `40000`.
- [ ] After adding all five suggestions the `Suggestions` heading is gone. Renaming `Groceries` to `groceries ` (different case and a trailing space) does not bring `Add Groceries` back; renaming it to `Food` (on blur) does.
- [ ] `Add category` opens dialog `Add category` with focus in `Name`. Saving with Name empty shows `Enter a category name` on `Name` and stores nothing; Name `rent` while `Rent` exists shows `You already have a category called Rent`; Name `Pets`, Planned empty → closes, focus on `Add category`, stored `Pets` at `0`; Name `Gifts`, Planned `25.50` → stored `2550`. Cancel and Esc close without storing; reopening shows empty fields.
- [ ] Seeded with 90 categories at `MAX_CENTS`: adding `Big` with Planned `999999999999.99` shows `That change would make a total too large.` on `Planned (USD)`, the dialog stays open, nothing stored. With `renderWithFakeBudget` and `addCategory` throwing `new Error('boom')`: `Something went wrong. Your budget was not changed.` in `[data-part="action-error"]` inside the dialog.
- [ ] Seeded `SCENARIO`: five rows `Category 1–5 name` with `Rent`…`Eating out` and planned `1,500.00`, `400.00`, `120.00`, `150.00`, `100.00`; no suggestions (all used); each `Remove` button has `data-variant="ghost"` and `data-size="md"` and accessible name `Remove Rent` etc.
- [ ] Preserved from today's setup criteria (re-run here): income typed saves on each change and empty stores 0; rename saves on blur and a duplicate restores the old name with `{problem}. The name is still {name}.`; Remove has no confirmation, keeps the category's expenses (Overview then shows the removed-categories line), and moves focus to the next row's Remove, else the previous row's, else `Add category`; every action error is shown as in Conventions.
- [ ] Changing month resets drafts: seeded `BOOK`, type `9` in `Monthly income (USD)` without leaving, switch to October (task 22's switcher if merged; otherwise call `viewMonth` through a probe): the field shows `3,000.00`.
- [ ] The only money textboxes on `/plan` with `SCENARIO` are named `Monthly income (USD)` and `Category 1–5 planned (USD)` (the updated styling check); in the open dialog, `Planned (USD)`.
- [ ] Keyboard only: from `Monthly income (USD)`, Tab reaches `Add category`, then the rows (name, planned, Remove), then the suggestion buttons; Enter on `Add Rent` adds it.
- [ ] `expectNoAxeViolations()` for empty, `SCENARIO`, dialog open, and dialog with errors.
- [ ] Styling rules hold; `features/setup/` no longer exists; no `any`, `@ts-ignore` or `@ts-expect-error`; `npm run check` passes.

## Manual browser checks
- 1280px: each row is one line; `Remove` is 40px tall, its bottom edge level with the fields' bottom edges, and it reads as a button (no input-like border). With a field error shown under a field, note how the row aligns (report; no fix required).
- 375px: rows stack (name, planned, Remove); suggestions wrap; the dialog fits.
- Focus ring visible on Remove (ghost) and the suggestion buttons.

## Assumptions
- Suggestions stay visible while any suggested name is unused, even after a deliberate removal (spec decision 12).
- Planned is optional in the dialog and defaults to $0.00; rows keep showing an empty field for $0.00, as today.
- `Add category` sits in the Card's header action slot.

## Out of scope
- A planned-vs-income summary on this page (open question in the plan); reordering categories; editing a category in a dialog; library changes.
