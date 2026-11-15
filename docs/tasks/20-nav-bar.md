# 20: NavBar

A site navigation: a `nav` landmark with a horizontal list of links, the current page marked with `aria-current="page"` and visibly (not by colour alone). Works with any router: the app passes Next.js's `Link` as the link component; stories use plain `<a>`.

**Depends on**: none (00 and 01–13 are merged)

**Parallel group**: Redesign A (with library 21 and app 20)

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
- `packages/ui/src/NavBar/NavBar.tsx` (no `'use client'`: no state, effects or handlers of its own)
- `packages/ui/src/NavBar/NavBar.module.css`
- `packages/ui/src/NavBar/NavBar.stories.tsx`
- `packages/ui/src/NavBar/NavBar.test.tsx` (QA)
- `packages/ui/src/index.ts`: append exactly `export { NavBar, type NavBarItem, type NavBarLinkProps, type NavBarProps } from './NavBar/NavBar';` as the last line
- `packages/ui/src/tokens.pairs.ts`: only if a colour pair you use is missing; append at the end of the array and name it in the report

## Props / API
```ts
export interface NavBarItem {
  href: string;
  label: string;
}

// What the link component receives. A plain <a> satisfies it; so does next/link's Link.
export interface NavBarLinkProps {
  href: string;
  className: string;
  'aria-current'?: 'page';
  'data-current'?: 'true';
  children: ReactNode;
}

export interface NavBarProps extends Omit<ComponentPropsWithRef<'nav'>, 'children' | 'aria-label'> {
  label: string;                               // accessible name of the nav landmark, e.g. 'Main'
  items: readonly NavBarItem[];
  currentHref: string | null;                  // the item whose href === currentHref is current; null: none
  linkComponent?: ComponentType<NavBarLinkProps>; // default: a plain <a>
}

export function NavBar(props: NavBarProps): ReactElement;
```

## Behaviour
- Renders `<nav aria-label={label}>` → `<ul role="list">` → one `<li>` per item → one link per item, in `items` order. (`role="list"` because VoiceOver drops list semantics when `list-style` is none.)
- The link is `linkComponent` when given, else `<a>`. It receives `href`, `className` (the module class), and for the current item `aria-current="page"` and `data-current="true"`; other items get neither attribute (not `aria-current="false"`).
- Matching is exact string equality on `href` (no prefix matching); at most one item is current. If two items have the same `href`, both are marked (the caller should not do that; no warning).
- Layout: items in a row with `--bk-space-1` gap, wrapping onto a second line when they do not fit (no horizontal scroll at 320px with four short labels). Each link is at least `--bk-space-10` tall (40px, matching Button `md`) with `--bk-space-2` `--bk-space-3` padding, `--bk-radius-md`, `--bk-font-size-md`, `--bk-font-weight-medium`, `line-height: var(--bk-line-height-tight)`, no underline, `overflow-wrap: anywhere`.
- Colours: links `--bk-color-text` on the page background (`--bk-color-bg`); hover background `--bk-color-surface-subtle`. Current link: text `--bk-color-primary-text`, background `--bk-color-primary-subtle`, **plus** a 2px bottom border in `--bk-color-primary` and `--bk-font-weight-semibold`, so the current page is identifiable without colour (border and weight). Non-current links have a 2px transparent bottom border so heights match.
- Focus: the Conventions focus ring on `:focus-visible`.
- `className` is appended to the `nav`; other native props go to the `nav`.

## Stories required
`Default` (four items `Overview` `/`, `Spending` `/spending`, `Plan` `/plan`, `History` `/history`, current `/`), `CurrentLast` (current `/history`), `NoCurrent` (`currentHref: null`), `Narrow` (the Default items in a 320px-wide container, for wrapping), `LongLabel` (one 60-character unbroken label, for wrapping), `CustomLink` (a `linkComponent` that renders an `<a>` with `data-router="custom"`, to show the hook).

## Acceptance criteria
- [ ] `getByRole('navigation', { name: 'Main' })` finds the nav for `label="Main"`; it contains a `list` with four `listitem`s and four `link`s named `Overview`, `Spending`, `Plan`, `History` in that order, with `href`s `/`, `/spending`, `/plan`, `/history`.
- [ ] With `currentHref="/plan"`: the `Plan` link has `aria-current="page"` and `data-current="true"`; the other three have no `aria-current` attribute and no `data-current` attribute. With `currentHref={null}` and with `currentHref="/plans"` no link has either attribute.
- [ ] With `linkComponent={Custom}`, `Custom` is rendered once per item and receives exactly `href`, `className`, `children`, and for the current item `aria-current` and `data-current` (QA asserts with a spy component); no `<a>` is rendered by NavBar itself in that case.
- [ ] Type check: in a QA type-only test file (or a `// type test` block in `NavBar.test.tsx`), a component declared as `(props: { href: string; className?: string; 'aria-current'?: 'page' | 'step' | boolean; children?: ReactNode; prefetch?: boolean }) => ReactElement` (the shape of `next/link`) is accepted by `linkComponent` without a cast. The library does not import `next`.
- [ ] `className="x"` is on the `nav` together with the module class; `data-testid` passed in reaches the `nav`.
- [ ] Keyboard: Tab moves through the four links in order; each shows the focus ring in Storybook.
- [ ] CSS source: `NavBar.module.css` selects the current link with `[data-current='true']` and that rule sets a bottom border and font weight in addition to colour (grep); every colour, spacing, radius, font-size and shadow is a `var(--bk-*)` (`grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' NavBar.module.css` prints nothing).
- [ ] Every story listed under Stories required exists under `Components/NavBar`; `npm run test:a11y` lists each with no axe violations; the Storybook Accessibility panel (with contrast) shows none.
- [ ] `NavBar` and its types are importable from `@budget-kit/ui`; `index.ts` changed only by the one appended line.
- [ ] No `any`, `@ts-ignore` or `@ts-expect-error` in non-test files; `npm run check` passes.

## Manual browser checks
- `Narrow` at 320px: items wrap, no horizontal scroll, each link at least 40px tall.
- `Default` in greyscale emulation: the current item is still identifiable (border and weight).
- `LongLabel`: the long label wraps inside its item.

## Assumptions
- Named `NavBar` (not `Nav` or `Tabs`): it is a set of links between pages, not an ARIA tablist, so it must not use `role="tab"`.
- No icons, no mobile "hamburger" menu: four short labels fit at 320px when wrapping.
- Exact `href` matching is enough for the app (four flat routes).

## Out of scope
- Any app code, `next` as a dependency, a standalone link component, sub-menus, active-route detection inside the library.
