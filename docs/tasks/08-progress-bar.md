# 08: ProgressBar

A labelled bar showing a value against a maximum, whose tone changes at thresholds and which explains in text when the value is over.

**Depends on**: 00

**Parallel group**: A

## Conventions (identical in every component task)
- **Folder**: one folder per component, `packages/ui/src/<Name>/`, containing `<Name>.tsx`, `<Name>.module.css`, `<Name>.stories.tsx` (builder) and `<Name>.test.tsx` (QA). No per-folder `index.ts`; named exports only; the public API is re-exported from `packages/ui/src/index.ts`.
- **Styling**: CSS Modules (`import styles from './<Name>.module.css'`). No new dependency: Vite/Storybook, Vitest and Next (`transpilePackages`) handle it, and `vite/client` and Next both ship the type declaration. Every colour, spacing, radius, font-size and shadow value is a `var(--bk-*)` token from `src/tokens.css`; colours use only semantic `--bk-color-*` tokens, in text/background pairs listed in `src/tokens.pairs.ts`. No Tailwind, no colour literals, no `style` prop for static styling.
- **State hooks**: variants and states are exposed as `data-*` attributes (named under Behaviour). CSS selects on them and tests query them; tests never assert on class names or computed styles (jsdom has no layout).
- **Props**: `className` is appended on the root element; `ref` (React 19 ref-as-prop, no `forwardRef`) and remaining native props go to the root, or for form fields to the native control.
- **Focus**: interactive elements show `box-shadow: var(--bk-focus-ring)` with `outline: 2px solid transparent` on `:focus-visible`; focus styling is never removed without this replacement.
- **Client boundary**: a file starts with `'use client';` only if it uses state, effects, refs or event handlers of its own (stated under Files).
- **Stories**: CSF3, `import type { Meta, StoryObj } from '@storybook/react-vite'`, `title: 'Components/<Name>'`, `satisfies Meta<typeof <Name>>`. `src/stories.a11y.test.tsx` picks up every story automatically.
- **Tests**: `<Name>.test.tsx` is written by QA from the acceptance criteria (Vitest globals, Testing Library, `@testing-library/user-event`); the builder does not create it.

## Files
- `packages/ui/src/ProgressBar/ProgressBar.tsx` (no `'use client'`; `useId` only)
- `packages/ui/src/ProgressBar/ProgressBar.module.css`
- `packages/ui/src/ProgressBar/ProgressBar.stories.tsx`
- `packages/ui/src/ProgressBar/ProgressBar.test.tsx` (QA)
- `packages/ui/src/index.ts`: add `export { ProgressBar, type ProgressBarProps, type ProgressBarTone } from './ProgressBar/ProgressBar';`

## Props / API
```ts
export type ProgressBarTone = 'ok' | 'warning' | 'danger';   // derived, not a prop

export interface ProgressBarProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  label: string;
  value: number;
  max: number;
  formatValue?: (amount: number) => string;   // default: (n) => String(n)
}
```
For money, `value` and `max` are **integer cents** and `formatValue` turns cents into text; ProgressBar itself never divides or rounds an amount for display.

## Behaviour
- Inputs are normalised first: a `value` or `max` that is negative or not finite is treated as `0`. Below, `value` and `max` mean the normalised numbers.
- Tone, using integer comparisons (no float ratio):
  - `ok` when `value * 5 <= max * 4` (≤ 80%)
  - else `warning` when `value <= max` (≤ 100%)
  - else `danger` (> 100%)
  - so `max = 0, value = 0` is `ok`, and `max = 0, value > 0` is `danger`.
- Status text:
  - not over: `{formatValue(value)} of {formatValue(max)}`
  - over: `{formatValue(value)} of {formatValue(max)}, over by {formatValue(value - max)}`
- Fill percent: `0` when `max` is `0` and `value` is `0`; `100` when `value >= max`; otherwise `Math.floor(value * 100 / max)`.
- DOM: root `<div data-tone="…">` containing a header row with the label `<span id={labelId} data-part="label">` and the status `<span data-part="status">`; then the track `<div role="progressbar" aria-labelledby={labelId} aria-valuemin="0" aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-valuetext={status text}>` containing the fill `<div data-part="fill" style="width: {percent}%">`. The inline `width` is the one permitted `style` use (it is dynamic).
- Colours: label `--bk-color-text`; status text `--bk-color-text-muted` (ok), `--bk-color-warning-text` (warning), `--bk-color-danger-text` (danger); track `--bk-color-surface-subtle`; fill `--bk-color-success` (ok), `--bk-color-warning` (warning), `--bk-color-danger` (danger). Track and fill radius `--bk-radius-full`; track height `--bk-space-2`.
- Not interactive; adds no tab stop. The fill never extends past the track.

