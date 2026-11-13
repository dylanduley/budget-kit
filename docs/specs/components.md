# Component specs (packages/ui)

Ten components, in build order. 1–5 can be built in parallel; 6–10 after.
Every component: typed props, uses tokens, visible focus, works with keyboard only, has stories for every variant/state, passes axe with no violations.

## 0. Design tokens (`tokens.css`)
Colors (primary, neutral scale, success, warning, danger, each with a text-safe shade), spacing scale, radii, font sizes, shadows.
- [ ] All text/background pairs used by components meet 4.5:1 contrast (list them in a story)

## 1. Button
Variants: primary, secondary, ghost, danger. Sizes: sm, md. States: disabled, loading (spinner + `aria-busy`, keeps width).
- [ ] Loading button can't be clicked twice
- [ ] Works as a submit button in a form

## 2. TextField
Label (required), hint, error message, optional prefix (e.g. `$`). Types: text, number.
- [ ] Error is linked with `aria-describedby` and sets `aria-invalid`
- [ ] Label click focuses the input

## 3. MoneyField
Built on TextField. Accepts "12", "12.5", "1,200.00"; reports value as integer cents. Shows formatted value on blur.
- [ ] `onChange` gives cents; invalid input shows an error, never NaN
- [ ] Negative values rejected unless `allowNegative`

## 4. Select
Native `<select>` styled to match. Label, hint, error like TextField.
- [ ] Fully keyboard usable (native behavior kept)

## 5. Badge
Variants: neutral, success, warning, danger. Text required (no color-only meaning).

## 6. Card
Title, optional description, optional action slot, body.

## 7. Stat
Label, value, optional change/trend text with tone (good/bad/neutral).
- [ ] Trend meaning not shown by color alone

## 8. ProgressBar
Value and max, label, tone changes at thresholds (≤80% ok, ≤100% warning, >100% danger). Shows "over by X" when over.
- [ ] `role="progressbar"` with `aria-valuenow/min/max` and a text label
- [ ] Over 100% still renders correctly (bar capped, text explains)

## 9. Dialog
Modal with title, body, actions. Opens from a trigger.
- [ ] Focus moves in on open, is trapped, returns to the trigger on close
- [ ] Esc and the close button close it; background is inert

## 10. Table
Columns config, rows, optional empty state, right-aligned numeric columns.
- [ ] Real `<table>` with `<th scope>`; caption required (can be visually hidden)
