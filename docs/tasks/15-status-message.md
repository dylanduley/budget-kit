# 15: StatusMessage

A polite live region for status messages that are not errors ("Expense added", "Category removed"), so screen-reader users hear about changes they cannot see (WCAG 4.1.3 Status Messages). The region stays in the DOM and only its text changes, which is what makes screen readers announce it.

The app may not write `role="status"` or `aria-live` itself (app conventions); it needs a library component for this. App task 10 wires it in.

**Depends on**: none

**Parallel group**: F1 (with 14)

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
- `packages/ui/src/StatusMessage/StatusMessage.tsx` (no `'use client'`: no state, effects, refs or handlers of its own)
- `packages/ui/src/StatusMessage/StatusMessage.module.css`
- `packages/ui/src/StatusMessage/StatusMessage.stories.tsx` (the stories hold their own `useState` and Buttons; that is fine in a stories file)
- `packages/ui/src/StatusMessage/StatusMessage.test.tsx` (QA)
- `packages/ui/src/text-wrapping.test.ts` (QA): add `['StatusMessage/StatusMessage.module.css', ['.message']]` to `MUST_WRAP`
- `packages/ui/src/index.ts`: add, after the `Table` line,
  `export { StatusMessage, type StatusMessageProps } from './StatusMessage/StatusMessage';`
- No change to tokens: `--bk-color-text` on `--bk-color-bg`, `--bk-color-surface` and `--bk-color-surface-subtle` are already listed pairs.

## Props / API
```ts
export interface StatusMessageProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'role' | 'aria-live' | 'aria-atomic'> {
  /** The text to announce. '' renders the region with nothing in it. */
  message: string;
  /** Change this (for example a counter) to announce the same text again. */
  announceKey?: string | number;
  /** Hide the text visually but keep it for assistive technology. Default false. */
  visuallyHidden?: boolean;
}
```
Name chosen to match WCAG's term "status message"; it is not for errors (errors use a field's `error` prop, which the library already announces with `role="alert"`).

## Behaviour
- Renders one root `<div role="status" aria-live="polite" aria-atomic="true" data-part="status-message">` (`aria-live` and `aria-atomic` repeat what `role="status"` implies, because some screen-reader and browser pairs ignore the implicit values). `data-visually-hidden="true"` is present only when `visuallyHidden` is true. `className` is appended; other native props and `ref` go to the root.
- When `message` is non-empty the root contains exactly one child, `<span data-part="status-text">{message}</span>`, rendered with React `key={announceKey}`. When `message` is `''` the root has no children.
- The root element is never remounted by a change of `message` or `announceKey`: the same DOM node stays in the document while its content changes. That is the contract that makes the change announced.
- Re-announcing identical text: if `announceKey` changes while `message` stays the same, the `status-text` span is replaced by a new span with the same text (a DOM removal plus addition, which screen readers treat as new content). If neither changes, nothing in the DOM changes.
- No timers, effects or state: what is in the DOM always equals the current props (so it works with server rendering and is synchronous in tests).
- Not focusable; adds no tab stop; no `aria-label`.
- **Visible** (default): the root carries the class `.message`: text in `--bk-color-text`, `--bk-font-size-md`, `margin: 0`, `overflow-wrap: anywhere` (long text wraps; listed in `text-wrapping.test.ts`). No border, background or padding, so it looks like a plain paragraph on `--bk-color-bg` or `--bk-color-surface`.
- **Visually hidden** (`data-visually-hidden="true"`): a rule `.message[data-visually-hidden='true']` applies the clip technique to the root, the same declarations as `.toneText` in `Stat.module.css` (`position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;`), not `display: none`, `visibility: hidden` or the `hidden` attribute (which would stop the announcement). Being absolutely positioned, it takes no space in a flex or grid parent.

### Usage rules (go in the story docs)
- Render the region **before** the message changes, and keep it rendered: put it in the page with `message=""` and set the text later. Text that is present when the region first appears is usually not announced.
- Do not put it inside a container that is `inert`, `hidden` or `aria-hidden` when the text changes (for example behind an open Dialog); change the text after the Dialog has closed.
- Polite: the announcement waits until the screen reader is idle and can be dropped if several messages arrive at once. One region per area of the page, one short sentence per change.
- Not for errors. Field errors already announce through the field's `error` prop.

## Stories required
All under `Components/StatusMessage`, with a `meta` docs description that states the usage rules above and a **Known limitations** list: "jsdom tests can check the region and its text, not that a screen reader speaks it; check announcements by hand with VoiceOver or NVDA", "Polite messages can be delayed or dropped if many arrive together", "Text present when the region first renders is usually not announced".
- `Visible`: `message: 'Your changes were saved.'`.
- `VisuallyHidden`: a `Button` `Add item` and a visible paragraph `Items: {n}`; each click increments `n` and sets the hidden region to `Item {n} added.` (the region starts empty).
- `RepeatedMessage`: a `Button` `Save`; each click sets `message: 'Saved.'` and increments `announceKey`, visibly (not hidden), so a reviewer can hear the same text announced on every click.
- `Empty`: `message: ''` (the region exists with no content; axe must pass).

