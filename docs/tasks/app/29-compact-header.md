# 29: Compact header on phones

At 375px the app header is about 260px tall: the site name and the navigation take two rows, the month switcher (`Previous month`, the month, `Next month`) wraps onto two more, and `Add expense` gets a row of its own. On a phone a third of the screen is chrome before any content. This task makes the smallest layout change that brings the header to three rows of controls, using only library components and the allowed Tailwind classes.

**Depends on**: app tasks 21, 22 (merged)

**Parallel group**: G1 (with 26 and 28; see `docs/tasks/followups-plan2.md`)

## Conventions (identical in every redesign app task)
- **Folders** (all under `apps/web/src/`): `lib/` pure TypeScript (no React, no `window`, no `Date.now()`); `state/` storage and the React provider; `features/<area>/` screen components; `test/` shared test helpers; `app/` Next.js route files only (`layout.tsx`, `page.tsx` files, `globals.css`).
- **Imports**: library components and helpers only from `@budget-kit/ui` (lint blocks `@budget-kit/ui/src/*`); app modules through the `@/` alias.
- **Client boundary**: a file starts with `'use client';` only if it uses state, effects, refs, context, event handlers or Next client hooks (`usePathname`, `useRouter`). `layout.tsx` and every `page.tsx` stay server components (they may export `metadata`). `lib/*`, `state/storage.ts` and `state/budgetReducer.ts` have no directive.
- **Styling**: no CSS files (other than the existing `app/globals.css`, unchanged), no `style` prop, no CSS Modules, and no native `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, `<dialog>` or `<a>` anywhere in `apps/web/src` (links come from the library `NavBar` with Next's `Link`). Tailwind classes only for layout and spacing on plain elements (`flex*`, `grid*`, `gap-*`, `p*-*`, `m*-*`, `max-w-*`, `w-full`, `items-*`, `justify-*`, `list-none`, and `sm:` variants of these), plus typography and token text colours (`text-2xl`, `font-semibold`, `text-text`, `text-text-muted`) on plain text elements (`h1`, `h3`, `p`). On library components `className` may contain only `w-full`, `self-*`, `justify-self-*`, `col-span-*`. Single column below 640px: any multi-column layout is behind `sm:`.
- **Structure**: plain semantic elements only (`header`, `main`, `section`, `div`, `h1`, `h3`, `p`, `ul`, `li`, `form`).
- **Action errors**: every call to a `useBudget().actions` function is wrapped in `try`/`catch`. A caught `RangeError` whose message is exactly `That change would make a total too large.` (`TOTAL_TOO_LARGE_MESSAGE`) is shown with that text; anything else is shown as `Something went wrong. Your budget was not changed.` The provider guarantees state and storage are unchanged; the screen keeps its form or dialog open with the user's values. The message goes in the `error` prop of the field the action came from when one fits; otherwise in the **one permitted app-level alert**: `<p role="alert" data-part="action-error">{message}</p>`, placed directly after the control that triggered the action, rendered only while a message is shown, and cleared on the next edit or successful action in that form. `useBudget().viewMonth` is navigation, not an action, and needs no `try`.
- **Live regions**: app code has no `role="status"` and no `aria-live`, with one exception: the month switcher's month label (task 22) is `aria-live="polite"`. (App task 27 changes this rule; this task keeps the label exactly as it is.)
- **Money**: integer cents in state, storage, props and function arguments. Converted to text only at the display edge with `formatMoney` from `@/lib/format`. No `parseFloat`, `toFixed`, `Number(` on text, `* 100` or `/ 100` on amounts. Amounts shown are exactly the numbers the `lib/` functions return.
- **Dates**: ISO strings (`YYYY-MM-DD`, months `YYYY-MM`), compared as strings. Never `new Date(string)`. "Today" comes only from `useBudget().today`.
- **Copy**: English, sentence case; strings quoted in a task are exact.
- **Tests**: written by QA from the acceptance criteria, colocated as `<file>.test.ts(x)`; the builder does not write them. Tests import from `vitest` (no globals), use Testing Library and `@testing-library/user-event`, and use the helpers in `src/test/`. From task 21 on, `next/navigation` and `next/link` are mocked in `src/test/setup.ts`. jsdom has no layout: visual behaviour goes under **Manual browser checks**.
- **Done**: every acceptance criterion passes and `npm run check` passes.

## Files
- `apps/web/src/features/shell/AppShell.tsx`: the `<header>` block only (class values and the order of its children); `main` and the saved-data messages unchanged
- `apps/web/src/features/month/MonthSwitcher.tsx`: the visible text and `aria-label` of the two Buttons, and the class of the button row; the label `<p aria-live="polite">`, the notes, the focus effect and the handlers unchanged
- QA, existing tests to update (listed under "Existing tests"): `features/shell/AppShell.test.tsx`, `features/shell/App.a11y.test.tsx`, `features/month/MonthSwitcher.test.tsx`, `styling.rules.test.ts` (the `className values` count only)
- Read-only: `features/expenses/AddExpense.tsx` (its `className="self-start"` stays), `features/shell/navItems.ts`, every page, `packages/ui/**` (no NavBar or Button change)

## API / Props
No new exports or props. Uses the library `Button`'s native `aria-label`.

## Behaviour
### Target layout (all widths)
Three rows, in this DOM order (which is also the visual and Tab order):

| row | content | layout |
|---|---|---|
| 1 | `Budget Kit` (the existing plain `<p>`) and, once ready and the month has a category, `Add expense` | `flex flex-wrap items-center justify-between gap-3` (the existing row-1 classes) |
| 2 | the `NavBar` (`Main`) | the NavBar directly in the header, no wrapper |
| 3 | the month switcher (not on History): `Previous` · `{Month YYYY}` · `Next`, then the past-month / new-month notes when they apply | MonthSwitcher's own markup |

Header classes become `mx-auto flex max-w-3xl flex-col gap-2 px-4 pt-4 sm:px-6` (was `… gap-4 px-4 pt-6 sm:px-6`). The second wrapper `div` (switcher + Add expense) is removed: `<MonthSwitcher />` is a direct child of the header after the NavBar, and `{ready ? <AddExpense /> : null}` moves into the row-1 `div` after the `Budget Kit` paragraph.

Expected header JSX:
```tsx
<header className="mx-auto flex max-w-3xl flex-col gap-2 px-4 pt-4 sm:px-6">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <p className="font-semibold text-text">Budget Kit</p>
    {ready ? <AddExpense /> : null}
  </div>
  <NavBar label="Main" items={NAV_ITEMS} currentHref={pathname} linkComponent={Link} />
  <MonthSwitcher />
</header>
```

### Month switcher buttons
- Visible text `Previous` and `Next`; `aria-label="Previous month"` and `aria-label="Next month"`. The accessible names are unchanged, and each starts with its visible text, so label-in-name (WCAG 2.5.3) holds and speech users can say "click Previous".
- The button row's class becomes `flex flex-wrap items-center gap-2` (was `gap-3`).
- Everything else in MonthSwitcher is unchanged.

### Why this layout
At 375px (343px of content width): row 1 is `Budget Kit` (about 80px) plus `Add expense` (about 127px); the NavBar is about 334px; the switcher with short labels and the longest month (`September 2026`) is about 306px (with the full labels it is about 400px, which is what wraps today). Each row is one 40px control row, so the header is 16 + 40 + 8 + 40 + 8 + 40 = **152px** (no notes). Putting `Add expense` on the switcher row (spec order) would need about 440px and wrap again; Add expense beside the nav would need about 470px.

### Targets
- 375px, current month, no notes, on `/`, `/spending`, `/plan`: header height (`document.querySelector('header').getBoundingClientRect().height`) at most **152px**; on `/history` (no switcher) at most 104px.
- 1280px: the same rows and at most 152px (one layout at every width; no `sm:` row changes).
- 320px: no horizontal page scroll and no clipped control or text; rows may wrap (the NavBar to two lines, the switcher's `Next` under the month), which is allowed.
- The notes (`You're looking at a past month…`, `New month…`) add their own lines below the switcher; they are not counted in the targets.

### Tab and reading order
Becomes: `Add expense` (when present), `Overview`, `Spending`, `Plan`, `History`, `Previous`, `Next`, then `main`. This is a deliberate change from the spec's header order (site name, navigation, switcher, Add expense; see Assumptions). Visual order matches DOM order at every width (no CSS reordering).

### Loading and other states
Loading: row 1 holds only `Budget Kit`, row 2 the NavBar, no switcher (unchanged content). History: rows 1 and 2 only. No categories: row 1 holds only `Budget Kit`.

## Acceptance criteria
- [ ] Header DOM order on `/`, `/spending`, `/plan` with `SCENARIO` (`renderApp`): the banner's element children are exactly, in order, a `div` containing `Budget Kit` then the `Add expense` button (assert containment and order, not an exact child list: app task 27 later adds a hidden status region after the button), the `nav` named `Main`, and the switcher's `div`; the `Add expense` button is not inside the `nav` and not inside the switcher's `div`. On `/history`: the `div` (name + Add expense) and the `nav` only.
- [ ] Header and row classes exactly as under Behaviour (header `mx-auto flex max-w-3xl flex-col gap-2 px-4 pt-4 sm:px-6`; row 1 `flex flex-wrap items-center justify-between gap-3`; switcher button row `flex flex-wrap items-center gap-2`).
- [ ] Switcher buttons: `getByRole('button', { name: 'Previous month' })` has text content exactly `Previous`; `Next month` has `Next`; the month label `<p>` still has `aria-live="polite"` and sits between them; the row's children's text is `['Previous', 'November 2026', 'Next']`.
- [ ] Label in name: for both buttons, the accessible name starts with the button's text content (case-insensitive).
- [ ] Tab order with `renderApp({ state: SCENARIO })` (one month, so both switcher buttons are disabled): Tab focuses `Add expense`, then `Overview`, `Spending`, `Plan`, `History`. With `renderApp({ book: BOOK })`: after `History`, Tab focuses `Previous month` (Next is disabled).
- [ ] Unchanged behaviour: every other test in `MonthSwitcher.test.tsx`, `AppShell.test.tsx`, `AppShell.hydration.test.tsx`, `App.a11y.test.tsx` and `App.e2e.test.tsx` passes unedited (names by role, focus after Previous/Next, Add expense from every page, the loading shell, one dialog at a time).
- [ ] axe: `expectNoAxeViolations()` passes on every path with `SCENARIO`, with `BOOK` viewing October (past-month note), and loading.
- [ ] `styling.rules.test.ts` passes with only the `className values` count changed (to 31 with the JSX above: one header `div` fewer); every class is allowed; no `any`, `@ts-ignore` or `@ts-expect-error`; `npm run check` passes.

### Existing tests
Update these; change nothing else in them:
- `features/shell/AppShell.test.tsx`, test `Tab order is the four links, then Add expense`: rename to `Tab order is Add expense, then the four links`; first Tab expects `Add expense`, then `Overview`, `Spending`, `Plan`, `History`.
- `features/shell/App.a11y.test.tsx`, describe `DOM order`, test `the banner (name, Main nav, month switcher, Add expense) comes before main on every path`: rename to `the banner (name, Add expense, Main nav, month switcher) comes before main on every path`; replace `expect(before(previous, add), path).toBe(true)` with `expect(before(add, links[0] as HTMLElement), path).toBe(true)`; keep `before(links[3], previous)` and `before(banner, main)`.
- `features/month/MonthSwitcher.test.tsx`, test `seeded BOOK, today 2026-11-14: banner shows November 2026 between Previous (enabled) and Next (disabled), no notes`: `expect(order).toEqual(['Previous month', 'November 2026', 'Next month'])` becomes `toEqual(['Previous', 'November 2026', 'Next'])`.
- `styling.rules.test.ts`, describe `className values`: `expect(seen).toBe(32)` becomes the new grep count (31 with the JSX above) and its comment says so.

## Manual browser checks (`npm run dev`, DevTools device toolbar)
- 375×812 on `/` with a saved budget: three header rows; header height at most 152px (measure as under Targets); `Add expense` at the right of `Budget Kit`; the NavBar on one line; `Previous`, the month and `Next` on one line. Report the measured height, and whether the NavBar fits on one line (it is tight: about 334 of 343px).
- 320×640: no horizontal scroll on any page; wrapped rows look intentional (nothing overlaps, focus rings not clipped).
- 1280: three rows, left-aligned, nothing stretched oddly; report whether the empty space to the right of the NavBar looks wrong (see the follow-ups plan, open questions).
- Past month (`Previous`) and new month (today in a later month): the note sits under the switcher and wraps within the header.
- Keyboard: Tab order as under Behaviour; focus ring visible on every header control.
- VoiceOver/NVDA: the buttons are read as "Previous month" and "Next month"; Voice Control / Dragon: "click Previous" works.

## Assumptions
- `Add expense` moves to the first row, before the navigation in DOM and Tab order. It is the only arrangement that fits three rows at 375px without CSS reordering (which would make visual and Tab order differ) or a library change. Rejected: keeping the spec's order (four rows), icon-only switcher buttons (`‹` `›`; less clear, and the row with Add expense still does not fit), smaller `sm` buttons (shorter than the 40px control height the app keeps everywhere).
- One layout at every width. A desktop layout with the NavBar and the switcher on one row (`sm:flex-row`) would save 48px at 1280 but needs another wrapper and makes the notes' position depend on width; left as an open question.
- Visible `Previous` / `Next` with the full names as `aria-label`, rather than a visually hidden " month" span: the library Button takes plain children, and `aria-label` keeps the accessible name exactly as tests and users know it.
- `docs/specs/app-redesign.md` (header order) and the manual check text in task 25 ("Tab order banner (nav, switcher, Add expense)") are not edited here; the lead decides whether to update the spec (follow-ups plan, open questions).

## Out of scope
- NavBar or Button changes (for example a compact NavBar size); a hamburger menu; sticky or collapsing headers.
- Changing the month label, the notes' wording, or where the saved-data messages are.
