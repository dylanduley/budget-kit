# 25: Whole-app acceptance after the redesign

Proves the redesigned app end to end across the four pages: the brief's whole-app acceptance (now with months), every behaviour listed as "must be preserved" in `docs/tasks/redesign-plan.md`, axe on every page state, the styling rules, hydration on every route, and the build. Replaces the deleted `BudgetApp.e2e.test.tsx` and `BudgetApp.a11y.test.tsx`. Fixes to screens are allowed only for integration defects found here, each named in the report.

**Depends on**: library 20, 21; app 20, 21, 22, 23, 24 (all merged)

**Parallel group**: Redesign D (runs alone, last)

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
- QA: `apps/web/src/features/shell/App.e2e.test.tsx`, `apps/web/src/features/shell/App.a11y.test.tsx`; final pass over `styling.rules.test.ts` (scan list names every shell, page and screen file; `found`/`calls` minimums updated)
- Integration fixes only, each named in the report

## Behaviour
No new behaviour. States to cover (each through `renderApp`): on every path, loading and ready; first run; populated (`SCENARIO`); over budget; removed-category spending; no categories; empty expense list; Add expense dialog open and with errors; Add category dialog open and with errors; past month (`BOOK`, October viewed); new month (`BOOK`, today `'2026-12-02'`); History with `BOOK`; Delete all data dialog open; after deleting; invalid saved data (before and after replacement); storage unavailable; migrated version 1 data.

## Acceptance criteria
### End to end (`App.e2e.test.tsx`), roles and visible labels only (no test ids), empty storage, today `'2026-11-14'`
- [ ] **New user, without instructions.** On `/`: the welcome line. Click nav `Plan`; type `3200` in `Monthly income (USD)`; click `Add Rent`, `Add Groceries`, `Add Transport`, `Add Utilities`, `Add Eating out`; type `1500`, `400`, `120`, `150`, `100` in `Category 1–5 planned (USD)`. Through the header's `Add expense`: `1500` / Rent / `November rent` / `Nov 1, 2026`; `82.47` / Groceries / no note / `Nov 3, 2026`; `112.35` / Eating out / `Birthday dinner` / `Nov 5, 2026`. Click `Overview`: `Income $3,200.00`, `Planned $2,270.00`, `Spent $1,694.82`, `Left to spend $1,505.18`, `Unplanned money $930.00`; Groceries `$82.47 of $400.00` and `$317.53 left`; Eating out `$112.35 of $100.00, over by $12.35` with `Over budget`; no welcome line. Click `Spending`: rows Nov 5, Nov 3, Nov 1.
- [ ] **Overspending to the cent.** Add `2000` / Transport / `Nov 10, 2026`: Overview `Spent $3,694.82`, `Left to spend -$494.82` with `Spent $494.82 more than your income`; Transport `Over budget`.
- [ ] **Deleting to the cent.** On Spending delete the Transport then the Groceries expense: Overview `Spent $1,612.35`, `Left to spend $1,587.65`, Groceries `$0.00 of $400.00`; two rows remain.
- [ ] **Removed category.** On Plan remove `Eating out`: Overview `Planned $2,170.00`, `Spent $1,612.35`, `The Spent total includes $112.35 from removed categories, which are not listed above.`; the Nov 5 row's category is `Removed category`.
- [ ] **Refresh keeps everything** on each of the four paths (`refresh()`): every figure, row, name and planned field unchanged; the viewed month is the current month again.
- [ ] **A new month keeps the old one.** From the stored result above, re-render with the same storage and today `'2026-12-02'`: header `December 2026` with the new-month note; Overview `Income $3,200.00`, `Planned $2,170.00`, `Spent $0.00`; storage byte-identical. Add `50` / Groceries (default date `Dec 2, 2026`): note gone; History has `December 2026 (this month)` `$3,200.00` `$50.00` `$3,150.00` and `November 2026` `$3,200.00` `$1,612.35` `$1,587.65`; `View November 2026` shows November's figures unchanged; adding `10` / Rent while viewing November (date `Nov 1, 2026` default) changes November's Spent to `$1,622.35` and leaves December's at `$50.00`.
- [ ] **First expense with no plan is not red.** From first run, add one suggestion (`Add Groceries`) and one expense `20` / Groceries / `Nov 14, 2026`: Overview Groceries `No plan set`, `Spent $20.00`; no `Over budget` and no `[data-tone="danger"]`; `Left to spend` `Not set`.
- [ ] **Delete all data only after confirming.** On History, Esc and Cancel change nothing (storage byte-identical); confirming empties storage (`{ months: [] }`), focus on `All data deleted. You're starting fresh with November 2026.`; `/` shows the welcome line; `refresh()` keeps it empty.
- [ ] **Category names.** On Plan, renaming `Groceries` to `rent` and tabbing away keeps `Groceries` on Plan, Overview and in the Add expense options, with the duplicate error; renaming to `Food` updates Overview and the Add expense options after blur.
- [ ] **Migration.** Storage holding version 1 `SCENARIO`, today `'2026-11-14'`: every page shows SCENARIO's figures and rows, History has one row; storage still version 1 until the first change, then version 2 with the same figures. With today `'2026-12-02'`: December is a copy (income and five categories), November is in History unchanged.
- [ ] **Saved-data messages.** `'not json'` → the first invalid message on every path; after typing `3200` on Plan, the replaced message; after `refresh()` neither. Throwing storage → the unavailable message, and the scenario's first steps still update Overview, including after navigating between pages.
- [ ] **Totals safety.** Seeded with 91 `MAX_CENTS` expenses in one month: the invalid message and a first-run app. Seeded with 90: adding one more shows `That change would make a total too large.` on `Amount (USD)`, the dialog stays open, Overview unchanged.
- [ ] **One dialog at a time.** While `Add expense` is open, the nav links, the switcher buttons and the page's own buttons (`Add category`, `Delete all data`) have an `[inert]` ancestor; `getAllByRole('dialog')` never has more than one element during the whole scenario.
- [ ] **Keyboard only.** The first criterion passes using only `user.keyboard` / `user.tab` / `user.type` (navigation by focusing nav links and pressing Enter).

