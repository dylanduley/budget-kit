import { describe, expect, it } from 'vitest';
import {
  MAX_CENTS,
  SUGGESTED_CATEGORIES,
  addCategory,
  addExpense,
  categoryLabel,
  categoryNameError,
  createInitialState,
  datesInMonth,
  defaultExpenseDate,
  deleteExpense,
  expensesForMonth,
  formatMonth,
  getCategorySummaries,
  getTotals,
  isDateInMonth,
  isIsoDate,
  isIsoMonth,
  monthOf,
  removeCategory,
  setIncome,
  sumCents,
  updateCategory,
} from './budget';
import type { BudgetState, BudgetTotals, Category, CategorySummary, Expense } from './budget';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

function expectRangeError(fn: () => unknown): void {
  expect(thrown(fn)).toBeInstanceOf(RangeError);
}

// A plain Error: thrown, but not a RangeError.
function expectPlainError(fn: () => unknown): void {
  const error = thrown(fn);
  expect(error).toBeInstanceOf(Error);
  expect(error).not.toBeInstanceOf(RangeError);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`No item at index ${index}`);
  return item;
}

const RENT = 'suggested-rent';
const GROCERIES = 'suggested-groceries';
const TRANSPORT = 'suggested-transport';
const UTILITIES = 'suggested-utilities';
const EATING_OUT = 'suggested-eating-out';

// The base state S of the worked examples, written out literally so it does not depend on the code under test.
function makeS(): BudgetState {
  return {
    month: '2026-11',
    incomeCents: 320000,
    categories: [
      { id: RENT, name: 'Rent', plannedCents: 150000 },
      { id: GROCERIES, name: 'Groceries', plannedCents: 40000 },
      { id: TRANSPORT, name: 'Transport', plannedCents: 12000 },
      { id: UTILITIES, name: 'Utilities', plannedCents: 15000 },
      { id: EATING_OUT, name: 'Eating out', plannedCents: 10000 },
    ],
    expenses: [
      { id: 'e1', categoryId: RENT, amountCents: 150000, note: 'November rent', date: '2026-11-01' },
      { id: 'e2', categoryId: GROCERIES, amountCents: 8247, note: '', date: '2026-11-03' },
      { id: 'e3', categoryId: EATING_OUT, amountCents: 11235, note: 'Birthday dinner', date: '2026-11-05' },
    ],
  };
}

// The SCENARIO of the criteria: the five suggested categories in 2026-11.
function makeScenario(): BudgetState {
  return createInitialState('2026-11');
}

function summary(
  category: Category,
  spentCents: number,
  remainingCents: number,
  isOverBudget: boolean,
  hasPlan: boolean,
): CategorySummary {
  return { category, spentCents, remainingCents, isOverBudget, hasPlan };
}

const CAT = {
  rent: { id: RENT, name: 'Rent', plannedCents: 150000 },
  groceries: { id: GROCERIES, name: 'Groceries', plannedCents: 40000 },
  transport: { id: TRANSPORT, name: 'Transport', plannedCents: 12000 },
  utilities: { id: UTILITIES, name: 'Utilities', plannedCents: 15000 },
  eatingOut: { id: EATING_OUT, name: 'Eating out', plannedCents: 10000 },
} as const;

function zeroSummary(id: string, name: string): CategorySummary {
  return summary({ id, name, plannedCents: 0 }, 0, 0, false, false);
}

const ALL_INVALID_AMOUNTS: readonly number[] = [-1, 12.5, NaN, Infinity, -Infinity, MAX_CENTS + 1, Number.MAX_SAFE_INTEGER + 2];

// ---------------------------------------------------------------------------
// Worked examples
// ---------------------------------------------------------------------------