## Stories required
`Ok` (40 of 100), `AtOkThreshold` (80 of 100), `Warning` (90 of 100), `AtMax` (100 of 100), `Over` (125 of 100), `Empty` (0 of 100), `ZeroMax` (0 of 0), `ZeroMaxOver` (10 of 0), `MoneyFormatted` (cents with a `formatValue` written with integer maths in the story, e.g. 45050 of 40000 → `$450.50 of $400.00, over by $50.50`), `AllTones` (ok, warning, danger stacked).

## Acceptance criteria
Spec:
- [ ] Tone changes at thresholds (`max = 100`): `value` 0, 40, 80 → `data-tone="ok"`; 81, 90, 100 → `warning`; 101, 125 → `danger`. With `max = 3`: `value` 2 → `ok`, 3 → `warning`, 4 → `danger`.
- [ ] Shows "over by X" when over: `value=125 max=100` renders the visible status `125 of 100, over by 25`; `value=100 max=100` renders `100 of 100` with no `over by`.
- [ ] `formatValue` is applied to value, max and the overage: with `formatValue={(n) => '$' + n}`, `value=125 max=100` renders `$125 of $100, over by $25`.
- [ ] `role="progressbar"` with `aria-valuenow/min/max` and a text label: `getByRole('progressbar', { name: <label> })` finds the track; for `value=40 max=100` it has `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow="40"`, and `aria-valuetext="40 of 100"`; the label text is visible.
- [ ] Over 100% still renders correctly (bar capped, text explains): for `value=125 max=100`, `aria-valuenow="100"`, `aria-valuetext="125 of 100, over by 25"`, the fill's inline width is `100%`, and in the `Over` story in Storybook the fill ends exactly at the track's right edge.
- [ ] Fill width: `value=40 max=100` → `40%`; `value=1 max=3` → `33%`; `value=0 max=100` → `0%`.
- [ ] Edge inputs: `value=0 max=0` → tone `ok`, width `0%`, status `0 of 0`; `value=10 max=0` → tone `danger`, width `100%`, status `10 of 0, over by 10`; `value=-5 max=100` behaves exactly like `value=0`; `value=NaN` behaves like `value=0`. No attribute or text ever contains `NaN` or `Infinity`.
- [ ] The tone is never colour-only: the status text with the numbers is always visible, and the danger tone always includes `over by`.
- [ ] Two ProgressBars on one page have different label ids, and each track is labelled by its own label.
- [ ] `className` is appended and other native props reach the root `<div>`.

Blanket:
- [ ] Typed props exactly as under Props / API; no `any`, `@ts-ignore` or `@ts-expect-error` in non-test files; omitting `label`, `value` or `max` is a type error.
- [ ] Uses tokens: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' ProgressBar.module.css` prints nothing; every colour, spacing, radius, font-size and shadow declaration is a `var(--bk-*)`; only the colours listed under Behaviour are used; the only inline style is the fill `width`.
- [ ] Visible focus / keyboard only: the ProgressBar adds no tab stop (tabbing through `AllTones` in Storybook never lands on one).
- [ ] Every story listed under Stories required exists under `Components/ProgressBar`.
- [ ] `npm run test:a11y` lists every ProgressBar story with no axe violations, and the Storybook Accessibility panel shows no violations (including colour contrast) for each story.
- [ ] `ProgressBar`, `ProgressBarProps` and `ProgressBarTone` are importable from `@budget-kit/ui`.
- [ ] `npm run check` passes.

## Assumptions
- Thresholds are inclusive as the spec writes them: exactly 80% is ok, exactly 100% is warning.
- Tone is derived from `value` and `max`; there is no `tone` override prop.
- `aria-valuenow` is capped at `max` (ARIA requires it within range); the overage is carried by `aria-valuetext` and the visible text.
- The ok/warning difference is conveyed by the visible numbers plus colour; only "over" gets extra words, as the spec asks.
- The status text is always shown; the wording `X of Y` and `, over by Z` is fixed English.
- The component is generic over numbers; the app supplies a cents formatter (e.g. `formatCents` from task 03).

## Out of scope
- Indeterminate/animated progress, custom thresholds, stacked segments.
- Importing `formatCents` or any other component.
- Anything in `apps/web`.
- Editing `tokens.css` or `tokens.pairs.ts` (task 00 owns them; if a pair is missing, append it at the end of the array and name it in your report).
- New dependencies: report the need instead of installing.
