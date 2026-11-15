# 11: Explicit box-sizing for components

Make every library component's dimensions independent of the host page's CSS reset.

A review found that TextField's box and Select's control are the same height (42px) in Storybook, which has no reset, but differ by 2px in the app, where Tailwind's preflight sets `box-sizing: border-box` on every element. TextField sets no `box-sizing`, so its height depends on the host; Select sets `content-box` explicitly.

**Depends on**: none (library follow-up, runs before any app screen)

**Files**
- `packages/ui/src/TextField/TextField.module.css`
- `packages/ui/src/Select/Select.module.css`
- any other `packages/ui/src/<Name>/<Name>.module.css` the audit shows needs it
- `docs/tasks/11-box-sizing.md` is not edited by the builder. QA writes tests only if a CSS-source test can fail (see criteria); tests go in `packages/ui/src/<Name>/<Name>.test.tsx`.

## Behaviour
- **Fix TextField and Select:** set `box-sizing: border-box` explicitly on the TextField box (`.box`) and on Select's `.select`, and give both a `min-height` of `var(--bk-space-10)` with no hard-coded `2px` adjustment, so each control is exactly 40px tall (border included) regardless of the host reset. The invalid and focus ring, the prefix, the chevron and padding must look unchanged apart from the 2px height change.
- **Audit every other component:** read each `*.module.css`. For every rule that combines a border or padding with a `width`, `max-width`, `height`, `min-height` or `max-height` (or `flex-basis`), decide whether the rendered size changes when the host sets `box-sizing: border-box` versus the browser default `content-box`. Where it does, add an explicit `box-sizing` and adjust the size so the component keeps its intended outer size (Button `md` 40px and `sm` 32px, the Dialog panel at `32rem` max, the Table scroll region, the Card header action, the Badge, the ProgressBar track) in both environments. Do not change a component whose size is the same in both. List every rule you checked, and what you decided, in the report.
- No visual redesign. No token changes. No new dependencies.

## Acceptance criteria
- [ ] `TextField.module.css` `.box` and `Select.module.css` `.select` both declare `box-sizing: border-box` and `min-height: var(--bk-space-10)`; neither contains `calc(` with a `2px` offset for height (grep).
- [ ] The report lists every CSS rule in `packages/ui/src` that combines border or padding with a width or height, with the decision (changed, or same in both modes and why).
- [ ] For every rule changed, the same component measured in a browser with and without a global `*, ::before, ::after { box-sizing: border-box }` gives the same outer size. QA says how this was checked; if it cannot be checked without a browser, QA lists it under manual browser checks (the lead measures it).
- [ ] If a CSS-source test is written (for example "every `.module.css` that sets a border together with a width or height also sets `box-sizing`"), it passes on the fixed code and would fail on the pre-fix `TextField.module.css`.
- [ ] No colour, spacing token, radius, font size or shadow changes (diff shows only `box-sizing`, `min-height`, `height`, `width` or `max-*` lines).
- [ ] All stories still render and pass axe (`npm run test:a11y`).
- [ ] `npm run check` passes.

## Manual browser checks (the lead does these)
- In Storybook `Components/Select/BesideTextField`, the input box and the select are both 40px high with the same border.
- In the built app, the same two controls render at 40px (Tailwind's reset is active there).
- Button `md` and `sm`, the Dialog at 375px wide, and the Table at 320px look the same as before.

## Out of scope
- Any app code. Redesigning component sizes. Changing `Field`.
