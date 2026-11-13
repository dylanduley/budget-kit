# 03: MoneyField

A TextField for money amounts that parses what the user types and reports integer cents.

**Depends on**: 02 (TextField must be merged)

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
- `packages/ui/src/MoneyField/money.ts`: pure `parseMoney` and `formatCents` (no React)
- `packages/ui/src/MoneyField/MoneyField.tsx` (starts with `'use client';`: state and handlers)
- `packages/ui/src/MoneyField/MoneyField.stories.tsx`
- `packages/ui/src/MoneyField/MoneyField.test.tsx` and `money.test.ts` (QA)
- No `MoneyField.module.css`: all styling comes from TextField. If a style turns out to be needed, report it.
- `packages/ui/src/index.ts`: add
  `export { MoneyField, type MoneyFieldProps } from './MoneyField/MoneyField';`
  `export { formatCents, parseMoney, type MoneyParseResult } from './MoneyField/money';`

## Props / API
All amounts are **integer cents**. No float ever holds a money value: no `parseFloat`, `Number(text)`, `* 100` on a decimal, or `toFixed`.

```ts
// money.ts
export type MoneyParseResult =
  | { ok: true; cents: number | null }                       // null = empty input
  | { ok: false; reason: 'invalid' | 'negative' | 'too-large' };

export function parseMoney(input: string, options?: { allowNegative?: boolean }): MoneyParseResult;
/** Integer cents -> "1,200.00". Throws RangeError unless Number.isSafeInteger(cents). */
export function formatCents(cents: number): string;

// MoneyField.tsx
export interface MoneyFieldProps
  extends Omit<TextFieldProps, 'type' | 'value' | 'defaultValue' | 'onChange' | 'prefix' | 'inputMode'> {
  value: number | null;                       // integer cents; null = empty
  onChange: (cents: number | null) => void;
  allowNegative?: boolean;                    // default false
  currencySymbol?: string;                    // default '$', shown as the TextField prefix
}
```

## Behaviour
### `parseMoney` rules, applied in order
1. Trim leading and trailing whitespace. If nothing is left: `{ ok: true, cents: null }`.
2. Strip one optional leading `-`, then one optional `$`.
3. The rest must match `^(\d+|\d{1,3}(,\d{3})+)?(\.\d{0,2})?$` and contain at least one digit; otherwise `invalid`. Digits are ASCII `0-9` only. Commas are valid only as thousands separators in groups of exactly three. More than two decimals is `invalid` (never rounded or truncated).
4. Drop commas and leading zeros from the whole part. More than 12 digits left: `too-large`.
5. `cents = whole × 100 + fraction`, where the fraction is right-padded with zeros to two digits; integer arithmetic on digit strings only.
6. If a `-` was stripped and `cents > 0`: `negative` when `allowNegative` is false, else negate. `-0` yields `0` (never `-0`).

| input | result | | input | result |
|---|---|---|---|---|
| `""`, `"   "` | `null` | | `"12.345"` | `invalid` |
| `"12"` | `1200` | | `"1,2,3"` | `invalid` |
| `"12.5"` | `1250` | | `"1,20"`, `"1,2345"`, `",123"` | `invalid` |
| `"1,200.00"` | `120000` | | `"."`, `"-"`, `"$"` | `invalid` |
| `".5"` | `50` | | `"abc"`, `"1e3"`, `"+5"`, `"1 200"` | `invalid` |
| `"5."` | `500` | | `"12.5.1"`, `"$-5"`, `"１２"` | `invalid` |
| `"0.07"` | `7` | | `"-5"` | `negative` |
| `"0012"` | `1200` | | `"-5"` with `allowNegative` | `-500` |
| `" 12 "` | `1200` | | `"-$1,200.5"` with `allowNegative` | `-120050` |
| `"$12"` | `1200` | | `"-0"`, `"-0.00"` | `0` |
| `"12,345.6"` | `1234560` | | `"999999999999.99"` | `99999999999999` |
| `"1200"`, `"1,200"` | `120000` | | `"1000000000000"` | `too-large` |

### `formatCents`
Fixed format, independent of runtime locale: optional `-`, whole part with `,` every three digits, `.`, exactly two decimals, no currency symbol.
`0` → `"0.00"`, `5` → `"0.05"`, `50` → `"0.50"`, `1250` → `"12.50"`, `120000` → `"1,200.00"`, `123456789` → `"1,234,567.89"`, `-500` → `"-5.00"`, `-0` → `"0.00"`. `12.5`, `NaN`, `Infinity` → throws `RangeError`.

