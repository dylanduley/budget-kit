# Component library tasks

Plan for `docs/specs/components.md`. One file per task; each is self-contained for a builder (with `CLAUDE.md`) and for QA. All of these tasks are built and merged (see `docs/build-log.md`).

## Tasks

| # | Task | Depends on | Group | Shared files touched |
|---|---|---|---|---|
| 00 | [Token pairs](00-token-pairs.md) | none | 0 | `src/tokens.pairs.ts`, `src/tokens.css` |
| 01 | [Button](01-button.md) | 00 | A | `src/index.ts` |
| 02 | [TextField](02-text-field.md) | 00 | A | `src/index.ts`; creates internal `src/Field/` |
| 03 | [MoneyField](03-money-field.md) | 02 | B | `src/index.ts`; reads `src/TextField/` |
| 04 | [Select](04-select.md) | 02 | B | `src/index.ts`; reads `src/Field/` |
| 05 | [Badge](05-badge.md) | 00 | A | `src/index.ts` |
| 06 | [Card](06-card.md) | 00 | A | `src/index.ts` |
| 07 | [Stat](07-stat.md) | 00 | A | `src/index.ts` |
| 08 | [ProgressBar](08-progress-bar.md) | 00 | A | `src/index.ts` |
| 09 | [Dialog](09-dialog.md) | 01 | B | `src/index.ts`; reads `src/Button/` |
| 10 | [Table](10-table.md) | 00 | A | `src/index.ts` |

All paths are under `packages/ui/`. Every component task also creates its own folder `src/<Name>/`, which no other task writes to.

### What task 00 covers
The scaffold already satisfies most of spec item 0: every colour family with a text-safe shade, spacing, radii, font sizes, shadows, a contrast test over `tokens.pairs.ts`, and a story listing the pairs. What remains is small: nine pairs the planned components use that are not listed yet (status text on the page background, the invalid-field outline, ProgressBar fills, the secondary Button hover border), and a scrim token for Dialog. All nine already pass with today's values, so no colour changes.

## Parallel groups

Run the groups in order; tasks inside a group can run at the same time in separate git worktrees.

| Order | Group | Tasks | Starts when |
|---|---|---|---|
| 1 | 0 | 00 | immediately |
| 2 | A | 01, 02, 05, 06, 07, 08, 10 | 00 is merged |
| 3 | B | 03, 04, 09 | 02 is merged (03, 04); 01 is merged (09) |

The spec says "1–5 in parallel, 6–10 after". That does not match the real dependencies:

- **03 MoneyField moves out of the first batch**: it is built on TextField (imports it and its props type), so it cannot start until 02 is merged.
- **04 Select moves out of the first batch**: it must share label/hint/error markup with TextField; that lives in an internal `Field` wrapper created by 02, so 04 starts after 02.
- **09 Dialog stays after 01, and needs only 01**: its close button is a `Button`, and its stories use Buttons as trigger and actions.
- **06 Card, 07 Stat, 08 ProgressBar, 10 Table move into the first batch**: they import no other component (Card's action and Table's cells are slots), so nothing makes them wait for 1–5.
- **00 runs first, alone**: it is the only task that edits the token files, which removes them as a conflict between parallel tasks.

If seven parallel worktrees is more than you want to review at once, a split that still respects every dependency and keeps the spec's two checkpoints is: batch 1 = 01, 02, 05; batch 2 = 03, 04, 06, 07, 08, 09, 10.

## Merge-conflict risks

| File | Who touches it | Rule |
|---|---|---|
| `src/index.ts` | every component task | Each task adds only the export line(s) given under its Files heading and changes nothing else. Merge branches one at a time; a conflict here is always resolved by keeping both sides' export lines, ordered by task number, and deleting the placeholder `export {};`. The final file is exactly the block below. |
| `src/tokens.pairs.ts`, `src/tokens.css` | task 00 only | Component tasks do not edit them. If a builder finds a pair missing, it appends the pair at the very end of the array and names it in its report; such a conflict is resolved by keeping both sides' appended entries. Token values never change in a component task. |
| `src/Field/*` | created by 02; read by 04 | 04 starts only after 02 is merged and may not modify `Field`. If Select needs something different, the builder reports it and the lead decides. |
| `src/TextField/*` | created by 02; read by 03 | 03 may not modify TextField; missing capability is reported, not patched. |
| `src/Button/*` | created by 01; read by 09 | 09 may not modify Button. |
| `package.json`, `package-lock.json` | nobody | No task adds a dependency. A builder that thinks it needs one stops and reports. |
| `src/stories.a11y.test.tsx`, `.storybook/*`, `vitest.config.ts` | nobody | Stories are discovered by glob; no task edits these. |

Expected `src/index.ts` when all tasks are merged:

