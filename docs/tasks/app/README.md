# Budget planner app tasks

Plan for `docs/specs/app-brief.md` (`apps/web`). One file per task; each is self-contained for a feature-builder (with `CLAUDE.md`) and for QA. All of these tasks are built and merged (see `docs/build-log.md`). The lead's product decisions on task 01 (left to spend, over budget, removed categories, rollover, minimum amount, category names) are already worked in.

## Tasks

| # | Task | Depends on | Group | Shared files touched |
|---|---|---|---|---|
| 01 | [Budget math](01-budget-math.md) | none | 0 | creates `src/lib/budget.ts`, `src/lib/format.ts` |
| 02 | [Persistence and app state](02-persistence-and-state.md) | 01 | 1 | creates `src/state/*`, `src/lib/clock.ts`, `src/features/BudgetApp.tsx`, `src/test/*` (incl. `renderWithFakeBudget`); edits `src/app/page.tsx`, `vitest.config.ts`, `apps/web/package.json`, `package-lock.json`. Built, reviewed and merged, including review items N1–N8 |
| 03 | [Month setup](03-month-setup.md) | 02 | 2 | `src/features/BudgetApp.tsx` (one line) |
| 04 | [Add expense](04-add-expense.md) | 02 | 2 | `src/features/BudgetApp.tsx` (one line); own files in `src/features/expenses/` |
| 05 | [Dashboard](05-dashboard.md) | 02 | 2 | `src/features/BudgetApp.tsx` (one line) |
| 06 | [Expense list](06-expense-list.md) | 02 | 2 | `src/features/BudgetApp.tsx` (one line); own file in `src/features/expenses/` |
| 07 | [Reset month and rollover notice](07-reset-month.md) | 02 | 2 | `src/features/BudgetApp.tsx` (two lines) |
| 08 | [App shell and whole-app acceptance](08-app-shell-and-acceptance.md) | 01–07 | 3 | `src/features/BudgetApp.tsx`; may touch screens for integration fixes only |

All paths are under `apps/web/`.

### Follow-ups (planned, not built)
See [../followups-plan.md](../followups-plan.md) for order, planner defaults and risks.

| # | Task | Depends on | Group | Shared files touched |
|---|---|---|---|---|
| 09 | [Invalid money text warns and is not saved](09-invalid-money-not-saved.md) (superseded by 26) | library 14 | F2 | `src/features/setup/MonthSetup.tsx`; one sentence in this README |
| 10 | [Announce non-error changes with StatusMessage](10-status-announcements.md) (superseded by 27) | library 15, app 09 | F3 | `AddExpense.tsx`, `ExpenseList.tsx`, `MonthSetup.tsx`, `BudgetApp.tsx`, `styling.rules.test.ts`, four existing tests; two passages in this README |

### Follow-ups after the redesign (planned, not built)
09 and 10 were written before the redesign (app tasks 20–25, `../redesign-plan.md`) and are replaced by 26 and 27. See [../followups-plan2.md](../followups-plan2.md) for order, planner defaults, risks and the existing tests that change.

| # | Task | Depends on | Group | Shared files touched |
|---|---|---|---|---|
| 26 | [Invalid money text warns and is not saved](26-invalid-money-not-saved.md) | library 14 | G1 | `src/features/plan/IncomeCard.tsx`, `CategoryRow.tsx`, `AddCategoryDialog.tsx`; one sentence in this README |
| 28 | [Back up the old saved data before it is first overwritten](28-saved-data-backup.md) | none | G1 | `src/state/storage.ts`, `src/state/BudgetProvider.tsx`; one sentence in this README |
| 29 | [Compact header on phones](29-compact-header.md) | none | G1 | `src/features/shell/AppShell.tsx` (header), `src/features/month/MonthSwitcher.tsx`; `styling.rules.test.ts` (one count) |
| 27 | [Announce non-error changes with StatusMessage](27-status-announcements.md) | library 15, app 26, app 29 | G2 | `AddExpense.tsx`, `ExpenseList.tsx`, `CategoriesCard.tsx`, `AddCategoryDialog.tsx`, `AppShell.tsx` (main); `styling.rules.test.ts`; two passages in this README and two in task 25 |

