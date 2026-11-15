# 02: Persistence and app state

Versioned, validated `localStorage` storage; a reducer over the task 01 functions; a `BudgetProvider` that loads after mount (no hydration mismatch, no flash of default content) and saves after every user action; the app skeleton in `page.tsx`; and the shared test set-up every later task uses.

**Depends on**: 01

**Parallel group**: 1 (runs alone)

**Status (2026-11-15)**: built, reviewed and merged. The review added behaviours **N1–N8** below, all now implemented. N8 was added by the planner so screen tasks can test a throwing action.
- **N1** load treats data that cannot be totalled as `corrupt`; **N2** actions refuse changes that would make a total unsafe (`RangeError` `That change would make a total too large.`); **N3** no-op actions neither save nor change state; **N4** `savedDataReplaced`; **N5** `createId` fallback without `crypto.randomUUID`; **N6** skeleton heading wrapper `flex flex-col gap-2`; **N7** `renderWithBudget` seeds through the memory storage's initial data and returns the memory-storage type; **N8** `BudgetContext` export and `renderWithFakeBudget` helper.

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
- `apps/web/src/lib/clock.ts` (no directive): `todayIso`
- `apps/web/src/state/storage.ts` (no directive)
- `apps/web/src/state/budgetReducer.ts` (no directive)
- `apps/web/src/state/BudgetProvider.tsx` (`'use client';`): `BudgetProvider`, `useBudget`
- `apps/web/src/features/BudgetApp.tsx` (`'use client';`): the skeleton below
- `apps/web/src/app/page.tsx`: replace the placeholder with `<BudgetProvider><BudgetApp /></BudgetProvider>` (stays a server component)
- Test infrastructure (builder writes these; they are not product code):
  - `apps/web/vitest.config.ts`: add `setupFiles: ['./src/test/setup.ts']`; nothing else changes
  - `apps/web/src/test/setup.ts`: `import '@testing-library/jest-dom/vitest'`; `afterEach`: RTL `cleanup()`, `window.localStorage.clear()`, `vi.restoreAllMocks()`
  - `apps/web/src/test/memoryStorage.ts`, `renderWithBudget.tsx`, `axe.ts`, `fixtures.ts` (below); `renderWithFakeBudget.tsx` **(new, N8)**
  - `apps/web/package.json`: add devDependencies `"@testing-library/user-event": "^14.6.10"` and `"axe-core": "^4.14.0"` (same versions already installed for `packages/ui`) and update `package-lock.json` with `npm install -D -w @budget-kit/web …`. **Approved by the lead.**
- QA: `storage.test.ts`, `budgetReducer.test.ts`, `BudgetProvider.test.tsx`, `clock.test.ts`, `src/features/BudgetApp.hydration.test.tsx`

## API / Props
```ts
// lib/clock.ts
export function todayIso(now?: Date): string;   // local calendar date of `now` (default new Date()), 'YYYY-MM-DD'

// state/storage.ts
export const STORAGE_KEY = 'budget-kit:budget';
export const STORAGE_VERSION = 1;
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type LoadResult =
  | { status: 'empty' }
  | { status: 'loaded'; state: BudgetState }
  | { status: 'invalid'; reason: 'corrupt' | 'unsupported-version' }
  | { status: 'unavailable' };
export function isBudgetState(value: unknown): value is BudgetState;
export function parseStoredBudget(raw: string | null): LoadResult;      // pure; never 'unavailable'
export function serializeBudget(state: BudgetState): string;            // JSON of { version: 1, state }
export function loadBudget(storage: StorageLike | null): LoadResult;    // never throws
export function saveBudget(storage: StorageLike | null, state: BudgetState): boolean; // never throws
export function canBeTotalled(state: BudgetState): boolean; // (new, N1) false if getTotals or getCategorySummaries throws

// state/budgetReducer.ts
export type BudgetAction =
  | { type: 'setIncome'; incomeCents: number }
  | { type: 'addCategory'; input: NewCategory; id: string }
  | { type: 'updateCategory'; id: string; patch: CategoryPatch }
  | { type: 'removeCategory'; id: string }
  | { type: 'addExpense'; input: NewExpense; id: string }
  | { type: 'deleteExpense'; id: string }
  | { type: 'reset'; month: string };
export function budgetReducer(state: BudgetState, action: BudgetAction): BudgetState;

// state/BudgetProvider.tsx
export const TOTAL_TOO_LARGE_MESSAGE = 'That change would make a total too large.'; // (new, N2)
export interface BudgetActions {
  setIncome(incomeCents: number): void;
  addCategory(input: NewCategory): string;              // returns the new id
  updateCategory(id: string, patch: CategoryPatch): void;
  removeCategory(id: string): void;
  addExpense(input: NewExpense): string;                // returns the new id
  deleteExpense(id: string): void;
  resetMonth(): void;
}
export type BudgetContextValue =
  | { status: 'loading' }
  | {
      status: 'ready';
      state: BudgetState;
      today: string;                                     // 'YYYY-MM-DD', read once at load
      currentMonth: string;                              // monthOf(today)
      isOtherMonth: boolean;                             // state.month !== currentMonth
      generation: number;                                // 0 after load, +1 on every resetMonth
      loadStatus: LoadResult['status'];
      savedDataReplaced: boolean;                        // (new, N4)
      actions: BudgetActions;
    };
export interface BudgetProviderProps {
  children: ReactNode;
  storage?: StorageLike | null;   // undefined: window.localStorage (looked up in the load effect); null: memory only
  getToday?: () => string;        // default () => todayIso()
  createId?: () => string;        // default defaultCreateId (N5: randomUUID, else getRandomValues, else counter + Math.random)
}
export function BudgetProvider(props: BudgetProviderProps): ReactElement;
export function useBudget(): BudgetContextValue;       // throws Error outside a provider
export const BudgetContext: Context<BudgetContextValue | null>; // (new, N8) exported for test helpers only
```

