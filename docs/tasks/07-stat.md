# 07: Stat

A labelled figure with optional change text that carries a good, bad or neutral tone.

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
- `packages/ui/src/Stat/Stat.tsx` (no `'use client'`)
- `packages/ui/src/Stat/Stat.module.css`
- `packages/ui/src/Stat/Stat.stories.tsx`
- `packages/ui/src/Stat/Stat.test.tsx` (QA)
- `packages/ui/src/index.ts`: add `export { Stat, type StatProps, type StatTone } from './Stat/Stat';`

## Props / API
```ts
export type StatTone = 'good' | 'bad' | 'neutral';

export interface StatProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  label: string;
  value: string;      // already formatted by the caller, e.g. '$1,200.00'
  change?: string;    // e.g. '$50.00 under plan'
  tone?: StatTone;    // default 'neutral'; only affects the change line
}
```
Stat does no money maths and never receives a number: the caller formats integer cents into `value` and `change`.

## Behaviour
- Renders a root `<div data-tone="…">` containing, in DOM order: `<p data-part="label">`, `<p data-part="value">`, and, only if `change` is set, `<p data-part="change">`.
- The change line contains, in order:
  1. for `good` and `bad` only, a marker `<span data-part="tone-marker" aria-hidden="true">`: `✓` for good, `!` for bad;
  2. for `good` and `bad` only, a visually hidden `<span data-part="tone-text">`: `Good: ` or `Bad: ` (hidden with the clip technique, not `display: none`, so screen readers read it);
  3. the `change` text.
  For `neutral` there is no marker and no hidden text.
- Colours: label `--bk-color-text-muted`; value `--bk-color-text`; change `--bk-color-success-text` (good), `--bk-color-danger-text` (bad), `--bk-color-text-muted` (neutral). Must be legible on both `--bk-color-bg` and `--bk-color-surface`.
- Type: label `--bk-font-size-sm`; value `--bk-font-size-2xl`, `--bk-font-weight-semibold`, `font-variant-numeric: tabular-nums`; change `--bk-font-size-sm`.
- Not interactive; adds no tab stop. Long values wrap rather than overflow.

## Stories required
`Default` (label and value only), `GoodChange`, `BadChange`, `NeutralChange`, `AllTones` (three side by side), `LongValue` (a 20-character value in a 160px-wide container), `InsideSurface` (the three tones on a `--bk-color-surface` panel).

## Acceptance criteria
Spec:
- [ ] Label and value: both texts are rendered, the label before the value in DOM order.
- [ ] Optional change: with no `change` prop there is no `[data-part="change"]`, marker or tone text, whatever `tone` is.
- [ ] `data-tone` on the root equals the `tone` prop; default `neutral`.
- [ ] Trend meaning not shown by colour alone: with `tone="good"` and `change="$50.00 under plan"`, the change line contains a marker with text `✓` and `aria-hidden="true"`, and its full text content is `✓Good: $50.00 under plan` (so the accessible text is `Good: $50.00 under plan`); with `tone="bad"` the marker is `!` and the hidden text is `Bad: `; with `tone="neutral"` the change line's text content is exactly the `change` string.
- [ ] The marker is visible in the `GoodChange` and `BadChange` stories in Storybook, and the two are distinguishable in greyscale (devtools "emulate vision deficiency: achromatopsia").
- [ ] The `[data-part="tone-text"]` span is not hidden with `display: none`, `visibility: hidden` or the `hidden` attribute (CSS and DOM inspection).
- [ ] In `LongValue` in Storybook, nothing overflows the 160px container horizontally.
- [ ] `className` is appended and other native props reach the root `<div>`.

Blanket:
- [ ] Typed props exactly as under Props / API; no `any`, `@ts-ignore` or `@ts-expect-error` in non-test files; `value={1200}` is a type error.
- [ ] Uses tokens: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' Stat.module.css` prints nothing; every colour, spacing, radius, font-size and shadow declaration is a `var(--bk-*)`; only the colours listed under Behaviour are used.
- [ ] Visible focus / keyboard only: the Stat adds no tab stop (tabbing through `AllTones` in Storybook never lands on a Stat).
- [ ] Every story listed under Stories required exists under `Components/Stat`.
- [ ] `npm run test:a11y` lists every Stat story with no axe violations, and the Storybook Accessibility panel shows no violations (including colour contrast) for each story.
- [ ] `Stat`, `StatProps` and `StatTone` are importable from `@budget-kit/ui`.
- [ ] `npm run check` passes.

## Assumptions
- Tone is good/bad, not up/down, so the non-colour cue is a `✓` / `!` marker plus hidden `Good: ` / `Bad: ` text rather than arrows (spending going up is bad).
- The hidden tone words are fixed English strings with no override prop.
- `value` and `change` are pre-formatted strings; Stat has no surface of its own (the app puts it in a Card or on the page).

## Out of scope
- Formatting money, computing changes, sparklines, icons from a library.
- Other components; anything in `apps/web`.
- Editing `tokens.css` or `tokens.pairs.ts` (task 00 owns them; if a pair is missing, append it at the end of the array and name it in your report).
- New dependencies: report the need instead of installing.