### Accessibility (`App.a11y.test.tsx`)
- [ ] `expectNoAxeViolations()` (all rules except `color-contrast`, including `region`, `landmark-*`, `heading-order`, `page-has-heading-one`) passes on `document.body` in every state under Behaviour.
- [ ] Every path has exactly one `banner`, one `navigation` named `Main`, one `main`, one `h1`; every visible text node outside an open dialog is inside `banner` or `main`.
- [ ] Heading order per page (populated): `/`: h1 `Overview`, h2 `Summary`, `Spending by category`; `/spending`: h1 `Spending`, h2 `Expenses in November 2026`; `/plan`: h1 `Plan`, h2 `Income`, `Categories` (h3 `Suggestions` only when shown); `/history`: h1 `History`, h2 `Months`, `Start over`.
- [ ] `aria-current="page"` is on exactly one nav link on every path, the one for that path.

### Styling and structure (`styling.rules.test.ts`)
- [ ] The scan list names `features/shell/AppShell.tsx`, the four `*Page.tsx`, `features/month/MonthSwitcher.tsx`, `features/plan/*`, `features/history/*`, `features/dashboard/Dashboard.tsx`, `features/expenses/*`, `state/BudgetProvider.tsx`, `app/layout.tsx`.
- [ ] Every rule from task 08's styling criteria still holds, plus: no `<a`; exactly one `aria-live` (task 22); every `actions.<name>(` call (including `deleteAllData`) is in a `try` with a message-setting `catch`.

### Blanket
- [ ] Hydration: for each path, `renderToString` + `hydrateRoot` with saved data logs no recoverable error and no `console.error`.
- [ ] No `any`, `@ts-ignore` or `@ts-expect-error` in non-test files; `npm run check` passes; `npm run build -w @budget-kit/web` succeeds with the four static routes.

## Manual browser checks (a11y-reviewer, `npm run dev`)
- axe **with `color-contrast`** in a real browser (inject `node_modules/axe-core/axe.min.js`, run `axe.run()`) on every page in the populated, first-run, past-month and dialog-open states: zero violations.
- 375×812: every page single column, no horizontal page scroll; header wraps; Plan rows stack; tables scroll inside their regions; dialogs fit. Note how far a new user scrolls on Plan to reach the suggestions (report).
- 1280: Plan rows one line with `Remove` level with the fields and visibly a button.
- Keyboard: Tab order banner (nav, switcher, Add expense) then the page; focus ring always visible; after each dialog closes focus is on its trigger (or the documented confirmation paragraph).
- Screen reader: page change announced; month change announced; over-budget, `No plan set`, `Not set` and negative Left understandable without colour; every money label ends `(USD)`.
- Real migration: with data saved by the pre-redesign app in the same browser profile, the redesigned app shows it unchanged.
- No hydration warning in the console on a direct load of each route; no `Loading your budget…` flash on client navigation.

## Assumptions
- Whole-app tests render through `renderApp` (the mocked router) rather than a real browser; real routing is covered by the manual checks and `next build`.

## Out of scope
- New features; library changes (report them); a Playwright suite (needs approval).
