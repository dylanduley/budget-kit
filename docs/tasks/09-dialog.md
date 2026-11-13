# 09: Dialog

A modal with a title, body and actions that traps focus, closes on Esc or its close button, and makes the page behind it inert.

**Depends on**: 01 (the close button is a `Button`; stories use `Button` as trigger and actions)

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
- `packages/ui/src/Dialog/Dialog.tsx` (starts with `'use client';`: effects, refs, handlers)
- `packages/ui/src/Dialog/Dialog.module.css`
- `packages/ui/src/Dialog/Dialog.stories.tsx`
- `packages/ui/src/Dialog/Dialog.test.tsx` (QA)
- `packages/ui/src/index.ts`: add `export { Dialog, type DialogProps } from './Dialog/Dialog';`
- Read-only: `packages/ui/src/Button/Button.tsx` (import `Button`; do not modify)

## Props / API
```ts
export interface DialogProps {
  open: boolean;
  onClose: () => void;                               // asked to close: Esc or the close button
  title: string;
  children: ReactNode;                               // body
  actions?: ReactNode;                               // footer, e.g. Cancel / Save Buttons
  closeLabel?: string;                               // accessible name of the close button; default 'Close'
  initialFocusRef?: RefObject<HTMLElement | null>;   // focused on open instead of the dialog itself
  className?: string;                                // appended on the dialog panel
}
```
Controlled: the consumer owns `open` and renders the trigger (normally a `Button`). `onClose` only requests closing; the dialog stays open until `open` becomes `false`.

## Behaviour
- `open={false}`: renders nothing and touches no DOM outside itself (safe during server render).
- `open={true}`: renders through `createPortal` into a container `<div data-bk-dialog-root>` appended to `document.body` (removed on close). Inside it: a backdrop `<div data-part="backdrop">` (`--bk-color-overlay`, covers the viewport) and the panel `<div role="dialog" aria-modal="true" aria-labelledby={titleId} tabindex="-1">`.
- Panel content in DOM order: header with the title `<h2 id={titleId}>` and the close button; body `<div data-part="body">` with `children`; footer `<div data-part="actions">` (only if `actions` is set).
- Close button: `<Button variant="ghost" size="sm" aria-label={closeLabel}>` whose visible content is `×` in an `aria-hidden="true"` span.
- Uses a custom implementation, **not** native `<dialog>.showModal()` (jsdom, used by the test suite, does not implement it).
- Focus:
  - on open, the element focused at that moment is remembered as the trigger; focus then moves to `initialFocusRef.current` if set, otherwise to the panel itself;
  - Tab and Shift+Tab cycle through the tabbable elements inside the panel in DOM order: Tab on the last goes to the first; Shift+Tab on the first, or on the panel itself, goes to the last; focus never leaves the panel while open;
  - on close (`open` becomes `false`, or the Dialog unmounts while open), focus returns to the remembered trigger if it is still in the document.
- Closing: pressing Escape anywhere while open calls `onClose` once; activating the close button calls `onClose` once. Clicking the backdrop does **not** call `onClose`.
- Background inert: while open, every direct child of `document.body` except the dialog's own container has the `inert` attribute, and `document.body.style.overflow` is `hidden`. On close or unmount both are restored exactly: elements that already had `inert` before opening keep it, and the previous `overflow` value is put back.
- Layout: panel centred, `max-width` 32rem, `width` 100% minus `--bk-space-4` margins on small screens, `max-height` within the viewport with the body scrolling (`overflow-y: auto`) while header and actions stay visible. Panel `--bk-color-surface`, title and body `--bk-color-text`, radius `--bk-radius-lg`, shadow `--bk-shadow-lg`.
- No open/close animation.

## Stories required
- `Default`: a trigger `Button` opens the Dialog; closed initially.
- `OpenByDefault`: rendered open, with a body paragraph and no actions.
- `WithActions`: open, with `Cancel` (secondary) and `Save` (primary) Buttons in `actions`.
- `ConfirmDestructive`: open, title `Reset month?`, actions `Cancel` and a `danger` Button.
- `InitialFocus`: open, with `initialFocusRef` pointing at a native text `<input>` with a `<label>` in the body.
- `LongContent`: open, body tall enough to scroll.

Stories that render open must set `parameters: { docs: { story: { inline: false, height: '400px' } } }` so an open dialog does not make the Storybook Docs page inert.

