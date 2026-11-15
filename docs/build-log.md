# Build log

What each agent did, what QA and review caught, and decisions I made as lead. Updated after each batch.

| Task | Built by | QA | a11y | Review | Notes |
|---|---|---|---|---|---|
| 00 Token pairs | Sonnet | pass | pass | approve | 9 contrast pairs and the `--bk-color-overlay` token. No issues. |
| 01 Button | Sonnet | pass | fail, fixed | changes needed, fixed | a11y: the loading label was hidden with `visibility: hidden`, which removes it from the accessibility tree in real browsers, so a loading button had no accessible name; the task file itself specified `visibility: hidden`, so the spec was wrong, and the fix uses `opacity: 0`. Review: a consumer's own `aria-busy`/`aria-disabled` were dropped when not loading; a disabled loading button showed the wrong cursor; the disabled secondary border used a colour not in the contrast list. QA added tests for the aria fix. |
| 02 TextField | Sonnet | pass | fail, fixed | approve | a11y: the input outline was removed unconditionally and the replacement focus ring depended on `:has()`, so browsers without it showed no focus indicator; the outline is now removed only where `:has()` is supported. |
| 03 MoneyField | Sonnet | fail, fixed | 2 findings, not fixed | approve | QA found the field stopped following the parent when the parent set a value equal to a value the field had reported earlier (for example 500, then back to empty: the field kept showing 5.00); one-line fix. Code review fuzzed `parseMoney` with 4 million random strings against a BigInt reference with zero mismatches. The two a11y findings (currency symbol hidden from assistive technology; "Amount is too large" gives no correction) are spec-level and were left for the lead to decide. |
| 04 Select | Sonnet | pass | pass | changes needed, fixed | Review: an uncontrolled Select with a placeholder showed and submitted its first real option instead of the placeholder (a story workaround hid it); fixed and QA added tests. Open: Select and TextField match at 42px in Storybook but differ by 2px in the app, because Tailwind's reset sets `box-sizing: border-box` and TextField sets none; left for the lead to decide. One a11y "failure" was a test timeout caused by the machine sleeping; a clean re-run passed. |
| 05 Badge | Sonnet | pass | pass | changes needed, fixed | Review: a QA test claimed to check that props cannot override `data-variant` but never passed a conflicting prop; the component was correct and the test was corrected. |
| 06 Card | Sonnet | pass | pass | changes needed, fixed | Review: a hard-coded `font-weight: 600` where `--bk-font-weight-semibold` exists. |
| 07 Stat | Sonnet | pass | pass | changes needed, fixed | Review: a vacuous override test (as in Badge). Both reviews: the visually hidden tone text had no positioned ancestor, which can cause a stray scrollbar inside scroll containers; `position: relative` added. |
| 08 ProgressBar | Sonnet | pass | pass | approve | No issues. |
| 09 Dialog | Sonnet | pass | fail, fixed | changes needed, fixed | a11y: a scrolling body was not keyboard-reachable (WCAG 2.1.1); it now becomes focusable only while it overflows. Review (Opus): the focus trap jammed on hidden, inert or disabled-fieldset elements; Esc during IME composition or already handled by an inner widget still closed the dialog. QA also repaired three tests that could not fail, and ran the new tests against the pre-fix component (13 failed there). A focused re-review approved the fixes. |
| 10 Table | Sonnet | pass | pass | changes needed, fixed | Review: the `NarrowViewport` story barely overflowed its 320px container, so the scrolling could not be seen; it now uses the five-column set. The `eslint-disable` for `jsx-a11y/no-noninteractive-tabindex` on the focusable scroll region was ruled justified by both reviewers. |

## Totals and notes

- 11 tasks (00 plus ten components).
- 670 tests across 13 test files and 80 story accessibility checks passing on `main` at the time of writing.
- Groups A and B were built in separate git worktrees in parallel. A: 01, 02, 05, 06, 07, 08, 10. B: 03, 04, 09.
- Fable was used only for the first planning run and for group A's code reviews. The model assignment was changed afterwards (see `docs/workflow.md`).
- The first attempt at group A failed because the worktrees were cut from the remote branch, which lacked the task files. Nothing was built or lost.
- Time and cost: not recorded.
