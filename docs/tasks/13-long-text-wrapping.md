# 13: Long unbroken text must wrap

Every component that renders text a user or the app supplies (a category name, a note, an error that embeds a name) must wrap a very long unbroken string instead of overflowing its container.

The dashboard review (app task 05) found that a category name such as 80 characters with no spaces overflows at 320px and makes the page scroll sideways (WCAG 1.4.10 Reflow). Category names have no length limit. Two components lack `overflow-wrap`: `ProgressBar` (`.label`, and its status text) and `Card` (`.body`). The same gap probably exists in `Field` (the label, hint and error: an error such as "You already have a category called {name}" embeds the name), `Stat`, `Dialog` and `Badge`.

**Depends on**: none (library follow-up, runs before the screens are merged)

## Files
- `packages/ui/src/*/*.module.css`: only the rules the audit shows need it
- QA may add a CSS-source test (for example `packages/ui/src/text-wrapping.test.ts`)

## Behaviour
- Add `overflow-wrap: anywhere;` (and `min-width: 0` where the element is a flex or grid item that would otherwise refuse to shrink) to every rule that renders caller-supplied text and lacks it. Audit every `*.module.css` in `packages/ui/src` and, for each text-bearing rule, decide: already wraps / changed / not applicable (fixed library strings, controls whose text the browser clips by design such as `<select>`, `<input>`). List every rule you checked and the decision in your report.
- Do not change any colour, size, spacing, radius or font. Do not change `Badge`'s `white-space: nowrap` unless a Badge can contain caller text of unbounded length (it takes `children: string`): say what you decided and why; if you remove `nowrap` for long text only, keep short labels on one line (for example allow wrapping only via `overflow-wrap: anywhere` combined with `max-width: 100%`, which leaves normal-length labels unchanged).
- The `Table` scrolls horizontally inside its own focusable region by design: do not change it.
- No visual change for normal-length text.

## Acceptance criteria
- [ ] `ProgressBar.module.css` `.label` and the element that shows the status text, `Card.module.css` `.body`, and the `Field` label, hint and error rules each have `overflow-wrap: anywhere` (or an equivalent that wraps an unbroken string), as does every other rule the audit finds.
- [ ] The report lists every text-bearing CSS rule in `packages/ui/src` with its decision.
- [ ] The diff contains only `overflow-wrap`, `min-width`, `word-break` or `max-width` lines (no colour, size, spacing, radius, font or shadow lines).
- [ ] If QA writes a CSS-source test, it passes on the fixed code and fails against the pre-fix `ProgressBar.module.css` `.label` and `Card.module.css` `.body` (QA shows how).
- [ ] All stories still render and pass axe (`npm run test:a11y`); `npm run check` passes.

## Manual browser checks (the lead does these)
- At 320px wide, an 80-character unbroken category name shown in the dashboard's progress bar row, in the unplanned row, in a Field error message and in a Card body does not make the page scroll horizontally and does not clip.
- Normal-length labels look unchanged.

## Out of scope
- Any app code. Limiting category name length (a separate product decision). Changing `Table`.
