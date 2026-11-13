# 02: TextField

A labelled text or number input with hint, error and optional prefix, plus the internal `Field` wrapper that Select (04) reuses.

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
- `packages/ui/src/Field/Field.tsx` and `packages/ui/src/Field/Field.module.css`: internal wrapper; no stories, **not** exported from `index.ts` (no `'use client'`)
- `packages/ui/src/TextField/TextField.tsx` (no `'use client'`; `useId` only)
- `packages/ui/src/TextField/TextField.module.css`
- `packages/ui/src/TextField/TextField.stories.tsx`
- `packages/ui/src/TextField/TextField.test.tsx` (QA)
- `packages/ui/src/index.ts`: add `export { TextField, type TextFieldProps } from './TextField/TextField';`

## Props / API
```ts
// Field/Field.tsx (internal)
export interface FieldProps {
  id: string;            // id of the control the label points at
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;   // the control
}
export function Field(props: FieldProps): ReactElement;
/** ids the control must reference: "<id>-error <id>-hint", only the parts that are rendered; undefined if neither. */
export function describedBy(id: string, hint?: string, error?: string): string | undefined;

// TextField/TextField.tsx
export interface TextFieldProps
  extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'prefix' | 'aria-describedby' | 'aria-invalid'> {
  label: string;               // required, always visible
  hint?: string;
  error?: string;              // '' and undefined both mean "no error"
  prefix?: string;             // short decorative text inside the box, e.g. '$'
  type?: 'text' | 'number';    // default 'text'
  // id?: string  (inherited)  // default: generated with useId
}
```

## Behaviour
- `Field` renders, in DOM order: root `<div data-part="field">` (gets `className`, and `data-invalid="true"` when there is an error) › `<label for={id}>` › `children` › hint `<p id="{id}-hint" data-part="hint">` (only if `hint`) › error `<p id="{id}-error" data-part="error">` (only if `error` is non-empty).
- `TextField` renders `Field` around a box containing the optional prefix `<span data-part="prefix" aria-hidden="true">` and one native `<input>`. `ref` and remaining native props (`value`, `onChange`, `name`, `required`, `disabled`, `placeholder`, `inputMode`, …) go to the `<input>`.
- `aria-describedby` on the input is `describedBy(id, hint, error)`; the attribute is absent when there is neither hint nor error.
- `aria-invalid="true"` is set only when `error` is non-empty; otherwise the attribute is absent.
- Colours: label and input text `--bk-color-text`; hint and placeholder `--bk-color-text-muted`; error text `--bk-color-danger-text`; input background `--bk-color-surface`; 1px border `--bk-color-border-strong`, `--bk-color-danger` when invalid; disabled input `--bk-color-text-muted` on `--bk-color-surface-subtle`. The field must be legible on both `--bk-color-bg` and `--bk-color-surface`.
- Input min-height `--bk-space-10`; font size `--bk-font-size-md` (avoids iOS zoom).
- The error message is text, so the invalid state is never colour-only.
- Keyboard: native input behaviour; nothing intercepted.

## Stories required
`Default`, `WithHint`, `WithError`, `WithHintAndError`, `WithPrefix` (prefix `$`), `NumberType`, `Disabled`, `Required`, `OnSurface` (rendered on a `--bk-color-surface` panel).

## Acceptance criteria
Spec:
- [ ] Error is linked with `aria-describedby` and sets `aria-invalid`: with `error="Required"`, the input has `aria-invalid="true"`, its `aria-describedby` contains the id of an element whose text is `Required`, and `toHaveAccessibleDescription` includes `Required`.
- [ ] With `hint` and `error` both set, `aria-describedby` is exactly `"<id>-error <id>-hint"` and both elements exist; with only `hint`, exactly `"<id>-hint"`.
- [ ] With no `error` (undefined or `''`) the input has no `aria-invalid` attribute and no `[data-part="error"]` element is rendered; with neither hint nor error it has no `aria-describedby` attribute.
- [ ] Label click focuses the input: `userEvent.click` on the label text makes the input `document.activeElement`; `getByLabelText(<label>)` returns the input.
- [ ] Two TextFields rendered without `id` get different ids; a passed `id` is used as given for the input, with `<id>-hint` / `<id>-error` derived from it.
- [ ] `prefix="$"` renders `$` in an element with `aria-hidden="true"`, and the input's accessible name is still exactly the label.
- [ ] `type` defaults to `text`; `type="number"` renders `<input type="number">`.
- [ ] `value`, `onChange`, `name`, `required`, `disabled` and `placeholder` reach the `<input>`; typing `abc` fires `onChange` three times; `ref` receives the `HTMLInputElement`.
- [ ] `Field` and `describedBy` are not exported from `@budget-kit/ui`.

Blanket:
- [ ] Typed props exactly as under Props / API; no `any`, `@ts-ignore` or `@ts-expect-error` in non-test files; omitting `label` is a type error.
- [ ] Uses tokens: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' TextField.module.css ../Field/Field.module.css` prints nothing; every colour, spacing, radius, font-size and shadow declaration is a `var(--bk-*)`; only the colours listed under Behaviour are used.
- [ ] Visible focus: in Storybook, tabbing into the input shows the `--bk-focus-ring` ring in the default, error and prefix stories.
- [ ] Keyboard only: Tab reaches the input, typing edits it, Tab leaves it; a disabled input is skipped.
- [ ] Every story listed under Stories required exists under `Components/TextField`.
- [ ] `npm run test:a11y` lists every TextField story with no axe violations, and the Storybook Accessibility panel shows no violations (including colour contrast) for each story.
- [ ] `TextField` and `TextFieldProps` are importable from `@budget-kit/ui`.
- [ ] `npm run check` passes.

## Assumptions
- "Label (required)" means the `label` prop is mandatory, not that a required-field marker is shown. Native `required` passes through with no added visual indicator.
- `label`, `hint` and `error` are plain strings.
- The prefix is decorative (`aria-hidden`); the label must carry the unit if it matters to screen-reader users.
- The error is announced through `aria-describedby` when the input has focus; there is no live region (`role="alert"`).
- The shared label/hint/error markup lives in an internal `Field` so Select (04) matches TextField exactly; it is not a public component.
- Consumers may not pass their own `aria-describedby` / `aria-invalid`; the component owns them.

## Out of scope
- MoneyField (03), Select (04), textarea, date or password types, input masks.
- Anything in `apps/web`.
- Editing `tokens.css` or `tokens.pairs.ts` (task 00 owns them; if a pair is missing, append it at the end of the array and name it in your report).
- New dependencies: report the need instead of installing.
