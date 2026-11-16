# Follow-ups plan: invalid money text, status announcements

Two follow-ups after the library (tasks 00–13) and app (app tasks 01–08) were built. Not built yet; the lead reviews this plan first.

## Tasks

| # | Task | Depends on | Group | Files touched |
|---|---|---|---|---|
| 14 | [MoneyField reports the parse state](14-money-field-parse-state.md) | none | F1 | `packages/ui/src/MoneyField/MoneyField.tsx`, `.stories.tsx`, `.test.tsx` |
| 15 | [StatusMessage](15-status-message.md) | none | F1 | new `packages/ui/src/StatusMessage/*`; `src/index.ts` (one line); `src/text-wrapping.test.ts` (one entry) |
| app 09 | [Invalid money text warns and is not saved](app/09-invalid-money-not-saved.md) | 14 | F2 | `apps/web/src/features/setup/MonthSetup.tsx` (+ tests), one sentence in `docs/tasks/app/README.md` |
| app 10 | [Announce non-error changes with StatusMessage](app/10-status-announcements.md) | 15, app 09 | F3 | `AddExpense.tsx`, `ExpenseList.tsx`, `MonthSetup.tsx`, `BudgetApp.tsx` (+ tests, including four existing tests that forbid status regions), `styling.rules.test.ts`, two passages in `docs/tasks/app/README.md` |

## Order and parallelism

| Order | Group | Tasks | Starts when |
|---|---|---|---|
| 1 | F1 | 14 and 15, in separate worktrees | immediately |
| 2 | F2 | app 09 | 14 is merged (15 may still be in progress) |
| 3 | F3 | app 10 | 15 and app 09 are merged |

- **14 and 15 are parallel**: different folders. 15 adds one line to `src/index.ts` and one entry to `text-wrapping.test.ts`; 14 touches neither (`MoneyParseResult` is already exported).
- **app 09 needs only 14.**
- **app 10 waits for app 09** even though the two features are unrelated: both edit `MonthSetup.tsx` and `MonthSetup.test.tsx`, and app 09 also edits `docs/tasks/app/README.md`. Running them one after the other avoids conflicts in those files.
- Fastest path: 14 → app 09, while 15 is built at the same time; then app 10.

## Decided by the planner (lead may revise later)
Choices made without asking, as instructed. Each is also listed under Assumptions in its task.

**Invalid money text (14, app 09)**
1. The library reports the parse state as a **second `onChange` argument**, the existing `MoneyParseResult`: `onChange(cents, result)`. One-parameter callers (AddExpense, `useState` setters in stories) keep working, and no new export is needed.
2. Showing errors while typing is **opt-in** with `validateOn?: 'blur' | 'change'` (default `'blur'`). Only the app's income and category planned fields use `'change'`.
3. Invalid text in those fields **is not saved**: the action is not called and the stored amount is kept. **Empty still saves 0** (unchanged lead decision).
4. Invalid text **stays in the field with the error** until the user fixes it. It is not reverted on blur (names are reverted; amounts are not). Refresh shows the saved amount.
5. The library's error wording is used as is. No "The amount is still $3,200.00" suffix, because the parse error replaces the app's `error` prop.
6. The add-category form and AddExpense are **unchanged**: they save only on submit and already treat `null` as missing.

**Status announcements (15, app 10)**
7. Component name **`StatusMessage`** (WCAG's term), props `message`, `announceKey`, `visuallyHidden` (default false). It is a polite `role="status"` region with `aria-live="polite"` and `aria-atomic="true"`. It has no timers or effects, and the region node stays mounted while its text changes.
8. Identical text is announced again by changing `announceKey`, which re-keys the inner span. Timers and invisible characters are not used.
9. **One region per screen** (BudgetApp, AddExpense, ExpenseList, MonthSetup) rather than an app-wide announcer context.
10. Exactly four messages: expense added, expense deleted, category removed, saved data replaced. Wording is in app task 10.
11. **Totals** are announced only inside the expense added/deleted messages (`Left to spend: …`, when income is set). They are not announced on income or planned keystrokes, which would speak on every digit, and not on category removal.
12. The saved-data message stays visible (it becomes a visible `StatusMessage`). The other three are visually hidden.
13. Messages stay in their region until the next one replaces them. Nothing clears them on a timer.
14. Rule text: the app convention sentence "App code has no other `role="alert"`, `role="status"` or `aria-live`" becomes "App code has no other `role="alert"`, and writes no `role="status"`, `aria-live` or `aria-atomic` itself", plus a new **Status announcements** convention. `styling.rules.test.ts` keeps its source ban on `role="status"`/`aria-live` (extended to `aria-atomic`/`aria-relevant`). It adds a check that `<StatusMessage` is used exactly once in each of the four files and nowhere else, and a DOM check that every live region on the page is the library's. `<p role="alert" data-part="action-error">` remains the only app-level alert. **`CLAUDE.md` needs no change**: it has no rule about live regions. The rule lives in the app task conventions and `docs/tasks/app/README.md`. The conventions in the built task files 03–08 are left as history.

## Risks
- **Errors flash while typing (14, app 09).** With `validateOn="change"`, a half-typed amount that is not valid yet (`1,` on the way to `1,200`, a leading `.`, `$` or `-`) shows `Enter an amount like 12.50` until it is complete. Because field errors are `role="alert"`, a screen reader may announce it mid-typing. Most people type `1200`, so this was accepted as the smallest change. If the manual checks find it disruptive, the follow-up is a library rule that holds back the `invalid` message while the text could still become valid. It needs no app change.
- **Intermediate valid keystrokes are still saved.** Typing `12.3.4` saves `1230` at `12.3` before the `.` that makes it invalid. Saving per keystroke is existing behaviour; only invalid text is skipped.
- **Announcements are not provable in CI.** jsdom tests prove the region exists, keeps its identity, and gets the exact text at the right time (including after the Dialog lifts `inert`). Only the manual VoiceOver/NVDA checks prove anything is spoken. The repo has no browser test runner (see app README).
- **Dialog and inert timing (app 10).** If the added-expense message is set in the same commit that closes the Dialog, the region may still be inert and the message lost. Task 10 requires the text to change after `inert` is lifted, and checks it with a `MutationObserver`.
- **Polite messages can be dropped or reordered** when focus moves at the same moment (Delete and Remove move focus). The manual checks cover this. If messages are lost, a short library-side delay is the fallback; it would need test changes.
- **Existing tests that forbid status regions** (four tests, listed in app task 10) must be updated in the same branch, or app 10 fails `npm run check`.
- **Stale hidden messages**: a screen-reader user browsing the page later may hear the last "Expense added…" with an outdated left-to-spend. Accepted for now.

## Index updates
`docs/tasks/README.md` and `docs/tasks/app/README.md` link to this plan under "Follow-ups".