### Test helpers (`src/test/`)
```ts
// memoryStorage.ts
export function createMemoryStorage(
  initial?: Record<string, string>,
  options?: { throwOnGet?: boolean; throwOnSet?: boolean },
): MemoryStorage;
export type MemoryStorage = StorageLike & { dump(): Record<string, string>; setItemCalls: number };

// renderWithBudget.tsx
export interface RenderWithBudgetOptions {
  storage?: MemoryStorage;        // default: a new memory storage
  state?: BudgetState;            // (N7) without `storage`: the new memory storage is created with
                                  // { [STORAGE_KEY]: serializeBudget(state) } as initial data, so setItemCalls starts at 0.
                                  // Pass `state` or `storage`, not both (a seeded storage is built with createMemoryStorage).
  today?: string;                 // default '2026-11-14'
}
export function renderWithBudget(ui: ReactElement, options?: RenderWithBudgetOptions): RenderResult & {
  user: UserEvent;                // userEvent.setup()
  storage: MemoryStorage;        // (N7) the concrete type, so tests can read setItemCalls and dump()
  refresh(): RenderResult;        // unmount, then render the same ui with the same storage and today: a page refresh
  readStored(): BudgetState | null; // parseStoredBudget(storage.getItem(STORAGE_KEY)) state, or null
};
// ids from createId are 'id-1', 'id-2', … (a fresh counter per render). renderWithBudget awaits nothing;
// tests use findBy* to wait for the ready state.

// renderWithFakeBudget.tsx (new, N8): no provider and no storage; a fixed ready value
export function renderWithFakeBudget(ui: ReactElement, options: {
  state: BudgetState;
  today?: string;                          // default '2026-11-14'
  actions?: Partial<BudgetActions>;        // overrides; e.g. { addExpense: () => { throw new RangeError(TOTAL_TOO_LARGE_MESSAGE) } }
}): RenderResult & { user: UserEvent; actions: { [K in keyof BudgetActions]: Mock<BudgetActions[K]> } };
// Renders ui inside <BudgetContext.Provider value={ready value}>. Every action is a vi.fn: the override if given,
// else a no-op (returning 'fake-id' for addCategory/addExpense). The state never changes, so tests assert on the
// mocks and on what the screen shows. currentMonth/isOtherMonth derive from today; generation 0; loadStatus 'loaded';
// savedDataReplaced false.

// axe.ts
export async function expectNoAxeViolations(root?: Element): Promise<void>;
// runs axe-core on root (default document.body) with only 'color-contrast' disabled (jsdom has no layout);
// fails listing { id, help, nodes[].html } for every violation.

// fixtures.ts
export const SCENARIO: BudgetState;            // state S from task 01, exactly
export const SCENARIO_TODAY = '2026-11-14';
```