```ts
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button/Button';
export { TextField, type TextFieldProps } from './TextField/TextField';
export { MoneyField, type MoneyFieldProps } from './MoneyField/MoneyField';
export { formatCents, parseMoney, type MoneyParseResult } from './MoneyField/money';
export { Select, type SelectOption, type SelectProps } from './Select/Select';
export { Badge, type BadgeProps, type BadgeVariant } from './Badge/Badge';
export { Card, type CardProps } from './Card/Card';
export { Stat, type StatProps, type StatTone } from './Stat/Stat';
export { ProgressBar, type ProgressBarProps, type ProgressBarTone } from './ProgressBar/ProgressBar';
export { Dialog, type DialogProps } from './Dialog/Dialog';
export { Table, type TableColumn, type TableProps } from './Table/Table';
```

## Conventions chosen for all components

Stated identically in every task file. In short: one folder per component (`src/<Name>/<Name>.tsx`, `.module.css`, `.stories.tsx`, `.test.tsx`), CSS Modules using only `--bk-*` tokens, variants and states exposed as `data-*` attributes, `'use client'` only where a component has state, effects or handlers. No scaffold change is needed for any of this: `vite/client` and Next both declare `*.module.css`, the Storybook and a11y-test globs already match subfolders, and `sideEffects` in `package.json` already covers CSS.

## Open questions for the lead

Each has the assumption the tasks currently use. The first five affect several tasks.

1. **Grouping differs from the spec.** Assumed the dependency-based groups above (0, then A, then B) replace "1–5 then 6–10". `docs/prompts.md` step 2 names tasks 1–5 and would need the same change.
2. **Who writes the test files?** `docs/workflow.md` says QA writes tests from the acceptance criteria. Assumed the builder creates component, styles and stories, and QA creates `<Name>.test.tsx`. If builders should also write tests, say so and the Files sections change.
3. **CSS Modules through Next is unproven here.** Type declarations and Next's `transpilePackages` support it, but no component exists to prove it in `apps/web`. Assumed it works; the first merged component should be imported once in the app to confirm before group B starts. The same applies to the `'use client'` rule.
4. **Task 00 adds a token the spec does not list**: `--bk-color-overlay` (the scrim behind Dialog), so Dialog can meet "uses tokens". Assumed that is acceptable.
5. **An internal `Field` wrapper** (label, hint, error) is created in task 02 and reused by Select. It is not one of the ten components and is not exported. Assumed that is preferable to duplicating the markup in Select.
6. **The app needs field types the spec does not have.** The expense form in `app-brief.md` needs a date, and TextField supports only `text` and `number`. Not planned (outside the spec). Assumed the lead will either extend the spec or accept a text field for the date.
7. **`formatCents` and `parseMoney` are exported publicly** from task 03 so the app formats cents for Stat, ProgressBar and Table with the same rules as MoneyField. The spec does not ask for a formatter. Assumed yes.
8. **MoneyField details the spec leaves open.** Assumed: controlled only, empty is `null`; invalid text calls `onChange(null)`; parse errors appear on blur, not per keystroke; more than two decimals (`12.345`) is an error, not rounded; a leading `$` is accepted; fixed `1,234.56` format regardless of locale; cap of 999,999,999,999.99.
9. **Button.** Assumed default `type="button"` (submit only when asked), and that loading uses `aria-disabled` plus blocked clicks instead of native `disabled`, so focus is not lost.
10. **Dialog.** Assumed: controlled `open`/`onClose` with a consumer-owned trigger; backdrop click does not close; focus moves to the dialog panel unless `initialFocusRef` is given; a custom modal instead of native `<dialog>` because jsdom lacks `showModal()` and the criteria must be testable; background made inert by setting `inert` on the other children of `<body>`.
11. **Required fields and error announcements.** "Label (required)" was read as "the label prop is mandatory". Assumed no visual required-marker, and that errors are announced through `aria-describedby` on focus with no live region.
12. **ProgressBar.** Assumed exactly 80% is ok and exactly 100% is warning; `aria-valuenow` is capped at max with the overage in `aria-valuetext`; the ok/warning difference is carried by the visible numbers plus colour, with extra words only when over.
13. **Stat.** Tone is good/bad rather than up/down, so the non-colour cue is a `✓` / `!` marker plus hidden `Good:` / `Bad:` text. Assumed fixed English strings.
14. **Card** is a `<section>` named by its title (a landmark). Assumed fine; many cards on the dashboard could make landmark navigation noisy.
15. **Table** is wrapped in a focusable scroll region so it works on a phone, which adds one tab stop per table. Assumed acceptable. Sorting and pagination are not planned.
16. **Stories for Card and Table use a plain native `<button>`** in their action slots, because they run in parallel with Button. Assumed a follow-up (docs-writer) swaps in `Button` after group A merges.
17. **Fixed English strings** in components: `Close`, `Good:`, `Bad:`, `over by`, `Nothing to show yet.`, and the MoneyField error messages. Only `closeLabel` and `emptyState` are overridable. Assumed English-only is fine.
18. **Outside this plan, noticed while reading the scaffold**: `docs/workflow.md` mentions a typecheck hook and CI, but the repo has no `.claude/` or `.github/` directory. Not planned here.