## Build order and parallel groups

| Order | Group | Tasks | Starts when |
|---|---|---|---|
| 1 | 0 | 01 | immediately |
| 2 | 1 | 02 | 01 is merged |
| 3 | 2 | 03, 04, 05, 06, 07 (separate worktrees) | 02 is merged |
| 4 | 3 | 08 | all of group 2 is merged |

Why this shape:
- **01 alone**: every other task imports its types and functions.
- **02 alone**: it fixes the provider API (`useBudget`), the storage format, the page skeleton and the test helpers every screen task and every QA run uses. Nothing in group 2 can be built or tested without it.
- **03–07 in parallel**: the screens share *state*, but only through the provider from 02, which none of them changes. Each screen reads `useBudget()`, each has its own folder, and QA seeds state through storage (`renderWithBudget({ state })`), so 04 does not need 03 to create categories and 05/06 do not need 04 to create expenses. Each dialog's `open` state lives in the component that owns its trigger, and the library's inert background stops a second dialog from opening, so no shared dialog state is needed. The only shared file is `BudgetApp.tsx`, one line per task.
- **08 last**: it tests the assembled page.

If five worktrees is too many to review at once, a split that keeps every dependency: batch 2a = 03, 04, 05; batch 2b = 06, 07. Fully sequential also works: 03, 04, 05, 06, 07.

## Merge-conflict risks

| File | Who touches it | Rule |
|---|---|---|
| `src/features/BudgetApp.tsx` | 02 creates; 03–07 add lines; 08 finalises | 03–07 each add only their import(s) and JSX line(s) from "BudgetApp order" below and change nothing else. Merge group 2 one branch at a time; a conflict is resolved by keeping every side's imports (alphabetical by path) and JSX lines in the order below. |
| `src/features/expenses/` | 04 (`AddExpense.tsx`, `expenseForm.ts`), 06 (`ExpenseList.tsx`) | Different files; no shared module. Neither edits the other's files. |
| `src/lib/*`, `src/state/*`, `src/test/*` | 01 and 02 only | Read-only for 03–08. A builder that needs a change stops and reports; the lead decides whether 01/02 is reopened. |
| `src/app/page.tsx` | 02 only | Screens are mounted in `BudgetApp.tsx`, never in `page.tsx`. |
| `src/app/layout.tsx`, `globals.css` | 08 only, only if a check fails | No other task edits them. |
| `apps/web/package.json`, `package-lock.json`, `vitest.config.ts` | 02 only (approved by the lead) | No other task adds dependencies. |
| `packages/ui/**` | nobody | Library gaps are reported, not patched. |

### BudgetApp order
Expected ready-state body of `<main>` once 03–07 are merged:

```tsx
<div>
  <h1 className="text-2xl font-semibold text-text">Budget Kit</h1>
  <p className="text-text-muted">Budget for {formatMonth(state.month)}</p>
  {/* 08: first-run line and saved-data messages */}
</div>
<MonthNotice />                      {/* 07 */}
<Dashboard />                        {/* 05 */}
<AddExpense />                       {/* 04 */}
<ExpenseList />                      {/* 06 */}
<MonthSetup key={generation} />      {/* 03 */}
<ResetMonth />                       {/* 07 */}
```
(The comments here label ownership for the merge; they are not written into the file.) This is the lead's page order: rollover notice, dashboard, Add expense, expense list, setup, reset. A merge conflict in `BudgetApp.tsx` is always resolved to exactly this order, whatever order the branches merge in.

## Conventions for the whole app

