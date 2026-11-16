# 22: Month switcher and month notes

A month switcher in the page header (Previous month, the month, Next month) that changes the viewed month on every page except History, plus the two month notes: the past-month note and the new-month note. Spec: `docs/specs/app-redesign.md` (Month model, decisions 3, 8, 16).

**Depends on**: app 21

**Parallel group**: Redesign C (with 23 and 24)

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
- `apps/web/src/features/month/MonthSwitcher.tsx` (`'use client';`)
- `apps/web/src/features/shell/AppShell.tsx`: import it and add `<MonthSwitcher />` as the first child of the header's second row (before `<AddExpense />`); nothing else
- QA: `features/month/MonthSwitcher.test.tsx`; in `styling.rules.test.ts` change only the "no `aria-live`" check to allow exactly one match, which must be `aria-live="polite"` on a `<p` in `features/month/MonthSwitcher.tsx`

## API
```ts
export function MonthSwitcher(): ReactElement | null; // null while loading and on '/history'
```
Uses `useBudget()` (`viewedMonth`, `months`, `currentMonth`, `isViewedMonthStored`, `copiedFromMonth`, `viewMonth`), `adjacentMonth` from `@/lib/months`, `formatMonth`, `usePathname()`. Library: `Button`.

## Behaviour
- Root `<div className="flex flex-col gap-2">`:
  - a row `<div className="flex flex-wrap items-center gap-3">`: `<Button variant="secondary">Previous month</Button>`, `<p className="font-semibold text-text" aria-live="polite">{formatMonth(viewedMonth)}</p>`, `<Button variant="secondary">Next month</Button>` (both default size `md`);
  - when `viewedMonth < currentMonth`: `<p>You're looking at a past month. Changes are saved to {formatMonth(viewedMonth)}.</p>`;
  - when `!isViewedMonthStored && copiedFromMonth !== null`: `<p>New month. Your income and categories were copied from {formatMonth(copiedFromMonth)}. Change them on the Plan page.</p>`.
- Previous calls `viewMonth(adjacentMonth(months, viewedMonth, -1))`; Next likewise with `+1`. Each is natively `disabled` when its adjacent month is `null`.
- If the button that was just activated becomes disabled and the other button is enabled, focus moves to the other button (so focus is never lost to `body`). If both are disabled (only one month), they simply stay disabled.
- Not rendered on `/history` (`usePathname() === '/history'`), and not while loading.
- Every page's content follows the viewed month (they already read `useBudget().state`). Open forms are not affected: the Add expense dialog makes the rest of the page inert, so the switcher cannot be used while it is open.

## Acceptance criteria
Render with `renderApp` unless stated. `BOOK` = October 2026 (income $3,000.00, spent $3,494.82) + November 2026 (`SCENARIO`).
- [ ] Seeded `BOOK`, today `'2026-11-14'`, path `/`: the banner shows `November 2026` between `Previous month` (enabled) and `Next month` (disabled); no past-month or new-month note.
- [ ] Clicking `Previous month`: the label reads `October 2026`; Overview shows `Income $3,000.00`, `Spent $3,494.82`, `Left to spend -$494.82` with `Spent $494.82 more than your income`; the note `You're looking at a past month. Changes are saved to October 2026.` shows; `Previous month` is disabled and `document.activeElement` is `Next month`; `setItemCalls` is unchanged.
- [ ] The month label element has `aria-live="polite"` and its text changes in place (same element before and after the click).
- [ ] While viewing October: `/spending` lists only October's two rows (`Oct 12, 2026`, `Oct 1, 2026`); `Add expense` → the `Date` select's options are Oct 1–Oct 31, 2026, selected `Oct 1, 2026`; saving `5` / Rent stores the expense in October (`readStoredBook()`), not November. `/plan` shows `Monthly income (USD)` with `3,000.00`.
- [ ] The viewed month survives navigation (still October after clicking `Plan` then `Overview`) and resets to the current month on `refresh()`.
- [ ] New month: seeded `BOOK`, today `'2026-12-02'`: label `December 2026`, `Next month` disabled, note `New month. Your income and categories were copied from November 2026. Change them on the Plan page.`; Overview shows `Income $3,200.00`, `Planned $2,270.00`, `Spent $0.00`; storage untouched. After adding an expense (`20` / Rent) the note disappears; `Previous month` → `November 2026` with SCENARIO's figures unchanged.
- [ ] Gaps: seeded `{ months: [OCTOBER] }`, today `'2026-12-02'`: `Previous month` from December goes to `October 2026` (no November).
- [ ] First run (empty storage): label `November 2026`, both buttons disabled, no notes.
- [ ] `/history`: no `Previous month` / `Next month` buttons in the document.
- [ ] Keyboard only: Tab to `Previous month`, Enter: label changes and focus is on `Next month`; Enter: back to `November 2026`, focus on `Previous month`.
- [ ] `expectNoAxeViolations()` on `/` in the current-month, past-month and new-month states.
- [ ] `styling.rules.test.ts` passes with exactly one `aria-live`, and fails if QA adds a second (prove once, revert).
- [ ] No `any`, `@ts-ignore` or `@ts-expect-error`; `npm run check` passes.

## Manual browser checks
- VoiceOver or NVDA: activating `Previous month` announces `October 2026`.
- 375px: the row wraps without horizontal scroll; buttons and label stay readable; 1280px: one line beside `Add expense`.
- Disabled buttons are visibly disabled; focus ring visible on both buttons.

## Assumptions
- Plain `Previous month` / `Next month` labels (no month names in the buttons): the label between them says the month and is announced.
- Notes are plain paragraphs (not announced), like the other page messages.
- If the follow-up library status component (branch `docs/plan-followups`) lands first, the lead may prefer it for the month label instead of a raw `aria-live`; this task does not wait for it.

## Out of scope
- Jumping to an arbitrary month (History's `View` does that, task 24); future months; URL state.
