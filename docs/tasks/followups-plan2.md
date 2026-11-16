# Follow-ups plan 2: after the redesign

Four app follow-ups on the redesigned app (four pages, months, storage v2, NavBar; app tasks 20–25 and library tasks 14 and 15 are built and merged). Two replace stale tasks written before the redesign (app 09 and 10 referred to `features/setup/MonthSetup.tsx` and `features/BudgetApp.tsx`, which no longer exist); two are new. Not built yet; the lead reviews this plan first.

## Tasks

| # | Task | Replaces | Depends on | Group | Files touched |
|---|---|---|---|---|---|
| app 26 | [Invalid money text warns and is not saved](app/26-invalid-money-not-saved.md) | app 09 | lib 14 (merged) | G1 | `features/plan/IncomeCard.tsx`, `CategoryRow.tsx`, `AddCategoryDialog.tsx`; one README sentence; tests appended to `PlanPage.test.tsx` |
| app 28 | [Back up the old saved data before it is first overwritten](app/28-saved-data-backup.md) | new | none | G1 | `state/storage.ts`, `state/BudgetProvider.tsx`; one README sentence; new `state/*.backup.test.ts(x)`; three counts in existing provider tests |
| app 29 | [Compact header on phones](app/29-compact-header.md) | new | none | G1 | `features/shell/AppShell.tsx` (header block), `features/month/MonthSwitcher.tsx` (button labels, one class); four existing tests |
| app 27 | [Announce non-error changes with StatusMessage](app/27-status-announcements.md) | app 10 | lib 15 (merged), app 26, app 29 | G2 | `AddExpense.tsx`, `ExpenseList.tsx`, `CategoriesCard.tsx`, `AddCategoryDialog.tsx` (one prop), `AppShell.tsx` (main block); README (two passages), task 25 (two passages); `styling.rules.test.ts` (live-regions block); new `App.announcements.test.tsx`; three existing tests |

All app paths are under `apps/web/src/`. Numbers continue after the redesign's app 20–25. `app/09-…` and `app/10-…` now start with a "Superseded" line and stay as history.

## Order and parallelism

| Order | Group | Tasks (separate worktrees) | Starts when |
|---|---|---|---|
| 1 | G1 | 26, 28, 29 | immediately |
| 2 | G2 | 27 | 26 and 29 are merged (28 may still be in progress) |

- **26, 28 and 29 are parallel.** They touch disjoint source files: 26 the Plan field components, 28 the state layer, 29 the shell header and the switcher. Their only shared files are `docs/tasks/app/README.md` (26 and 28 edit different bullets) and, for 29 alone, `styling.rules.test.ts`. None imports anything another one changes.
- **27 waits for 26 and 29**, not because the features depend on each other but because it edits the same files: `AddCategoryDialog.tsx` (26 changes the Planned field and submit; 27 adds `onAdded`), `PlanPage.test.tsx`, the README "Accepted as is" bullet (one line, so parallel edits always conflict), `AppShell.tsx` (29 the header; 27 `main`), `MonthSwitcher.test.tsx`, `App.a11y.test.tsx`/`AppShell.test.tsx` (29) and `styling.rules.test.ts`. And 27 places a hidden region beside `Add expense`, whose position 29 changes; its manual "no extra gap" check is only meaningful on the final header.
- **27 does not need 28**: 28 changes no UI and no file 27 touches.
- Fastest path: 26, 28, 29 at once; then 27. If three worktrees is too many: 29 first (smallest), then 26 and 28 together, then 27.

## Merge-conflict rules