## Behaviour
### Storage
- Stored value under `STORAGE_KEY`: `JSON.stringify({ version: 1, state })`.
- `parseStoredBudget`: `null` → `empty`. Unparseable JSON, a non-object, or a missing/non-integer `version` → `invalid/corrupt`. An integer `version` other than 1 → `invalid/unsupported-version`. Version 1 whose `state` fails `isBudgetState` → `invalid/corrupt`. Otherwise `loaded` with a fresh copy of the state that has **only** the known fields (unknown extra fields anywhere are dropped).
- `isBudgetState` requires: `month` passes `isIsoMonth`; `incomeCents` a safe integer in `0..MAX_CENTS`; `categories` an array of `{ id: non-empty string, name: string, plannedCents: integer 0..MAX_CENTS }` with unique ids; `expenses` an array of `{ id: non-empty string, categoryId: string, amountCents: integer 1..MAX_CENTS, note: string, date: isIsoDate }` with unique ids. An expense's `categoryId` need not exist (removed categories). Floats (`1250.5`), strings (`"1250"`), negatives and `null` fail.
- `loadBudget` / `saveBudget` catch every exception (e.g. `SecurityError`, `QuotaExceededError`): load returns `unavailable`, save returns `false`. `null` storage: load returns `unavailable`, save returns `false`.

### Provider
- Server render and the first client render produce `{ status: 'loading' }`. Nothing reads storage, the clock or `crypto` during render.
- One `useEffect` after mount: resolves storage (`props.storage`, or `window.localStorage` inside a `try`, `null` if that throws), calls `getToday()` once, `loadBudget`. `loaded` → that state; anything else → `createInitialState(monthOf(today))`. Then `status: 'ready'`, `generation: 0`.
- **(new, N1) Totals safety on load**: a version-1 value that passes `isBudgetState` but fails `canBeTotalled` (for example 91 categories each planned at `MAX_CENTS`, or 91 expenses of `MAX_CENTS` in the month) is `invalid/corrupt`, handled like any other invalid data (initial state, raw value untouched until the first change). `parseStoredBudget` applies this check, so `loadBudget` does too.
- **(new, N2) Totals safety on every action**: after the reducer returns the new state and before it is stored in React state or saved, the provider checks `canBeTotalled`. If it fails, the action throws `new RangeError(TOTAL_TOO_LARGE_MESSAGE)` (exactly `That change would make a total too large.`) and changes neither state nor storage. Invariant: any state the provider holds can always be totalled. Errors thrown by the reducer itself (task 01 validation) also propagate with state and storage unchanged.
- **(new, N3) No-ops**: if the reducer returns the identical object (`===`), the action changes nothing and does not save (e.g. `deleteExpense('nope')`, `removeCategory('nope')`).
- **(new, N4) `savedDataReplaced`**: `false` at load; becomes `true` after the first successful save following a load whose `loadStatus` was `'invalid'`; always `false` when `loadStatus` is `'loaded'`, `'empty'` or `'unavailable'`. `loadStatus` keeps its meaning (how the data was loaded) and does not change after saves.
- **(new, N5) `defaultCreateId`**: `crypto.randomUUID()` when it is a function; else a UUID-v4-format string built from `crypto.getRandomValues`; else a counter plus `Math.random` (non-secure dev origins such as a LAN IP over http). Ids are unique within a page load in every case.
- **Loading never writes.** Storage is written only after a user action: each action dispatches to `budgetReducer` and the new state is saved with `saveBudget` (in an effect or right after dispatch). Corrupt, unsupported or empty data is therefore left untouched until the first change, which overwrites it.
- **No automatic rollover** (lead decision): a loaded budget keeps its stored `month` even when `today` is in another month; nothing is changed or deleted on load. The provider only exposes `currentMonth` and `isOtherMonth` so the page can show the rollover notice (task 07) and the user decides.
- `resetMonth` dispatches `{ type: 'reset', month: monthOf(today) }` (the reducer returns `createInitialState(month)`), increments `generation`, and saves.
- Actions that throw (task 01 validation, or N2) propagate; screens validate before calling and catch what still throws (Conventions, "Action errors").
- A failed save is ignored: the app keeps working in memory.
- `actions` is stable across renders (`useMemo`/`useCallback`), so screens can list it in effect dependencies.

### Skeleton (`features/BudgetApp.tsx`)
- Loading: `<main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6" aria-busy="true">` containing `<h1>Budget Kit</h1>` and `<p>Loading your budget…</p>`.
- Ready: the same `<main>` without `aria-busy`, containing a `<div className="flex flex-col gap-2">` **(N6)** with the `<h1>Budget Kit</h1>` and `<p>Budget for {formatMonth(state.month)}</p>`. Later tasks add one line each below it, in the order given in the README; this task adds no screen.
- The `h1` uses `text-2xl font-semibold text-text`; the month line `text-text-muted`.

