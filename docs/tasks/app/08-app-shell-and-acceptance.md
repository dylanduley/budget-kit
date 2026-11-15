# 08: App shell and whole-app acceptance

Finishes the page around the screens (order, first-run and saved-data messages, heading and landmark structure, phone layout) and proves the brief's whole-app acceptance: a worked end-to-end scenario to the cent, refresh, reset, rollover, "no control styled from scratch", and axe on every screen state.

**Depends on**: 01, 02, 03, 04, 05, 06, 07 (all merged)

**Parallel group**: 3 (runs alone, last)

## Conventions (identical in every app task)
- **Folders** (all under `apps/web/src/`): `lib/` pure TypeScript (no React, no `window`, no `Date.now()`); `state/` storage and the React provider; `features/<area>/` screen components; `test/` shared test helpers; `app/` Next.js route files only (`layout.tsx`, `page.tsx`, `globals.css`).
- **Imports**: library components and helpers only from `@budget-kit/ui` (lint blocks `@budget-kit/ui/src/*`); app modules through the `@/` alias (`@/lib/budget`).
- **Client boundary**: a file starts with `'use client';` only if it uses state, effects, refs, context or event handlers. `page.tsx` and `layout.tsx` stay server components. `lib/*`, `state/storage.ts` and `state/budgetReducer.ts` have no directive.
- **Styling**: no CSS files (other than the existing `app/globals.css`, unchanged), no `style` prop, no CSS Modules, and no native `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>` or `<dialog>` anywhere in `apps/web/src`. Tailwind classes only for layout and spacing on plain elements (`flex*`, `grid*`, `gap-*`, `p*-*`, `m*-*`, `max-w-*`, `w-full`, `items-*`, `justify-*`, `list-none`, and `sm:` variants of these), plus typography and token text colours (`text-2xl`, `font-semibold`, `text-text`, `text-text-muted`) on plain text elements (`h1`, `h3`, `p`). On library components `className` may contain only `w-full`, `self-*`, `justify-self-*`, `col-span-*`. Single column below 640px: any multi-column layout is behind `sm:`.
- **Structure**: plain semantic elements only (`main`, `section`, `h1`, `h3`, `p`, `ul`, `li`, `form`).
- **Money**: integer cents in state, storage, props and function arguments. Converted to text only at the display edge with `formatMoney` from `@/lib/format` (which wraps the library's `formatCents`). No `parseFloat`, `toFixed`, `Number(` on text, `* 100` or `/ 100` on amounts. Amounts shown are exactly the numbers the `lib/budget.ts` functions return.
- **Dates**: ISO strings (`YYYY-MM-DD`, months `YYYY-MM`), compared as strings. Never parse them with `new Date(string)` (time-zone shifts). "Today" comes only from `useBudget().today` (task 02).
- **Copy**: English, sentence case; strings quoted in a task are exact.
- **Tests**: written by QA from the acceptance criteria, colocated as `<file>.test.ts(x)`; the builder does not write them. Tests import `describe`, `it`, `expect`, `vi` from `vitest` (no globals), use Testing Library and `@testing-library/user-event`, and render screens with the helpers in `src/test/` (task 02). jsdom has no layout, so visual behaviour goes under **Manual browser checks**, never into a test that cannot fail.
- **Done**: every acceptance criterion passes and `npm run check` passes.

## Files
- `apps/web/src/features/BudgetApp.tsx`: final order (README "BudgetApp order"), the messages below, layout fixes found here
- `apps/web/src/app/layout.tsx`: only if a check below fails (it already has `lang="en"` and `title: 'Budget Kit'`)
- QA: `apps/web/src/features/BudgetApp.e2e.test.tsx`, `apps/web/src/features/BudgetApp.a11y.test.tsx`, `apps/web/src/styling.rules.test.ts`
- Fixes to a screen's file are allowed only for integration defects found here, each named in the report; anything bigger goes back to that screen's task.

## API / Props
No new exports. `BudgetApp(): ReactElement` (unchanged signature).

## Behaviour
- Ready page, in order inside the `<main>` from task 02:
  1. heading block: `<h1>Budget Kit</h1>`, `<p>Budget for {month}</p>`, then the messages below;
  2. `<MonthNotice />` (07), `<Dashboard />` (05), `<AddExpense />` (04), `<ExpenseList />` (06), `<MonthSetup key={generation} />` (03), `<ResetMonth />` (07). This is the lead's page order: the month at a glance first, setup below the expense list.
- **First-run line**: while `incomeCents === 0` and there are no expenses: `<p>Start by entering your monthly income and what you plan to spend in each category.</p>`.
- **Saved-data messages** (so data is never lost silently):
  - `loadStatus === 'invalid'`: `<p>Your saved budget couldn't be read, so a new one was started. The old data will be replaced when you make a change.</p>`
  - `loadStatus === 'unavailable'`: `<p>This browser isn't letting the app save, so your changes will be lost when you close the page.</p>`
- Structure: exactly one `h1`; every `h2` comes from a Card, the notice or a Dialog; `h3` only inside a Card. Landmarks: `main` for all page content; Cards are named regions; dialogs are portalled outside `main` (library).
- Layout: `main` is `max-w-3xl`, single column; screens are separated by `gap-6`; no horizontal page scroll at 375px.

## Screens / states
Loading; first run; populated (`SCENARIO`); over budget (category over, left to spend negative, unplanned negative); unplanned-category spending; no categories; empty expense list; add-expense dialog open; add-expense dialog with errors; reset dialog open; rollover notice; after a rollover reset; invalid saved data; storage unavailable.

## Acceptance criteria
### End-to-end (`BudgetApp.e2e.test.tsx`)
Render `renderWithBudget(<BudgetApp />, { today: '2026-11-14' })` with empty storage. Use only roles and visible labels (`getByRole`, `getByLabelText`), never test ids, so a passing test shows the flow works from what is on screen. The steps are in the order a new user takes them (setup first), even though Set up the month is below the dashboard and expense list on the page.
- [ ] **New user, 5 categories, 3 expenses, correct totals.** Type `3200` in `Monthly income (USD)`; type `1500`, `400`, `120`, `150`, `100` in `Category 1–5 planned (USD)`; add through `Add expense` (date chosen in the `Date` select): `1500` / Rent / note `November rent` / `Nov 1, 2026`; `82.47` / Groceries / no note / `Nov 3, 2026`; `112.35` / Eating out / `Birthday dinner` / `Nov 5, 2026`. Then: Stats `Income $3,200.00`, `Planned $2,270.00`, `Spent $1,694.82`, `Left to spend $1,505.18`, `Unplanned money $930.00`; Groceries progressbar `$82.47 of $400.00` and `$317.53 left`; Eating out `$112.35 of $100.00, over by $12.35` with `Over budget`; expense rows in order Nov 5, Nov 3, Nov 1. The first-run line is gone after the first expense.
- [ ] **Overspending to the cent.** Continue: add `2000` / Transport / `Nov 10, 2026`. `Spent $3,694.82`, `Left to spend -$494.82` with `Spent $494.82 more than your income`; Transport `Over budget`.
- [ ] **Deleting an expense to the cent.** Delete the Transport expense, then the Groceries expense: `Spent $1,612.35`, `Left to spend $1,587.65`, Groceries `$0.00 of $400.00`, two rows remain.
- [ ] **Removed category.** Remove `Eating out`: `Planned $2,170.00`, `Spent $1,612.35` (unchanged), `The Spent total includes $112.35 from removed categories, which are not listed above.`, the Nov 5 row's category is `Removed category`.
- [ ] **Refresh keeps everything.** `refresh()`: every figure, row, category name and planned field from the previous step is unchanged.
- [ ] **Reset only after confirming.** Open `Reset month`, press Esc: nothing changed (figures as before; storage byte-identical). Open again, Cancel: same. Open again, confirm: income field empty, `Planned $0.00`, `Spent $0.00`, `Left to spend Not set`, the five suggested categories with empty planned fields, `No expenses yet this month.`, first-run line shown; focus on the `Reset month` button. `refresh()`: still reset.
- [ ] **First expense with no plan is not red.** From first run, add one expense `20` / Groceries / `Nov 14, 2026` (the default) without planning anything: Groceries shows `No plan set` and `Spent $20.00`; no `Over budget` text and no `[data-tone="danger"]` on the page; `Left to spend` shows `Not set`.
- [ ] **Rollover.** Seed `SCENARIO`, `today: '2026-12-02'`: the notice `This budget is for November 2026. It is now December 2026.` shows above `Summary` (first in the page after the heading block), every November figure is still shown, storage untouched. Confirm through `Start December 2026 budget`: `Budget for December 2026`, the reset state, `New budget started for December 2026.` focused; `refresh()` shows December with no notice.
- [ ] **Category names.** Renaming `Groceries` to `rent` and tabbing away keeps `Groceries` everywhere (setup field, dashboard, add-expense options) and shows the duplicate error; renaming it to `Food` updates the dashboard and the add-expense options to `Food` after blur.
- [ ] **Saved-data messages.** Storage `'not json'`: the invalid-data message shows and the app works; storage that throws: the unavailable message shows and the scenario's first step still updates the Stats.
- [ ] **One dialog at a time.** While `Add expense` is open, `Reset month` (and the notice's button, in rollover) have an `[inert]` ancestor; while `Reset month?` is open, `Add expense` has one; `getAllByRole('dialog')` never returns more than one element during the whole scenario.

### Accessibility (`BudgetApp.a11y.test.tsx`)
- [ ] `expectNoAxeViolations()` (all rules except `color-contrast`, **including `region`, `landmark-*`, `heading-order`, `page-has-heading-one`**) passes on `document.body` in every state under Screens / states, each rendered through `BudgetApp`.
- [ ] Headings: in the populated state, `getAllByRole('heading', { level: 1 })` is exactly `Budget Kit`; level-2 headings are, in order, `Summary`, `Spending by category`, `Expenses`, `Set up the month`, `Reset month` (plus `New month` first in the rollover state); `Categories` is level 3 and comes after `Set up the month` and before `Reset month`; no level is skipped.
- [ ] DOM order: inside `main`, the `Summary` region precedes the `Add expense` button, which precedes the `Expenses` region, which precedes `Set up the month`, which precedes `Reset month` (`compareDocumentPosition`); in the rollover state the `New month` section precedes `Summary`. The first-run prompts read `Enter your monthly income in Set up the month below`, and the setup section really is below them.
- [ ] Landmarks: one `main`; every visible text node of the page (outside an open dialog) is inside `main`.
- [ ] `layout.tsx`: `import { metadata } from '@/app/layout'` has `title` `Budget Kit`; the file's `<html` element has `lang="en"` (read the source).
- [ ] Keyboard only: the end-to-end scenario's first criterion passes using only `user.keyboard` / `user.tab` / `user.type` (no `user.click`).

### No control styled from scratch (`styling.rules.test.ts`, reads every non-test `.ts`/`.tsx` under `apps/web/src`)
- [ ] Every MoneyField in the app has a `label` ending in ` (USD)` (static check of the source, plus `getAllByRole('textbox')` names in the populated state).
- [ ] No `role="alert"`, `role="status"` or `aria-live` anywhere in app code: field errors are announced by the library's Field, and no other live region is planned.
- [ ] No match for `<button`, `<input`, `<select`, `<textarea`, `<table`, `<dialog`, `style=`, `styled(`, `.module.css`, `@apply`.
- [ ] No `.css` file under `apps/web/src` except `app/globals.css`, and `globals.css` equals its committed version on `main` before this plan (no new rules).
- [ ] Every `className="…"` value uses only the classes allowed in Conventions; on a JSX element whose name starts with a capital letter (a library component), only `w-full`, `self-*`, `justify-self-*`, `col-span-*`.
- [ ] No `parseFloat`, `toFixed`, `* 100`, `/ 100`, `Math.round` or `new Date(` outside `lib/clock.ts`.
- [ ] The test fails when QA temporarily adds `<button>` or `style={{}}` to a screen (prove it once, then revert).

### Blanket
- [ ] No `any`, `@ts-ignore` or `@ts-expect-error` in non-test files; `npm run check` passes; `npm run build -w @budget-kit/web` succeeds.

## Manual browser checks (a11y-reviewer, `npm run dev`)
- Run axe in the real browser on each state above **with `color-contrast` on**: inject `node_modules/axe-core/axe.min.js` into localhost:3000 (DevTools snippet or the browser tool) and run `axe.run()`; zero violations. This is the only contrast check for the app.
- 375×812: one column, no horizontal page scroll; on a first run, note how far a new user must scroll past the dashboard, `Add expense` and the empty list to reach `Monthly income (USD)` (report it; no scripted scrolling); the expense table scrolls inside its region; dialogs fit.
- 1280 wide: Stats two columns, setup rows one line each.
- Keyboard: Tab order follows the visual order (dashboard has no tab stops, then `Add expense`, the expense table region and Delete buttons, the setup fields, `Reset month`); focus ring always visible; after each dialog closes focus is on its trigger (Chrome, Firefox; Safari pointer-open limitation is known).
- Screen reader (VoiceOver or NVDA): over-budget, `No plan set`, `Not set` and the rollover notice are understandable without colour; field errors are announced when they appear (library `role="alert"`); every money field's label ends `(USD)`.
- Refresh with data: no flash of the empty state, no hydration warning in the console.
- Greyscale (DevTools rendering emulation): every warning is still identifiable.

## Assumptions
- The saved-data messages are my reading of "no data is ever lost silently"; they are plain paragraphs (no library alert, README "Decided by the lead").
- The first-run line is the only instruction text; "without reading instructions" is covered by the label-only end-to-end test plus the manual check.
- jsdom axe cannot check contrast; the real-browser run above covers it (the lead accepted manual contrast checks; README "Decided by the lead").

## Out of scope
- New features or screens; library changes (report them); a Playwright suite (needs approval).
