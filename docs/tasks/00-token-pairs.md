# 00: Token pairs for planned components

Register the contrast pairs (and one overlay token) that tasks 01–10 use but the scaffold does not list yet.

The scaffold already delivers the rest of spec item 0: `tokens.css` has every colour family with a text-safe shade, spacing, radii, font sizes and shadows; `tokens.test.ts` checks every listed pair; the `Foundations/Tokens` story lists them. Do not redo any of that.

**Depends on**: none

**Parallel group**: 0 (runs alone, before every other task)

## Files
- `packages/ui/src/tokens.pairs.ts`: append the pairs below to the end of `contrastPairs`
- `packages/ui/src/tokens.css`: add one token, `--bk-color-overlay`
- Nothing else. `Tokens.stories.tsx` and `tokens.test.ts` read the array and need no edit.

## Props / API
No component. Append exactly these entries, in this order:

| text | background | min | used by | ratio today |
|---|---|---|---|---|
| `--bk-color-success-text` | `--bk-color-bg` | 4.5 | Stat | 7.48 |
| `--bk-color-warning-text` | `--bk-color-bg` | 4.5 | ProgressBar | 7.88 |
| `--bk-color-danger-text` | `--bk-color-bg` | 4.5 | TextField, Select, Stat, ProgressBar | 8.26 |
| `--bk-color-danger` | `--bk-color-surface` | 3 | invalid field outline | 5.97 |
| `--bk-color-danger` | `--bk-color-bg` | 3 | invalid field outline | 5.60 |
| `--bk-color-border-strong` | `--bk-color-surface-subtle` | 3 | secondary Button hover | 3.17 |
| `--bk-color-success` | `--bk-color-surface-subtle` | 3 | ProgressBar fill on track | 4.81 |
| `--bk-color-warning` | `--bk-color-surface-subtle` | 3 | ProgressBar fill on track | 5.13 |
| `--bk-color-danger` | `--bk-color-surface-subtle` | 3 | ProgressBar fill on track | 5.17 |

Add to `tokens.css`, in the semantic colours block after `--bk-color-on-status`:

```css
/* Scrim behind modal dialogs */
--bk-color-overlay: rgb(27 36 44 / 0.5);
```

## Behaviour
None. No existing token value or existing pair changes.

## Stories required
None new. `Foundations/Tokens › ContrastPairs` must show the new rows automatically.

## Acceptance criteria
- [ ] `contrastPairs` has 35 entries: the original 26 unchanged and in the same order, followed by the 9 above in the order given.
- [ ] `--bk-color-overlay: rgb(27 36 44 / 0.5);` exists in `tokens.css`; `git diff` shows no other line of `tokens.css` changed.
- [ ] Spec item 0: all text/background pairs used by components meet 4.5:1 (3:1 for outlines and fills) and are listed in a story. Observed as: `npm run test -w @budget-kit/ui` reports 35 passing `design tokens` cases, and the `Foundations/Tokens › ContrastPairs` story renders 35 body rows.
- [ ] `npm run test:a11y` passes.
- [ ] `npm run check` passes.

## Assumptions
- The pairs above are the complete set tasks 01–10 need beyond the scaffold's list; they come from the colour choices fixed in each task's Behaviour section.
- A scrim token is needed so Dialog (09) can meet "uses tokens"; the spec's token list does not mention one.
- The overlay is not a text/background pair, so it is not added to `contrastPairs`.

## Out of scope
- Changing any existing token value. If a pair fails its minimum, stop and report; do not retune colours.
- Any component, story or test file; anything in `apps/web`; new dependencies.
