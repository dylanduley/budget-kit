# 21: Routes, layout and app shell

Split the one page into four Next.js routes (Overview `/`, Spending `/spending`, Plan `/plan`, History `/history`) that share one `BudgetProvider` and one shell: a header with the site name, the library `NavBar` (with Next's `Link`) and `Add expense`; a `main` with the saved-data messages and the page. Moves today's screens onto their pages with the new copy, and adds the Next.js test mocks every later task uses. Spec: `docs/specs/app-redesign.md` (Pages, First run, Copy).

**Depends on**: library 20 (NavBar), app 20 (months and provider)

**Parallel group**: Redesign B (runs alone)

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

## How routing and the provider fit together
- `app/layout.tsx` (server component) renders `<html lang="en"><body><BudgetProvider><AppShell>{children}</AppShell></BudgetProvider></body></html>`. A server component may render client components and pass server-rendered `children` through them.
- The root layout is not remounted on client-side navigation between the four routes, so the provider loads storage **once per full page load** and its in-memory state (including the viewed month, and changes that could not be saved) survives navigation. Navigation must use `Link` (through `NavBar`) or `router.push`; a plain `<a>` would reload the page and the provider.
- Hydration rule unchanged: the server render and the first client render are `loading` on every route (the provider reads nothing during render). In that state the shell renders only what needs no budget data: the site name, the navigation (its current item comes from `usePathname()`, which is the same on the server and the client), and `main` with `aria-busy="true"`, the page's `h1` and `Loading your budget…`. `Add expense`, the month switcher (22) and the saved-data messages render only when ready.
- Every route is static (no `searchParams`, no dynamic functions), so `next build` prerenders the four loading shells.

## Files
- `apps/web/src/app/layout.tsx`: the wrapper above; `metadata = { title: { default: 'Budget Kit', template: '%s · Budget Kit' }, description: 'A calm monthly budget planner.' }`; still no `'use client'`
- `apps/web/src/app/page.tsx` (Overview), `app/spending/page.tsx`, `app/plan/page.tsx`, `app/history/page.tsx`: each `export const metadata = { title: 'Spending' }` (`Plan`, `History`) and a default export rendering the matching page component; nothing else. The Overview page is the exception: `export const metadata = { title: { absolute: 'Overview · Budget Kit' } }`, because the template would otherwise add the suffix to its own title (changed in app 21 commit 9600c6a)
- `apps/web/src/features/shell/AppShell.tsx` (`'use client';`)
- `apps/web/src/features/shell/navItems.ts` (no directive): `NAV_ITEMS`
- `apps/web/src/features/overview/OverviewPage.tsx`, `features/spending/SpendingPage.tsx`, `features/plan/PlanPage.tsx`, `features/history/HistoryPage.tsx` (each `'use client';`)
- Copy changes in `features/dashboard/Dashboard.tsx`, `features/expenses/AddExpense.tsx`, `features/expenses/ExpenseList.tsx` (below)
- Delete `features/BudgetApp.tsx`, `features/BudgetApp.test.tsx`, `features/BudgetApp.hydration.test.tsx`
- Test infrastructure (builder writes; not product code): `src/test/nextNavigation.ts`, `src/test/setup.ts` (add the two `vi.mock` calls), `src/test/renderApp.tsx`
- QA: `features/shell/AppShell.test.tsx`, `features/shell/AppShell.hydration.test.tsx`, `features/overview/OverviewPage.test.tsx`, `features/spending/SpendingPage.test.tsx`, `app/routes.test.ts`; update `styling.rules.test.ts` (scan list: shell and page files instead of `BudgetApp.tsx`/`ResetMonth.tsx`; add `<a` to the forbidden list; the populated-state money-label check renders the Plan page through `renderApp`), `Dashboard.test.tsx`, `AddExpense.test.tsx`, `ExpenseList.test.tsx` for the new copy

## API
```ts
// features/shell/navItems.ts
export const NAV_ITEMS: readonly NavBarItem[] = [
  { href: '/', label: 'Overview' }, { href: '/spending', label: 'Spending' },
  { href: '/plan', label: 'Plan' }, { href: '/history', label: 'History' },
];

// features/shell/AppShell.tsx
export function AppShell(props: { children: ReactNode }): ReactElement;

// features/<area>/<Name>Page.tsx
export function OverviewPage(): ReactElement;
export function SpendingPage(): ReactElement;
export function PlanPage(): ReactElement;
export function HistoryPage(): ReactElement;

// test/nextNavigation.ts (used by the vi.mock factories in setup.ts)
export function setTestPathname(path: string): void;  // default '/' (reset after each test)
export function getTestPathname(): string;
export const testRouter: { push: Mock<(href: string) => void> }; // push sets the pathname and notifies subscribers
export function usePathname(): string;                // mock: subscribes, re-renders on change
export function useRouter(): { push(href: string): void; replace(href: string): void; back(): void; refresh(): void; prefetch(): void };
export function MockLink(props: { href: string; className?: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>): ReactElement;
// renders an anchor; a plain left click calls preventDefault and testRouter.push(href)

// test/renderApp.tsx
export function renderApp(options: RenderWithBudgetOptions & {
  path?: string;                 // default '/'
  getToday?: () => string;       // optional spy; default () => options.today ?? '2026-11-14'
}): RenderWithBudgetResult & {
  goTo(path: string): void;   // what a nav click does, without the click
};
// Renders <BudgetProvider ...><AppShell><CurrentPage /></AppShell></BudgetProvider>, where CurrentPage
// picks OverviewPage / SpendingPage / PlanPage / HistoryPage from the mocked pathname, so clicking a
// nav link "navigates" inside one provider exactly like the real layout. refresh() remounts the provider
// (a full page load) and keeps the current path.
```

## Behaviour
### Shell
- `<header className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-6 sm:px-6">` (the banner landmark), containing:
  - a row (`div`, `flex flex-wrap items-center justify-between gap-3`): `<p className="font-semibold text-text">Budget Kit</p>` and `<NavBar label="Main" items={NAV_ITEMS} currentHref={usePathname()} linkComponent={Link} />` (`Link` from `next/link`; if its type does not fit `NavBarLinkProps`, a three-line adapter component in this file, no cast);
  - a second row (`div`, `flex flex-wrap items-center justify-between gap-3`) holding `<AddExpense />`. Task 22 adds `<MonthSwitcher />` as the first child of this row; leave it otherwise empty.
- `<main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">`, with `aria-busy="true"` only while loading, containing (when ready) the saved-data messages with today's exact wording and conditions (`loadStatus` `invalid` with and without `savedDataReplaced`; `unavailable`), then `children`.
- `Add expense` is today's AddExpense (button and dialog) in the header on every page. It adds to the viewed month. When the viewed month has no categories it renders nothing (instead of today's sentence).

