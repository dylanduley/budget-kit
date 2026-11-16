# 14: MoneyField reports the parse state and can show errors while typing

Lets a consumer tell an empty MoneyField from one holding invalid text, and lets it show the parse error as soon as the text becomes invalid instead of only on blur. Existing callers keep working unchanged.

Why: today `onChange` receives `null` both for empty text and for invalid text (`abc`, `1,2,3`, 13 or more whole digits), so the app cannot tell "the user cleared the amount" from "the user made a typo". The app saves amounts on every keystroke and turns `null` into `0`, so a stray keystroke or a bad paste silently wipes a saved amount (fixed in app task 09, which needs this task). The error is also shown only on blur, so the user does not see that their text was rejected until they leave the field.

**Depends on**: none (task 03 MoneyField and task 12 field error alert are merged)

**Parallel group**: F1 (with 15)

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
- `packages/ui/src/MoneyField/MoneyField.tsx` (already starts with `'use client';`)
- `packages/ui/src/MoneyField/MoneyField.stories.tsx`: one new story, the docs text changes listed under Behaviour, and the `onChange` argType description
- `packages/ui/src/MoneyField/MoneyField.test.tsx` (QA adds tests; existing tests stay unchanged and must still pass)
- Not touched: `money.ts` (`parseMoney` and its messages are unchanged), `TextField/*`, `Field/*`, `src/index.ts` (`MoneyParseResult` is already exported), tokens, any app code.

## Props / API
Two changes to `MoneyFieldProps`; everything else is exactly as in task 03.

```ts
import type { MoneyParseResult } from './money';

export interface MoneyFieldProps
  extends Omit<TextFieldProps, 'type' | 'value' | 'defaultValue' | 'onChange' | 'prefix' | 'inputMode'> {
  value: number | null;
  /** `result` is parseMoney(text, { allowNegative }) for the text just typed. */
  onChange: (cents: number | null, result: MoneyParseResult) => void;
  /** When the parse error appears. Default 'blur' (unchanged behaviour). */
  validateOn?: 'blur' | 'change';
  allowNegative?: boolean;
  currencySymbol?: string;
}
```

- The first argument keeps its meaning: integer cents when the text is valid, `null` when it is empty **or** invalid. A callback that takes one parameter (`(cents) => …`, or a `useState` setter) still type-checks and behaves exactly as before.
- The parse state comes from the second argument:
  - empty: `result.ok === true && result.cents === null`
  - valid amount: `result.ok === true && result.cents !== null` (then `cents === result.cents`)
  - invalid: `result.ok === false`, with `result.reason` `'invalid' | 'negative' | 'too-large'`
- No new exported type; `MoneyParseResult` is already exported from `@budget-kit/ui`.

## Behaviour
- **`onChange`**: on every input change, as today, it is called exactly once, now as `onChange(cents, result)` where `result` is the object returned by `parseMoney(nextText, { allowNegative })` for the new text, and `cents` is `result.ok ? result.cents : null`. Blur still does not call `onChange`.
- **`validateOn="blur"` (default)**: behaviour identical to today: a parse error appears on blur and disappears as soon as the text parses `ok` (including empty).
- **`validateOn="change"`**: after every input change the parse error is updated immediately: text that is not `ok` shows its message at once (no blur needed); text that is `ok` (including empty) removes it. Blur behaves as today (valid non-empty text is reformatted with `formatCents`; invalid text is left as typed and its error stays).
- Messages are unchanged: `invalid` → `Enter an amount like 12.50`; `negative` → `Amount can't be negative`; `too-large` → `Amount is too large`. They are shown through TextField's `error`, so the library's `role="alert"`, `aria-invalid` and `aria-describedby` apply. A parse error still takes precedence over the `error` prop.
- The rule for outside `value` changes is unchanged (text resets only when `value` changes to something other than the last value this component passed to `onChange`). In particular, a parent that **keeps** its old `value` when it receives an invalid result (as app task 09 does) does not cause the typed text to be replaced: the text and the error stay until the user edits them.

### Examples
Typing into an empty field, one character at a time, with `validateOn="change"` (with the default `'blur'`, the `onChange` calls are identical but no error is shown until blur):

