# 28: Back up the old saved data before it is first overwritten

Before the app overwrites stored data it could not read, or data saved by the pre-redesign app (storage version 1), it copies the raw stored text once to a second key, `budget-kit:budget:backup`. If anything goes wrong in parsing, migration or the first version 2 write, the person's original data still exists in their browser and can be recovered by hand (or by a later restore feature). `Delete all data` removes the backup too, so its promise stays true.

Why: redesign plan risk 1 (storage migration) and its open question 3. Today the first change after loading unreadable or version 1 data replaces the only copy. Loading never writes, and that stays true.

**Depends on**: app tasks 20–25 (merged)

**Parallel group**: G1 (with 26 and 29; see `docs/tasks/followups-plan2.md`)

## Conventions (identical in every redesign app task)
- **Folders** (all under `apps/web/src/`): `lib/` pure TypeScript (no React, no `window`, no `Date.now()`); `state/` storage and the React provider; `features/<area>/` screen components; `test/` shared test helpers; `app/` Next.js route files only (`layout.tsx`, `page.tsx` files, `globals.css`).
- **Imports**: library components and helpers only from `@budget-kit/ui` (lint blocks `@budget-kit/ui/src/*`); app modules through the `@/` alias.
- **Client boundary**: a file starts with `'use client';` only if it uses state, effects, refs, context, event handlers or Next client hooks (`usePathname`, `useRouter`). `layout.tsx` and every `page.tsx` stay server components (they may export `metadata`). `lib/*`, `state/storage.ts` and `state/budgetReducer.ts` have no directive.
- **Styling**: no CSS files (other than the existing `app/globals.css`, unchanged), no `style` prop, no CSS Modules, and no native `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, `<dialog>` or `<a>` anywhere in `apps/web/src` (links come from the library `NavBar` with Next's `Link`). Tailwind classes only for layout and spacing on plain elements (`flex*`, `grid*`, `gap-*`, `p*-*`, `m*-*`, `max-w-*`, `w-full`, `items-*`, `justify-*`, `list-none`, and `sm:` variants of these), plus typography and token text colours (`text-2xl`, `font-semibold`, `text-text`, `text-text-muted`) on plain text elements (`h1`, `h3`, `p`). On library components `className` may contain only `w-full`, `self-*`, `justify-self-*`, `col-span-*`. Single column below 640px: any multi-column layout is behind `sm:`.
- **Structure**: plain semantic elements only (`header`, `main`, `section`, `div`, `h1`, `h3`, `p`, `ul`, `li`, `form`).
- **Action errors**: every call to a `useBudget().actions` function is wrapped in `try`/`catch`. A caught `RangeError` whose message is exactly `That change would make a total too large.` (`TOTAL_TOO_LARGE_MESSAGE`) is shown with that text; anything else is shown as `Something went wrong. Your budget was not changed.` The provider guarantees state and storage are unchanged; the screen keeps its form or dialog open with the user's values. The message goes in the `error` prop of the field the action came from when one fits; otherwise in the **one permitted app-level alert**: `<p role="alert" data-part="action-error">{message}</p>`, placed directly after the control that triggered the action, rendered only while a message is shown, and cleared on the next edit or successful action in that form. `useBudget().viewMonth` is navigation, not an action, and needs no `try`.
- **Live regions**: app code has no `role="status"` and no `aria-live`, with one exception: the month switcher's month label (task 22) is `aria-live="polite"`. (App task 27 changes this rule; this task touches no UI.)
- **Money**: integer cents in state, storage, props and function arguments. Converted to text only at the display edge with `formatMoney` from `@/lib/format`. No `parseFloat`, `toFixed`, `Number(` on text, `* 100` or `/ 100` on amounts. Amounts shown are exactly the numbers the `lib/` functions return.
- **Dates**: ISO strings (`YYYY-MM-DD`, months `YYYY-MM`), compared as strings. Never `new Date(string)`. "Today" comes only from `useBudget().today`.
- **Copy**: English, sentence case; strings quoted in a task are exact.
- **Tests**: written by QA from the acceptance criteria, colocated as `<file>.test.ts(x)`; the builder does not write them. Tests import from `vitest` (no globals), use Testing Library and `@testing-library/user-event`, and use the helpers in `src/test/`. From task 21 on, `next/navigation` and `next/link` are mocked in `src/test/setup.ts`. jsdom has no layout: visual behaviour goes under **Manual browser checks**.
- **Done**: every acceptance criterion passes and `npm run check` passes.

## Files
- `apps/web/src/state/storage.ts`: `BACKUP_KEY`, `BackupResult`, `needsBackup`, `backUpStoredBudget`, `removeBackup` (below); nothing else changes (`LoadResult`, `loadBudget`, `saveBook`, `serializeBook`, parsing all unchanged)
- `apps/web/src/state/BudgetProvider.tsx`: one private `Model` field, the load effect, `commit`, `deleteAllData`; the public `BudgetContextValue` and `BudgetActions` types do not change
- `docs/tasks/app/README.md`: the one sentence under "Docs"
- QA, new tests: `apps/web/src/state/storage.backup.test.ts`, `apps/web/src/state/BudgetProvider.backup.test.tsx`
- QA, existing tests to update: listed under "Existing tests"
- Read-only: `test/*` (QA builds any special storage, for example one that fails only for one key, inside the test file), every `features/**` file, `lib/*`, `packages/ui/**`

## Functions
In `state/storage.ts` (no directive; pure apart from the `storage` argument):

```ts
export const BACKUP_KEY = 'budget-kit:budget:backup';

export type BackupResult = 'written' | 'present' | 'nothing-stored' | 'failed';

/** True for a load the first save would overwrite with something the old app cannot read. */
export function needsBackup(result: LoadResult): boolean;

/** Copies the raw STORAGE_KEY text to BACKUP_KEY unless BACKUP_KEY already holds something. Never throws. */
export function backUpStoredBudget(storage: StorageLike | null): BackupResult;

/** Removes BACKUP_KEY. Never throws. Returns false if removeItem threw or storage is null. */
export function removeBackup(storage: StorageLike | null): boolean;
```

- `needsBackup(result)`: `true` when `result.status === 'invalid'` (either reason), or `result.status === 'loaded' && result.fromVersion === 1`; `false` for `empty`, `unavailable` and `loaded` from version 2.
- `backUpStoredBudget(storage)`, in this order:
  1. `storage === null` → `'failed'`.
  2. In one `try`: if `storage.getItem(BACKUP_KEY) !== null` → `'present'` (never overwrite a backup, from this session or an earlier one).
  3. `raw = storage.getItem(STORAGE_KEY)`; `raw === null` → `'nothing-stored'`.
  4. `storage.setItem(BACKUP_KEY, raw)` with the string exactly as read (no parsing, trimming or re-serialising) → `'written'`.
  5. Anything thrown in 2–4 → `'failed'`.
- `removeBackup(storage)`: `storage.removeItem(BACKUP_KEY)` in a `try`; `true` on success, `false` if it threw or storage is `null`.

## Behaviour
"Session" = one mount of `BudgetProvider` (one page load). "Save" = a `saveBook` call.

### Provider
- **Load (unchanged except one flag)**: the load effect sets a private `Model` field `backupPending = needsBackup(result)`. Nothing is written on load; no backup is made on load. Under React StrictMode the load effect may run twice: each run recomputes the flag from a fresh read, and neither run writes.
- **`commit` (every action except `deleteAllData`)**, after the reducer has produced a changed, totallable state (no-op and throwing actions return or throw before this point and so never touch the backup):
  1. If `backupPending`: `backup = backUpStoredBudget(storage)`; else `backup = null`.
  2. `saved = saveBook(storage, book)`.
  3. If `!saved && backup === 'written'`: the backup may have used the space the save needed, so `removeBackup(storage)` and retry once: `saved = saveBook(storage, book)`.
  4. `backupPending` stays `true` until a save succeeds (`backupPending && !saved`). So the backup is attempted before every save until the first successful one, and never after it in this session.
  5. `savedDataReplaced` is computed from the final `saved`, exactly as today.
- **`deleteAllData`**: makes no backup. It saves the empty book as today, then always calls `removeBackup(storage)` (whatever the save result, and whether or not the backup came from this session), then sets `backupPending = false`.
- **Never visible**: no backup result, failure or retry is shown to the person, logged, or exposed on `useBudget()`; `BudgetContextValue` is unchanged. A failed backup never blocks or delays the save.
- Backup and save calls happen only in action handlers (`commit`, `deleteAllData`), never in render, in a `setState` updater or in an effect, so StrictMode's double invocation cannot repeat them.

### Cases
| load | backup key before | first change | storage after (backup key) |
|---|---|---|---|
| version 1 `SCENARIO` | absent | `setIncome(500)` | exactly the version 1 text |
| `'not json'` | absent | `setIncome(1)` | `'not json'` |
| `{"version":3,…}` (unsupported) | absent | any | that text |
| version 2 | absent | any | absent (never written) |
| empty | absent | any | absent |
| unavailable | n/a | any | not attempted |
| version 1 | `'older'` | any | `'older'` (not overwritten) |
| version 1, backup `setItem` throws (quota) | absent | `setIncome(500)` | absent; the main key is saved as version 2 anyway; no error shown |
| version 1, backup fits but then the main save fails (quota) | absent | `setIncome(500)` | backup removed, main save retried once; if the retry succeeds the main key is version 2 and there is no backup; if it fails, the main key still holds the version 1 text and the next change tries again |
| version 1, every `setItem` throws | absent | `setIncome(1)`, then storage recovers, `setIncome(2)` | first change: nothing written; second: backup = version 1 text, main = version 2 |
| any, then `deleteAllData` | present | `deleteAllData` | absent |

### Docs
In `docs/tasks/app/README.md`, "Decided by the lead", replace this text:
```text
unreadable data is overwritten on the first change, with no backup key.
```
with:
```text
unreadable data is overwritten on the first change. Since app task 28, unreadable or version 1 data is first copied once, byte for byte, to `budget-kit:budget:backup` (never overwritten, removed by Delete all data); there is no restore screen.
```

## Acceptance criteria
`V1` is `JSON.stringify({ version: 1, state: SCENARIO })`. "Writes to a key" are counted with a storage wrapper defined in the test file that records `setItem(key, value)` calls per key and delegates to `createMemoryStorage`.

`storage.ts` (`storage.backup.test.ts`):
- [ ] `BACKUP_KEY === 'budget-kit:budget:backup'`.
- [ ] `needsBackup`: `true` for `parseStoredBudget('not json')`, for `{"version":3}` and for `V1`; `false` for `parseStoredBudget(null)`, for `serializeBook(BOOK)` and for `{ status: 'unavailable' }`.
- [ ] `backUpStoredBudget`: with `{ [STORAGE_KEY]: 'x' }` → `'written'` and `BACKUP_KEY` = `'x'`; called again → `'present'`, still one write to `BACKUP_KEY`; with `{ [STORAGE_KEY]: 'x', [BACKUP_KEY]: 'old' }` → `'present'`, `BACKUP_KEY` still `'old'`, no write; with `{}` → `'nothing-stored'`, no write; with `null` → `'failed'`; with a storage whose `setItem` throws → `'failed'`, nothing thrown; with a storage whose `getItem` throws → `'failed'`, no write.
- [ ] Byte-identical: for each of these raw values, after `backUpStoredBudget`, `dump()[BACKUP_KEY] === raw` with `===` (not `toEqual` on parsed JSON): `V1`; `'  {"state":' + JSON.stringify({ ...SCENARIO, categories: [{ id: 'c', name: 'Café ☕ "x"', plannedCents: 1 }] }) + ',"version":1}\n'` (leading spaces, key order reversed, non-ASCII, escaped quotes, trailing newline); `'not json'`; `''` (empty string is stored text, so it is backed up: `'written'`).
- [ ] `removeBackup`: removes the key and returns `true`; with `null` returns `false`; with a storage whose `removeItem` throws returns `false` and does not throw.

Provider (`BudgetProvider.backup.test.tsx`, mounted with `BudgetProvider` and a probe, or `renderWithBudget`):
- [ ] Nothing on load: with `V1`, `'not json'` and `{"version":3,"book":{}}`, after ready and a 20 ms wait (and after `viewMonth` to another available month): zero `setItem` calls and no `BACKUP_KEY`.
- [ ] First change from version 1: `setIncome(500)` → exactly one write to `BACKUP_KEY` with value `=== V1`, then one write to `STORAGE_KEY` (version 2, `incomeCents` 500); the backup write comes first (record call order). A second change writes only `STORAGE_KEY`; `BACKUP_KEY` is still `V1`.
- [ ] First change from invalid: `'not json'` and the unsupported-version value are each backed up byte-identically on the first change; `savedDataReplaced` is `true` afterwards (unchanged).
- [ ] Never for version 2, empty or unavailable: after several changes, no write to `BACKUP_KEY` and no `BACKUP_KEY` in `dump()`.
- [ ] Existing backup kept: seeded `{ [STORAGE_KEY]: V1, [BACKUP_KEY]: 'older' }`, a change leaves `BACKUP_KEY === 'older'` and makes no write to it.
- [ ] No-op and throwing actions make no backup: with `V1`, `deleteExpense('nope')` and an `addExpense` that throws `That change would make a total too large.` (90 `MAX_CENTS` expenses seeded as version 1, then one more) leave `setItem` uncalled for every key.
- [ ] Backup fails, save goes on: with `V1` and a storage that throws `QuotaExceededError` only for `setItem(BACKUP_KEY, …)`: `setIncome(500)` does not throw, the main key is version 2 with `incomeCents` 500, there is no `BACKUP_KEY`, `console.error` and `console.warn` are not called, and nothing in the rendered output changes except the new income. A second change makes no further backup attempt (it does not call `setItem(BACKUP_KEY, …)` again).
- [ ] Backup takes the space: with `V1` and a storage that throws `QuotaExceededError` on any `setItem` after which the summed length of all stored values would exceed `V1.length * 2` (the backup fits exactly; the version 2 value is longer than `V1`, so the save then does not fit until the backup is removed): `setIncome(500)` ends with the main key version 2 (`incomeCents` 500), no `BACKUP_KEY`, and the call sequence `setItem(BACKUP_KEY)`, `setItem(STORAGE_KEY)` (throws), `removeItem(BACKUP_KEY)`, `setItem(STORAGE_KEY)`.
- [ ] Failed first save: with `V1` and a storage where every `setItem` throws until a flag is cleared: `setIncome(1)` leaves `STORAGE_KEY === V1` and no backup; clear the flag; `setIncome(2)` writes `BACKUP_KEY === V1` then the version 2 main key with `incomeCents` 2.
- [ ] StrictMode: inside `<StrictMode>`, seeded `V1`: after ready, zero writes; one `addCategory` writes `BACKUP_KEY` exactly once and `STORAGE_KEY` exactly once; no console errors or warnings.
- [ ] Delete all data removes it: (a) `V1`, one change (backup written), then `deleteAllData()`: `dump()` is exactly `{ [STORAGE_KEY]: '{"version":2,"book":{"months":[]}}' }`; (b) version 2 `BOOK` seeded with `[BACKUP_KEY]: 'older'`, `deleteAllData()`: `BACKUP_KEY` absent; (c) `V1`, `deleteAllData()` as the first change: no write to `BACKUP_KEY` and no `BACKUP_KEY` afterwards; a later change in the same session makes no backup.
- [ ] Delete all data with a failing remove: a storage whose `removeItem` throws: `deleteAllData()` does not throw, the main key is the empty book, no error is shown or logged.
- [ ] The public context is unchanged: the keys of the ready `useBudget()` value are exactly the same set as before this task (list them in the test), and `BudgetActions` has the same seven functions.

Existing tests:
- [ ] Updated as listed under "Existing tests" below; every other existing test passes unedited.

Blanket:
- [ ] `styling.rules.test.ts` passes unchanged; no `any`, `@ts-ignore` or `@ts-expect-error`; `storage.ts` still has no `'use client'`; `npm run check` passes.

### Existing tests
These count every `setItem` call and now see the backup write too. Change only the number (or split it per key); keep the rest:
- `state/BudgetProvider.test.tsx`, test `the first change overwrites invalid data`: `expect(storage.setItemCalls).toBe(1)` becomes `toBe(2)`, and add `expect(storage.getItem(BACKUP_KEY)).toBe('garbage')`.
- `state/BudgetProvider.test.tsx`, describe `no-op actions`, test `do not save, keep garbage byte-identical and keep the state object identical; a real change then overwrites`: the final `expect(storage.setItemCalls).toBe(1)` becomes `toBe(2)` (the earlier `toBe(0)` stays).
- `state/BudgetProvider.months.test.tsx`, test `first change writes version 2 with exactly one month, income changed, all else intact`: `expect(storage.setItemCalls).toBe(1)` becomes `toBe(2)`, and add `expect(storage.dump()[BACKUP_KEY]).toBe(V1_SCENARIO)`.

Checked and expected to pass unedited (they assert per key, use version 2 data, or make every write fail): the `savedDataReplaced` describe block in `BudgetProvider.test.tsx`, `a failed save is ignored…`, `a save that fails once…`, the StrictMode tests (version 2 data), `deleteAllData over invalid data counts as replacing it` in `BudgetProvider.months.test.tsx`, `App.e2e.test.tsx` (Migration, Saved-data messages, Delete all data assert only `STORAGE_KEY`), `AppShell.test.tsx`, `HistoryPage.test.tsx` (version 2 `BOOK`). If any other test fails only because of the extra backup write, QA updates its count the same way and lists it in the report.

## Manual browser checks (`npm run dev`)
- With data saved by the pre-redesign app (`main` before the redesign) in the same browser profile: load the redesigned app; DevTools → Application → Local Storage shows only `budget-kit:budget` (version 1). Change the income: `budget-kit:budget:backup` appears with the old text, byte for byte (copy both into a diff tool), and `budget-kit:budget` is version 2.
- Set `budget-kit:budget` to `not json` with no backup key, reload, type an income: the backup key holds `not json`; the visible messages are unchanged.
- History → Delete all data → confirm: the backup key is gone.
- Fill storage close to the quota (for example a large dummy key from the console) with version 1 data saved: a change still saves the new version 2 value; no error appears on the page.

## Assumptions
- The backup is the raw text read from `budget-kit:budget` just before the first overwrite (not a copy kept from load time). Because loading never writes and no other code writes that key, it is the same text that was loaded; if another tab changed it meanwhile, the text about to be overwritten is what is kept, which is the point.
- "Only if absent" is absolute: an earlier backup is never replaced, even by a later incident. The first incident's data is usually the one worth keeping, and replacing would need rules about which copy wins.
- Unreadable data of either reason (corrupt or unsupported version) and valid version 1 data are backed up; version 2 data is not (it is what this app writes; backing it up would double storage on every first change).
- If the backup itself fills the quota and makes the main save fail, the backup is dropped and the save retried once. A save the person asked for beats a backup they do not know about.
- `Delete all data` removes the backup unconditionally, including one from an earlier session.
- No UI: no restore screen, no message about the backup, nothing on `useBudget()`.

## Out of scope
- A recover-from-backup UI or any message about the backup (for the lead: possible follow-up, see the follow-ups plan open questions).
- Backing up version 2 data, rotating backups, or a backup per month.
- Changing parsing, migration, `saveBook` or the saved-data messages.