### Pages (each: `h1` first; while loading only `h1` + `<p>Loading your budget…</p>`)
- **OverviewPage**: `<h1>Overview</h1>`; when ready and `book.months.length === 0`: `<p>Welcome. Start on the Plan page: enter your monthly income and add the categories you spend on.</p>`; then `<Dashboard />`.
- **SpendingPage**: `<h1>Spending</h1>`, `<ExpenseList />`.
- **PlanPage**: `<h1>Plan</h1>`, `<MonthSetup key={`${viewedMonth}:${generation}`} />` (temporary; task 23 replaces it).
- **HistoryPage**: `<h1>History</h1>`, `<p>Your months will be listed here.</p>` (temporary; task 24 replaces it).
- All `h1`: `className="text-2xl font-semibold text-text"`.

### Copy changes in today's screens
- Dashboard: the `Not set` prompts read `Enter your monthly income on the Plan page`; the empty categories text reads `No categories yet. Add them on the Plan page.`
- ExpenseList: Card title `Expenses in {formatMonth(state.month)}` (description `Newest first.` unchanged). The table caption changes to `Expense table for {formatMonth(state.month)}` (hidden). It was `Expenses in {…}`, the same text as the card title, so the card and the table region had the same name; the caption now differs from the card title. Empty state `No expenses in {formatMonth(state.month)}.`; when `state.categories.length === 0`, a `<p>Add a category on the Plan page before adding expenses.</p>` after the table.
- AddExpense: returns `null` when there are no categories (the sentence moves to ExpenseList).

## Acceptance criteria
Routes and layout (`app/routes.test.ts`, reading modules and source):
- [ ] `layout.tsx`, `page.tsx`, `spending/page.tsx`, `plan/page.tsx`, `history/page.tsx` have no `'use client'`; their `metadata.title` values are `{ default: 'Budget Kit', template: '%s · Budget Kit' }`, `{ absolute: 'Overview · Budget Kit' }` (page.tsx), `'Spending'`, `'Plan'`, `'History'`; `layout.tsx`'s source has `<html lang="en">` and renders `BudgetProvider` around `AppShell` around `children`.
- [ ] `features/BudgetApp.tsx` no longer exists; `AppShell.tsx` and every `*Page.tsx` start with `'use client';`.

