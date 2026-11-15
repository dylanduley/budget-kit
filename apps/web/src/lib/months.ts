import {
  type BudgetState,
  createInitialState,
  getTotals,
  isIsoMonth,
} from '@/lib/budget';

export interface BudgetBook { months: BudgetState[] }

export interface MonthSummary {
  month: string;
  incomeCents: number;
  spentCents: number;
  leftToSpendCents: number;
  hasIncome: boolean;
  isStored: boolean;
}

export const EMPTY_BOOK: BudgetBook = Object.freeze({ months: Object.freeze([]) as unknown as BudgetState[] });

export function findMonth(book: BudgetBook, month: string): BudgetState | undefined {
  return book.months.find((candidate) => candidate.month === month);
}

export function copySourceFor(book: BudgetBook, month: string): BudgetState | undefined {
  let source: BudgetState | undefined;
  for (const candidate of book.months) {
    if (candidate.month < month && (source === undefined || candidate.month > source.month)) {
      source = candidate;
    }
  }
  return source;
}

export function startMonth(book: BudgetBook, month: string): BudgetState {
  if (!isIsoMonth(month)) throw new RangeError(`Not an ISO month: ${month}`);
  const source = copySourceFor(book, month);
  if (source === undefined) return createInitialState(month);
  return {
    month,
    incomeCents: source.incomeCents,
    categories: source.categories.map((c) => ({ id: c.id, name: c.name, plannedCents: c.plannedCents })),
    expenses: [],
  };
}

export function monthToShow(book: BudgetBook, month: string): BudgetState {
  return findMonth(book, month) ?? startMonth(book, month);
}

export function putMonth(book: BudgetBook, state: BudgetState): BudgetBook {
  const months = book.months.filter((candidate) => candidate.month !== state.month);
  months.push(state);
  months.sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
  return { months };
}

export function availableMonths(book: BudgetBook, currentMonth: string): string[] {
  return Array.from(new Set([...book.months.map((m) => m.month), currentMonth])).sort();
}

export function adjacentMonth(months: readonly string[], month: string, step: -1 | 1): string | null {
  const index = months.indexOf(month);
  if (index === -1) return null;
  return months[index + step] ?? null;
}

export function monthSummaries(book: BudgetBook, currentMonth: string): MonthSummary[] {
  return availableMonths(book, currentMonth)
    .reverse()
    .map((month) => {
      const totals = getTotals(monthToShow(book, month));
      return {
        month,
        incomeCents: totals.incomeCents,
        spentCents: totals.spentCents,
        leftToSpendCents: totals.leftToSpendCents,
        hasIncome: totals.hasIncome,
        isStored: findMonth(book, month) !== undefined,
      };
    });
}
