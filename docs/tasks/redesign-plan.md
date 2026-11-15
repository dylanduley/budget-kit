# Redesign plan: pages, months and history

Plan for `docs/specs/app-redesign.md`. Library tasks are `docs/tasks/20-*.md`, `21-*.md`; app tasks are `docs/tasks/app/20-*.md` to `25-*.md` (numbers start at 20 so they cannot collide with the follow-up plan on `docs/plan-followups`). Each task file is self-contained for a builder (with `CLAUDE.md`) and for QA.

## Tasks

| Task | Title | Depends on | Group | Shared files touched |
|---|---|---|---|---|
| lib 20 | [NavBar](20-nav-bar.md) | none | A | `packages/ui/src/index.ts` (one appended line); maybe `tokens.pairs.ts` (append only) |
| lib 21 | [Control height contract](21-control-height-contract.md) | none | A | `packages/ui/src/tokens.css` (two tokens), Button/TextField/Select `.module.css` (`min-height` lines only) |
| app 20 | [Months, storage v2 and the provider](app/20-months-and-storage-v2.md) | none | A | `lib/budget.ts`, `state/*`, `test/*`, `features/BudgetApp.tsx`; deletes `features/reset/`; edits/deletes tests (listed in the task) |
| app 21 | [Routes, layout and app shell](app/21-routes-and-shell.md) | lib 20, app 20 | B | `app/*`, creates `features/shell/*` and the four `*Page.tsx`; copy in `Dashboard.tsx`, `AddExpense.tsx`, `ExpenseList.tsx`; `test/setup.ts`; deletes `BudgetApp.tsx` |
| app 22 | [Month switcher and month notes](app/22-month-switcher.md) | app 21 | C | `features/shell/AppShell.tsx` (one import, one JSX line); `styling.rules.test.ts` (aria-live check only) |
| app 23 | [Plan page](app/23-plan-page.md) | app 21 | C | `features/plan/*`; deletes `features/setup/`; `styling.rules.test.ts` (money-label check and scan list only) |
| app 24 | [History page and Delete all data](app/24-history-page.md) | app 21 | C | `features/history/*`; `styling.rules.test.ts` (destructuring pattern and scan list only) |
| app 25 | [Whole-app acceptance](app/25-whole-app-acceptance.md) | all above | D | new e2e/a11y tests; final `styling.rules.test.ts`; integration fixes only |

App paths are under `apps/web/src/`, library paths under `packages/ui/src/`.

## Order and parallel groups

| Order | Group | Tasks (separate worktrees) | Starts when |
|---|---|---|---|
| 1 | A | lib 20, lib 21, app 20 | immediately |
| 2 | B | app 21 | lib 20 and app 20 are merged |
| 3 | C | app 22, app 23, app 24 | app 21 is merged |
| 4 | D | app 25 | all of C is merged |

