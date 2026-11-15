import {
  type BudgetState,
  type Category,
  type Expense,
  MAX_CENTS,
  getCategorySummaries,
  getTotals,
  isIsoDate,
  isIsoMonth,
} from '@/lib/budget';
import type { BudgetBook } from '@/lib/months';

export const STORAGE_KEY = 'budget-kit:budget';
export const STORAGE_VERSION = 2;
export const BACKUP_KEY = 'budget-kit:budget:backup';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LoadResult =
  | { status: 'empty' }
  | { status: 'loaded'; book: BudgetBook; fromVersion: 1 | 2 }
  | { status: 'invalid'; reason: 'corrupt' | 'unsupported-version' }
  | { status: 'unavailable' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCents(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= MAX_CENTS;
}

function isCategory(value: unknown): value is Category {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id !== '' &&
    typeof value.name === 'string' &&
    isCents(value.plannedCents, 0)
  );
}

function isExpense(value: unknown): value is Expense {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id !== '' &&
    typeof value.categoryId === 'string' &&
    isCents(value.amountCents, 1) &&
    typeof value.note === 'string' &&
    typeof value.date === 'string' &&
    isIsoDate(value.date)
  );
}

function hasUniqueIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

export function isBudgetState(value: unknown): value is BudgetState {
  if (!isRecord(value)) return false;
  const { month, incomeCents, categories, expenses } = value;
  if (typeof month !== 'string' || !isIsoMonth(month)) return false;
  if (!isCents(incomeCents, 0)) return false;
  if (!Array.isArray(categories) || !categories.every(isCategory) || !hasUniqueIds(categories)) return false;
  if (!Array.isArray(expenses) || !expenses.every(isExpense) || !hasUniqueIds(expenses)) return false;
  return true;
}

// Per-amount limits do not bound the sums, so totalling a valid-looking state can still throw.
export function canBeTotalled(state: BudgetState): boolean {
  try {
    getTotals(state);
    getCategorySummaries(state);
    return true;
  } catch {
    return false;
  }
}

// Rebuilds the state from known fields only, so unknown stored keys never reach the app.
function copyState(state: BudgetState): BudgetState {
  return {
    month: state.month,
    incomeCents: state.incomeCents,
    categories: state.categories.map((c) => ({ id: c.id, name: c.name, plannedCents: c.plannedCents })),
    expenses: state.expenses.map((e) => ({
      id: e.id,
      categoryId: e.categoryId,
      amountCents: e.amountCents,
      note: e.note,
      date: e.date,
    })),
  };
}

function validMonth(value: unknown): BudgetState | null {
  if (!isBudgetState(value)) return null;
  const copy = copyState(value);
  return canBeTotalled(copy) ? copy : null;
}

function parseBook(book: unknown): BudgetBook | null {
  if (!isRecord(book) || !Array.isArray(book.months)) return null;
  const months: BudgetState[] = [];
  for (const item of book.months) {
    const month = validMonth(item);
    if (month === null) return null;
    months.push(month);
  }
  if (new Set(months.map((m) => m.month)).size !== months.length) return null;
  months.sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
  return { months };
}

export function parseStoredBudget(raw: string | null): LoadResult {
  if (raw === null) return { status: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'invalid', reason: 'corrupt' };
  }
  if (!isRecord(parsed)) return { status: 'invalid', reason: 'corrupt' };
  const { version } = parsed;
  if (typeof version !== 'number' || !Number.isInteger(version)) return { status: 'invalid', reason: 'corrupt' };
  if (version === 1) {
    const state = validMonth(parsed.state);
    if (state === null) return { status: 'invalid', reason: 'corrupt' };
    return { status: 'loaded', book: { months: [state] }, fromVersion: 1 };
  }
  if (version === STORAGE_VERSION) {
    const book = parseBook(parsed.book);
    if (book === null) return { status: 'invalid', reason: 'corrupt' };
    return { status: 'loaded', book, fromVersion: 2 };
  }
  return { status: 'invalid', reason: 'unsupported-version' };
}

export function serializeBook(book: BudgetBook): string {
  return JSON.stringify({ version: STORAGE_VERSION, book: { months: book.months } });
}

export function loadBudget(storage: StorageLike | null): LoadResult {
  if (storage === null) return { status: 'unavailable' };
  try {
    return parseStoredBudget(storage.getItem(STORAGE_KEY));
  } catch {
    return { status: 'unavailable' };
  }
}

export function saveBook(storage: StorageLike | null, book: BudgetBook): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(STORAGE_KEY, serializeBook(book));
    return true;
  } catch {
    return false;
  }
}

export type BackupResult = 'written' | 'present' | 'nothing-stored' | 'failed';

/** True for a load the first save would overwrite with something the old app cannot read. */
export function needsBackup(result: LoadResult): boolean {
  return result.status === 'invalid' || (result.status === 'loaded' && result.fromVersion === 1);
}

/** Copies the raw STORAGE_KEY text to BACKUP_KEY unless BACKUP_KEY already holds something. Never throws. */
export function backUpStoredBudget(storage: StorageLike | null): BackupResult {
  if (storage === null) return 'failed';
  try {
    if (storage.getItem(BACKUP_KEY) !== null) return 'present';
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return 'nothing-stored';
    storage.setItem(BACKUP_KEY, raw);
    return 'written';
  } catch {
    return 'failed';
  }
}

/** Removes BACKUP_KEY. Never throws. Returns false if removeItem threw or storage is null. */
export function removeBackup(storage: StorageLike | null): boolean {
  if (storage === null) return false;
  try {
    storage.removeItem(BACKUP_KEY);
    return true;
  } catch {
    return false;
  }
}