Shell (`AppShell.test.tsx`, `renderApp`):
- [ ] For each path `/`, `/spending`, `/plan`, `/history` (seeded `SCENARIO`): one `banner` containing the text `Budget Kit` and `navigation` `Main` with links `Overview`, `Spending`, `Plan`, `History`; exactly the link for that path has `aria-current="page"`; one `main`; exactly one `h1`, reading `Overview`, `Spending`, `Plan`, `History` respectively.
- [ ] Clicking the nav link `Plan` from `/` shows `h1` `Plan` and marks `Plan` current, **without reloading the provider**: `getToday` was called exactly once in total (spy passed through `renderApp`'s provider), and an unsaved change survives: with `createMemoryStorage({}, { throwOnSet: true })`, type `3200` into `Monthly income (USD)` on `/plan`, click `Overview`: `Income` shows `$3,200.00`.
- [ ] `Add expense` is in the banner on all four paths (seeded `SCENARIO`); adding `20` / Groceries from `/history` and then clicking `Overview` shows `Spent $1,714.82`. With empty storage (no categories) there is no `Add expense` button on any of the four paths.
- [ ] Saved-data messages show inside `main` on `/history` and `/spending` as well as `/` (storage `'not json'`: the invalid message; `throwOnGet`: the unavailable message), with today's wording and transitions.
- [ ] Loading: before the ready state (or via `renderToString`), `main` has `aria-busy="true"` and contains the page `h1` and `Loading your budget…`; the banner has the nav and no `Add expense`. Ready: `main` has no `aria-busy`.

Hydration (`AppShell.hydration.test.tsx`), for each of the four paths with storage seeded with `SCENARIO`:
- [ ] `renderToString` of the provider + shell + page contains `Loading your budget…`, the four nav link names and the page's `h1`, and not `November 2026` or `Add expense`.
- [ ] `hydrateRoot` of that HTML (inside `act`): `onRecoverableError` never called, `console.error` never called; afterwards the ready content shows (on `/`: `Summary`; on `/spending`: `Expenses in November 2026`).

Pages:
- [ ] Overview, empty storage: the welcome line is shown; `Left to spend` `Not set` with `Enter your monthly income on the Plan page`; `No categories yet. Add them on the Plan page.` Seeded `SCENARIO` (or after any change): no welcome line. Seeded `{ version: 2, book: { months: [] } }`: welcome line shown.
- [ ] Overview, seeded `SCENARIO`: the five stats `$3,200.00`, `$2,270.00`, `$1,694.82`, `$1,505.18`, `$930.00` and Eating out `Over budget` (today's dashboard criteria still pass with the new copy).
- [ ] Spending, seeded `SCENARIO`: region `Expenses in November 2026`, rows Nov 5, Nov 3, Nov 1; deleting all three shows `No expenses in November 2026.` focused. Seeded `createInitialState('2026-11')`: also `Add a category on the Plan page before adding expenses.`
- [ ] Plan: typing `3200` in `Monthly income (USD)` stores income `320000` (the temporary MonthSetup still works).
- [ ] `expectNoAxeViolations()` (all rules except `color-contrast`, including `region`, `landmark-*`, `heading-order`, `page-has-heading-one`) on `document.body` for each path, loading and ready, and with the Add expense dialog open on `/`.

Blanket:
- [ ] `styling.rules.test.ts` passes with the updated scan list and the `<a` rule, and fails if QA temporarily adds `<a href="/">x</a>` to `AppShell.tsx` (prove once, revert).
- [ ] `npm run build -w @budget-kit/web` succeeds and lists `/`, `/spending`, `/plan`, `/history` as static routes.
- [ ] No `any`, `@ts-ignore` or `@ts-expect-error` in non-test files; `npm run check` passes.

## Manual browser checks
- `npm run dev`: clicking the nav items switches pages without a `Loading your budget…` flash; the browser Back button returns to the previous page; the tab title changes (`Plan · Budget Kit`); a screen reader announces the new page (Next.js route announcer).
- Loading `localhost:3000/plan` directly with saved data: no flash of empty content, no hydration warning in the console.
- 375px: header rows wrap cleanly, nav items at least 40px tall, no horizontal scroll; 1280px: one header line for name and nav.
- Keyboard: Tab order is site name (not focusable), nav links, `Add expense`, then the page.

## Assumptions
- The site name is a paragraph, not a heading; each page's `h1` names the page.
- Focus after navigation is left to Next.js (it scrolls to the top and announces the route); no focus is moved to the `h1`.
- No `not-found.tsx`; Next's default 404 renders inside the layout.

## Out of scope
- The month switcher and month notes (22), the new Plan page (23), History (24), the whole-app scenario (25). Library changes.
