# 04: Select

A native `<select>` styled to match TextField, with the same label, hint and error.

**Depends on**: 02 (uses the internal `Field` wrapper and `describedBy` created there)

**Parallel group**: B

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
- `packages/ui/src/Select/Select.tsx` (no `'use client'`; `useId` only)
- `packages/ui/src/Select/Select.module.css`
- `packages/ui/src/Select/Select.stories.tsx`
- `packages/ui/src/Select/Select.test.tsx` (QA)
- `packages/ui/src/index.ts`: add `export { Select, type SelectOption, type SelectProps } from './Select/Select';`
- Read-only: `packages/ui/src/Field/Field.tsx` (import `Field` and `describedBy`; do not modify)

## Props / API
```ts
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<ComponentPropsWithRef<'select'>, 'children' | 'multiple' | 'size' | 'aria-describedby' | 'aria-invalid'> {
  label: string;             // required, always visible
  hint?: string;
  error?: string;            // '' and undefined both mean "no error"
  options: SelectOption[];
  placeholder?: string;      // if set, rendered as a first <option value="" disabled>
  // id?: string (inherited) // default: generated with useId
}
```

## Behaviour
- Renders `Field` (label, hint, error: same markup and ids as TextField: `<id>-hint`, `<id>-error`) around one native `<select>` with one `<option>` per entry of `options`, in order. `ref` and remaining native props (`value`, `defaultValue`, `onChange`, `name`, `required`, `disabled`, …) go to the `<select>`.
- `aria-describedby` is `describedBy(id, hint, error)` (absent when neither); `aria-invalid="true"` only when `error` is non-empty.
- Styled to match TextField: `appearance: none`; same min-height (`--bk-space-10`), font size, radius, padding, border (`--bk-color-border-strong`, `--bk-color-danger` when invalid), background (`--bk-color-surface`), text (`--bk-color-text`), disabled colours (`--bk-color-text-muted` on `--bk-color-surface-subtle`). A chevron is drawn in CSS with `currentColor` (no image file, no data-URI colour literal), is `pointer-events: none`, and has no DOM text.
- Keyboard: entirely native. No `role`, no `tabindex`, no key handlers, no custom listbox.

## Stories required
`Default`, `WithPlaceholder`, `WithHint`, `WithError`, `WithHintAndError`, `Disabled`, `WithDisabledOption`, `BesideTextField` (a Select next to a TextField, to compare height and border).

## Acceptance criteria
Spec:
- [ ] Fully keyboard usable (native behaviour kept): the control is an `HTMLSelectElement` with no `role`, `tabindex` or `multiple` attribute; `Select.tsx` registers no `onKeyDown`/`onKeyUp` of its own (grep). In Storybook (`Default`), using only the keyboard: Tab focuses it, ArrowDown/ArrowUp change the value, typing an option's first letter jumps to it, and Space or Alt+ArrowDown opens the native list.
- [ ] `userEvent.selectOptions(select, <value>)` calls `onChange` once and the select's value becomes that value.
- [ ] One `<option>` is rendered per `options` entry, in order, with matching `value`, text and `disabled`.
- [ ] `placeholder="Choose a category"` renders a first option with `value=""`, the `disabled` attribute and that text; without `placeholder` no such option exists.
- [ ] Label, hint, error like TextField: `getByLabelText(<label>)` returns the select; clicking the label focuses it; with `error="Pick one"` the select has `aria-invalid="true"` and an accessible description including `Pick one`; with hint and error, `aria-describedby` is exactly `"<id>-error <id>-hint"`; with neither, `aria-describedby` and `aria-invalid` are absent.
- [ ] `disabled` reaches the `<select>`; `ref` receives the `HTMLSelectElement`.
- [ ] In the `BesideTextField` story in Storybook, the select box and the input box have the same height and border colour (devtools).
- [ ] `Field.tsx` and `Field.module.css` are unchanged by this task (`git diff`).

Blanket:
- [ ] Typed props exactly as under Props / API; no `any`, `@ts-ignore` or `@ts-expect-error` in non-test files; omitting `label` or `options` is a type error.
- [ ] Uses tokens: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' Select.module.css` prints nothing; every colour, spacing, radius, font-size and shadow declaration is a `var(--bk-*)`; only the colours listed under Behaviour are used.
- [ ] Visible focus: in Storybook, tabbing to the select shows the `--bk-focus-ring` ring in the default and error stories.
- [ ] Keyboard only: covered by the first spec criterion; a disabled select is skipped by Tab.
- [ ] Every story listed under Stories required exists under `Components/Select`.
- [ ] `npm run test:a11y` lists every Select story with no axe violations, and the Storybook Accessibility panel shows no violations (including colour contrast) for each story.
- [ ] `Select`, `SelectOption` and `SelectProps` are importable from `@budget-kit/ui`.
- [ ] `npm run check` passes.

## Assumptions
- Options are passed as data (`options`), not as `<option>` children, so the app cannot style options itself.
- Single-select only; option groups are not supported.
- The placeholder option is disabled so it cannot be re-selected once a value is chosen.
- The open option list keeps the browser's native look; only the closed control is styled.

## Out of scope
- Custom listbox/combobox, multi-select, search.
- Changing `Field` or TextField: if they lack something, report it.
- Anything in `apps/web`.
- Editing `tokens.css` or `tokens.pairs.ts` (task 00 owns them; if a pair is missing, append it at the end of the array and name it in your report).
- New dependencies: report the need instead of installing.
