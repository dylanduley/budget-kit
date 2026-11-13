# 06: Card

A titled surface with an optional description, an optional action slot, and a body.

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
- `packages/ui/src/Card/Card.tsx` (no `'use client'`; `useId` only)
- `packages/ui/src/Card/Card.module.css`
- `packages/ui/src/Card/Card.stories.tsx`
- `packages/ui/src/Card/Card.test.tsx` (QA)
- `packages/ui/src/index.ts`: add `export { Card, type CardProps } from './Card/Card';`

## Props / API
```ts
export interface CardProps extends Omit<ComponentPropsWithRef<'section'>, 'title'> {
  title: string;
  description?: string;
  action?: ReactNode;          // e.g. a Button; placed at the end of the header
  headingLevel?: 2 | 3 | 4;    // default 2
  children: ReactNode;         // body
}
```

## Behaviour
- Renders `<section aria-labelledby={titleId}>` containing, in DOM order: a header with the title as `<h2>`/`<h3>`/`<h4>` (per `headingLevel`, `id={titleId}` from `useId`), the description `<p data-part="description">` (only if set), the action wrapper `<div data-part="action">` (only if `action` is set); then the body `<div data-part="body">` with `children`.
- Layout: title and description stacked on the left, action on the right of the header; when the header is too narrow the action wraps below the title instead of overflowing.
- Colours: background `--bk-color-surface`; title `--bk-color-text`; description `--bk-color-text-muted`; 1px border `--bk-color-border`; shadow `--bk-shadow-sm`; radius `--bk-radius-lg`; padding from the spacing scale.
- The Card itself is not interactive and adds no tab stop; focusable content in `action` or `children` is reached in DOM order (action before body).

## Stories required
`Default` (title and body), `WithDescription`, `WithAction`, `WithDescriptionAndAction`, `HeadingLevel3`, `NarrowWidth` (in a 280px-wide container, with description and action).
Action stories use a plain native `<button type="button">` as the slot content (Button, task 01, may not be merged yet); do not style it.

## Acceptance criteria
Spec:
- [ ] Title: `getByRole('heading', { level: 2, name: <title> })` finds it by default; `headingLevel={3}` and `{4}` render level 3 and 4.
- [ ] The root is a `<section>` exposed as `getByRole('region', { name: <title> })`.
- [ ] Optional description: with `description` its text is rendered in `[data-part="description"]`; without it that element is absent.
- [ ] Optional action slot: with `action={<button type="button">Edit</button>}` the button is rendered inside `[data-part="action"]`; without `action` that element is absent.
- [ ] Body: `children` are rendered inside `[data-part="body"]`.
- [ ] DOM order is title, description, action, body: with an action button and a button in the body, the first Tab focuses the action and the second the body button.
- [ ] Two Cards on one page have different title ids.
- [ ] `className` is appended and other native props (e.g. `id`) reach the `<section>`.
- [ ] In the `NarrowWidth` story in Storybook, nothing overflows the 280px container horizontally.

Blanket:
- [ ] Typed props exactly as under Props / API; no `any`, `@ts-ignore` or `@ts-expect-error` in non-test files; omitting `title` or `children` is a type error.
- [ ] Uses tokens: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' Card.module.css` prints nothing; every colour, spacing, radius, font-size and shadow declaration is a `var(--bk-*)`; only the colours listed under Behaviour are used.
- [ ] Visible focus / keyboard only: the Card adds no tab stop of its own, and does not clip the focus ring of a focused element in the action slot (check `WithAction` in Storybook).
- [ ] Every story listed under Stories required exists under `Components/Card`.
- [ ] `npm run test:a11y` lists every Card story with no axe violations, and the Storybook Accessibility panel shows no violations (including colour contrast) for each story.
- [ ] `Card` and `CardProps` are importable from `@budget-kit/ui`.
- [ ] `npm run check` passes.

## Assumptions
- A Card is a named `<section>` (a region landmark labelled by its title). If the dashboard ends up with too many landmarks, this becomes a `<div>`.
- `title` and `description` are plain strings; the heading level is the consumer's choice so page outlines stay correct.
- No footer, no clickable/whole-card-link variant, one padding size.

## Out of scope
- Importing Button or any other component, including in stories.
- Anything in `apps/web`.
- Editing `tokens.css` or `tokens.pairs.ts` (task 00 owns them; if a pair is missing, append it at the end of the array and name it in your report).
- New dependencies: report the need instead of installing.