## Acceptance criteria
Spec:
- [ ] With `open={false}`, `queryByRole('dialog')` is null and no `[data-bk-dialog-root]` exists in the document.
- [ ] With `open={true}`, `getByRole('dialog', { name: <title> })` finds the panel; it has `aria-modal="true"`; the title is a level-2 heading; body and actions content are rendered inside it; without `actions` there is no `[data-part="actions"]`.
- [ ] Opens from a trigger and focus moves in on open: clicking a trigger button that sets `open` to `true` makes the dialog panel `document.activeElement`; with `initialFocusRef` set, that element is `document.activeElement` instead.
- [ ] Focus is trapped: with the close button and two action buttons, pressing Tab from the panel visits close → first action → second action → close; Shift+Tab from the close button goes to the second action; after 10 consecutive Tabs `document.activeElement` is still inside the panel.
- [ ] Focus returns to the trigger on close: after opening from a trigger and then closing by Escape, by the close button, or by the parent setting `open={false}`, the trigger is `document.activeElement`. Unmounting the Dialog while open also returns focus to the trigger.
- [ ] Esc closes it: pressing Escape with focus on the panel, and with focus on a button inside it, calls `onClose` exactly once each time.
- [ ] The close button closes it: `getByRole('button', { name: 'Close' })` exists; clicking it, and pressing Enter on it, each call `onClose` exactly once; `closeLabel="Dismiss"` changes its accessible name to `Dismiss`.
- [ ] `onClose` is not called when the backdrop is clicked, nor when Escape is pressed while `open={false}`.
- [ ] Background is inert: with a sibling `<main>` under `document.body`, while open that element has the `inert` attribute and `document.body.style.overflow === 'hidden'`; after close neither is true. A body child that had `inert` before opening still has it after closing. The dialog's own container never has `inert`.
- [ ] In the `Default` story in Storybook, while the dialog is open the page behind cannot be clicked, scrolled or reached with Tab.
- [ ] In `LongContent` in Storybook at a 375×600 viewport, the body scrolls while the title and close button stay visible, and the panel does not overflow the viewport.

Blanket:
- [ ] Typed props exactly as under Props / API; no `any`, `@ts-ignore` or `@ts-expect-error` in non-test files; omitting `open`, `onClose`, `title` or `children` is a type error.
- [ ] Uses tokens: `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' Dialog.module.css` prints nothing; the backdrop uses `var(--bk-color-overlay)`; every colour, spacing, radius, font-size and shadow declaration is a `var(--bk-*)` (the `32rem` max-width and `z-index` are the only permitted literals besides `0`, `100%` and viewport units).
- [ ] Visible focus: in Storybook, the close button and action Buttons show the `--bk-focus-ring` ring when tabbed to; the focused panel itself may show no ring.
- [ ] Keyboard only: in `Default`, the dialog can be opened (Enter on the trigger), tabbed through, and closed (Escape) without a pointer.
- [ ] Every story listed under Stories required exists under `Components/Dialog`.
- [ ] `npm run test:a11y` lists every Dialog story with no axe violations, and the Storybook Accessibility panel shows no violations (including colour contrast) for each story. After the a11y test file finishes, no element in `document.body` is left with `inert` and `overflow` is restored (cleanup on unmount works).
- [ ] `Dialog` and `DialogProps` are importable from `@budget-kit/ui`.
- [ ] `npm run check` passes.

## Assumptions
- "Opens from a trigger" means a controlled `open` prop with a consumer-owned trigger; "the trigger" is whatever element had focus when `open` became `true`.
- Clicking the backdrop does not close the dialog (the spec lists only Esc and the close button; this also protects half-filled forms).
- Initial focus goes to the panel (so the title is announced) unless `initialFocusRef` is given.
- A custom modal is used instead of native `<dialog>` because jsdom cannot test `showModal()`.
- The dialog container is a direct child of `document.body`, and the app's content lives in other body children, so marking siblings `inert` covers the whole background.
- One dialog at a time; nested or stacked dialogs are unsupported.
- The close button is always shown; it is an icon-style `×` with an accessible name.

## Out of scope
- Changing `Button`: if it lacks something, report it.
- Non-modal popovers, drawers, toasts, animations, nested dialogs.
- Anything in `apps/web`.
- Editing `tokens.css` or `tokens.pairs.ts` (task 00 owns them; if a pair is missing, append it at the end of the array and name it in your report).
- New dependencies (including focus-trap libraries): report the need instead of installing.
