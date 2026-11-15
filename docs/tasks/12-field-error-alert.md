# 12: Announce field errors

Make validation errors on TextField, Select and MoneyField announced to screen readers when they appear.

Today the error is a plain `<p id="…-error">` linked with `aria-describedby`, so it is read only when the control is focused. MoneyField raises its error on blur, after focus has left the control, so nothing is announced at all (WCAG 3.3.1, 4.1.3).

**Depends on**: none (library follow-up, runs before any app screen)

**Files**
- `packages/ui/src/Field/Field.tsx`
- the `meta` docs in `packages/ui/src/TextField/TextField.stories.tsx`, `packages/ui/src/Select/Select.stories.tsx`, `packages/ui/src/MoneyField/MoneyField.stories.tsx` (the "Known limitations" bullet about errors only)
- tests: `Field` has none of its own; QA adds assertions to `TextField.test.tsx`, `Select.test.tsx` and `MoneyField.test.tsx`

## Behaviour
- When `error` is a non-empty string, `Field` renders the error `<p>` with `role="alert"` (keeping its `id`, `data-part="error"` and its place in `aria-describedby`). When `error` is empty or undefined, no error element exists, as today. The hint element has no role.
- The error text is the only content of the alert; no wrapper, no prefix such as "Error:".
- No change to props, ids, DOM order, `aria-invalid`, `aria-describedby` or visual styling.
- Update the one "Known limitations" bullet in the three story docs that says errors are not announced when they appear: replace it with "Errors are announced when they appear (`role="alert"`) and are also linked with `aria-describedby` and `aria-invalid`, so they are read again when the control is focused." Change nothing else in the docs.

## Acceptance criteria
- [ ] TextField, Select and MoneyField each: with `error="Pick one"` (or the field's own parse error), `getByRole('alert')` exists, has exactly that text, and is the element the control's `aria-describedby` points at.
- [ ] With no error or `error=""`, `queryByRole('alert')` is `null`, and `aria-describedby` and `aria-invalid` behave as before (existing tests still pass unchanged).
- [ ] MoneyField: typing `abc` and tabbing away makes an alert with "Enter an amount like 12.50" appear (it did not exist before the blur); clearing and typing `5` removes the alert; `-5` blur shows "Amount can't be negative" as the alert.
- [ ] The hint element has no `role`; there is at most one alert per field.
- [ ] A test fails on the pre-change `Field.tsx` (QA explains how they know, using `git show` on the previous commit).
- [ ] The three story docs say errors are announced; the old "not announced" bullet is gone (grep).
- [ ] `npm run test:a11y` passes for every story (axe must not flag the alert role).
- [ ] `npm run check` passes.

## Manual browser / screen-reader checks (the lead does these)
- In Storybook `MoneyField/WithHint`: typing `abc` and tabbing away exposes an element with role `alert` in the accessibility tree; with VoiceOver or NVDA the message is spoken when it appears.

## Out of scope
- A live region around the hint, changes to MoneyField behaviour or messages, the currency symbol, any app code.