## Acceptance criteria
Spec (from the follow-up request: a small polite live region that is in the DOM before its text changes):
- [ ] Render `<StatusMessage message="" />`: `getByRole('status')` exists, has `aria-live="polite"`, `aria-atomic="true"`, `data-part="status-message"`, no `data-visually-hidden`, and empty text content with no child elements.
- [ ] Same node, new text: rerender with `message="Expense added."`; `getByRole('status')` is the **same element** (`toBe` the one captured before) and its text content is exactly `Expense added.`, inside one `[data-part="status-text"]` span. Rerender with `message="Expense deleted."`: still the same root element, text exactly `Expense deleted.`.
- [ ] Re-announce: with `message="Saved."` and `announceKey={1}`, capture the `status-text` span; rerender with `announceKey={2}` and the same message: the span is a **different** node with the same text, and the root is the same node. Rerender again with `announceKey={2}`: the span is the same node as before (nothing changed).
- [ ] Empty again: rerender with `message=""`: the root is still the same element and has no child elements.
- [ ] `visuallyHidden`: the root has `data-visually-hidden="true"`; the text is still in the DOM and still exposed (`getByRole('status')` has the text; it is not `hidden`, `aria-hidden` or `display: none` by attribute); in `StatusMessage.module.css` the rule for the hidden state declares `clip-path: inset(50%)` and `position: absolute` and contains neither `display: none` nor `visibility: hidden` (read the CSS file).
- [ ] `className` is appended on the root and `id`, `data-*` and `ref` reach the root `<div>`.
- [ ] Not focusable: the root and span have no `tabindex`; tabbing through `VisuallyHidden` in Storybook lands only on the `Add item` button.
- [ ] `StatusMessage.tsx` contains no `setTimeout`, `useEffect`, `useState` or `'use client'` (grep).
- [ ] Long text wraps: `text-wrapping.test.ts` includes `.message` and passes.

Blanket:
- [ ] Typed props exactly as under Props / API; `role`, `aria-live`, `aria-atomic` and `children` cannot be passed (type error); no `any`, `@ts-ignore` or `@ts-expect-error` in non-test files.
- [ ] Uses tokens: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' StatusMessage.module.css` prints nothing; the only colour is `--bk-color-text`; the only non-token lengths are the clip technique's `1px`, `-1px` and `0`, as in `Stat.module.css`.
- [ ] Every story listed under Stories required exists under `Components/StatusMessage`.
- [ ] `npm run test:a11y` lists every StatusMessage story with no axe violations, and the Storybook Accessibility panel shows none (including colour contrast for `Visible` and `RepeatedMessage`).
- [ ] `StatusMessage` and `StatusMessageProps` are importable from `@budget-kit/ui`; `src/index.ts` gained exactly the one line under Files.
- [ ] `npm run check` passes.

## How this is tested, and what tests cannot show
jsdom can prove the contract the announcement depends on: the region has `role="status"` / `aria-live="polite"`, it is the same node before and after the text changes, its text equals the message, and a new `announceKey` produces a new text node. jsdom has no accessibility tree events and no screen reader, so **no automated test here proves anything is spoken**. That is the manual check below, done by the lead or the a11y-reviewer.

## Manual screen-reader checks (Storybook, the lead or a11y-reviewer)
- VoiceOver + Safari (macOS) and NVDA + Firefox or Chrome (Windows), in `VisuallyHidden`: pressing `Add item` with the keyboard is followed by `Item 1 added.`, then `Item 2 added.` on the next press, each spoken once, after the button's own feedback and without moving focus.
- In `RepeatedMessage`: every press of `Save` speaks `Saved.` again (not only the first).
- In `Empty` and on first load of `Visible`: nothing is spoken on page load (text present at mount is not expected to be announced; report it if it is, it is harmless).
- The Accessibility tree in browser devtools shows a `status` node for the region in every story, including `Empty`.

## Assumptions
- One small component with a `message` string, not an imperative `announce()` API or a context provider; consumers keep one region per area of the page.
- Visible by default, with `visuallyHidden` as an opt-in, so a reviewer reading the JSX sees when a message is hidden.
- Re-announcing identical text is done by re-keying the inner span (`announceKey`), not by timers or by appending invisible characters, so the behaviour is synchronous and testable.
- `aria-atomic="true"`: the whole message is read, never a fragment.
- Fixed behaviour, no `politeness="assertive"` option: assertive announcements are for errors, which already have `role="alert"` through `Field`.

## Out of scope
- A toast or snackbar (no timeout, no dismiss button, no visual container).
- An assertive or alert variant.
- Wiring it into the app (app task 10).
- Editing `tokens.css` or `tokens.pairs.ts`.
- New dependencies: report the need instead of installing.
