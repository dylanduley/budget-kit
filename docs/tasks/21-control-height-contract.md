# 21: Control height contract (Button md = fields)

Make "a `md` Button is exactly as tall as a TextField, MoneyField or Select" a tested, documented contract, and show it in a story.

Background: the lead saw `Remove` buttons shorter than the inputs beside them and looking like inputs. The cause is in the app (it used `size="sm"`, 32px, and the `secondary` variant, white with a grey border); library Button `md`, TextField's box and Select are all `min-height: var(--bk-space-10)` (40px) with `box-sizing: border-box` since task 11. The app fix is app task 23. This task only stops the library from drifting: today the equality is a coincidence of three separate rules.

**Depends on**: none

**Parallel group**: Redesign A (with library 20 and app 20)

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
- `packages/ui/src/tokens.css`: add `--bk-control-height: var(--bk-space-10);` and `--bk-control-height-sm: var(--bk-space-8);` in a new `/* Control heights */` block after Spacing (no other token changes)
- `packages/ui/src/Button/Button.module.css`: `md` min-height → `var(--bk-control-height)`; `sm` min-height → `var(--bk-control-height-sm)`
- `packages/ui/src/TextField/TextField.module.css` `.box` and `packages/ui/src/Select/Select.module.css` `.select`: min-height → `var(--bk-control-height)`
- `packages/ui/src/Button/Button.stories.tsx`: add story `BesideFields`
- `packages/ui/src/control-height.test.ts` (QA)

## Props / API
No prop changes. New tokens `--bk-control-height` (40px) and `--bk-control-height-sm` (32px).

## Behaviour
- Rendered sizes do not change: Button `md` 40px, `sm` 32px, TextField box and Select 40px, all border-box.
- `BesideFields` story: one row (flex, `align-items: flex-end`, story-level inline layout is allowed in stories only) with a `TextField` `Category 1 name`, a `MoneyField` `Category 1 planned (USD)`, a `Select` `Category`, then a `Button` `variant="ghost"` `Remove` and a `Button` `variant="secondary"` `Save`, all default size. Story description: "Button md and every field are the same height (--bk-control-height). Use ghost for row actions beside fields so they do not read as inputs; size sm is for compact places, not beside fields."

## Acceptance criteria
- [ ] `control-height.test.ts` (reads CSS source): `Button.module.css` `[data-size='md']` and `TextField.module.css` `.box` and `Select.module.css` `.select` each declare `min-height: var(--bk-control-height)`; `[data-size='sm']` declares `min-height: var(--bk-control-height-sm)`; each of those rules (or the base `.button` rule for Button) declares `box-sizing: border-box`.
- [ ] The same test fails against the pre-change CSS (QA shows it once by checking out the old files, then restores).
- [ ] `tokens.css` defines `--bk-control-height: var(--bk-space-10)` and `--bk-control-height-sm: var(--bk-space-8)`; `git diff` of `tokens.css` adds only those lines and the comment.
- [ ] `Components/Button/BesideFields` exists, renders the five controls, and passes `npm run test:a11y`.
- [ ] The diff touches no colour, spacing value, radius, font or shadow (only the `min-height` lines, the two tokens and the story).
- [ ] `npm run check` passes.

## Manual browser checks (the lead does these)
- In `BesideFields`, the bottom edges of all five controls line up and all are 40px tall (DevTools), and `Remove` does not look like an input.
- In the app after app task 23, the same holds on the Plan page.

## Assumptions
- A token is the lightest way to tie the three heights together; no shared CSS file between modules.
- The library does not change Button's default variant or add a "row action" variant: `ghost` already is one.

## Out of scope
- Any app code; changing sizes; new Button sizes or variants.