| text after keystroke | `cents` | `result` | error shown immediately |
|---|---|---|---|
| `1` | `100` | `{ ok: true, cents: 100 }` | none |
| `1,` | `null` | `{ ok: false, reason: 'invalid' }` | `Enter an amount like 12.50` |
| `1,2` | `null` | `{ ok: false, reason: 'invalid' }` | `Enter an amount like 12.50` |
| `1,20` | `null` | `{ ok: false, reason: 'invalid' }` | `Enter an amount like 12.50` |
| `1,200` | `120000` | `{ ok: true, cents: 120000 }` | none |
| `a` | `null` | `{ ok: false, reason: 'invalid' }` | `Enter an amount like 12.50` |
| `-` | `null` | `{ ok: false, reason: 'invalid' }` | `Enter an amount like 12.50` |
| `-5` | `null` | `{ ok: false, reason: 'negative' }` | `Amount can't be negative` |
| `111111111111` (12 digits) | `11111111111100` | `{ ok: true, cents: 11111111111100 }` | none |
| `1111111111111` (13 digits) | `null` | `{ ok: false, reason: 'too-large' }` | `Amount is too large` |
| `` (cleared) | `null` | `{ ok: true, cents: null }` | none |

### Story docs (in `MoneyField.stories.tsx` `meta.parameters.docs.description.component`)
Change exactly these strings and nothing else. Each block is the exact new string (backticks included).

1. The second paragraph (today starting `It formats the amount when it loses focus and reports empty or invalid text`) becomes:
   ```text
   It formats the amount when it loses focus. `onChange(cents, result)` receives integer cents, or `null` when the text is empty or invalid; the second argument is the `parseMoney` result, so `result.ok === false` tells invalid text from empty. Errors show on blur by default; set `validateOn="change"` to show them while typing. The currency symbol is hidden from assistive technology, so name the currency in the label.
   ```
2. The known limitation starting `It is controlled only:` becomes:
   ```text
   - It is controlled only: `value` is integer cents or `null`, and `onChange` receives integer cents or `null` (empty or invalid text reports `null`; check the second argument to tell them apart).
   ```
3. The known limitation starting `Errors appear when the field loses focus` becomes:
   ```text
   - By default errors appear when the field loses focus. With `validateOn="change"` they appear on each keystroke, so a half-typed amount such as `1,` shows an error until it is complete. A parse error replaces the `error` prop while it is showing.
   ```
4. The `onChange` argType description becomes:
   ```text
   Called with the new amount in integer cents (or `null` when the text is empty or invalid) and the `parseMoney` result for the typed text.
   ```
5. New `validateOn` argType description:
   ```text
   When the parse error appears: `blur` (default) or `change` (while typing).
   ```

## Stories required
- Existing stories unchanged.
- New `ValidateWhileTyping`: `args: { validateOn: 'change' }`, with a `play` function that types `abc` into `Monthly income` and does **not** tab away, so the error is visible while the input still has focus.