## Screens / states
Loading; ready (heading and month only).

## Acceptance criteria
Storage (unit, no React):
- [ ] `serializeBudget(SCENARIO)` then `parseStoredBudget` returns `{ status: 'loaded', state }` with `state` `toEqual` `SCENARIO`.
- [ ] `parseStoredBudget` returns `empty` for `null`; `invalid/corrupt` for `'not json'`, `'null'`, `'[]'`, `'{}'`, `'{"version":"1","state":…}'`, and for version 1 with each of: `incomeCents: 1250.5`, `incomeCents: "1250"`, `incomeCents: -1`, a category `plannedCents: null`, an expense `amountCents: 0`, an expense `date: '2026-11-31'`, `month: '2026-13'`, two categories with the same id, `expenses` missing; `invalid/unsupported-version` for `version: 2` and `version: 0`.
- [ ] A stored state with an extra field (`state.theme`, and `categories[0].colour`) loads, and the loaded state has no such keys.
- [ ] An expense whose `categoryId` matches no category loads.
- [ ] `loadBudget` with `createMemoryStorage({}, { throwOnGet: true })` returns `unavailable`; `saveBudget` with `throwOnSet` returns `false`; neither throws; both return the same with `null`.

Reducer:
- [ ] Each action type returns what the matching task 01 function returns (`toEqual`) for `SCENARIO`; `reset` with `'2026-12'` returns `createInitialState('2026-12')`; the input state is not mutated (deep-frozen input does not throw).