| File | Who | Rule |
|---|---|---|
| `docs/tasks/app/README.md` | 26 ("Accepted as is" bullet), 28 ("Saved-data messages" bullet), 27 (new Conventions bullet; "Accepted as is" bullet) | Each replaces only its quoted text. 26 and 28 touch different bullets several lines apart: on conflict keep both replacements. 27 applies its replacement on top of 26's text (they are different substrings of the same bullet). |
| `features/plan/AddCategoryDialog.tsx` | 26, then 27 | 27 starts after 26 is merged; 27 adds only the `onAdded` prop and its one call. |
| `features/plan/IncomeCard.tsx`, `CategoryRow.tsx` | 26 only | |
| `features/plan/CategoriesCard.tsx` | 27 only | 26 does not touch it. |
| `features/shell/AppShell.tsx` | 29 (the `<header>` block), then 27 (the invalid-data paragraph in `main`) | Each edits only its block. |
| `features/month/MonthSwitcher.tsx` | 29 only | 27 must not convert the label to `StatusMessage`. |
| `features/expenses/AddExpense.tsx`, `ExpenseList.tsx` | 27 only | 29 must not edit AddExpense (its `self-start` stays); 26 must not edit either. |
| `state/storage.ts`, `state/BudgetProvider.tsx` | 28 only | |
| `styling.rules.test.ts` | 29 (`className values` count), 27 (`alerts and live regions` block) | Each edits only its describe block. |
| `features/plan/PlanPage.test.tsx` | 26, then 27 | Each appends one new `describe` block at the end. 26 also rewrites four existing tests (see the table below); 27 changes none. |
| `features/month/MonthSwitcher.test.tsx` | 29 (first test's `order`), then 27 (live-region test) | Different tests. |
| `features/shell/AppShell.test.tsx`, `App.a11y.test.tsx` | 29 | 27 puts its whole-app tests in the new `App.announcements.test.tsx`. |
| `features/expenses/*.test.tsx` | 27 | |
| `state/BudgetProvider.test.tsx`, `BudgetProvider.months.test.tsx` | 28 | |
| `docs/tasks/app/25-whole-app-acceptance.md` | 27 only | Two passages, quoted in 27. |
| `src/test/*`, `lib/*`, `packages/ui/**`, `package.json` | nobody | A builder that needs a change stops and reports. |

## Existing tests that change

| Task | Test file | Test | Change |
|---|---|---|---|
| 28 | `state/BudgetProvider.test.tsx` | `the first change overwrites invalid data` | `setItemCalls` 1 → 2; assert the backup equals `'garbage'` |
| 28 | `state/BudgetProvider.test.tsx` | `no-op actions` › `do not save, keep garbage byte-identical … a real change then overwrites` | final `setItemCalls` 1 → 2 |
| 28 | `state/BudgetProvider.months.test.tsx` | `first change writes version 2 with exactly one month, income changed, all else intact` | `setItemCalls` 1 → 2; assert the backup equals the version 1 text |
| 29 | `features/shell/AppShell.test.tsx` | `Tab order is the four links, then Add expense` | renamed; Add expense first, then the four links |
| 29 | `features/shell/App.a11y.test.tsx` | `DOM order` › `the banner (name, Main nav, month switcher, Add expense) comes before main on every path` | renamed; `before(previous, add)` → `before(add, links[0])` |
| 29 | `features/month/MonthSwitcher.test.tsx` | `seeded BOOK, today 2026-11-14: banner shows November 2026 between Previous (enabled) and Next (disabled), no notes` | row text `['Previous', 'November 2026', 'Next']` |
| 29 | `styling.rules.test.ts` | `className values` › `every className is a literal …` | count 32 → 31 |
| 27 | `features/month/MonthSwitcher.test.tsx` | `the label has aria-live="polite", is the only live region, and its text changes in place` | renamed "only raw live region"; the count excludes `[data-part="status-message"]` |
| 27 | `features/expenses/ExpenseList.test.tsx` | `the Spending page renders the list and still has no other alerts/live regions from it` | `queryByRole('status')` absent → exactly two library regions, hidden and empty |
| 27 | `styling.rules.test.ts` | `there is no role="status" and exactly one aria-live (the month label)` | renamed; also bans `aria-atomic`/`aria-relevant`; plus two new tests |
| 27 | `features/expenses/AddExpense.test.tsx` | `AddExpense.tsx displays no money text (…)` | title only (assertion unchanged) |
| 26 | `features/plan/PlanPage.test.tsx` | `invalid 12.345 shows a field error on blur and 0 is stored` | renamed and rewritten: the last valid amount (1234) is kept and the error shows before blur, not 0 (QA commit daa1112) |
| 26 | `features/plan/PlanPage.test.tsx` | `total too large is shown on the income field; generic for other errors; clears on next edit` | typed text replaced with the `replaceWith` helper (select all, then type) |
| 26 | `features/plan/PlanPage.test.tsx` | `a total-too-large error on Planned clears when Planned is edited, and a later success closes the dialog` | typed text replaced with `replaceWith` |
| 26 | `features/plan/PlanPage.test.tsx` | `planned edit failing: total too large and generic land on that row planned field only` | typed text replaced with `replaceWith` |

Each task lists the tests it checked and expects to pass unedited, except the rows above; QA reports any other test that needed a change.

## Decided by the planner (lead may revise later)
Each is also under Assumptions in its task.

**Invalid money text (26)**
1. Income and category planned fields: `validateOn="change"`; invalid text calls no action and keeps the draft; empty still stores 0; the library wording is used as is; invalid text stays in the field (not reverted). Carried over from app 09 unchanged.
2. **The Add category dialog is included**: its Planned field had the same silent-$0 defect on submit (`Pets` / `abc` added Pets at $0.00). It gets `validateOn="change"` and Save is blocked while the text is invalid (focus to Planned, library error already showing). AddExpense stays unchanged.

**Status announcements (27)**
3. **One region per owner** (AppShell, AddExpense, ExpenseList, CategoriesCard), not an app-wide announcer, and none inside a dialog.
4. Messages: `Expense added: {amount} for {category} on {date}.`, `Expense deleted: …`, each with ` Left to spend: {left}.` when income is set; `Category added: {name}.` (+ ` Planned: {amount}.` when above 0), `Category removed: {name}.`; the existing replaced message. Exact examples in the task.
5. **Focus first, then text**: every region's text changes in the render after the focus move or dialog close, via an effect. **Dialogs are mounted only while open** (AddExpense and the Add category dialog, as DeleteAllData already is), because the library Dialog lifts `inert` in an effect cleanup that otherwise runs one render too late. Up to one `react-hooks/set-state-in-effect` lint disable per changed file, with a why-comment.
6. **Not announced**: typing in income/planned/names, month changes (the label already announces), navigation, the unavailable message, notes, and **Delete all data** (it already moves focus to its confirmation).
7. **The month label stays a raw `aria-live` `<p>`**; it is the only one. Rules: source bans `role="status"`, `aria-atomic`, `aria-relevant` and any other `aria-live`; `<StatusMessage` exactly once in each of the four files; a DOM check that every live region is the library's or the month label.

**Backup (28)**
8. Key `budget-kit:budget:backup` (the lead's name; the redesign plan's open question used `…:v1-backup`). Backed up: unreadable data (corrupt or unsupported version) and valid version 1 data; not version 2.
9. The raw text is read **just before the first overwrite**, not kept from load; never overwritten once present (from any session); attempted before every save until one succeeds.
10. If the backup fits but then the main save fails, the backup is removed and the save retried once.
11. `deleteAllData` makes no backup and always removes the key.

**Compact header (29)**
12. Three rows at every width: `Budget Kit` + `Add expense`; the NavBar; the switcher. **Add expense moves before the navigation** in DOM and Tab order (a change to the spec's header order).
13. Switcher buttons show `Previous` / `Next` with `aria-label` `Previous month` / `Next month` (label in name holds).
14. Header `gap-2` and `pt-4`; target at most 152px at 375px and at 1280px; at 320px rows may wrap but nothing overflows.

## Risks
1. **Announcement timing (27), highest.** Whether a polite message is spoken depends on the screen reader, the browser, focus moves and `inert`. The plan orders things so the text changes after focus has moved and after the dialog has gone, and jsdom tests check that order (a `focusin` snapshot sees the old text), but only the manual VoiceOver/NVDA checks prove anything is spoken. NVDA in particular may cut a polite message short if more focus or speech follows quickly. Making the plan work also changes two Dialogs to mount only while open and adds effects that set state (lint disables); if the library Dialog's cleanup order changes later, the order tests are what catch it.
2. **Backup and storage quota (28).** The backup doubles the stored size once. A full quota can make the backup or the save fail: the plan never lets the backup block the save (drop it and retry), but in that edge case there is no backup, exactly as today. "Never overwrite" means a second, later incident is not backed up while an old backup sits there, and with no restore screen the backup helps only someone who knows how to use DevTools. `Delete all data` must remove it, or the page would not delete everything it says it does.
3. **Header reorder and tight fit (29).** Putting `Add expense` before the navigation changes the Tab order every keyboard and screen-reader user meets first, and departs from the spec. The 152px target assumes the NavBar fits on one line at 375px (about 334 of 343px); a wider system font makes it wrap and adds about 44px. The manual check measures both; the fallback (a compact NavBar size) is a library change.
4. **Errors flash while typing (26).** With `validateOn="change"`, a half-typed amount (`1,` on the way to `1,200`) shows `Enter an amount like 12.50` until complete, and field errors are `role="alert"`, so screen readers may announce it mid-typing. Accepted as the smallest change (as in the first follow-ups plan); the follow-up would be a library rule.
5. **Three regions plus the month label on a page (27).** A stale hidden message (an old left to spend) can be heard when browsing past `Add expense`. Accepted.
6. **Existing tests that count writes or live regions** must be updated in the same branch as the code, or `npm run check` fails; they are listed above and in each task.

## Open questions for the lead
Each has the assumption the tasks use.
1. **Spec header order.** `docs/specs/app-redesign.md` ("Header, every page") lists name, navigation, switcher, Add expense; 29 makes it name, Add expense, navigation, switcher. Update the spec sentence? Not edited by this plan. Suggested wording: "the site name `Budget Kit` (plain text, not a heading) and, once the budget has loaded and the viewed month has a category, the `Add expense` button; the navigation; then the month switcher (not on History)."
2. **Spec decision 16** ("One app-level live region") is no longer accurate after 27. Update it to name the StatusMessage regions? Not edited.
3. **Desktop header.** 29 uses the same three rows at 1280. Put the NavBar and the switcher on one row from 640px up (saves 48px, adds one wrapper and makes the notes' position width-dependent)? Assumed not.
4. **Recover from backup.** 28 has no UI. A small History-page control ("Restore the data saved before {date}") would need its own spec (what it restores, what it replaces, confirmation). Not planned.
5. **Backup when the key already exists.** Assumed never overwritten. Alternative: overwrite when the existing backup is itself version 2 or unreadable. Not planned.
6. **Category removed message** could add "Its expenses still count in Spent." when the category had expenses (Overview explains it, but a screen-reader user on Plan does not see that). Assumed not.
7. **Stale indexes.** `docs/tasks/app/README.md` still describes the one-page plan (BudgetApp order, Reset, task 08 states) and does not list app 20–25. This plan only adds its follow-ups table; a docs-writer pass could bring the rest up to date.