## Acceptance criteria
Spec (from the follow-up request: let the app tell empty from invalid; show the error right away):
- [ ] Second argument: typing `12.5` into an empty field calls `onChange` four times with exactly `(100, { ok: true, cents: 100 })`, `(1200, { ok: true, cents: 1200 })`, `(1200, { ok: true, cents: 1200 })`, `(1250, { ok: true, cents: 1250 })` (`toHaveBeenNthCalledWith`).
- [ ] Invalid is distinguishable from empty: typing `a` calls `onChange(null, { ok: false, reason: 'invalid' })`; then clearing the field calls `onChange(null, { ok: true, cents: null })`.
- [ ] `reason` is passed through: `-5` ends with `(null, { ok: false, reason: 'negative' })`; `1000000000000` ends with `(null, { ok: false, reason: 'too-large' })`; with `allowNegative`, `-5` ends with `(-500, { ok: true, cents: -500 })`.
- [ ] For every row of the Examples table, typing the text (from empty, or `user.clear` then `user.type`) makes the last `onChange` call exactly the listed `cents` and `result`.
- [ ] `validateOn="change"`: after typing `a` **without blurring** (input still has focus), `getByRole('alert')` has text `Enter an amount like 12.50`, the input has `aria-invalid="true"` and its accessible description includes that text. Typing `-5` shows `Amount can't be negative` before blur; pasting `1000000000000` shows `Amount is too large` before blur.
- [ ] `validateOn="change"`: from the `a` state, select all and type `5`: the alert and `aria-invalid` are gone without blurring. Typing `1,` then `200` shows the alert at `1,` and removes it at `1,200`.
- [ ] `validateOn="change"` blur: typing `12.5` then Tab shows `12.50`; typing `abc` then Tab leaves `abc` and the error. `onChange` is not called by the blur.
- [ ] Default unchanged: without `validateOn` (and with `validateOn="blur"`), typing `abc` shows no alert while focused; after Tab the alert shows `Enter an amount like 12.50`. Every test in the existing `MoneyField.test.tsx` passes without edits (`git diff` of the existing test cases is empty; QA only adds tests).
- [ ] Parent keeps its value on invalid input: a wrapper starting at `value={120000}` that ignores calls whose `result.ok` is `false` (and stores the cents otherwise), with `validateOn="change"`: click at the end of `1,200.00`, type `x`: the input shows `1,200.00x`, the error is shown, and the wrapper's value is still `120000`; press Backspace: the input shows `1,200.00`, the error is gone, the wrapper's value is `120000`. Tab: the input shows `1,200.00`.
- [ ] A parse error still takes precedence over the `error` prop in both modes: with `error="Income is required"` and `validateOn="change"`, typing `a` shows only `Enter an amount like 12.50` (one alert); clearing shows `Income is required`.
- [ ] Never NaN: across typing `abc`, `12.345`, `1,2,3`, `.`, `-` and `1e3` in both modes, every first argument is `null` or a safe integer, never `NaN` or `-0`, and every second argument deep-equals `parseMoney(currentInputText)`.
- [ ] Existing callers compile: `npm run check` passes with `apps/web` unchanged (AddExpense's `onChange={(cents) => …}` and the MonthSetup handlers take one parameter), and the stories' `onChange={setValue}` wrapper still works (typing `12.5` in `Empty` then Tab shows `12.50`).

Blanket:
- [ ] Typed props exactly as under Props / API; no `any`, `@ts-ignore` or `@ts-expect-error` in non-test files.
- [ ] No CSS file and no `style` prop added; `money.ts` unchanged (`git diff --stat` shows no change to it).
- [ ] `MoneyField.tsx` contains no `parseFloat`, `toFixed`, or `Number(` applied to user text (grep).
- [ ] Visible focus: in Storybook, tabbing into the input in `ValidateWhileTyping` shows the `--bk-focus-ring` ring while the error is shown.
- [ ] `ValidateWhileTyping` exists under `Components/MoneyField`; the docs lines above are changed (grep for `validateOn="change"` and `result.ok === false` in the stories file) and the sentence `Errors show on blur, not on each keystroke.` is gone.
- [ ] `npm run test:a11y` lists every MoneyField story, including `ValidateWhileTyping`, with no axe violations; the Storybook Accessibility panel shows none for it.
- [ ] `npm run check` passes.

## Manual browser checks (Storybook, the lead or a11y-reviewer)
- `ValidateWhileTyping`: the error is visible while the caret is still in the field; the field keeps its focus ring.
- With VoiceOver or NVDA in `ValidateWhileTyping`: typing `a` announces `Enter an amount like 12.50` while typing; typing `1,200` into a cleared field announces the error at `1,` and then stops (note whether repeated announcements while typing `1,2`, `1,20` are disruptive, and report it).

## Assumptions
- The parse state is reported as a second `onChange` argument (the existing `MoneyParseResult`) rather than a new callback or a new type, so one-parameter callers are unaffected and no new export is needed.
- Error timing is opt-in through `validateOn` (default `'blur'`), so AddExpense and the library's own stories keep today's behaviour.
- With `'change'`, half-typed amounts that are not yet valid (`1,`, `.`, `$`, `-`) show the `invalid` message until completed. No "could still become valid" leniency is added (smallest change; see `docs/tasks/followups-plan.md`, risks).
- The second argument is a plain object, never a function, so passing a `useState` setter as `onChange` stays warning-free in React.

## Out of scope
- Changing `parseMoney`, `formatCents` or the error wording.
- Changing `TextField` or `Field`.
- Reverting or reformatting the text when it is invalid (the text stays as typed).
- Anything in `apps/web` (app task 09 uses this).
- Editing `tokens.css` or `tokens.pairs.ts`.
- New dependencies: report the need instead of installing.