Provider:
- [ ] Outside a provider, `useBudget()` throws an `Error`.
- [ ] Loads saved data: with storage seeded with `SCENARIO`, a probe component shows `ready`, `loadStatus` `loaded`, and `state` equal to `SCENARIO`.
- [ ] Empty storage: state equals `createInitialState('2026-11')` when `getToday` returns `'2026-11-14'`; `loadStatus` is `empty`.
- [ ] Missing, corrupt or old data: for each of storage values `'not json'`, `{"version":2,…}` and a version-1 value with `incomeCents: "1250"`, the state equals `createInitialState('2026-11')`, `loadStatus` is `invalid`, and the stored string is byte-identical after load.
- [ ] Loading never writes: with storage seeded with `SCENARIO`, after the ready state is shown `setItemCalls` is `0`.
- [ ] Saves after each action: after `setIncome(500)`, `readStored().incomeCents` is `500`; after `addExpense` (Groceries, `8247`, `'2026-11-03'`), the stored state contains that expense with id `'id-1'`.
- [ ] Survives a refresh: perform `setIncome(320000)` and `addCategory({ name: 'Pets', plannedCents: 2500 })`, call `refresh()`; the reloaded state equals the state before the refresh.
- [ ] `resetMonth` with `getToday` returning `'2026-12-02'` and a `SCENARIO`-seeded storage gives state `createInitialState('2026-12')`, `generation` `1`, and the stored state equals it.
- [ ] No silent rollover: with storage seeded with `SCENARIO` (month `2026-11`) and `getToday` returning `'2026-12-02'`, the state equals `SCENARIO`, `currentMonth` is `'2026-12'`, `isOtherMonth` is `true`, and `setItemCalls` is `0`. With `'2026-11-30'`, `isOtherMonth` is `false`. With `'2026-10-15'` (clock moved back), `isOtherMonth` is `true` and the state is still `SCENARIO`.
- [ ] Storage unavailable: with `throwOnGet` and `throwOnSet`, the provider reaches `ready` with the initial state, `loadStatus` `unavailable`, and `setIncome(500)` still updates the in-memory state to `500` with no error thrown or logged.
- [ ] **(N1)** `parseStoredBudget` returns `invalid/corrupt`, and the provider starts from `createInitialState('2026-11')` with `loadStatus` `invalid` and the stored string byte-identical, for: a version-1 state with 91 categories each planned at `MAX_CENTS`; and one with 91 Transport expenses of `MAX_CENTS` dated in the month. The same state with 90 of either loads.
- [ ] **(N2)** Seeded with 90 expenses of `MAX_CENTS` (one category), `actions.addExpense` of another `MAX_CENTS` throws a `RangeError` whose message is exactly `That change would make a total too large.`; afterwards the state still has 90 expenses, `setItemCalls` is unchanged, and the next valid action (e.g. `setIncome(500)`) works and saves. The same for `addCategory` with planned `MAX_CENTS` on a state with 90 categories each at `MAX_CENTS`, and for `updateCategory` raising the planned amount of a 91st category (planned 0) to `MAX_CENTS` on a state whose other 90 categories are each at `MAX_CENTS`.
- [ ] **(N2)** A reducer validation error (e.g. `addExpense` with amount `0`) propagates as the task 01 `RangeError` (not the total message), with state and storage unchanged.
- [ ] **(N3)** `deleteExpense('nope')`, `removeCategory('nope')` and `updateCategory('nope', { name: 'x' })` leave `setItemCalls` unchanged and the state object identical (a probe's `useBudget().state` is `toBe` the previous one).
- [ ] **(N4)** `savedDataReplaced` is `false` after loading `'not json'`, becomes `true` after `setIncome(500)` (and the stored value is now valid JSON of the new state), and stays `false` after the same action when the load was `loaded`, `empty` or `unavailable` (with `throwOnSet`, an attempted save that fails keeps it `false`).
- [ ] **(N5)** With `crypto.randomUUID` stubbed to `undefined`, two `addCategory` calls without an injected `createId` give two different non-empty ids; with both `randomUUID` and `getRandomValues` stubbed away, the same holds.
- [ ] **(N6)** In the ready skeleton the `h1`'s parent element has the classes `flex flex-col gap-2`.
- [ ] **(N7)** `renderWithBudget(ui, { state: SCENARIO })`: `storage.setItemCalls` is `0` after the ready state appears, and `storage.dump()` holds the serialized `SCENARIO`.
- [ ] **(N8)** `renderWithFakeBudget(<Probe />, { state: SCENARIO, actions: { setIncome: () => { throw new RangeError(TOTAL_TOO_LARGE_MESSAGE) } } })` renders a ready value with that state; calling `setIncome` throws that error and the returned `actions.setIncome` mock records the call; un-overridden actions are mocks that return `undefined` (or `'fake-id'`).
- [ ] `getToday` and `createId` are never called during render: `renderToString` of the provider with spies for both calls each `0` times; after a client mount `getToday` has been called exactly once.

Hydration (`BudgetApp.hydration.test.tsx`):
- [ ] `renderToString(<BudgetProvider storage={seeded with SCENARIO}><BudgetApp /></BudgetProvider>)` contains `Loading your budget…` and `Budget Kit`, and does not contain `November 2026`.
- [ ] Putting that HTML in a container and calling `hydrateRoot` (inside `act`) with an `onRecoverableError` spy: the spy is never called, `console.error` is never called, and afterwards the container shows `Budget for November 2026`.
- [ ] The loading `main` has `aria-busy="true"`; the ready `main` has no `aria-busy`; both have exactly one `h1`, `Budget Kit`.

Blanket:
- [ ] `page.tsx` and `layout.tsx` have no `'use client'`; `BudgetProvider.tsx` and `BudgetApp.tsx` start with it; `storage.ts`, `budgetReducer.ts` and `clock.ts` do not import `react`.
- [ ] `expectNoAxeViolations` passes on the ready skeleton, and fails (QA proves it once) on a test-only fragment containing an `<img>` without `alt`.
- [ ] No `any`, `@ts-ignore` or `@ts-expect-error` in non-test files; styling rules in Conventions hold (grep).
- [ ] `npm run check` passes, including the app's tests.

## Manual browser checks
- `npm run dev`, open localhost:3000 with a saved budget: no visible flash of the default (empty) state before the saved month appears; no hydration warning in the console.
- DevTools → Application → Local Storage: `budget-kit:budget` is created only after the first change.
- Set the stored value to `garbage` and reload: the app starts fresh and works; the garbage is replaced after the first change.

## Assumptions
- One storage key; version 1 is the first version, so "old version" means any other version, which is discarded (no migrations yet).
- Invalid or unsupported data is not loaded; the page tells the user (`loadStatus: 'invalid'`, notice in task 08) and the raw value stays in storage until the first change.
- No cross-tab sync (`storage` events): two open tabs overwrite each other.
- `today` is read once per page load; the app does not react to midnight passing (a month change shows up on the next load).
- `crypto.randomUUID` exists in supported browsers and in jsdom; tests inject `createId` anyway.
- The builder sets up test infrastructure (setup file, helpers, two dev dependencies); QA writes the tests.

## Out of scope
- Any screen (tasks 03–07), the rollover and saved-data notices (07, 08), migrations, multi-month history, export/import.
- Changing `layout.tsx`, `globals.css`, the root `package.json` or lint config.
