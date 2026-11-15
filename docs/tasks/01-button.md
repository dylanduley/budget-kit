# 01: Button

A button with four variants, two sizes, and disabled and loading states.

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
- `packages/ui/src/Button/Button.tsx` (starts with `'use client';`: it wraps `onClick`)
- `packages/ui/src/Button/Button.module.css`
- `packages/ui/src/Button/Button.stories.tsx`
- `packages/ui/src/Button/Button.test.tsx` (QA)
- `packages/ui/src/index.ts`: add `export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button/Button';`

## Props / API
```ts
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'type'> {
  variant?: ButtonVariant;                 // default 'primary'
  size?: ButtonSize;                       // default 'md'
  loading?: boolean;                       // default false
  type?: 'button' | 'submit' | 'reset';    // default 'button'
  children: ReactNode;
}
```

## Behaviour
- Renders one native `<button>` with `data-variant`, `data-size`, and `data-loading="true"` only while loading.
- Colours (rest / hover and active):
  - primary: `--bk-color-on-primary` on `--bk-color-primary` / `--bk-color-primary-hover`, `--bk-color-primary-active`
  - secondary: `--bk-color-text` on `--bk-color-surface` with a 1px `--bk-color-border-strong` border / `--bk-color-surface-subtle`
  - ghost: `--bk-color-primary-text` on transparent / `--bk-color-primary-subtle`
  - danger: `--bk-color-on-status` on `--bk-color-danger` / `--bk-color-danger-hover`
  - disabled (any variant): `--bk-color-text-muted` on `--bk-color-surface-subtle`, `cursor: not-allowed`, no hover change
- Sizes: `sm` min-height `--bk-space-8`, font `--bk-font-size-sm`; `md` min-height `--bk-space-10`, font `--bk-font-size-md`.
- `disabled`: native `disabled` attribute.
- `loading`:
  - sets `aria-busy="true"` and `aria-disabled="true"`; does **not** set native `disabled`, so the button keeps focus
  - click events do not reach `onClick` and are `preventDefault`ed, so a loading submit button does not submit its form
  - shows a spinner element (`data-part="spinner"`, `aria-hidden="true"`) centred over the label; the label stays in the DOM with `opacity: 0` so the width is unchanged and the accessible name is still the label
  - the spinner animation is disabled under `@media (prefers-reduced-motion: reduce)`
  - keeps its variant colours
- `disabled` and `loading` together: native `disabled` plus `aria-busy="true"` and the spinner.
- Keyboard: native. Enter and Space activate; neither activates while loading or disabled.

## Stories required
`Primary`, `Secondary`, `Ghost`, `Danger`, `Small`, `Disabled`, `Loading`, `LoadingSmall`, `AllVariants` (4 variants × 2 sizes, each at rest, disabled and loading), `LoadingWidth` (the same button at rest and loading, stacked, for the width check), `SubmitInForm` (a `<form>` with a text input and a `type="submit"` Button).

## Acceptance criteria
Spec:
- [ ] Loading button can't be clicked twice: with `loading`, clicking twice with `userEvent` calls `onClick` zero times; pressing Enter and Space while it is focused also calls it zero times.
- [ ] Works as a submit button in a form: clicking a `type="submit"` Button inside a `<form>` calls the form's `onSubmit` once; pressing Enter in a text input of that form also calls it once.
- [ ] A `type="submit"` Button with `loading` inside a form: clicking it calls the form's `onSubmit` zero times.
- [ ] Without a `type` prop the rendered attribute is `type="button"`, and clicking it inside a form calls `onSubmit` zero times.
- [ ] Each `variant` and `size` value is reflected in `data-variant` / `data-size`; defaults render `data-variant="primary"` and `data-size="md"`.
- [ ] `disabled`: the button has the `disabled` attribute and clicking calls `onClick` zero times.
- [ ] `loading`: the button has `aria-busy="true"`, `aria-disabled="true"`, no `disabled` attribute, contains one `[data-part="spinner"][aria-hidden="true"]`, and `getByRole('button', { name: <label> })` still finds it. Without `loading`, `aria-busy` and the spinner are absent.
- [ ] Keeps width: in the `LoadingWidth` story in Storybook, the two buttons have the same rendered width to the pixel (browser devtools).
- [ ] A loading button that had focus before `loading` became true is still `document.activeElement` afterwards.

Blanket:
- [ ] Typed props exactly as under Props / API; no `any`, `@ts-ignore` or `@ts-expect-error` in non-test files.
- [ ] Uses tokens: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' Button.module.css` prints nothing; every colour, spacing, radius, font-size and shadow declaration is a `var(--bk-*)`; only the colour pairs listed under Behaviour are used.
- [ ] Visible focus: in Storybook, tabbing to the button in each variant shows the `--bk-focus-ring` ring; the CSS has the `:focus-visible` rule from Conventions.
- [ ] Keyboard only: in `SubmitInForm`, the form can be filled and submitted without a pointer.
- [ ] Every story listed under Stories required exists under `Components/Button`.
- [ ] `npm run test:a11y` lists every Button story with no axe violations, and the Storybook Accessibility panel shows no violations (including colour contrast) for each story.
- [ ] `Button` and its types are importable from `@budget-kit/ui`.
- [ ] `npm run check` passes.

## Assumptions
- Default `type` is `'button'` (not the HTML default `submit`), so a Button never submits a form by accident.
- Loading uses `aria-disabled` rather than `disabled` so keyboard focus is not lost when a submit button starts loading.
- "Keeps width" means identical width between rest and loading for the same label and size.
- No icon-only, link (`href`) or full-width variants; the spec lists none.

## Out of scope
- Other components, including a standalone Spinner export.
- Anything in `apps/web`.
- Editing `tokens.css` or `tokens.pairs.ts` (task 00 owns them; if a pair is missing, append it at the end of the array and name it in your report).
- New dependencies: report the need instead of installing.