Why this shape:
- **Group A**: the two library tasks touch different files (NavBar's own folder and one `index.ts` line, versus tokens and three `min-height` lines) and the app state task touches no library file. None imports another.
- **App 21 alone**: it needs NavBar (lib 20) and the new provider API (app 20), and it fixes the shell, routes, page files and test mocks every later task renders through.
- **Group C**: each task owns its own folder and page file. The switcher (22) lives in the shell, not in the pages, precisely so it does not collide with 23 and 24. They share state only through the provider from app 20, which none of them changes, and QA seeds state through storage (`BOOK`), so 24's tests do not need 22's switcher. 23's "drafts reset on month change" criterion has a probe fallback if 22 is not merged yet.
- **lib 21 is not a prerequisite of app 23**: the app fix (ghost `md` Remove) works with today's library; lib 21 only locks the equal heights in.
- Deviation from the lead's direction: the switcher is in the header, not on each page, and not on History (spec decisions 3 and 15). Expenses/Budget are named Spending/Plan (decision 2, from the YNAB inspiration). Add expense moves to the header (decision 4).

If three worktrees in group C is too many, run 23 first (largest), then 22 and 24 together.

## Merge-conflict rules

| File | Who touches it | Rule |
|---|---|---|
| `packages/ui/src/index.ts` | lib 20 | One appended line. If the follow-up plan adds exports too, keep every line, ordered by task number. |
| `packages/ui/src/tokens.css`, `tokens.pairs.ts` | lib 21 (tokens), lib 20 (pairs, append only); possibly the follow-up status component | Append only; a conflict keeps both sides' additions. No existing value changes. |
| `apps/web/src/features/shell/AppShell.tsx` | created by app 21; app 22 adds one import and `<MonthSwitcher />` | Nobody else edits it in group C. If the follow-up status component should wrap the saved-data messages, it edits this file after app 21 (not `BudgetApp.tsx`, which no longer exists). |
| `apps/web/src/styling.rules.test.ts` | app 20, 21, 22, 23, 24, 25 | Each task edits only the `describe` block named in its Files section. Merge group C one branch at a time; a conflict in the scan list keeps every side's entries (alphabetical). |
| `apps/web/src/test/*` | app 20 (helpers), app 21 (`setup.ts`, `nextNavigation.ts`, `renderApp.tsx`) | Read-only for 22–25. A builder that needs a change stops and reports. |
| `apps/web/src/lib/*`, `state/*` | app 20 only | Read-only afterwards. |
| `apps/web/src/features/dashboard/*`, `features/expenses/*` | app 21 (copy only) | Read-only for 22–24. |
| `apps/web/src/app/*` | app 21 only | No later task adds a route. |
| `package.json`, `package-lock.json` | nobody | No new dependency in this plan. |

## Files and tests replaced

| Today | After | Where |
|---|---|---|
| `features/BudgetApp.tsx` (one page) | `features/shell/AppShell.tsx` + four `*Page.tsx` + four route files | app 21 |
| `features/reset/MonthNotice.tsx`, `ResetMonth.tsx`, `ResetMonthDialog.tsx` | removed; `features/history/DeleteAllData.tsx` | app 20 (delete), app 24 (new) |
| `features/setup/MonthSetup.tsx` | `features/plan/*` | app 23 |
| `state/storage.ts` v1, `serializeBudget`, `saveBudget` | v2 with v1 migration, `serializeBook`, `saveBook` | app 20 |
| `budgetReducer` `reset` action; provider `resetMonth`, `isOtherMonth` | `deleteAllData`, `viewMonth`, `viewedMonth`, `months`, `book` | app 20 |
| `SUGGESTED_CATEGORIES` (pre-filled) | `SUGGESTED_CATEGORY_NAMES` (buttons) | app 20, app 23 |
| `features/reset/ResetMonth.test.tsx`, `MonthNotice.test.tsx`, `resetRules.test.ts` | deleted (behaviour removed); delete-all criteria in app 24 | app 20 |
| `features/BudgetApp.e2e.test.tsx`, `BudgetApp.a11y.test.tsx` | deleted in app 20; replaced by `features/shell/App.e2e.test.tsx`, `App.a11y.test.tsx` | app 20 → app 25 |
| `features/BudgetApp.test.tsx`, `BudgetApp.hydration.test.tsx` | `features/shell/AppShell.test.tsx`, `AppShell.hydration.test.tsx` | app 21 |
| `features/setup/MonthSetup.test.tsx` | `features/plan/PlanPage.test.tsx` | app 23 |
| `lib/budget.test.ts`, `state/*.test.ts(x)`, `test/*.test.tsx` | updated in place | app 20 |
| `Dashboard.test.tsx`, `AddExpense.test.tsx`, `ExpenseList.test.tsx` | updated for new copy | app 21 |
| `styling.rules.test.ts` | updated by each task (rules above) | 20–25 |

## Behaviours that must be preserved
Every one of these is re-checked in app 25 (and most earlier, in the task that touches it).

Money and totals
1. Integer cents everywhere; display formats `$1,505.18`, `-$494.82`, `Nov 5, 2026`, `November 2026`; every money label ends `(USD)`.
2. Summary stats Income, Planned, Spent, Left to spend, Unplanned money; `Not set` with a prompt while income is 0; `Spent $X more than your income` (bad tone) when left is negative; `Planned $X more than your income` / `Not yet assigned to a category` for unplanned.
3. Category rows: progress bar `$spent of $planned` when planned > 0, `$X left`, `Over budget` badge (never colour alone); `No plan set` badge and `Spent $X` when planned is 0 (never red); removed-categories line; `Removed category` and `Unnamed category` labels.
4. Totals safety: unsafe-to-total stored data is treated as invalid (N1); an action that would make a total unsafe throws `That change would make a total too large.` and changes nothing (N2).

Expenses
5. Add expense dialog: `Amount (USD)` (required, initial focus), `Category` (required, placeholder `Choose a category`), `Note` (optional, at most 100 characters), `Date` (Select of the month's days, default today if in the month, else the 1st); validation messages unchanged; Save closes, Cancel/Esc close without saving; focus returns to the trigger.
6. Expense list newest first (ties: later added first); Delete without confirmation; focus moves to the next row's Delete, else the previous, else the focusable empty-state paragraph; descriptive Delete labels.

Categories
7. Name rules: required, unique case-insensitively after trimming (`Enter a category name`, `You already have a category called {name}`); rename saves on blur, a rejected rename restores the old name with `{problem}. The name is still {name}.`
8. Planned and income save as typed; empty (and unparseable) stores 0; empty field shown for 0.
9. Remove without confirmation keeps the category's expenses in Spent; focus moves to a neighbouring Remove (else the add-category control).
10. Ordinal field labels (`Category 2 name`, `Category 2 planned (USD)`).

Persistence
11. Load after mount: server and first client render show loading, no hydration mismatch, no flash of empty content; `today` read once per load.
12. Loading never writes; every user action saves; a no-op action neither saves nor changes state (N3).
13. Invalid or unsupported data: start fresh, keep the raw value until the first change, show the invalid then the replaced message (N4); storage unavailable: work in memory with the unavailable message; failed saves ignored.
14. Ids from `crypto.randomUUID` with fallbacks (N5).

Interaction and accessibility
15. Every action error is caught and shown on the field or in the one action-error paragraph; the form or dialog stays open.
16. One dialog at a time (background inert); destructive confirmation has `Cancel` as initial focus and a `danger` confirm; after a confirmation that removes its trigger, focus goes to a confirmation paragraph.
17. Everything works by keyboard; axe clean (jsdom without contrast, real browser with contrast); single column below 640px, no horizontal scroll at 375px; long names wrap.
18. No native controls, `style`, CSS files or non-layout Tailwind in the app; every control from `@budget-kit/ui`.
19. "Clear everything after confirming" survives as `Delete all data`.

Intentionally changed (not regressions): five pre-filled categories; `Reset month`; the rollover notice and its confirmation; the `Budget Kit` `h1` and `Budget for {month}` line; "below" prompts; page order; the inline add-category form; `sm`/`secondary` Remove; the AddExpense no-categories sentence (moves to Spending); the expense card title and empty text.

## Risks

1. **Storage migration (highest).** A bug in v1 parsing or in the first v2 save loses the only copy of someone's budget. Also a **rollback** hazard: if the pre-redesign app is ever deployed again, it reads version 2 as `unsupported-version`, starts fresh, and its first change overwrites every month with a version 1 value. Mitigations in the plan: the v1 rules are reused unchanged; loading never writes, so nothing changes until the first edit; app 20 tests migration with and without a month change and the manual check uses data saved by today's `main`. Not planned (open question 3): keeping a backup of the raw v1 string under a second key before the first v2 write.
2. **Loss of whole-app coverage between app 20 and app 25.** App 20 deletes the e2e and a11y suites (they test the removed one-page flow); their replacements arrive in app 25, three merges later. Screen, state and storage tests stay green throughout, and app 21's shell tests cover navigation and hydration, but the scripted new-user scenario, the to-the-cent overspending/deletion flow and axe on the assembled app are missing in between. Mitigations: the preserved-behaviours list above, each re-checked in 25; do not release from `main` between app 20 and app 25; run groups B–D back to back.
3. **Routing tested through mocks.** Tests mock `next/navigation` and `next/link`, so they prove the app works when navigation happens inside one provider, not that Next does that. A plain `<a>` or a page-level provider would reload state on every navigation and pass jsdom tests. Mitigations: the provider is only in `layout.tsx`; `<a` is banned by the styling test; app 21 checks `next build` lists four static routes and has manual checks for no loading flash and no hydration warnings on direct loads.
4. **Derived month identity.** The viewed month may be computed (not stored); if the provider recomputes it every render, effects that depend on `state` or `state.expenses` (focus after delete, focus after remove) loop or misfire. App 20 has a referential-stability criterion.
5. **Editing the wrong month.** Past months are editable and Add expense is global, so a change can land in a past month by mistake. Mitigated by the switcher label and the past-month note (22) and by the Date options being that month's days; no confirmation is planned.
6. **Overlap with the follow-up plan** (`docs/plan-followups`): see below.

## Interaction with the follow-up plan (`docs/plan-followups`)
Not duplicated here. Where this redesign moves their targets:
- **Invalid-money warning**: today it would live in `features/setup/MonthSetup.tsx` (and `features/expenses/AddExpense.tsx`). After app 23 the money fields are in `features/plan/IncomeCard.tsx`, `CategoryRow.tsx` and `AddCategoryDialog.tsx` (new field `Planned (USD)`); AddExpense is unchanged in place but rendered from the header. Recommend building the warning after app 23 merges; if it merges first, app 23 must carry it into the new files (its criteria then extend to `Planned (USD)`).
- **Status component**: today's candidates are the saved-data messages in `BudgetApp.tsx` and the rollover confirmation in `features/reset/`. After the redesign the saved-data messages are in `features/shell/AppShell.tsx` (app 21), the rollover notice no longer exists, the delete confirmation is in `features/history/DeleteAllData.tsx`, and the month switcher's live label (app 22) is a natural user. If the status component lands before app 22, the lead may ask 22 to use it instead of a raw `aria-live`.
- Numbering: this plan uses library 20–21 and app 20–25 only.

## Open questions for the lead
Each has the assumption the tasks use.
1. **Planned-vs-income line on the Plan page** (e.g. `Not yet planned: $930.00`) to help while setting plans. Assumed not (Overview shows Unplanned money).
2. **Text links.** Prompts say "on the Plan page" as plain text; the app may not style an `<a>` and the library has no inline link component. Assumed plain text (the nav is one Tab away).
3. **Backup before migration**: copy the raw version 1 string to `budget-kit:budget:v1-backup` before the first version 2 write (cheap insurance for risk 1). Assumed not.
4. **Suggestions visibility**: always while unused (assumed) vs only during the first month.
5. **Category filter on Spending** (from the YNAB inspiration). Assumed not.
6. **Error boundary** (still open from the original plan, b3). Not planned.
7. **Future months / planning ahead**. Not planned.
8. **`docs/specs/app-brief.md`** still says "one-month planner", "5 suggested categories" and "Reset clears everything"; the lead may want to update it to point at this redesign. Not edited by this plan.
9. **`docs/tasks/README.md` and `docs/tasks/app/README.md`** are not edited here (to avoid conflicts with the follow-up plan); the docs-writer can link this plan after both merge.
