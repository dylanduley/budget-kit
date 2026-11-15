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

export const STORAGE_KEY = 'budget-kit:budget';
export const STORAGE_VERSION = 1;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LoadResult =
  | { status: 'empty' }
  | { status: 'loaded'; state: BudgetState }
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

export function parseStoredBudget(raw: string | null): LoadResult {
  if (raw === null) return { status: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'invalid', reason: 'corrupt' };
  }
  if (!isRecord(parsed)) return { status: 'invalid', reason: 'corrupt' };
  const { version, state } = parsed;
  if (typeof version !== 'number' || !Number.isInteger(version)) return { status: 'invalid', reason: 'corrupt' };
  if (version !== STORAGE_VERSION) return { status: 'invalid', reason: 'unsupported-version' };
  if (!isBudgetState(state)) return { status: 'invalid', reason: 'corrupt' };
  const copy = copyState(state);
  if (!canBeTotalled(copy)) return { status: 'invalid', reason: 'corrupt' };
  return { status: 'loaded', state: copy };
}

export function serializeBudget(state: BudgetState): string {
  return JSON.stringify({ version: STORAGE_VERSION, state });
}

export function loadBudget(storage: StorageLike | null): LoadResult {
  if (storage === null) return { status: 'unavailable' };
  try {
    return parseStoredBudget(storage.getItem(STORAGE_KEY));
  } catch {
    return { status: 'unavailable' };
  }
}

export function saveBudget(storage: StorageLike | null, state: BudgetState): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(STORAGE_KEY, serializeBudget(state));
    return true;
  } catch {
    return false;
  }
}
