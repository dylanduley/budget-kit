# 05: Badge

A small text label with a tone: neutral, success, warning or danger.

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
- `packages/ui/src/Badge/Badge.tsx` (no `'use client'`)
- `packages/ui/src/Badge/Badge.module.css`
- `packages/ui/src/Badge/Badge.stories.tsx`
- `packages/ui/src/Badge/Badge.test.tsx` (QA)
- `packages/ui/src/index.ts`: add `export { Badge, type BadgeProps, type BadgeVariant } from './Badge/Badge';`

## Props / API
```ts
export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends Omit<ComponentPropsWithRef<'span'>, 'children'> {
  variant?: BadgeVariant;   // default 'neutral'
  children: string;         // required visible text
}
```

## Behaviour
- Renders one `<span data-variant="…">` containing the text. No icon, no role, not focusable, no live region.
- Colours: neutral `--bk-color-text` on `--bk-color-surface-subtle`; success `--bk-color-success-text` on `--bk-color-success-bg`; warning `--bk-color-warning-text` on `--bk-color-warning-bg`; danger `--bk-color-danger-text` on `--bk-color-danger-bg`.
- Font size `--bk-font-size-xs`, weight `--bk-font-weight-medium`, radius `--bk-radius-full`, `white-space: nowrap`.
- The text carries the meaning; colour only reinforces it.

## Stories required
`Neutral`, `Success`, `Warning`, `Danger`, `AllVariants` (all four side by side, with realistic text such as `On track`, `Almost spent`, `Over budget`).

## Acceptance criteria
Spec:
- [ ] Each `variant` value is reflected in `data-variant`; with no `variant`, `data-variant="neutral"`.
- [ ] Text required (no colour-only meaning): `<Badge>Over budget</Badge>` renders the visible text `Over budget`; `<Badge />` and `<Badge>{null}</Badge>` are type errors (checked with `// @ts-expect-error` in the test file).
- [ ] The rendered element is a `<span>` with no `role`, `tabindex`, `aria-live` or `aria-label` attribute of its own, and contains no element other than text.
- [ ] `className` is appended and other native props (e.g. `id`, `title`) reach the `<span>`.

Blanket:
- [ ] Typed props exactly as under Props / API; no `any`, `@ts-ignore` or `@ts-expect-error` in non-test files.
- [ ] Uses tokens: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' Badge.module.css` prints nothing; every colour, spacing, radius, font-size and shadow declaration is a `var(--bk-*)`; only the four colour pairs listed under Behaviour are used.
- [ ] Visible focus / keyboard only: the Badge adds no tab stop (tabbing through `AllVariants` in Storybook never lands on a Badge).
- [ ] Every story listed under Stories required exists under `Components/Badge`.
- [ ] `npm run test:a11y` lists every Badge story with no axe violations, and the Storybook Accessibility panel shows no violations (including colour contrast) for each story.
- [ ] `Badge`, `BadgeProps` and `BadgeVariant` are importable from `@budget-kit/ui`.
- [ ] `npm run check` passes.

## Assumptions
- "Text required" is enforced by the type (`children: string`); there is no runtime check for an empty string.
- A Badge is static text, not a status announcement; the app decides whether a change needs announcing.
- One size only; the spec lists none.

## Out of scope
- Icons, dots, counts, removable or clickable badges.
- Other components; anything in `apps/web`.
- Editing `tokens.css` or `tokens.pairs.ts` (task 00 owns them; if a pair is missing, append it at the end of the array and name it in your report).
- New dependencies: report the need instead of installing.