describe('worked examples: getTotals and getCategorySummaries', () => {
  it('row S', () => {
    const state = makeS();
    const expectedTotals: BudgetTotals = {
      incomeCents: 320000,
      plannedCents: 227000,
      spentCents: 169482,
      leftToSpendCents: 150518,
      unplannedCents: 93000,
      removedCategoriesSpentCents: 0,
      hasIncome: true,
    };
    expect(getTotals(state)).toEqual(expectedTotals);
    expect(getCategorySummaries(state)).toEqual([
      summary(CAT.rent, 150000, 0, false, true),
      summary(CAT.groceries, 8247, 31753, false, true),
      summary(CAT.transport, 0, 12000, false, true),
      summary(CAT.utilities, 0, 15000, false, true),
      summary(CAT.eatingOut, 11235, -1235, true, true),
    ]);
  });

  it('S built through the API equals the literal S, and getTotals agrees', () => {
    let state = createInitialState('2026-11');
    state = setIncome(state, 320000);
    state = updateCategory(state, RENT, { plannedCents: 150000 });
    state = updateCategory(state, GROCERIES, { plannedCents: 40000 });
    state = updateCategory(state, TRANSPORT, { plannedCents: 12000 });
    state = updateCategory(state, UTILITIES, { plannedCents: 15000 });
    state = updateCategory(state, EATING_OUT, { plannedCents: 10000 });
    state = addExpense(state, { categoryId: RENT, amountCents: 150000, note: 'November rent', date: '2026-11-01' }, 'e1');
    state = addExpense(state, { categoryId: GROCERIES, amountCents: 8247, note: '', date: '2026-11-03' }, 'e2');
    state = addExpense(state, { categoryId: EATING_OUT, amountCents: 11235, note: 'Birthday dinner', date: '2026-11-05' }, 'e3');
    expect(state).toEqual(makeS());
  });

  it('row S, then deleteExpense(e2)', () => {
    const state = deleteExpense(makeS(), 'e2');
    expect(getTotals(state)).toEqual({
      incomeCents: 320000,
      plannedCents: 227000,
      spentCents: 161235,
      leftToSpendCents: 158765,
      unplannedCents: 93000,
      removedCategoriesSpentCents: 0,
      hasIncome: true,
    });
    expect(getCategorySummaries(state)).toEqual([
      summary(CAT.rent, 150000, 0, false, true),
      summary(CAT.groceries, 0, 40000, false, true),
      summary(CAT.transport, 0, 12000, false, true),
      summary(CAT.utilities, 0, 15000, false, true),
      summary(CAT.eatingOut, 11235, -1235, true, true),
    ]);
    expect(state.expenses.map((e) => e.id)).toEqual(['e1', 'e3']);
  });

  it('row S, then removeCategory(suggested-eating-out)', () => {
    const state = removeCategory(makeS(), EATING_OUT);
    expect(getTotals(state)).toEqual({
      incomeCents: 320000,
      plannedCents: 217000,
      spentCents: 169482,
      leftToSpendCents: 150518,
      unplannedCents: 103000,
      removedCategoriesSpentCents: 11235,
      hasIncome: true,
    });
    expect(getCategorySummaries(state)).toEqual([
      summary(CAT.rent, 150000, 0, false, true),
      summary(CAT.groceries, 8247, 31753, false, true),
      summary(CAT.transport, 0, 12000, false, true),
      summary(CAT.utilities, 0, 15000, false, true),
    ]);
    expect(categoryLabel(state, EATING_OUT)).toBe('Removed category');
    expect(expensesForMonth(state).map((e) => e.id)).toContain('e3');
    expect(state.expenses).toHaveLength(3);
  });

  it('row S with incomeCents 0', () => {
    const state = setIncome(makeS(), 0);
    expect(getTotals(state)).toEqual({
      incomeCents: 0,
      plannedCents: 227000,
      spentCents: 169482,
      leftToSpendCents: -169482,
      unplannedCents: -227000,
      removedCategoriesSpentCents: 0,
      hasIncome: false,
    });
    expect(getCategorySummaries(state)).toEqual(getCategorySummaries(makeS()));
  });

  it('row S with incomeCents 200000', () => {
    const state = setIncome(makeS(), 200000);
    expect(getTotals(state)).toEqual({
      incomeCents: 200000,
      plannedCents: 227000,
      spentCents: 169482,
      leftToSpendCents: 30518,
      unplannedCents: -27000,
      removedCategoriesSpentCents: 0,
      hasIncome: true,
    });
  });

  it('row S plus Transport 200000 on 2026-11-10', () => {
    const state = addExpense(makeS(), { categoryId: TRANSPORT, amountCents: 200000, note: '', date: '2026-11-10' }, 'e4');
    expect(getTotals(state)).toEqual({
      incomeCents: 320000,
      plannedCents: 227000,
      spentCents: 369482,
      leftToSpendCents: -49482,
      unplannedCents: 93000,
      removedCategoriesSpentCents: 0,
      hasIncome: true,
    });
    expect(getCategorySummaries(state)).toEqual([
      summary(CAT.rent, 150000, 0, false, true),
      summary(CAT.groceries, 8247, 31753, false, true),
      summary(CAT.transport, 200000, -188000, true, true),
      summary(CAT.utilities, 0, 15000, false, true),
      summary(CAT.eatingOut, 11235, -1235, true, true),
    ]);
  });

  it("row createInitialState('2026-11')", () => {
    const state = createInitialState('2026-11');
    expect(getTotals(state)).toEqual({
      incomeCents: 0,
      plannedCents: 0,
      spentCents: 0,
      leftToSpendCents: 0,
      unplannedCents: 0,
      removedCategoriesSpentCents: 0,
      hasIncome: false,
    });
    expect(getCategorySummaries(state)).toEqual([
      zeroSummary(RENT, 'Rent'),
      zeroSummary(GROCERIES, 'Groceries'),
      zeroSummary(TRANSPORT, 'Transport'),
      zeroSummary(UTILITIES, 'Utilities'),
      zeroSummary(EATING_OUT, 'Eating out'),
    ]);
  });

  it('row: Groceries planned 8247, spent 8247 is exactly at plan, not over', () => {
    let state = createInitialState('2026-11');
    state = updateCategory(state, GROCERIES, { plannedCents: 8247 });
    state = addExpense(state, { categoryId: GROCERIES, amountCents: 8247, note: '', date: '2026-11-02' }, 'x1');
    expect(getTotals(state)).toEqual({
      incomeCents: 0,
      plannedCents: 8247,
      spentCents: 8247,
      leftToSpendCents: -8247,
      unplannedCents: -8247,
      removedCategoriesSpentCents: 0,
      hasIncome: false,
    });
    expect(getCategorySummaries(state)).toEqual([
      zeroSummary(RENT, 'Rent'),
      summary({ id: GROCERIES, name: 'Groceries', plannedCents: 8247 }, 8247, 0, false, true),
      zeroSummary(TRANSPORT, 'Transport'),
      zeroSummary(UTILITIES, 'Utilities'),
      zeroSummary(EATING_OUT, 'Eating out'),
    ]);
  });

  it('row: Transport planned 0, one expense of 1 is over with remaining -1 and no plan', () => {
    const state = addExpense(createInitialState('2026-11'), { categoryId: TRANSPORT, amountCents: 1, note: '', date: '2026-11-02' }, 'x1');
    expect(getTotals(state)).toEqual({
      incomeCents: 0,
      plannedCents: 0,
      spentCents: 1,
      leftToSpendCents: -1,
      unplannedCents: 0,
      removedCategoriesSpentCents: 0,
      hasIncome: false,
    });
    expect(getCategorySummaries(state)).toEqual([
      zeroSummary(RENT, 'Rent'),
      zeroSummary(GROCERIES, 'Groceries'),
      summary({ id: TRANSPORT, name: 'Transport', plannedCents: 0 }, 1, -1, true, false),
      zeroSummary(UTILITIES, 'Utilities'),
      zeroSummary(EATING_OUT, 'Eating out'),
    ]);
  });

  it('row: Transport planned 1, one expense of 1 is not over with remaining 0 and a plan', () => {
    let state = updateCategory(createInitialState('2026-11'), TRANSPORT, { plannedCents: 1 });
    state = addExpense(state, { categoryId: TRANSPORT, amountCents: 1, note: '', date: '2026-11-02' }, 'x1');
    expect(getTotals(state)).toEqual({
      incomeCents: 0,
      plannedCents: 1,
      spentCents: 1,
      leftToSpendCents: -1,
      unplannedCents: -1,
      removedCategoriesSpentCents: 0,
      hasIncome: false,
    });
    expect(getCategorySummaries(state)).toEqual([
      zeroSummary(RENT, 'Rent'),
      zeroSummary(GROCERIES, 'Groceries'),
      summary({ id: TRANSPORT, name: 'Transport', plannedCents: 1 }, 1, 0, false, true),
      zeroSummary(UTILITIES, 'Utilities'),
      zeroSummary(EATING_OUT, 'Eating out'),
    ]);
  });

  it('row: income MAX_CENTS and three Transport expenses of MAX_CENTS is exact', () => {
    let state = setIncome(createInitialState('2026-11'), MAX_CENTS);
    state = addExpense(state, { categoryId: TRANSPORT, amountCents: MAX_CENTS, note: '', date: '2026-11-01' }, 'm1');
    state = addExpense(state, { categoryId: TRANSPORT, amountCents: MAX_CENTS, note: '', date: '2026-11-02' }, 'm2');
    state = addExpense(state, { categoryId: TRANSPORT, amountCents: MAX_CENTS, note: '', date: '2026-11-03' }, 'm3');
    expect(getTotals(state)).toEqual({
      incomeCents: 99999999999999,
      plannedCents: 0,
      spentCents: 299999999999997,
      leftToSpendCents: -199999999999998,
      unplannedCents: 99999999999999,
      removedCategoriesSpentCents: 0,
      hasIncome: true,
    });
    expect(getCategorySummaries(state)).toEqual([
      zeroSummary(RENT, 'Rent'),
      zeroSummary(GROCERIES, 'Groceries'),
      summary({ id: TRANSPORT, name: 'Transport', plannedCents: 0 }, 299999999999997, -299999999999997, true, false),
      zeroSummary(UTILITIES, 'Utilities'),
      zeroSummary(EATING_OUT, 'Eating out'),
    ]);
  });

  function stateWithMaxExpenses(count: number): BudgetState {
    let state = createInitialState('2026-11');
    for (let i = 0; i < count; i += 1) {
      state = addExpense(state, { categoryId: TRANSPORT, amountCents: MAX_CENTS, note: '', date: '2026-11-15' }, `big${i}`);
    }
    return state;
  }

  it('row: 91 expenses of MAX_CENTS throws RangeError (total passes 2^53 - 1)', () => {
    const state = stateWithMaxExpenses(91);
    expectRangeError(() => getTotals(state));
    expectRangeError(() => getCategorySummaries(state));
  });

  it('90 expenses of MAX_CENTS is the largest total that still fits, and is exact', () => {
    const state = stateWithMaxExpenses(90);
    expect(getTotals(state).spentCents).toBe(8999999999999910);
    expect(getTotals(state).leftToSpendCents).toBe(-8999999999999910);
    expect(at(getCategorySummaries(state), 2).spentCents).toBe(8999999999999910);
  });

  it('cent-exactness: expenses 10 and 20 give spent 30', () => {
    let state = createInitialState('2026-11');
    state = addExpense(state, { categoryId: RENT, amountCents: 10, note: '', date: '2026-11-01' }, 'a');
    state = addExpense(state, { categoryId: RENT, amountCents: 20, note: '', date: '2026-11-01' }, 'b');
    expect(getTotals(state).spentCents).toBe(30);
    expect(at(getCategorySummaries(state), 0).spentCents).toBe(30);
  });

  it('cent-exactness: three expenses of 1999 give spent 5997', () => {
    let state = createInitialState('2026-11');
    for (const id of ['a', 'b', 'c']) {
      state = addExpense(state, { categoryId: GROCERIES, amountCents: 1999, note: '', date: '2026-11-01' }, id);
    }
    expect(getTotals(state).spentCents).toBe(5997);
    expect(at(getCategorySummaries(state), 1).spentCents).toBe(5997);
  });

  it('ordering: a, b, c, d added in order give [c, a, b] and d is excluded from the list and every total', () => {
    let state = createInitialState('2026-11');
    // d is from another month, so only hand-made state can hold it.
    state = addExpense(state, { categoryId: RENT, amountCents: 1, note: '', date: '2026-11-05' }, 'a');
    state = addExpense(state, { categoryId: RENT, amountCents: 2, note: '', date: '2026-11-01' }, 'b');
    state = addExpense(state, { categoryId: RENT, amountCents: 4, note: '', date: '2026-11-05' }, 'c');
    const d: Expense = { id: 'd', categoryId: RENT, amountCents: 800, note: '', date: '2026-10-31' };
    state = { ...state, expenses: [...state.expenses, d] };
    expect(expensesForMonth(state).map((e) => e.id)).toEqual(['c', 'a', 'b']);
    expect(getTotals(state).spentCents).toBe(7);
    expect(getTotals(state).removedCategoriesSpentCents).toBe(0);
    expect(at(getCategorySummaries(state), 0).spentCents).toBe(7);
    expect(state.expenses).toHaveLength(4);
  });

  it('expenses of a removed category that fall in another month are not counted as removed spending', () => {
    const state: BudgetState = {
      ...makeS(),
      expenses: [
        ...makeS().expenses,
        { id: 'old', categoryId: 'gone', amountCents: 999, note: '', date: '2026-10-31' },
        { id: 'bad', categoryId: 'gone', amountCents: 555, note: '', date: '2026-11-31' },
        { id: 'in', categoryId: 'gone', amountCents: 7, note: '', date: '2026-11-30' },
      ],
    };
    expect(getTotals(state).spentCents).toBe(169482 + 7);
    expect(getTotals(state).removedCategoriesSpentCents).toBe(7);
    expect(expensesForMonth(state).map((e) => e.id)).not.toContain('old');
    expect(expensesForMonth(state).map((e) => e.id)).not.toContain('bad');
  });

  it('never returns negative zero from any figure', () => {
    const state = createInitialState('2026-11');
    const totals = getTotals(state);
    for (const value of [totals.incomeCents, totals.plannedCents, totals.spentCents, totals.leftToSpendCents, totals.unplannedCents, totals.removedCategoriesSpentCents]) {
      expect(Object.is(value, 0)).toBe(true);
    }
    for (const entry of getCategorySummaries(state)) {
      expect(Object.is(entry.spentCents, 0)).toBe(true);
      expect(Object.is(entry.remainingCents, 0)).toBe(true);
    }
    const even = setIncome(addExpense(state, { categoryId: RENT, amountCents: 5, note: '', date: '2026-11-01' }, 'a'), 5);
    expect(Object.is(getTotals(even).leftToSpendCents, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Dates and months
// ---------------------------------------------------------------------------

describe('isIsoDate', () => {
  it.each(['2026-11-14', '2028-02-29', '2000-02-29', '2024-02-29', '2026-01-31', '2026-12-31', '2026-04-30', '2026-02-28', '1900-02-28', '2100-02-28'])(
    '%j is true',
    (value) => {
      expect(isIsoDate(value)).toBe(true);
    },
  );

  it.each([
    '2026-11-31',
    '2026-02-29',
    '1900-02-29',
    '2100-02-29',
    '2026-04-31',
    '2026-06-31',
    '2026-09-31',
    '2026-01-32',
    '2026-11-00',
    '2026-13-01',
    '2026-00-10',
    '2026-1-5',
    ' 2026-11-14',
    '2026-11-14 ',
    '2026-11-14T00:00',
    '2026-11-14\n',
    '\n2026-11-14',
    '',
    '２０２６-11-14',
    '2026-１１-14',
    '2026-11-１４',
    '٢٠٢٦-11-14',
    '2026/11/14',
    '20261114',
    '26-11-14',
    '12026-11-14',
    '2026-011-14',
  ])('%j is false', (value) => {
    expect(isIsoDate(value)).toBe(false);
  });

  it('applies Gregorian leap-year rules to February 29', () => {
    const leap: Record<number, boolean> = { 1900: false, 2000: true, 2024: true, 2026: false, 2028: true, 2100: false, 2400: true, 1700: false, 1600: true };
    for (const [year, isLeap] of Object.entries(leap)) {
      expect(isIsoDate(`${year}-02-29`)).toBe(isLeap);
      expect(isIsoDate(`${year}-02-28`)).toBe(true);
      expect(isIsoDate(`${year}-02-30`)).toBe(false);
    }
  });

  it('accepts exactly the last day of every month in a common year and rejects the day after', () => {
    const last = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    last.forEach((days, index) => {
      const month = String(index + 1).padStart(2, '0');
      expect(isIsoDate(`2026-${month}-${String(days).padStart(2, '0')}`)).toBe(true);
      expect(isIsoDate(`2026-${month}-${String(days + 1).padStart(2, '0')}`)).toBe(false);
      expect(isIsoDate(`2026-${month}-01`)).toBe(true);
    });
  });
});

describe('isIsoMonth', () => {
  it.each(['2026-01', '2026-09', '2026-10', '2026-12', '1900-02', '0001-01'])('%j is true', (value) => {
    expect(isIsoMonth(value)).toBe(true);
  });
  it.each(['2026-00', '2026-13', '2026-1', '2026-001', '', '2026-11\n', '2026-11 ', ' 2026-11', '２０２６-11', '2026-１１', '2026-11-01', '26-11', '2026/11', '202611'])(
    '%j is false',
    (value) => {
      expect(isIsoMonth(value)).toBe(false);
    },
  );
});

describe('monthOf and isDateInMonth', () => {
  it('monthOf takes the YYYY-MM prefix', () => {
    expect(monthOf('2026-11-14')).toBe('2026-11');
    expect(monthOf('2028-02-29')).toBe('2028-02');
    expect(monthOf('2026-01-01')).toBe('2026-01');
  });

  it.each(['', '2026-11', '2026-11-31', '2026-02-29', '2026-13-01', '2026-11-14T00:00', '2026-11-14\n', '２０２６-11-14'])('monthOf(%j) throws RangeError', (value) => {
    expectRangeError(() => monthOf(value));
  });

  it('isDateInMonth is true only for a valid date inside that month', () => {
    expect(isDateInMonth('2026-11-14', '2026-11')).toBe(true);
    expect(isDateInMonth('2026-11-01', '2026-11')).toBe(true);
    expect(isDateInMonth('2026-11-30', '2026-11')).toBe(true);
    expect(isDateInMonth('2028-02-29', '2028-02')).toBe(true);
  });

  it('isDateInMonth is false for other months, other years, invalid dates and malformed months, and never throws', () => {
    expect(isDateInMonth('2026-10-31', '2026-11')).toBe(false);
    expect(isDateInMonth('2026-12-01', '2026-11')).toBe(false);
    expect(isDateInMonth('2025-11-14', '2026-11')).toBe(false);
    expect(isDateInMonth('2026-11-31', '2026-11')).toBe(false);
    expect(isDateInMonth('2026-02-29', '2026-02')).toBe(false);
    expect(isDateInMonth('garbage', '2026-11')).toBe(false);
    expect(isDateInMonth('', '')).toBe(false);
    expect(isDateInMonth('2026-11-14', '2026-1')).toBe(false);
    expect(isDateInMonth('2026-11-14', '')).toBe(false);
  });
});

describe('formatMonth', () => {
  it.each([
    ['2026-11', 'November 2026'],
    ['2027-01', 'January 2027'],
  ])('formats %s as %s', (month, text) => {
    expect(formatMonth(month)).toBe(text);
  });

  it('uses the fixed English name for every month', () => {
    const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    names.forEach((name, index) => {
      expect(formatMonth(`2030-${String(index + 1).padStart(2, '0')}`)).toBe(`${name} 2030`);
    });
  });

  it.each(['2026-13', '2026-00', '2026-1', '', '2026-11-01', '2026-11\n', '２０２６-11'])('throws RangeError for %j', (value) => {
    expectRangeError(() => formatMonth(value));
  });
});

describe('defaultExpenseDate', () => {
  it('returns today when it is in the month', () => {
    expect(defaultExpenseDate('2026-11', '2026-11-14')).toBe('2026-11-14');
    expect(defaultExpenseDate('2026-11', '2026-11-01')).toBe('2026-11-01');
    expect(defaultExpenseDate('2026-11', '2026-11-30')).toBe('2026-11-30');
  });

  it('returns the first of the month when today is in another month', () => {
    expect(defaultExpenseDate('2026-10', '2026-11-14')).toBe('2026-10-01');
    expect(defaultExpenseDate('2026-12', '2026-11-30')).toBe('2026-12-01');
    expect(defaultExpenseDate('2026-11', '2025-11-14')).toBe('2026-11-01');
  });

  it('returns the first of the month when today is not a valid date', () => {
    expect(defaultExpenseDate('2026-11', '2026-11-31')).toBe('2026-11-01');
    expect(defaultExpenseDate('2026-11', 'garbage')).toBe('2026-11-01');
  });
});

describe('datesInMonth', () => {
  it.each([
    ['2026-02', 28, '2026-02-01', '2026-02-28'],
    ['2028-02', 29, '2028-02-01', '2028-02-29'],
    ['1900-02', 28, '1900-02-01', '1900-02-28'],
    ['2000-02', 29, '2000-02-01', '2000-02-29'],
    ['2026-11', 30, '2026-11-01', '2026-11-30'],
    ['2026-12', 31, '2026-12-01', '2026-12-31'],
    ['2024-02', 29, '2024-02-01', '2024-02-29'],
    ['2100-02', 28, '2100-02-01', '2100-02-28'],
  ])('%s has %i entries from %s to %s', (month, length, first, last) => {
    const dates = datesInMonth(month);
    expect(dates).toHaveLength(length);
    expect(dates[0]).toBe(first);
    expect(dates[dates.length - 1]).toBe(last);
  });

  it.each(['2026-13', '2026-1', '', '2026-00', '2026-11-01', '2026-11\n', '２０２６-11'])('throws RangeError for %j', (value) => {
    expectRangeError(() => datesInMonth(value));
  });

  it('gives lengths 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 for the twelve months of 2026', () => {
    const lengths: number[] = [];
    for (let m = 1; m <= 12; m += 1) lengths.push(datesInMonth(`2026-${String(m).padStart(2, '0')}`).length);
    expect(lengths).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });

  const expectedLengths: Record<number, number[]> = {
    2026: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    2028: [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    1900: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    2000: [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  };

  for (const [yearText, lengths] of Object.entries(expectedLengths)) {
    it(`every month of ${yearText}: length, first, last, ascending, consecutive, valid and in the month`, () => {
      lengths.forEach((length, index) => {
        const month = `${yearText}-${String(index + 1).padStart(2, '0')}`;
        const dates = datesInMonth(month);
        expect(dates).toHaveLength(length);
        expect(dates[0]).toBe(`${month}-01`);
        expect(dates[dates.length - 1]).toBe(`${month}-${String(length).padStart(2, '0')}`);
        dates.forEach((date, position) => {
          // Consecutive days: entry n is exactly day n + 1, so it is also strictly ascending.
          expect(date).toBe(`${month}-${String(position + 1).padStart(2, '0')}`);
          expect(isIsoDate(date)).toBe(true);
          expect(isDateInMonth(date, month)).toBe(true);
        });
        const sorted = [...dates].sort();
        expect(dates).toEqual(sorted);
        expect(new Set(dates).size).toBe(dates.length);
        // The day after the last entry is not a date of the month.
        expect(isIsoDate(`${month}-${String(length + 1).padStart(2, '0')}`)).toBe(false);
      });
    });
  }

  it('returns a fresh array on every call', () => {
    const first = datesInMonth('2026-11');
    first.push('x');
    expect(datesInMonth('2026-11')).toHaveLength(30);
  });
});

// ---------------------------------------------------------------------------
// sumCents
// ---------------------------------------------------------------------------

describe('sumCents', () => {
  it('adds integers exactly, including negatives and an empty list', () => {
    expect(sumCents([])).toBe(0);
    expect(sumCents([10, 20])).toBe(30);
    expect(sumCents([1999, 1999, 1999])).toBe(5997);
    expect(sumCents([5, -8])).toBe(-3);
    expect(sumCents([Number.MAX_SAFE_INTEGER, 0])).toBe(Number.MAX_SAFE_INTEGER);
    expect(sumCents([Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER])).toBe(0);
  });

  it.each([12.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, 0.1])('throws RangeError when an input is %s', (bad) => {
    expectRangeError(() => sumCents([1, bad, 2]));
    expectRangeError(() => sumCents([bad]));
  });

  it('throws RangeError when the running total leaves the safe-integer range, upwards and downwards', () => {
    expectRangeError(() => sumCents([Number.MAX_SAFE_INTEGER, 1]));
    expectRangeError(() => sumCents([-Number.MAX_SAFE_INTEGER, -1]));
    expectRangeError(() => sumCents([Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]));
    expectRangeError(() => sumCents(Array.from({ length: 91 }, () => MAX_CENTS)));
  });

  it('accepts 90 additions of MAX_CENTS', () => {
    expect(sumCents(Array.from({ length: 90 }, () => MAX_CENTS))).toBe(8999999999999910);
  });

  it('does not change its input', () => {
    const input = deepFreeze([1, 2, 3]);
    expect(sumCents(input)).toBe(6);
    expect(input).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// Suggested categories and initial state
// ---------------------------------------------------------------------------

describe('SUGGESTED_CATEGORIES and createInitialState', () => {
  const expected: Category[] = [
    { id: 'suggested-rent', name: 'Rent', plannedCents: 0 },
    { id: 'suggested-groceries', name: 'Groceries', plannedCents: 0 },
    { id: 'suggested-transport', name: 'Transport', plannedCents: 0 },
    { id: 'suggested-utilities', name: 'Utilities', plannedCents: 0 },
    { id: 'suggested-eating-out', name: 'Eating out', plannedCents: 0 },
  ];

  it('SUGGESTED_CATEGORIES lists the five categories in order', () => {
    expect(SUGGESTED_CATEGORIES).toEqual(expected);
  });

  it('createInitialState returns the exact listed shape', () => {
    expect(createInitialState('2026-11')).toEqual({ month: '2026-11', incomeCents: 0, categories: expected, expenses: [] });
    expect(createInitialState('2028-02').month).toBe('2028-02');
  });

  it.each(['2026-13', '2026-00', '2026-1', '', '2026-11-01', '2026-11\n'])('createInitialState(%j) throws RangeError', (value) => {
    expectRangeError(() => createInitialState(value));
  });

  it('two calls share no arrays or category objects', () => {
    const a = createInitialState('2026-11');
    const b = createInitialState('2026-11');
    expect(a).not.toBe(b);
    expect(a.categories).not.toBe(b.categories);
    expect(a.expenses).not.toBe(b.expenses);
    a.categories.forEach((category, index) => {
      expect(category).not.toBe(at(b.categories, index));
      expect(category).not.toBe(at(SUGGESTED_CATEGORIES, index));
    });
  });

  it('mutating one result changes neither a second result nor SUGGESTED_CATEGORIES', () => {
    const a = createInitialState('2026-11');
    const b = createInitialState('2026-11');
    const frozenCopy = structuredClone(SUGGESTED_CATEGORIES);
    at(a.categories, 0).name = 'Mutated';
    at(a.categories, 1).plannedCents = 12345;
    a.categories.push({ id: 'extra', name: 'Extra', plannedCents: 1 });
    a.categories.length = 2;
    a.expenses.push({ id: 'x', categoryId: RENT, amountCents: 1, note: '', date: '2026-11-01' });
    a.incomeCents = 99;
    expect(b).toEqual({ month: '2026-11', incomeCents: 0, categories: expected, expenses: [] });
    expect(SUGGESTED_CATEGORIES).toEqual(frozenCopy);
    expect(createInitialState('2026-11').categories).toEqual(expected);
  });

  it('state-changing functions on one initial state never touch SUGGESTED_CATEGORIES or a later initial state', () => {
    const before = structuredClone(SUGGESTED_CATEGORIES);
    let state = createInitialState('2026-11');
    state = updateCategory(state, RENT, { name: 'Changed', plannedCents: 5 });
    state = removeCategory(state, GROCERIES);
    state = addCategory(state, { name: 'Pets', plannedCents: 1 }, 'pets');
    expect(state.categories.map((c) => c.id)).toEqual([RENT, TRANSPORT, UTILITIES, EATING_OUT, 'pets']);
    expect(SUGGESTED_CATEGORIES).toEqual(before);
    expect(createInitialState('2026-11').categories).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('immutability', () => {
  type Call = { name: string; run: (state: BudgetState) => unknown; changes: boolean };
  const calls: Call[] = [
    { name: 'setIncome', run: (s) => setIncome(s, 12345), changes: true },
    { name: 'addCategory', run: (s) => addCategory(s, deepFreeze({ name: '  Pets ', plannedCents: 500 }), 'pets'), changes: true },
    { name: 'updateCategory (name and plannedCents)', run: (s) => updateCategory(s, GROCERIES, deepFreeze({ name: ' Food ', plannedCents: 1 })), changes: true },
    { name: 'updateCategory (unknown id)', run: (s) => updateCategory(s, 'nope', { name: 'x' }), changes: false },
    { name: 'removeCategory', run: (s) => removeCategory(s, EATING_OUT), changes: true },
    { name: 'removeCategory (unknown id)', run: (s) => removeCategory(s, 'nope'), changes: false },
    {
      name: 'addExpense',
      run: (s) => addExpense(s, deepFreeze({ categoryId: TRANSPORT, amountCents: 700, note: ' fare ', date: '2026-11-04' }), 'e9'),
      changes: true,
    },
    { name: 'deleteExpense', run: (s) => deleteExpense(s, 'e2'), changes: true },
    { name: 'deleteExpense (unknown id)', run: (s) => deleteExpense(s, 'nope'), changes: false },
  ];

  for (const call of calls) {
    it(`${call.name} runs on a deep-frozen state without TypeError and leaves it equal to its earlier clone`, () => {
      const state = deepFreeze(makeS());
      const before = structuredClone(state);
      const result = call.run(state);
      expect(state).toEqual(before);
      if (call.changes) {
        expect(result).not.toBe(state);
      }
    });
  }

  it('read functions run on a deep-frozen state, with removed categories and foreign-month expenses, and leave it unchanged', () => {
    const base = makeS();
    const state = deepFreeze<BudgetState>({
      ...base,
      categories: base.categories.slice(0, 3),
      expenses: [...base.expenses, { id: 'o', categoryId: RENT, amountCents: 1, note: '', date: '2026-10-31' }],
    });
    const before = structuredClone(state);
    getTotals(state);
    getCategorySummaries(state);
    expensesForMonth(state);
    categoryLabel(state, RENT);
    categoryNameError(state, 'Rent');
    expect(state).toEqual(before);
  });

  it('a changing call returns a new state but every untouched part is unchanged', () => {
    const state = makeS();
    const result = addExpense(state, { categoryId: RENT, amountCents: 1, note: '', date: '2026-11-02' }, 'n1');
    expect(result.expenses).toHaveLength(4);
    expect(state.expenses).toHaveLength(3);
    expect(result.categories).toEqual(state.categories);
    expect(result.incomeCents).toBe(state.incomeCents);
    expect(result.month).toBe(state.month);
  });

  it('expensesForMonth returns a new array, so sorting or mutating it leaves the state alone', () => {
    const state = makeS();
    const before = structuredClone(state);
    const list = expensesForMonth(state);
    list.reverse();
    list.length = 0;
    expect(state).toEqual(before);
  });
});

describe('unknown ids return the same object', () => {
  it("updateCategory(state, 'nope', patch) returns state itself", () => {
    const state = makeS();
    expect(updateCategory(state, 'nope', { name: 'x', plannedCents: 5 })).toBe(state);
    expect(updateCategory(state, 'nope', {})).toBe(state);
  });
  it("removeCategory(state, 'nope') returns state itself", () => {
    const state = makeS();
    expect(removeCategory(state, 'nope')).toBe(state);
  });
  it("deleteExpense(state, 'nope') returns state itself", () => {
    const state = makeS();
    expect(deleteExpense(state, 'nope')).toBe(state);
  });
  it('a category id is not an expense id and the other way round', () => {
    const state = makeS();
    expect(deleteExpense(state, RENT)).toBe(state);
    expect(removeCategory(state, 'e1')).toBe(state);
    expect(updateCategory(state, 'e1', { name: 'x' })).toBe(state);
  });
  it('known ids return a different object', () => {
    const state = makeS();
    expect(updateCategory(state, RENT, { plannedCents: 1 })).not.toBe(state);
    expect(removeCategory(state, RENT)).not.toBe(state);
    expect(deleteExpense(state, 'e1')).not.toBe(state);
  });
});

// ---------------------------------------------------------------------------
// State changes and validation
// ---------------------------------------------------------------------------

describe('removing a category keeps its expenses', () => {
  it('state.expenses still has length 3 after removeCategory(S, eating-out), and the expense is unchanged', () => {
    const state = removeCategory(makeS(), EATING_OUT);
    expect(state.expenses).toHaveLength(3);
    expect(state.expenses).toEqual(makeS().expenses);
    expect(state.categories.map((c) => c.id)).toEqual([RENT, GROCERIES, TRANSPORT, UTILITIES]);
  });
  it('removing every category keeps all expenses counted as removed spending', () => {
    let state = makeS();
    for (const category of makeS().categories) state = removeCategory(state, category.id);
    expect(state.expenses).toHaveLength(3);
    expect(getCategorySummaries(state)).toEqual([]);
    expect(getTotals(state)).toEqual({
      incomeCents: 320000,
      plannedCents: 0,
      spentCents: 169482,
      leftToSpendCents: 150518,
      unplannedCents: 320000,
      removedCategoriesSpentCents: 169482,
      hasIncome: true,
    });
  });
  it('re-adding a category with the same id makes its old expenses count again', () => {
    let state = removeCategory(makeS(), EATING_OUT);
    state = addCategory(state, { name: 'Eating out', plannedCents: 10000 }, EATING_OUT);
    expect(getTotals(state).removedCategoriesSpentCents).toBe(0);
    expect(at(getCategorySummaries(state), 4).spentCents).toBe(11235);
  });
});

describe('setIncome', () => {
  it('replaces incomeCents and changes nothing else', () => {
    const state = setIncome(makeS(), 777);
    expect(state).toEqual({ ...makeS(), incomeCents: 777 });
  });
  it.each([0, 1, 12345, MAX_CENTS])('accepts %i', (amount) => {
    expect(setIncome(makeS(), amount).incomeCents).toBe(amount);
  });
  it.each(ALL_INVALID_AMOUNTS)('throws RangeError for %s', (amount) => {
    expectRangeError(() => setIncome(makeS(), amount));
  });
  it('an invalid amount does not change the state it was given', () => {
    const state = deepFreeze(makeS());
    expectRangeError(() => setIncome(state, -1));
    expect(state).toEqual(makeS());
  });
});

describe('addCategory', () => {
  it('appends at the end, trims the name, and keeps plannedCents', () => {
    const state = addCategory(makeS(), { name: '  Pets ', plannedCents: 2500 }, 'pets');
    expect(state.categories).toHaveLength(6);
    expect(at(state.categories, 5)).toEqual({ id: 'pets', name: 'Pets', plannedCents: 2500 });
    expect(state.categories.slice(0, 5)).toEqual(makeS().categories);
    expect(state.expenses).toEqual(makeS().expenses);
  });
  it('trims every kind of surrounding whitespace but keeps inner spaces', () => {
    const state = addCategory(makeS(), { name: '\t Dog  food \n', plannedCents: 0 }, 'dog');
    expect(at(state.categories, 5).name).toBe('Dog  food');
  });
  it.each(['   ', '', '\t', '\n  '])('throws Error (not RangeError) for blank name %j', (name) => {
    expectPlainError(() => addCategory(makeS(), { name, plannedCents: 0 }, 'new'));
  });
  it('throws Error (not RangeError) for a duplicate id, even with a fresh name', () => {
    expectPlainError(() => addCategory(makeS(), { name: 'Pets', plannedCents: 0 }, RENT));
  });
  it.each([' rent ', 'RENT', 'rent', 'Rent', 'eating OUT'])('throws Error (not RangeError) for duplicate name %j', (name) => {
    expectPlainError(() => addCategory(makeScenario(), { name, plannedCents: 0 }, 'new'));
  });
  it.each([0, 1, MAX_CENTS])('accepts plannedCents %i', (plannedCents) => {
    expect(at(addCategory(makeS(), { name: 'Pets', plannedCents }, 'pets').categories, 5).plannedCents).toBe(plannedCents);
  });
  it.each(ALL_INVALID_AMOUNTS)('throws RangeError for plannedCents %s', (plannedCents) => {
    expectRangeError(() => addCategory(makeS(), { name: 'Pets', plannedCents }, 'pets'));
  });
  it('a failed add leaves the state unchanged', () => {
    const state = deepFreeze(makeS());
    expect(() => addCategory(state, { name: '', plannedCents: 0 }, 'x')).toThrow();
    expect(state).toEqual(makeS());
  });
});

describe('updateCategory', () => {
  it("stores the name exactly as given: ' Pets ' stays ' Pets '", () => {
    const state = updateCategory(makeS(), RENT, { name: ' Pets ' });
    expect(at(state.categories, 0)).toEqual({ id: RENT, name: ' Pets ', plannedCents: 150000 });
  });
  it('does not validate the name: blank and duplicate names are stored raw', () => {
    const scenario = makeScenario();
    const blank = updateCategory(scenario, RENT, { name: '' });
    expect(at(blank.categories, 0).name).toBe('');
    const spaces = updateCategory(scenario, RENT, { name: '   ' });
    expect(at(spaces.categories, 0).name).toBe('   ');
    const duplicate = updateCategory(scenario, RENT, { name: 'Groceries' });
    expect(at(duplicate.categories, 0).name).toBe('Groceries');
  });
  it('a plannedCents-only patch keeps the name and a name-only patch keeps plannedCents', () => {
    const planned = updateCategory(makeS(), GROCERIES, { plannedCents: 1 });
    expect(at(planned.categories, 1)).toEqual({ id: GROCERIES, name: 'Groceries', plannedCents: 1 });
    const named = updateCategory(makeS(), GROCERIES, { name: 'Food' });
    expect(at(named.categories, 1)).toEqual({ id: GROCERIES, name: 'Food', plannedCents: 40000 });
  });
  it('changes only the matching category, keeps order, and keeps expenses', () => {
    const state = updateCategory(makeS(), TRANSPORT, { name: 'Cars', plannedCents: 9 });
    expect(state.categories.map((c) => c.id)).toEqual([RENT, GROCERIES, TRANSPORT, UTILITIES, EATING_OUT]);
    expect(state.categories.filter((c) => c.id !== TRANSPORT)).toEqual(makeS().categories.filter((c) => c.id !== TRANSPORT));
    expect(state.expenses).toEqual(makeS().expenses);
  });
  it('cannot change the id', () => {
    const state = updateCategory(makeS(), RENT, { name: 'x', plannedCents: 1 });
    expect(at(state.categories, 0).id).toBe(RENT);
  });
  it.each([0, 1, MAX_CENTS])('accepts plannedCents %i', (plannedCents) => {
    expect(at(updateCategory(makeS(), RENT, { plannedCents }).categories, 0).plannedCents).toBe(plannedCents);
  });
  it.each(ALL_INVALID_AMOUNTS)('throws RangeError for plannedCents %s', (plannedCents) => {
    expectRangeError(() => updateCategory(makeS(), RENT, { plannedCents }));
  });
  it("updateCategory(SCENARIO, 'suggested-rent', { name: '' }) does not throw and stores ''", () => {
    const scenario = makeScenario();
    let result: BudgetState | undefined;
    expect(() => {
      result = updateCategory(scenario, RENT, { name: '' });
    }).not.toThrow();
    expect(result && at(result.categories, 0).name).toBe('');
    expect(result && categoryLabel(result, RENT)).toBe('Unnamed category');
  });
});

describe('addExpense', () => {
  const base = { categoryId: TRANSPORT, amountCents: 700, note: 'fare', date: '2026-11-04' };

  it("appends { id, categoryId, amountCents, note, date } at the end", () => {
    const state = addExpense(makeS(), base, 'e9');
    expect(state.expenses).toHaveLength(4);
    expect(at(state.expenses, 3)).toEqual({ id: 'e9', categoryId: TRANSPORT, amountCents: 700, note: 'fare', date: '2026-11-04' });
    expect(state.expenses.slice(0, 3)).toEqual(makeS().expenses);
  });
  it("stores note '  lunch ' as 'lunch'", () => {
    expect(at(addExpense(makeS(), { ...base, note: '  lunch ' }, 'e9').expenses, 3).note).toBe('lunch');
  });
  it('stores a blank note as an empty string and keeps inner spaces', () => {
    expect(at(addExpense(makeS(), { ...base, note: '   ' }, 'e9').expenses, 3).note).toBe('');
    expect(at(addExpense(makeS(), { ...base, note: ' a  b ' }, 'e9').expenses, 3).note).toBe('a  b');
  });
  it.each([0, ...ALL_INVALID_AMOUNTS])('throws RangeError for amount %s', (amountCents) => {
    expectRangeError(() => addExpense(makeS(), { ...base, amountCents }, 'e9'));
  });
  it.each([1, 2, MAX_CENTS])('accepts amount %i', (amountCents) => {
    expect(at(addExpense(makeS(), { ...base, amountCents }, 'e9').expenses, 3).amountCents).toBe(amountCents);
  });
  it.each(['2026-12-01', '2026-11-31', '2026-10-31', '2025-11-04', '2026-11-00', '2026-11-4', '', 'garbage', '2026-11-04T00:00', '2026-11-04\n', '２０２６-11-04'])(
    'throws RangeError for date %j in a 2026-11 state',
    (date) => {
      expectRangeError(() => addExpense(makeS(), { ...base, date }, 'e9'));
    },
  );
  it.each(['2026-11-01', '2026-11-30'])('accepts the boundary date %s', (date) => {
    expect(at(addExpense(makeS(), { ...base, date }, 'e9').expenses, 3).date).toBe(date);
  });
  it('accepts 2028-02-29 in a 2028-02 state but not 2026-02-29 in a 2026-02 state', () => {
    expect(addExpense(createInitialState('2028-02'), { ...base, date: '2028-02-29' }, 'e9').expenses).toHaveLength(1);
    expectRangeError(() => addExpense(createInitialState('2026-02'), { ...base, date: '2026-02-29' }, 'e9'));
  });
  it('throws Error (not RangeError) for an unknown categoryId', () => {
    expectPlainError(() => addExpense(makeS(), { ...base, categoryId: 'nope' }, 'e9'));
  });
  it('throws Error for a category that was removed', () => {
    const state = removeCategory(makeS(), TRANSPORT);
    expectPlainError(() => addExpense(state, base, 'e9'));
  });
  it('throws Error (not RangeError) for a duplicate expense id', () => {
    expectPlainError(() => addExpense(makeS(), base, 'e1'));
  });
  it('an expense id equal to a category id is allowed (different id spaces)', () => {
    expect(addExpense(makeS(), base, RENT).expenses).toHaveLength(4);
  });
  it('a failed add leaves the state unchanged', () => {
    const state = deepFreeze(makeS());
    expect(() => addExpense(state, { ...base, amountCents: 0 }, 'e9')).toThrow();
    expect(state).toEqual(makeS());
  });
});

describe('deleteExpense', () => {
  it('removes that expense only, keeping the others in order', () => {
    const state = deleteExpense(makeS(), 'e2');
    expect(state.expenses).toEqual([makeS().expenses[0], makeS().expenses[2]]);
    expect(state.categories).toEqual(makeS().categories);
  });
});

describe('categoryNameError', () => {
  const scenario = makeScenario();
  it.each(['', '   ', '\t\n'])('%j -> Enter a category name', (name) => {
    expect(categoryNameError(scenario, name)).toBe('Enter a category name');
  });
  it.each(['groceries', ' GROCERIES ', 'Groceries', 'gRoCeRiEs'])('%j -> duplicate of Groceries', (name) => {
    expect(categoryNameError(scenario, name)).toBe('You already have a category called Groceries');
  });
  it("'Groceries' with exceptId 'suggested-groceries' -> null", () => {
    expect(categoryNameError(scenario, 'Groceries', GROCERIES)).toBeNull();
  });
  it("'Groceries' with exceptId 'suggested-rent' -> the duplicate error", () => {
    expect(categoryNameError(scenario, 'Groceries', RENT)).toBe('You already have a category called Groceries');
  });
  it("'Pets' -> null", () => {
    expect(categoryNameError(scenario, 'Pets')).toBeNull();
    expect(categoryNameError(scenario, '  Pets  ')).toBeNull();
  });
  it('a blank name is reported as blank even with exceptId, and inner spacing makes a different name', () => {
    expect(categoryNameError(scenario, '', GROCERIES)).toBe('Enter a category name');
    expect(categoryNameError(scenario, 'Eating  out')).toBeNull();
    expect(categoryNameError(scenario, 'Eating out')).toBe('You already have a category called Eating out');
  });
  it('an unknown exceptId excludes nothing', () => {
    expect(categoryNameError(scenario, 'Rent', 'nope')).toBe('You already have a category called Rent');
  });
  it('reports the other category as stored, trimmed, in its own case', () => {
    const state: BudgetState = { ...scenario, categories: [{ id: 'a', name: '  GROCERIES ', plannedCents: 0 }] };
    expect(categoryNameError(state, 'groceries')).toBe('You already have a category called GROCERIES');
  });
  it('compares against a stored name that has surrounding spaces', () => {
    const state: BudgetState = { ...scenario, categories: [{ id: 'a', name: ' Rent ', plannedCents: 0 }] };
    expect(categoryNameError(state, 'rent')).not.toBeNull();
  });
  it('a category being renamed can keep its own name with different case or padding', () => {
    expect(categoryNameError(scenario, ' RENT ', RENT)).toBeNull();
  });
  it('is null on an empty category list for any non-blank name', () => {
    expect(categoryNameError({ ...scenario, categories: [] }, 'Rent')).toBeNull();
  });
});

describe('categoryLabel', () => {
  it("returns 'Unnamed category' for a category named '  ' and for ''", () => {
    const state = updateCategory(makeScenario(), RENT, { name: '  ' });
    expect(categoryLabel(state, RENT)).toBe('Unnamed category');
    expect(categoryLabel(updateCategory(makeScenario(), RENT, { name: '' }), RENT)).toBe('Unnamed category');
  });
  it("returns 'Removed category' for a missing id, including a removed category", () => {
    expect(categoryLabel(makeScenario(), 'nope')).toBe('Removed category');
    expect(categoryLabel(removeCategory(makeScenario(), RENT), RENT)).toBe('Removed category');
    expect(categoryLabel(makeScenario(), '')).toBe('Removed category');
  });
  it('returns the trimmed name otherwise', () => {
    expect(categoryLabel(makeScenario(), RENT)).toBe('Rent');
    expect(categoryLabel(updateCategory(makeScenario(), RENT, { name: '  Pets ' }), RENT)).toBe('Pets');
  });
  it('blank-named is not confused with missing', () => {
    const state = updateCategory(makeScenario(), RENT, { name: ' ' });
    expect(categoryLabel(state, RENT)).not.toBe(categoryLabel(state, 'nope'));
  });
});

// ---------------------------------------------------------------------------
// expensesForMonth ordering
// ---------------------------------------------------------------------------

describe('expensesForMonth', () => {
  function expense(id: string, date: string): Expense {
    return { id, categoryId: RENT, amountCents: 1, note: '', date };
  }

  it('sorts by date descending and keeps the later-added expense first on equal dates (many expenses)', () => {
    const rng = makeRng(20260101);
    const dates = datesInMonth('2026-11');
    const expenses: Expense[] = [];
    for (let i = 0; i < 400; i += 1) expenses.push(expense(`x${i}`, at(dates, int(rng, 6) + 10)));
    const state: BudgetState = { ...createInitialState('2026-11'), expenses };
    const ids = expensesForMonth(state).map((e) => e.id);
    expect(ids).toHaveLength(400);
    const expected = expenses
      .map((e, index) => ({ e, index }))
      .sort((a, b) => (a.e.date === b.e.date ? b.index - a.index : a.e.date < b.e.date ? 1 : -1))
      .map(({ e }) => e.id);
    expect(ids).toEqual(expected);
  });

  it('all-equal dates come back exactly reversed', () => {
    const expenses = Array.from({ length: 150 }, (_, i) => expense(`x${i}`, '2026-11-09'));
    const state: BudgetState = { ...createInitialState('2026-11'), expenses };
    expect(expensesForMonth(state).map((e) => e.id)).toEqual(expenses.map((e) => e.id).reverse());
  });

  it('ties stay ordered when interleaved with other dates and other months', () => {
    const state: BudgetState = {
      ...createInitialState('2026-11'),
      expenses: [
        expense('a', '2026-11-05'),
        expense('z1', '2026-12-05'),
        expense('b', '2026-11-05'),
        expense('c', '2026-11-06'),
        expense('z2', '2026-11-32'),
        expense('d', '2026-11-05'),
        expense('z3', '2025-11-05'),
        expense('e', '2026-11-06'),
      ],
    };
    expect(expensesForMonth(state).map((e) => e.id)).toEqual(['e', 'c', 'd', 'b', 'a']);
  });

  it('returns the same expense objects, empty for no expenses', () => {
    const state = makeS();
    const list = expensesForMonth(state);
    expect(list).toHaveLength(3);
    expect(list.map((e) => e.id)).toEqual(['e3', 'e2', 'e1']);
    for (const item of list) expect(state.expenses).toContain(item);
    expect(expensesForMonth(createInitialState('2026-11'))).toEqual([]);
  });

  it('a leap-day expense is listed in a leap February', () => {
    const state = addExpense(createInitialState('2028-02'), { categoryId: RENT, amountCents: 1, note: '', date: '2028-02-29' }, 'leap');
    expect(expensesForMonth(state).map((e) => e.id)).toEqual(['leap']);
  });
});

// ---------------------------------------------------------------------------
// Differential test against a BigInt reference
// ---------------------------------------------------------------------------

function makeRng(seed: number): () => number {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function int(rng: () => number, bound: number): number {
  return Math.floor(rng() * bound);
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return at(items, int(rng, items.length));
}

const BIG_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function refDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function refIsRealDate(text: string): boolean {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(text);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= refDaysInMonth(year, month);
}

function refInMonth(date: string, month: string): boolean {
  return refIsRealDate(date) && date.startsWith(`${month}-`);
}

function randomAmount(rng: () => number, hugeBias: boolean, allowZero: boolean): number {
  const roll = rng();
  let value: number;
  if (hugeBias && roll < 0.95) {
    value = MAX_CENTS - int(rng, 1000);
  } else if (roll < 0.1) {
    value = 0;
  } else if (roll < 0.5) {
    value = int(rng, 5000);
  } else if (roll < 0.8) {
    value = int(rng, 1_000_000_000);
  } else if (roll < 0.9) {
    value = MAX_CENTS - int(rng, 1000);
  } else {
    value = Math.min(MAX_CENTS, Math.floor(rng() * (MAX_CENTS + 1)));
  }
  return !allowZero && value === 0 ? 1 : value;
}

function randomDate(rng: () => number, month: string, hugeBias: boolean): string {
  const roll = hugeBias ? rng() * 0.6 : rng();
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  if (roll < 0.65) {
    return `${month}-${String(1 + int(rng, refDaysInMonth(year, monthNumber))).padStart(2, '0')}`;
  }
  const others = [
    `${year}-${String(monthNumber === 1 ? 12 : monthNumber - 1).padStart(2, '0')}-15`,
    `${year}-${String(monthNumber === 12 ? 1 : monthNumber + 1).padStart(2, '0')}-01`,
    `${year - 1}-${String(monthNumber).padStart(2, '0')}-10`,
    `${year + 1}-${String(monthNumber).padStart(2, '0')}-10`,
    `${month}-31x`,
    `${month}-00`,
    `${month}-32`,
    `${month}-99`,
    'garbage',
    '',
  ];
  const candidate = pick(rng, others);
  // Feb has no 30th or 31st; for 30-day months the 31st is not real either.
  return rng() < 0.5 ? `${month}-31` : candidate;
}

function randomState(rng: () => number, hugeBias: boolean): BudgetState {
  const month = pick(rng, ['2026-11', '2028-02', '2026-02', '1900-02', '2000-02', '2026-04', '2026-12']);
  const categoryCount = hugeBias ? (rng() < 0.5 ? 1 + int(rng, 3) : 70 + int(rng, 60)) : int(rng, 8);
  const categories: Category[] = [];
  for (let i = 0; i < categoryCount; i += 1) {
    categories.push({ id: `c${i}`, name: `Name ${i}`, plannedCents: randomAmount(rng, hugeBias, true) });
  }
  const expenseCount = hugeBias ? 70 + int(rng, 60) : int(rng, 25);
  const expenses: Expense[] = [];
  for (let i = 0; i < expenseCount; i += 1) {
    const known = categories.length > 0 && rng() < (hugeBias ? 0.97 : 0.75);
    const categoryId = known ? at(categories, int(rng, categories.length)).id : `gone${int(rng, 3)}`;
    expenses.push({
      id: `x${i}`,
      categoryId,
      amountCents: randomAmount(rng, hugeBias, true),
      note: '',
      date: randomDate(rng, month, hugeBias),
    });
  }
  return { month, incomeCents: randomAmount(rng, false, true), categories, expenses };
}

interface ReferenceTotals {
  incomeCents: bigint;
  plannedCents: bigint;
  spentCents: bigint;
  leftToSpendCents: bigint;
  unplannedCents: bigint;
  removedCategoriesSpentCents: bigint;
}

function referenceTotals(state: BudgetState): ReferenceTotals {
  const inMonth = state.expenses.filter((e) => refInMonth(e.date, state.month));
  const ids = new Set(state.categories.map((c) => c.id));
  let planned = 0n;
  for (const c of state.categories) planned += BigInt(c.plannedCents);
  let spent = 0n;
  let removed = 0n;
  for (const e of inMonth) {
    spent += BigInt(e.amountCents);
    if (!ids.has(e.categoryId)) removed += BigInt(e.amountCents);
  }
  const income = BigInt(state.incomeCents);
  return {
    incomeCents: income,
    plannedCents: planned,
    spentCents: spent,
    leftToSpendCents: income - spent,
    unplannedCents: income - planned,
    removedCategoriesSpentCents: removed,
  };
}

function fitsSafe(value: bigint): boolean {
  return value <= BIG_SAFE && value >= -BIG_SAFE;
}

function referenceSummaries(state: BudgetState): { spent: bigint; remaining: bigint; over: boolean; hasPlan: boolean }[] {
  const inMonth = state.expenses.filter((e) => refInMonth(e.date, state.month));
  return state.categories.map((c) => {
    let spent = 0n;
    for (const e of inMonth) if (e.categoryId === c.id) spent += BigInt(e.amountCents);
    const planned = BigInt(c.plannedCents);
    return { spent, remaining: planned - spent, over: spent > planned, hasPlan: planned > 0n };
  });
}

describe('differential test against an independent BigInt reference', () => {
  const stats = { cases: 0, totalsThrew: 0, totalsOk: 0, summariesThrew: 0, summariesOk: 0, withRemoved: 0, withForeign: 0 };

  function runCase(state: BudgetState): void {
    stats.cases += 1;
    const before = structuredClone(state);
    const ref = referenceTotals(state);
    const totalsFit = [ref.plannedCents, ref.spentCents, ref.leftToSpendCents, ref.unplannedCents, ref.removedCategoriesSpentCents].every(fitsSafe);
    if (ref.removedCategoriesSpentCents > 0n) stats.withRemoved += 1;
    if (state.expenses.some((e) => !refInMonth(e.date, state.month))) stats.withForeign += 1;
    if (totalsFit) {
      stats.totalsOk += 1;
      expect(getTotals(state)).toEqual({
        incomeCents: Number(ref.incomeCents),
        plannedCents: Number(ref.plannedCents),
        spentCents: Number(ref.spentCents),
        leftToSpendCents: Number(ref.leftToSpendCents),
        unplannedCents: Number(ref.unplannedCents),
        removedCategoriesSpentCents: Number(ref.removedCategoriesSpentCents),
        hasIncome: ref.incomeCents > 0n,
      });
    } else {
      stats.totalsThrew += 1;
      expectRangeError(() => getTotals(state));
    }

    const refSummaries = referenceSummaries(state);
    const summariesFit = refSummaries.every((s) => fitsSafe(s.spent) && fitsSafe(s.remaining));
    if (summariesFit) {
      stats.summariesOk += 1;
      expect(getCategorySummaries(state)).toEqual(
        state.categories.map((category, index) => {
          const r = at(refSummaries, index);
          return { category, spentCents: Number(r.spent), remainingCents: Number(r.remaining), isOverBudget: r.over, hasPlan: r.hasPlan };
        }),
      );
    } else {
      stats.summariesThrew += 1;
      expectRangeError(() => getCategorySummaries(state));
    }

    // expensesForMonth: same members as the reference filter, ordered date desc then later-added first.
    const list = expensesForMonth(state);
    const wanted = state.expenses.filter((e) => refInMonth(e.date, state.month)).map((e) => e.id);
    expect([...list.map((e) => e.id)].sort()).toEqual([...wanted].sort());
    for (let i = 1; i < list.length; i += 1) {
      const previous = at(list, i - 1);
      const current = at(list, i);
      if (previous.date === current.date) {
        expect(state.expenses.indexOf(previous)).toBeGreaterThan(state.expenses.indexOf(current));
      } else {
        expect(previous.date > current.date).toBe(true);
      }
    }
    expect(state).toEqual(before);
  }

  it('getTotals, getCategorySummaries and expensesForMonth agree with the reference on 3000 ordinary random states (seed 424242)', () => {
    const rng = makeRng(424242);
    for (let i = 0; i < 3000; i += 1) runCase(randomState(rng, false));
  });

  it('they agree, including RangeError on overflow, on 800 states built from near-MAX_CENTS amounts (seed 8675309)', () => {
    const rng = makeRng(8675309);
    for (let i = 0; i < 800; i += 1) runCase(randomState(rng, true));
  });

  it('the random states exercised every branch: overflow and non-overflow, removed-category spending and foreign-month expenses', () => {
    expect(stats.cases).toBe(3800);
    expect(stats.totalsThrew).toBeGreaterThan(20);
    expect(stats.totalsOk).toBeGreaterThan(1000);
    expect(stats.summariesThrew).toBeGreaterThan(0);
    expect(stats.summariesOk).toBeGreaterThan(1000);
    expect(stats.withRemoved).toBeGreaterThan(500);
    expect(stats.withForeign).toBeGreaterThan(500);
  });
});

// ---------------------------------------------------------------------------
// Sequence test
// ---------------------------------------------------------------------------

describe('random operation sequences keep the invariants', () => {
  const names = ['Rent', 'rent', ' Rent ', 'Pets', 'pets', 'Fun', 'Gifts', 'Eating out', '', '   ', 'Books', 'Coffee'];

  function checkInvariants(state: BudgetState): void {
    const totals = getTotals(state);
    const summaries = getCategorySummaries(state);
    const inMonth = expensesForMonth(state);
    const sumOf = (amounts: number[]): number => amounts.reduce((a, b) => a + b, 0);
    expect(totals.spentCents).toBe(sumOf(inMonth.map((e) => e.amountCents)));
    expect(totals.leftToSpendCents).toBe(totals.incomeCents - totals.spentCents);
    expect(totals.unplannedCents).toBe(totals.incomeCents - totals.plannedCents);
    expect(totals.plannedCents).toBe(sumOf(state.categories.map((c) => c.plannedCents)));
    expect(totals.incomeCents).toBe(state.incomeCents);
    expect(totals.hasIncome).toBe(state.incomeCents > 0);
    expect(sumOf(summaries.map((s) => s.spentCents)) + totals.removedCategoriesSpentCents).toBe(totals.spentCents);
    expect(summaries.map((s) => s.category.id)).toEqual(state.categories.map((c) => c.id));
    for (const entry of summaries) {
      expect(entry.remainingCents).toBe(entry.category.plannedCents - entry.spentCents);
      expect(entry.isOverBudget).toBe(entry.spentCents > entry.category.plannedCents);
      expect(entry.hasPlan).toBe(entry.category.plannedCents > 0);
    }
    const ids = new Set(state.categories.map((c) => c.id));
    expect(totals.removedCategoriesSpentCents).toBe(sumOf(inMonth.filter((e) => !ids.has(e.categoryId)).map((e) => e.amountCents)));
    expect(new Set(state.categories.map((c) => c.id)).size).toBe(state.categories.length);
    expect(new Set(state.expenses.map((e) => e.id)).size).toBe(state.expenses.length);
    for (const e of state.expenses) {
      expect(isDateInMonth(e.date, state.month)).toBe(true);
      expect(e.amountCents).toBeGreaterThanOrEqual(1);
    }
  }

  function runSequence(seed: number, steps: number): { adds: number; rejected: number } {
    const rng = makeRng(seed);
    const month = pick(rng, ['2026-11', '2028-02', '2026-02']);
    const days = datesInMonth(month);
    let state = createInitialState(month);
    let nextId = 0;
    let adds = 0;
    let rejected = 0;
    for (let step = 0; step < steps; step += 1) {
      const before = structuredClone(state);
      const op = int(rng, 8);
      let next = state;
      const newId = (): string => `id${nextId++}`;
      const someCategoryId = (): string => (state.categories.length > 0 && rng() < 0.85 ? at(state.categories, int(rng, state.categories.length)).id : 'nope');
      if (op === 0) {
        next = setIncome(state, int(rng, 5_000_000));
      } else if (op === 1) {
        const name = pick(rng, names);
        const id = rng() < 0.1 && state.categories.length > 0 ? someCategoryId() : newId();
        const mustFail = categoryNameError(state, name) !== null || state.categories.some((c) => c.id === id);
        if (mustFail) {
          expectPlainError(() => addCategory(state, { name, plannedCents: 1 }, id));
          rejected += 1;
        } else {
          next = addCategory(state, { name, plannedCents: int(rng, 100_000) }, id);
          expect(at(next.categories, next.categories.length - 1).name).toBe(name.trim());
        }
      } else if (op === 2) {
        const id = someCategoryId();
        const patch = rng() < 0.5 ? { plannedCents: int(rng, 100_000) } : { name: pick(rng, names) };
        next = updateCategory(state, id, patch);
        if (!state.categories.some((c) => c.id === id)) expect(next).toBe(state);
      } else if (op === 3) {
        const id = someCategoryId();
        next = removeCategory(state, id);
        if (!state.categories.some((c) => c.id === id)) expect(next).toBe(state);
        expect(next.expenses).toEqual(state.expenses);
      } else if (op === 4 || op === 5) {
        const categoryId = someCategoryId();
        const date = rng() < 0.9 ? pick(rng, days) : pick(rng, ['2026-12-01', '2025-01-01', `${month}-31x`, '']);
        const amountCents = rng() < 0.9 ? 1 + int(rng, 100_000) : pick(rng, [0, -5]);
        const mustFail = !state.categories.some((c) => c.id === categoryId) || !days.includes(date) || amountCents < 1;
        if (mustFail) {
          expect(() => addExpense(state, { categoryId, amountCents, note: ' n ', date }, newId())).toThrow();
          rejected += 1;
        } else {
          next = addExpense(state, { categoryId, amountCents, note: ' n ', date }, newId());
          adds += 1;
        }
      } else if (op === 6) {
        const id = state.expenses.length > 0 && rng() < 0.8 ? at(state.expenses, int(rng, state.expenses.length)).id : 'nope';
        next = deleteExpense(state, id);
        if (id === 'nope') expect(next).toBe(state);
        else expect(next.expenses).toHaveLength(state.expenses.length - 1);
      } else {
        // Re-adding a removed suggested category by id is the "undo" a UI could do.
        const id = pick(rng, SUGGESTED_CATEGORIES).id;
        if (!state.categories.some((c) => c.id === id) && categoryNameError(state, 'Rent') === null) {
          next = addCategory(state, { name: 'Rent', plannedCents: 0 }, id);
        }
      }
      expect(state).toEqual(before);
      state = next;
      checkInvariants(state);
    }
    return { adds, rejected };
  }

  it('hold after every step of 60 sequences of 150 operations (seeds 1 to 60)', () => {
    let adds = 0;
    let rejected = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const result = runSequence(seed, 150);
      adds += result.adds;
      rejected += result.rejected;
    }
    expect(adds).toBeGreaterThan(500);
    expect(rejected).toBeGreaterThan(200);
  });
});

// ---------------------------------------------------------------------------
// Behaviour the task does not specify (pinned so a change is noticed)
// ---------------------------------------------------------------------------

describe('behaviour the task does not specify', () => {
  const goodExpense = { categoryId: TRANSPORT, amountCents: 700, note: '', date: '2026-11-04' };

  it('addExpense reports the amount first, then the date, then a duplicate id, then an unknown category', () => {
    const allWrong = { categoryId: 'nope', amountCents: 0, note: '', date: '2026-12-01' };
    expectRangeError(() => addExpense(makeS(), allWrong, 'e1'));
    expect(String(thrown(() => addExpense(makeS(), allWrong, 'e1')))).toMatch(/amount/i);

    const dateWrong = { categoryId: 'nope', amountCents: 5, note: '', date: '2026-12-01' };
    expectRangeError(() => addExpense(makeS(), dateWrong, 'e1'));
    expect(String(thrown(() => addExpense(makeS(), dateWrong, 'e1')))).toMatch(/date/i);

    const dupAndUnknown = { categoryId: 'nope', amountCents: 5, note: '', date: '2026-11-04' };
    expectPlainError(() => addExpense(makeS(), dupAndUnknown, 'e1'));
    expect(String(thrown(() => addExpense(makeS(), dupAndUnknown, 'e1')))).toMatch(/Expense id already used/);
    expect(String(thrown(() => addExpense(makeS(), dupAndUnknown, 'fresh')))).toMatch(/Unknown category/);
    expect(String(thrown(() => addExpense(makeS(), goodExpense, 'e1')))).toMatch(/Expense id already used/);
  });

  it('addCategory reports the amount first, then a duplicate id, then the name', () => {
    expectRangeError(() => addCategory(makeS(), { name: '', plannedCents: -1 }, RENT));
    expectPlainError(() => addCategory(makeS(), { name: '', plannedCents: 1 }, RENT));
    expect(String(thrown(() => addCategory(makeS(), { name: '', plannedCents: 1 }, RENT)))).toMatch(/Category id already used/);
    expect(String(thrown(() => addCategory(makeS(), { name: '', plannedCents: 1 }, 'fresh')))).toBe('Error: Enter a category name');
    expect(String(thrown(() => addCategory(makeS(), { name: 'rent', plannedCents: 1 }, 'fresh')))).toBe('Error: You already have a category called Rent');
  });

  it('updateCategory throws RangeError for an invalid plannedCents even when the id is unknown', () => {
    expectRangeError(() => updateCategory(makeS(), 'nope', { plannedCents: -1 }));
    expectRangeError(() => updateCategory(makeS(), 'nope', { plannedCents: NaN }));
  });

  it('categoryNameError reports the first duplicate in category order', () => {
    const state: BudgetState = {
      ...makeScenario(),
      categories: [
        { id: 'a', name: ' Pets', plannedCents: 0 },
        { id: 'b', name: 'PETS', plannedCents: 0 },
        { id: 'c', name: 'pets ', plannedCents: 0 },
      ],
    };
    expect(categoryNameError(state, 'pets')).toBe('You already have a category called Pets');
    expect(categoryNameError(state, 'pets', 'a')).toBe('You already have a category called PETS');
    expect(categoryNameError(state, 'pets', 'b')).toBe('You already have a category called Pets');
  });
});

// ---------------------------------------------------------------------------
// Regression tests (review findings)
// ---------------------------------------------------------------------------

describe('updateCategory ignores undefined and unknown patch keys', () => {
  function hasUndefinedValue(value: object): boolean {
    return Object.values(value).some((v) => v === undefined);
  }

  it('{ name: undefined } leaves the name unchanged and later reads still work', () => {
    const state = updateCategory(makeS(), RENT, { name: undefined });
    const category = at(state.categories, 0);
    expect(category).toEqual({ id: RENT, name: 'Rent', plannedCents: 150000 });
    expect(hasUndefinedValue(category)).toBe(false);
    expect(categoryLabel(state, RENT)).toBe('Rent');
    expect(categoryNameError(state, 'Pets')).toBeNull();
    expect(categoryNameError(state, 'rent')).toBe('You already have a category called Rent');
    expect(addCategory(state, { name: 'Pets', plannedCents: 0 }, 'pets').categories).toHaveLength(6);
  });

  it('{ plannedCents: undefined } leaves plannedCents unchanged and totals and summaries are still right', () => {
    const state = updateCategory(makeS(), GROCERIES, { plannedCents: undefined });
    expect(hasUndefinedValue(at(state.categories, 1))).toBe(false);
    expect(state).toEqual(makeS());
    expect(getTotals(state)).toEqual(getTotals(makeS()));
    expect(getTotals(state).plannedCents).toBe(227000);
    expect(getCategorySummaries(state)).toEqual(getCategorySummaries(makeS()));
  });

  it('{ name: undefined, plannedCents: undefined } together change nothing', () => {
    expect(updateCategory(makeS(), RENT, { name: undefined, plannedCents: undefined })).toEqual(makeS());
  });

  it('a defined value next to an undefined one is still applied', () => {
    const state = updateCategory(makeS(), RENT, { name: undefined, plannedCents: 7 });
    expect(at(state.categories, 0)).toEqual({ id: RENT, name: 'Rent', plannedCents: 7 });
  });

  it('a patch carrying an id never changes the id or moves the category (Category variable)', () => {
    const whole: Category = { id: GROCERIES, name: 'Renamed', plannedCents: 5 };
    const state = updateCategory(makeS(), RENT, whole);
    expect(state.categories.map((c) => c.id)).toEqual([RENT, GROCERIES, TRANSPORT, UTILITIES, EATING_OUT]);
    expect(at(state.categories, 0)).toEqual({ id: RENT, name: 'Renamed', plannedCents: 5 });
    expect(at(state.categories, 1)).toEqual(at(makeS().categories, 1));
  });

  it('a patch carrying an id never changes the id (Partial<Category> variable)', () => {
    const partial: Partial<Category> = { id: 'hijacked' };
    const state = updateCategory(makeS(), RENT, partial);
    expect(state).toEqual(makeS());
    expect(categoryLabel(state, 'hijacked')).toBe('Removed category');
    const withName: Partial<Category> = { id: 'hijacked', name: 'X' };
    const state2 = updateCategory(makeS(), RENT, withName);
    expect(at(state2.categories, 0)).toEqual({ id: RENT, name: 'X', plannedCents: 150000 });
  });

  it('extra unknown keys are ignored', () => {
    const patch = { name: 'Y', colour: 'red', expenses: [1], __proto__x: 1 } as unknown as Parameters<typeof updateCategory>[2];
    const state = updateCategory(makeS(), RENT, patch);
    expect(at(state.categories, 0)).toEqual({ id: RENT, name: 'Y', plannedCents: 150000 });
    expect(Object.keys(at(state.categories, 0)).sort()).toEqual(['id', 'name', 'plannedCents']);
  });

  it("falsy values are still applied: { name: '' } stores '' and { plannedCents: 0 } stores 0", () => {
    const blank = updateCategory(makeS(), RENT, { name: '' });
    expect(at(blank.categories, 0).name).toBe('');
    const zero = updateCategory(makeS(), RENT, { plannedCents: 0 });
    expect(at(zero.categories, 0).plannedCents).toBe(0);
    expect(Object.is(at(zero.categories, 0).plannedCents, 0)).toBe(true);
    const both = updateCategory(makeS(), RENT, { name: '', plannedCents: 0 });
    expect(at(both.categories, 0)).toEqual({ id: RENT, name: '', plannedCents: 0 });
  });

  it('a JSON round trip of an updated state equals the state (no undefined keys)', () => {
    let state = updateCategory(makeS(), RENT, { name: undefined });
    state = updateCategory(state, GROCERIES, { plannedCents: undefined });
    state = updateCategory(state, TRANSPORT, { name: '', plannedCents: 0 });
    state = updateCategory(state, UTILITIES, { name: ' Bills ' });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    for (const category of state.categories) expect(hasUndefinedValue(category)).toBe(false);
  });
});

describe('SUGGESTED_CATEGORIES is frozen but createInitialState copies are not', () => {
  it('Object.isFrozen is true for the list and for each entry', () => {
    expect(Object.isFrozen(SUGGESTED_CATEGORIES)).toBe(true);
    for (const entry of SUGGESTED_CATEGORIES) expect(Object.isFrozen(entry)).toBe(true);
  });

  it('createInitialState results are not frozen and are independent copies', () => {
    const a = createInitialState('2026-11');
    const b = createInitialState('2026-11');
    expect(Object.isFrozen(a)).toBe(false);
    expect(Object.isFrozen(a.categories)).toBe(false);
    for (const category of a.categories) expect(Object.isFrozen(category)).toBe(false);
    const snapshot = structuredClone(SUGGESTED_CATEGORIES);
    at(a.categories, 0).name = 'Mutated';
    at(a.categories, 0).plannedCents = 9;
    a.categories.push({ id: 'z', name: 'Z', plannedCents: 1 });
    expect(at(b.categories, 0)).toEqual({ id: RENT, name: 'Rent', plannedCents: 0 });
    expect(b.categories).toHaveLength(5);
    expect(SUGGESTED_CATEGORIES).toEqual(snapshot);
  });
});

describe('sumCents checks every input and every running total', () => {
  it('a non-integer input after a large one throws RangeError', () => {
    expectRangeError(() => sumCents([2 ** 52, 0.5]));
  });
  it('an unsafe input after a negative one throws RangeError', () => {
    expectRangeError(() => sumCents([-10, Number.MAX_SAFE_INTEGER + 2]));
  });
  it('an intermediate overflow that a later negative would hide still throws RangeError', () => {
    expectRangeError(() => sumCents([Number.MAX_SAFE_INTEGER, 2, -10]));
    expectRangeError(() => sumCents([-Number.MAX_SAFE_INTEGER, -2, 10]));
  });
});
