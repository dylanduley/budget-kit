# 07: Reset month

A `Reset month` button that asks for confirmation in a Dialog and, only after confirming, clears the budget back to the first-run state for the current month. Also the month-rollover notice: when the saved budget is for another month, a notice with a button that opens the same confirmation.

**Depends on**: 02

**Parallel group**: 2 (with 03, 04, 05, 06)

## Conventions (identical in every app task)
- **Folders** (all under `apps/web/src/`): `lib/` pure TypeScript (no React, no `window`, no `Date.now()`); `state/` storage and the React provider; `features/<area>/` screen components; `test/` shared test helpers; `app/` Next.js route files only (`layout.tsx`, `page.tsx`, `globals.css`).
- **Imports**: library components and helpers only from `@budget-kit/ui` (lint blocks `@budget-kit/ui/src/*`); app modules through the `@/` alias (`@/lib/budget`).
- **Client boundary**: a file starts with `'use client';` only if it uses state, effects, refs, context or event handlers. `page.tsx` and `layout.tsx` stay server components. `lib/*`, `state/storage.ts` and `state/budgetReducer.ts` have no directive.
- **Styling**: no CSS files (other than the existing `app/globals.css`, unchanged), no `style` prop, no CSS Modules, and no native `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>` or `<dialog>` anywhere in `apps/web/src`. Tailwind classes only for layout and spacing on plain elements (`flex*`, `grid*`, `gap-*`, `p*-*`, `m*-*`, `max-w-*`, `w-full`, `items-*`, `justify-*`, `list-none`, and `sm:` variants of these), plus typography and token text colours (`text-2xl`, `font-semibold`, `text-text`, `text-text-muted`) on plain text elements (`h1`, `h3`, `p`). On library components `className` may contain only `w-full`, `self-*`, `justify-self-*`, `col-span-*`. Single column below 640px: any multi-column layout is behind `sm:`.
- **Structure**: plain semantic elements only (`main`, `section`, `h1`, `h3`, `p`, `ul`, `li`, `form`).
- **Action errors**: every call to a `useBudget().actions` function is wrapped in `try`/`catch`. A caught `RangeError` whose message is exactly `That change would make a total too large.` (`TOTAL_TOO_LARGE_MESSAGE`, task 02) is shown with that text; anything else is shown as `Something went wrong. Your budget was not changed.` The provider guarantees state and storage are unchanged; the screen keeps its form or dialog open with the user's values. The message goes in the `error` prop of the field the action came from when one fits (the library's Field announces it with `role="alert"`); otherwise in the **one permitted app-level alert**: `<p role="alert" data-part="action-error">{message}</p>`, placed directly after the control that triggered the action, rendered only while a message is shown, and cleared on the next edit or successful action in that form. App code has no other `role="alert"`, `role="status"` or `aria-live`.
- **Money**: integer cents in state, storage, props and function arguments. Converted to text only at the display edge with `formatMoney` from `@/lib/format` (which wraps the library's `formatCents`). No `parseFloat`, `toFixed`, `Number(` on text, `* 100` or `/ 100` on amounts. Amounts shown are exactly the numbers the `lib/budget.ts` functions return.
- **Dates**: ISO strings (`YYYY-MM-DD`, months `YYYY-MM`), compared as strings. Never parse them with `new Date(string)` (time-zone shifts). "Today" comes only from `useBudget().today` (task 02).
- **Copy**: English, sentence case; strings quoted in a task are exact.
- **Tests**: written by QA from the acceptance criteria, colocated as `<file>.test.ts(x)`; the builder does not write them. Tests import `describe`, `it`, `expect`, `vi` from `vitest` (no globals), use Testing Library and `@testing-library/user-event`, and render screens with the helpers in `src/test/` (task 02). jsdom has no layout, so visual behaviour goes under **Manual browser checks**, never into a test that cannot fail.
- **Done**: every acceptance criterion passes and `npm run check` passes.

## Files
- `apps/web/src/features/reset/ResetMonthDialog.tsx` (`'use client';`): the confirmation dialog, controlled
- `apps/web/src/features/reset/ResetMonth.tsx` (`'use client';`): the `Reset month` card
- `apps/web/src/features/reset/MonthNotice.tsx` (`'use client';`): the rollover notice
- `apps/web/src/features/BudgetApp.tsx`: add the imports, `<MonthNotice />` as the first line below the heading block (above `<Dashboard />`) and `<ResetMonth />` as the last line (after `<MonthSetup />`) (README "BudgetApp order"); nothing else
- `apps/web/src/features/reset/ResetMonth.test.tsx`, `MonthNotice.test.tsx` (QA)
- Read-only: `lib/`, `state/`, `test/`

## API / Props
```ts
export interface ResetMonthDialogProps {
  open: boolean;
  onClose: () => void;      // Cancel, Esc, close button
  onConfirmed: () => void;  // called after actions.resetMonth()
}
export function ResetMonthDialog(props: ResetMonthDialogProps): ReactElement | null;
export function ResetMonth(): ReactElement | null;    // null unless ready
export function MonthNotice(): ReactElement | null;   // null unless ready
```
Uses `useBudget().state`, `currentMonth`, `isOtherMonth` and `actions.resetMonth`. Library: `Card`, `Button`, `Dialog`. `ResetMonth` and `MonthNotice` each own their own `open` state and render their own `ResetMonthDialog`; there is one dialog *design*, never two dialogs open (the library makes the rest of the page inert while one is open, so the other trigger cannot be reached).

## Behaviour
- `<Card title="Reset month" description="Clear your income, categories and expenses and start again.">` containing `<Button variant="secondary">` text `Reset month`. The button is always rendered (also in the first-run state), so it still exists when the dialog closes and the Dialog can return focus to it.
- `ResetMonth` owns `const [open, setOpen] = useState(false)`; the button opens its `ResetMonthDialog`.
- `ResetMonthDialog` renders `<Dialog open={open} onClose={onClose} title="Reset month?" initialFocusRef={cancelRef}>`:
  - body: `<p>This deletes your income, your categories and {n} {n === 1 ? 'expense' : 'expenses'} for {formatMonth(state.month)}. You can't undo this.</p>` where `n = expensesForMonth(state).length`; when `isOtherMonth`, the first sentence ends `…for {formatMonth(state.month)}, and starts a new budget for {formatMonth(currentMonth)}.` instead;
  - `actions`: `<Button variant="secondary" ref={cancelRef}>Cancel</Button>` (calls `onClose`) then `<Button variant="danger">Reset month</Button>` (calls `actions.resetMonth()` then `onConfirmed()`).
- Initial focus is on `Cancel` (the safe choice).
- Confirm from the card: state becomes `createInitialState(currentMonth)`, saved, `generation` + 1; the card closes its dialog; focus returns to the `Reset month` trigger.
- Cancel, Esc and the close button: close with no change to state or storage.
- Neither component opens a dialog from inside another dialog.

### Month-rollover notice (`MonthNotice`)
- Rendered (non-null) only when ready. While `isOtherMonth` is true it shows
  `<section aria-labelledby={id}>` with `<h2 id={id}>New month</h2>`, `<p>This budget is for {formatMonth(state.month)}. It is now {formatMonth(currentMonth)}.</p>`, `<p>Your figures are kept until you start a new budget.</p>` and `<Button>` text `Start {formatMonth(currentMonth)} budget` that opens its own `ResetMonthDialog`.
- Nothing changes until the user confirms; Cancel/Esc/close leave everything and focus returns to the notice's button.
- Confirming resets (to `currentMonth`), so `isOtherMonth` becomes false and the notice's button disappears. Because the Dialog cannot return focus to a removed trigger, the notice instead renders `<p ref={doneRef} tabIndex={-1}>New budget started for {formatMonth(currentMonth)}.</p>` and focuses it in an effect after the dialog has closed. That confirmation stays until the page is reloaded.
- When `isOtherMonth` is false and no reset happened from the notice, it renders nothing visible (an empty fragment).

- **Action errors** (Conventions): if `actions.resetMonth` throws, `ResetMonthDialog` stays open, `onConfirmed` is not called, nothing changes, and `<p role="alert" data-part="action-error">` with the message is shown in the dialog body after the explanation paragraph; focus stays on the dialog's `Reset month` button. Cancel then closes as usual.

## Screens / states
Closed; open with expenses; open with no expenses (`0 expenses`); after reset.

## Acceptance criteria
Render `renderWithBudget(<ResetMonth />, { state: SCENARIO, today: '2026-11-14' })` unless stated.
- [ ] Closed: a `Reset month` button, heading `Reset month` (level 2), no dialog.
- [ ] Opening shows `getByRole('dialog', { name: 'Reset month?' })` with the text `This deletes your income, your categories and 3 expenses for November 2026. You can't undo this.`; focus is on `Cancel`. With one expense the text says `1 expense`; with none, `0 expenses`.
- [ ] Nothing is cleared before confirming: after opening, the stored value is byte-identical to before; after Cancel, Esc, and the close button (each tried from a fresh open) the dialog is gone, focus is on the `Reset month` trigger, and the stored value is still byte-identical (`setItemCalls` unchanged).
- [ ] Confirming clears everything: clicking the dialog's `Reset month` closes it, stored state equals `createInitialState('2026-11')` (income `0`, five suggested categories with `plannedCents: 0`, no expenses), and focus is on the trigger.
- [ ] Reset starts the current month: with `SCENARIO` (month `2026-11`) and `today: '2026-12-02'`, the dialog text ends `…for November 2026, and starts a new budget for December 2026. You can't undo this.` and confirming stores `createInitialState('2026-12')`.
- [ ] Survives a refresh: after confirming, `refresh()` loads the reset state, not `SCENARIO`.
- [ ] The dialog's `Reset month` is the `danger` variant (`data-variant="danger"`) and the trigger is not.
- [ ] While open, the trigger has an ancestor with `inert`.
- [ ] Keyboard only: Enter on the trigger opens; Tab moves Cancel → Reset month (dialog) → close button → Cancel; Enter on the dialog's `Reset month` resets.
- [ ] axe: `expectNoAxeViolations()` passes closed and open.
- [ ] Action error (`renderWithFakeBudget`, `state: SCENARIO`, `resetMonth` throws `new Error('boom')`): confirming keeps `Reset month?` open, shows `Something went wrong. Your budget was not changed.` in `[data-part="action-error"]` (`role="alert"`) inside the dialog, and the mock was called once; Cancel then closes it and focus returns to the trigger. The same from `MonthNotice` (today `'2026-12-02'`): the notice's button stays and no `New budget started…` text appears.

Rollover notice (render `renderWithBudget(<MonthNotice />, { state: SCENARIO, today })`):
- [ ] `today: '2026-11-14'` (same month): no `New month` heading, no button, nothing rendered inside the container.
- [ ] `today: '2026-12-02'`: heading `New month` (level 2), the text `This budget is for November 2026. It is now December 2026.`, and a button `Start December 2026 budget`; stored value byte-identical and `setItemCalls` `0` (nothing changed on load).
- [ ] Clicking it opens `Reset month?` with `3 expenses for November 2026, and starts a new budget for December 2026`; Cancel closes it, focus returns to `Start December 2026 budget`, storage unchanged, notice still shown.
- [ ] Confirming stores `createInitialState('2026-12')`, removes the notice's button, shows `New budget started for December 2026.`, and that paragraph is `document.activeElement` (not `document.body`).
- [ ] `today: '2026-10-15'` (clock moved back) also shows the notice (`It is now October 2026.`).
- [ ] Rendering `<MonthNotice />` and `<ResetMonth />` together with `today: '2026-12-02'`: opening either dialog makes the other trigger inert (`closest('[inert]')` not null), and `getAllByRole('dialog')` never has more than one element.
- [ ] axe passes for the notice, the notice's open dialog, and the post-reset confirmation.
- [ ] Styling rules in Conventions hold (grep); no `any`, `@ts-ignore` or `@ts-expect-error`; `npm run check` passes.

## Manual browser checks
- At 375px the dialog fits and both buttons are visible.
- Pressing Enter immediately after opening activates `Cancel`, not reset.
- Focus ring visible on the trigger after the dialog closes.

## Assumptions
- "Reset clears everything" returns to the first-run state, which includes the five suggested categories at $0 (README "Decided by the lead").
- Reset starts the month that today is in, so it is also how the budget rolls over (lead decision: never automatic, always confirmed).
- The notice heading `New month` and the button copy `Start {month} budget` are my choices; the notice sentence is the lead's example.
- The notice uses a plain `section` + `h2`, not a library alert (none exists; README "Decided by the lead").
- The trigger is `secondary`; only the confirming button is `danger`.
- The section sits last on the page so the destructive action is not the first tab stop.

## Out of scope
- Undo, archiving the old month, exporting data.
- Changes to `lib/`, `state/`, test helpers or the library; if something is missing, report it.