Stated identically in every task file. In short:
- **Folders** under `apps/web/src`: `lib/` pure TypeScript (budget math, formatting, clock); `state/` storage, reducer, provider; `features/<area>/` screens composed only from `@budget-kit/ui` and plain semantic elements; `test/` shared helpers; `app/` Next.js route files only.
- **Client components**: `'use client'` only on files with state, effects, refs, context or handlers (`BudgetProvider`, `BudgetApp`, every screen). `page.tsx` and `layout.tsx` stay server components; `page.tsx` renders `<BudgetProvider><BudgetApp /></BudgetProvider>`.
- **State**: one `BudgetProvider` (React context + `useReducer` over the pure functions). It renders `loading` on the server and the first client render, loads `localStorage` in an effect after mount (so hydration matches), and saves after every user action, never on load. Storage is `budget-kit:budget` = `{ version: 1, state }`, fully validated on load; anything invalid is not loaded and the user is told. UI-only state (dialog `open`, form drafts) stays local in the screen that owns it.
- **Money and dates**: integer cents everywhere; `formatMoney` (wrapping the library's `formatCents`) only at display; money labels end `(USD)`; ISO date strings, chosen from a Select of the month's days; "today" injected through the provider, never read in `lib/`.
- **Styling**: no CSS, no `style`, no native controls; Tailwind for layout and spacing only (plus heading/paragraph typography); single column below 640px.
- **Tests**: QA writes all `*.test.ts(x)` from the acceptance criteria, colocated with the code. The builder of 02 adds the infrastructure (setup file with jest-dom and cleanup, `createMemoryStorage`, `renderWithBudget` with `refresh()`, `expectNoAxeViolations`, the `SCENARIO` fixture). localStorage is faked with `createMemoryStorage` passed to the provider (jsdom's own `localStorage` is also cleared after each test). Tests import from `vitest` explicitly (the app has no Vitest globals). `npm run check` already runs the app's tests (root `test` runs every workspace).
- **Action errors**: actions can throw (task 01 validation, or the provider's `That change would make a total too large.`). Every screen catches them, keeps its form or dialog open, and shows the message in the matching field's `error` prop, or else in the one permitted app-level alert, `<p role="alert" data-part="action-error">`; unexpected errors read `Something went wrong. Your budget was not changed.` Screen QA tests this with `renderWithFakeBudget` and a throwing action.
- **Accessibility checks**: every screen task's QA runs `expectNoAxeViolations` (axe-core in jsdom, all rules except `color-contrast`) on that screen's states; task 08's QA runs it on the whole page in all 14 states, including landmark and heading rules; the a11y-reviewer runs axe **with contrast** in a real browser on each screen task and on 08. jsdom-invisible behaviour (layout at 375px, focus rings, overflow) is in each task's **Manual browser checks**.

## Open questions for the lead

Each has the assumption the tasks currently use.

### Decided by the lead (no longer open)
- **Date field**: the add-expense date is the library's `Select` of the budget month's days (`datesInMonth`, task 01; task 04), labelled with `formatDate`, defaulting to `defaultExpenseDate`. No text date, no format error, no library change.
- **TextField/Select height**: fixed in the library by separate follow-up tasks before any screen is built; the app assumes equal heights and has no workaround.
- **Field errors**: the library's `Field` gets `role="alert"`; the app adds no live regions or alerts around field errors (checked in 03, 04, 08).
- **Currency**: every money field's label states the unit: `Monthly income (USD)`, `Category {n} planned (USD)`, `New category planned (USD)`, `Amount (USD)` (acceptance criteria in 03, 04, 08). No library change.
- **Not used**: `allowNegative`, and any correction text for MoneyField's `Amount is too large`.
- **Page order**: rollover notice (when it applies), Dashboard, Add expense, Expense list, Set up the month, Reset month. First-run prompts on the dashboard say `…in Set up the month below` and are plain text (no scripted scrolling or focus moves). Applied in 03, 05, 07, 08 and the BudgetApp order above.
- **Unplanned money** also shows `Not set` before income is entered (05).
- **Saved-data messages** are wanted (08); unreadable data is overwritten on the first change. Since app task 28, unreadable or version 1 data is first copied once, byte for byte, to `budget-kit:budget:backup` (never overwritten, removed by Delete all data); there is no restore screen.
- **Category rename** saves on blur (03).
- **Reset** restores the five suggested categories at $0 (07).
- **No confirmation or undo** on Delete expense (06) or Remove category (03).
- **Rollover notice wording** as written (07).
- **Expense form**: a category must be chosen; saving closes the dialog, no "add another" (04).
- **Dependencies approved**: `@testing-library/user-event` and `axe-core` are added to `apps/web` devDependencies in task 02.
- **Accepted as is**: page-level messages are plain elements and are not announced (except the focused post-reset confirmation); MoneyField reports `null` for both empty and invalid text, with the parse result as a second argument; an empty income or planned field stores 0, while invalid text is not saved and shows the library error at once (app task 26); the Add category dialog does not save while its Planned text is invalid; AddExpense treats both as missing; app contrast is checked by hand in a real browser, with no automated browser runner.

### (a) Library notes (no decision needed; for awareness)
1. **ProgressBar with `max` 0 shows the danger tone** for any spending. Handled by not rendering a bar for unplanned categories; the library docs could mention it.
2. **No ref or focus target on Card headings or the Table.** After deleting the last expense, focus goes to the empty-state paragraph and, after a rollover reset, to a confirmation paragraph, because the Dialog cannot return focus to a removed trigger (known limitation). Works with the library as is.

### (b) Still open
1. **First-run reach on a phone (from the new page order).** A new user lands on a dashboard of `Not set` / `$0.00` Stats and five `No plan set` rows, then `Add expense` and an empty expense table, and must scroll (or Tab through `Add expense`, the table region) to reach `Monthly income (USD)`. The prompts say "below" but do not link or move there. Options for you, none planned: accept it; an in-page link to the setup section (a library `Button`-styled link or plain `<a href="#…">` would need a decision on styling, since the app may not style its own controls); or a library link component. Assumed: accept as is.
2. **Add expense before setup.** Because the suggested categories exist from the start, a user can add expenses from the top of the page before entering income or plans; the dashboard then shows `No plan set` and `Not set` as designed. Assumed fine.

3. **No error boundary.** Every action call is caught (Conventions, "Action errors"), but an exception thrown while *rendering* (a bug, or a library `RangeError` such as `formatCents` on a non-integer) is not caught, and Next.js shows its error page or a blank page. Decide what a render error should show (for example a library-built "Something went wrong, reload" panel via an `app/error.tsx`) and whether that becomes a task; nothing is planned.

### (c) Minor assumptions
1. Suggested categories: Rent, Groceries, Transport, Utilities, Eating out, $0 planned, fixed ids `suggested-*`.
2. Dollars only (labels `(USD)`); display formats `$1,505.18`, `-$270.00`, `Nov 5, 2026`, `November 2026`; English strings.
3. Note optional, at most 100 characters; planned and income may be 0.
4. Ordinal field labels (`Category 2 name`) for unique accessible names.
5. Storage key `budget-kit:budget`, version 1; any other version is unsupported (no migrations yet); no cross-tab sync.
6. Ids from `crypto.randomUUID`, injected in tests.
7. "Today" is read once per load; a month change shows on the next load.
8. Totals are not capped by `budget.ts` (only single amounts are); the provider keeps every held state safe to total (task 02 N1/N2), and screens show `That change would make a total too large.` if a change would overflow.
9. Tailwind typography and token text colours are allowed on `h1`, `h3` and `p` (the scaffold already does this), not only layout.
10. Each Card is a named landmark, so the page has about seven regions (noted in the library plan).

## Ambiguities and contradictions in the brief
- "Left to spend" and "over budget" were undefined (now decided).
- "Table of this month's expenses" in a one-month planner left rollover undefined (now decided).
- "Reset clears everything" vs "start with 5 suggested categories" (assumption b4).
- "Amount, category, note, date" needed a date control the library lacks (now decided: a Select of the month's days).
- "axe finds no violations on any screen": the app is one page with many states (listed in 08), and jsdom axe cannot check contrast (checked by hand; decided by the lead).
- "Built only with `@budget-kit/ui` components" vs forms, lists and headings, which use plain semantic elements (allowed by `CLAUDE.md`).
- "Without reading instructions" cannot be tested automatically; approximated by a label-only end-to-end test plus a manual check.
- `docs/workflow.md` says CI runs accessibility checks and the build; `npm run check` runs neither for the app (`test:a11y` covers only `packages/ui`), and the repo has no `.github/` directory. Task 08 adds the app's axe tests to the normal test run and asks for `npm run build -w @budget-kit/web` once.