### `MoneyField`
- Renders `TextField` with `type="text"`, `inputMode="decimal"`, `prefix={currencySymbol}`; all other props (`label`, `hint`, `error`, `id`, `name`, `disabled`, `onBlur`, …) pass through.
- Keeps the typed text in local state. Initial text is `''` for `null`, else `formatCents(value)`.
- On every input change it parses the text and calls `onChange` exactly once: with the cents when valid, with `null` when empty or not `ok`. It never passes `NaN`, a float, or `-0`.
- On blur: valid non-empty text is replaced by `formatCents(cents)`; empty text stays empty; text that is not `ok` is left as typed and the parse error is shown. Blur does not call `onChange`. The consumer's `onBlur` still fires.
- A shown parse error disappears as soon as the text parses `ok` (including empty).
- Parse error messages, shown through TextField's `error` (so `aria-invalid` and `aria-describedby` apply): `invalid` → `Enter an amount like 12.50`; `negative` → `Amount can't be negative`; `too-large` → `Amount is too large`. A parse error takes precedence over the `error` prop; with no parse error the `error` prop is shown.
- When `value` changes to something other than the last value this component passed to `onChange`, the text is reset to `formatCents(value)` (`''` for `null`) and any parse error is cleared.

## Stories required
All with a controlled wrapper (`useState`): `Empty`, `WithValue` (`120000`, shows `1,200.00`), `WithHint`, `InvalidInput` (a `play` function from `storybook/test` types `abc` and tabs away, so the error is visible), `NegativeRejected` (`play` types `-5` and tabs away), `AllowNegative` (`value={-500}`), `ExternalError` (`error="Income is required"`), `Disabled`, `OtherCurrencySymbol` (`currencySymbol="€"`).

## Acceptance criteria
Spec:
- [ ] `parseMoney` returns exactly the result in the table for every listed input; `ok: true` results are `{ ok: true, cents }` and failures `{ ok: false, reason }`.
- [ ] `formatCents` returns exactly the listed strings and throws `RangeError` for `12.5`, `NaN` and `Infinity`.
- [ ] For every table input that is `ok` and non-empty, `parseMoney(formatCents(cents))` returns the same cents.
- [ ] `onChange` gives cents: typing `12.5` into an empty field calls `onChange` with `100`, `1200`, `1200`, `1250` in that order; typing `1,200.00` ends with a last call of `120000`.
- [ ] Never NaN: across typing `abc`, `12.345`, `1,2,3`, `.`, `-` and `1e3`, every `onChange` argument is either `null` or satisfies `Number.isSafeInteger`; none is `NaN` or `-0`.
- [ ] Invalid input shows an error: after typing `abc` and tabbing away, the text `Enter an amount like 12.50` is visible, the input has `aria-invalid="true"` and its accessible description includes that text; the input still shows `abc`; the last `onChange` argument was `null`.
- [ ] The error clears while typing: from that state, clearing the input and typing `5` removes the error text and the `aria-invalid` attribute.
- [ ] Shows formatted value on blur: typing `12.5` then tabbing away leaves the input showing `12.50`; `1200` shows `1,200.00`; `.5` shows `0.50`; an empty field stays empty. `onChange` is not called by the blur.
- [ ] Negative values rejected unless `allowNegative`: typing `-5` and tabbing away shows `Amount can't be negative`, with last `onChange` argument `null`; with `allowNegative` the last argument is `-500`, no error is shown, and the input shows `-5.00` after blur.
- [ ] Typing `1000000000000` and tabbing away shows `Amount is too large`.
- [ ] Controlled value: rendering with `value={120000}` shows `1,200.00`; re-rendering with `value={null}` shows an empty input; re-rendering with `value={500}` shows `5.00`.
- [ ] While the user types `12.5` in a controlled wrapper (parent stores each `onChange` value), the input shows exactly `12.5` until blur (the text is not reformatted mid-typing).
- [ ] An `error` prop is shown when there is no parse error; a parse error replaces it while present.
- [ ] The input has `type="text"` and `inputmode="decimal"`; the prefix shows `$` by default and `currencySymbol="€"` shows `€`.
- [ ] `money.ts` and `MoneyField.tsx` contain no `parseFloat`, `toFixed`, or `Number(` applied to user text (grep).

Blanket:
- [ ] Typed props exactly as under Props / API; no `any`, `@ts-ignore` or `@ts-expect-error` in non-test files.
- [ ] Uses tokens: no CSS file and no `style` prop is added by this task; styling comes entirely from TextField.
- [ ] Visible focus: in Storybook, tabbing into the input shows the `--bk-focus-ring` ring, including in the `InvalidInput` story.
- [ ] Keyboard only: an amount can be typed, corrected and left with Tab without a pointer.
- [ ] Every story listed under Stories required exists under `Components/MoneyField`.
- [ ] `npm run test:a11y` lists every MoneyField story with no axe violations, and the Storybook Accessibility panel shows no violations (including colour contrast) for each story.
- [ ] `MoneyField`, `MoneyFieldProps`, `parseMoney`, `formatCents` and `MoneyParseResult` are importable from `@budget-kit/ui`.
- [ ] `npm run check` passes.

## Assumptions
- Controlled only (`value` + `onChange`); empty is `null`, not `0`.
- When the text is invalid, `onChange(null)` is called so the parent never keeps a stale amount.
- Parse errors appear on blur, not on each keystroke, so half-typed amounts (`1,`) do not flash errors.
- More than two decimals is an error rather than silently rounded.
- One leading `$` is accepted (pasted amounts); other currency symbols and `+` are not. `currencySymbol` changes only the displayed prefix.
- Formatting is fixed `1,234.56` regardless of locale; the amount cap is 999,999,999,999.99.
- `parseMoney` and `formatCents` are exported publicly so the app can format cents for Stat, ProgressBar and Table with the same rules.

## Out of scope
- Changing `TextField` or `Field`: if they lack something, report it.
- Currency conversion, locale-aware formats, budget math.
- Anything in `apps/web`.
- Editing `tokens.css` or `tokens.pairs.ts` (task 00 owns them; if a pair is missing, append it at the end of the array and name it in your report).
- New dependencies: report the need instead of installing.
