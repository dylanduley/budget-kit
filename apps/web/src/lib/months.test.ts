import { describe, expect, it } from 'vitest';

import { type BudgetState, SUGGESTED_CATEGORY_NAMES, createInitialState } from '@/lib/budget';
import {
  EMPTY_BOOK,
  adjacentMonth,
  availableMonths,
  copySourceFor,
  findMonth,
  monthSummaries,
  monthToShow,
  putMonth,
  startMonth,
} from '@/lib/months';
import { BOOK, OCTOBER, SCENARIO } from '@/test/fixtures';

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const month = (m: string, income = 0): BudgetState => ({ ...createInitialState(m), incomeCents: income });

describe('createInitialState and SUGGESTED_CATEGORY_NAMES', () => {
  it('createInitialState has no categories', () => {
    expect(createInitialState('2026-11')).toEqual({ month: '2026-11', incomeCents: 0, categories: [], expenses: [] });
  });
  it('SUGGESTED_CATEGORY_NAMES is the five names, frozen', () => {
    expect(SUGGESTED_CATEGORY_NAMES).toEqual(['Rent', 'Groceries', 'Transport', 'Utilities', 'Eating out']);
    expect(Object.isFrozen(SUGGESTED_CATEGORY_NAMES)).toBe(true);
  });
});

describe('EMPTY_BOOK', () => {
  it('is empty and frozen (book and months)', () => {
    expect(EMPTY_BOOK).toEqual({ months: [] });
    expect(Object.isFrozen(EMPTY_BOOK)).toBe(true);
    expect(Object.isFrozen(EMPTY_BOOK.months)).toBe(true);
    expect(() => (EMPTY_BOOK.months as BudgetState[]).push(month('2026-01'))).toThrow();
  });
});

describe('findMonth / monthToShow', () => {
  it('finds a stored month and returns undefined otherwise', () => {
    expect(findMonth(BOOK, '2026-10')).toBe(OCTOBER);
    expect(findMonth(BOOK, '2026-09')).toBeUndefined();
    expect(findMonth(EMPTY_BOOK, '2026-11')).toBeUndefined();
  });
  it('monthToShow returns the stored object itself, else a started month', () => {
    expect(monthToShow(BOOK, '2026-11')).toBe(SCENARIO);
    expect(monthToShow(BOOK, '2026-12')).toEqual(startMonth(BOOK, '2026-12'));
    expect(monthToShow(BOOK, '2026-12').expenses).toEqual([]);
  });
});

describe('copySourceFor', () => {
  it('is the latest stored month strictly earlier than the month', () => {
    expect(copySourceFor(BOOK, '2026-12')).toBe(SCENARIO);
    expect(copySourceFor(BOOK, '2026-11')).toBe(OCTOBER);
    expect(copySourceFor(BOOK, '2026-10')).toBeUndefined();
    expect(copySourceFor(BOOK, '2026-09')).toBeUndefined();
    expect(copySourceFor(EMPTY_BOOK, '2026-11')).toBeUndefined();
  });
  it('picks the latest earlier month regardless of array order and skips gaps and future months', () => {
    const jan = month('2026-01', 1);
    const mar = month('2026-03', 3);
    const dec = month('2026-12', 12);
    expect(copySourceFor({ months: [dec, jan, mar] }, '2026-06')).toBe(mar);
    expect(copySourceFor({ months: [mar, dec, jan] }, '2026-06')).toBe(mar);
    expect(copySourceFor({ months: [jan, mar, dec] }, '2027-01')).toBe(dec);
  });
  it('never uses a later month or the month itself', () => {
    expect(copySourceFor({ months: [month('2026-12', 9)] }, '2026-12')).toBeUndefined();
    expect(copySourceFor({ months: [month('2026-12', 9)] }, '2026-11')).toBeUndefined();
  });
  it('compares across years', () => {
    const dec25 = month('2025-12', 5);
    expect(copySourceFor({ months: [dec25] }, '2026-01')).toBe(dec25);
    expect(copySourceFor({ months: [month('2027-01')] }, '2026-12')).toBeUndefined();
  });
});

describe('startMonth', () => {
  it('copies income and categories (same ids, names, plans) from the earlier month with no expenses', () => {
    const result = startMonth({ months: [OCTOBER] }, '2026-12');
    expect(result.month).toBe('2026-12');
    expect(result.incomeCents).toBe(300000);
    expect(result.categories.map((c) => c.plannedCents)).toEqual([150000, 40000, 12000, 15000, 10000]);
    expect(result.categories.map((c) => c.id)).toEqual(OCTOBER.categories.map((c) => c.id));
    expect(result.categories).toEqual(OCTOBER.categories);
    expect(result.expenses).toEqual([]);
  });
  it('copies from the LATEST earlier month, not a skipped older one', () => {
    const older = { ...month('2026-01', 111), categories: [{ id: 'old', name: 'Old', plannedCents: 1 }] };
    const newer = { ...month('2026-03', 333), categories: [{ id: 'new', name: 'New', plannedCents: 3 }] };
    const future = month('2026-09', 999);
    const result = startMonth({ months: [future, older, newer] }, '2026-06');
    expect(result).toEqual({ month: '2026-06', incomeCents: 333, categories: [{ id: 'new', name: 'New', plannedCents: 3 }], expenses: [] });
  });
  it('does not copy from a future month: empty start', () => {
    expect(startMonth({ months: [SCENARIO] }, '2026-10')).toEqual({ month: '2026-10', incomeCents: 0, categories: [], expenses: [] });
    expect(startMonth({ months: [BOOK.months[1]!] }, '2026-11')).toEqual(createInitialState('2026-11'));
  });
  it('EMPTY_BOOK gives an empty month', () => {
    expect(startMonth(EMPTY_BOOK, '2026-11')).toEqual({ month: '2026-11', incomeCents: 0, categories: [], expenses: [] });
  });
  it('shares no object with the input: mutating the result leaves the book unchanged', () => {
    const book = clone(BOOK);
    const result = startMonth(book, '2026-12');
    result.categories[0]!.name = 'CHANGED';
    result.categories.push({ id: 'x', name: 'x', plannedCents: 1 });
    result.incomeCents = 1;
    expect(book).toEqual(BOOK);
    for (const c of result.categories) {
      for (const m of book.months) expect(m.categories).not.toContain(c);
    }
    expect(result.categories).not.toBe(book.months[1]!.categories);
    expect(result.expenses).not.toBe(book.months[1]!.expenses);
  });
  it('does not throw on a deep-frozen book and does not mutate it', () => {
    const book = deepFreeze(clone(BOOK));
    expect(() => startMonth(book, '2026-12')).not.toThrow();
    expect(book).toEqual(BOOK);
    expect(() => startMonth(deepFreeze(clone(BOOK)), '2026-09')).not.toThrow();
  });
  it('throws RangeError for non-ISO months', () => {
    for (const bad of ['', '2026', '2026-13', '2026-00', '2026-11-01', 'nov', '2026-1']) {
      expect(() => startMonth(BOOK, bad)).toThrow(RangeError);
    }
  });
  it('copying a month with zero income and zero categories stays valid', () => {
    expect(startMonth({ months: [month('2026-01')] }, '2026-02')).toEqual(createInitialState('2026-02'));
  });
});

describe('putMonth', () => {
  it('replaces the month with the same key', () => {
    const next = putMonth(BOOK, { ...OCTOBER, incomeCents: 1 });
    expect(next.months).toHaveLength(2);
    expect(next.months.map((m) => m.month)).toEqual(['2026-10', '2026-11']);
    expect(findMonth(next, '2026-10')?.incomeCents).toBe(1);
    expect(findMonth(next, '2026-11')).toBe(SCENARIO);
  });
  it('inserts keeping ascending order (start, middle, end)', () => {
    expect(putMonth(BOOK, createInitialState('2026-09')).months.map((m) => m.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(putMonth(BOOK, createInitialState('2026-12')).months.map((m) => m.month)).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(putMonth({ months: [month('2026-01'), month('2026-03')] }, month('2026-02')).months.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(putMonth(EMPTY_BOOK, month('2026-05')).months.map((m) => m.month)).toEqual(['2026-05']);
  });
  it('does not mutate the input book or its months array, and returns a new book', () => {
    const book = deepFreeze(clone(BOOK));
    let result: ReturnType<typeof putMonth> | undefined;
    expect(() => {
      result = putMonth(book, createInitialState('2026-09'));
      putMonth(book, { ...OCTOBER, incomeCents: 7 });
    }).not.toThrow();
    expect(book).toEqual(BOOK);
    expect(result).not.toBe(book);
    expect(putMonth(BOOK, OCTOBER)).not.toBe(BOOK);
    expect(BOOK.months).toEqual([OCTOBER, SCENARIO]);
  });
  it('works on EMPTY_BOOK without mutating it', () => {
    putMonth(EMPTY_BOOK, month('2026-05'));
    expect(EMPTY_BOOK.months).toHaveLength(0);
  });
  it('puts the given state object itself in the book', () => {
    const s = month('2026-09');
    expect(findMonth(putMonth(BOOK, s), '2026-09')).toBe(s);
  });
});

describe('availableMonths', () => {
  it('matches the examples', () => {
    expect(availableMonths(BOOK, '2026-11')).toEqual(['2026-10', '2026-11']);
    expect(availableMonths(BOOK, '2026-12')).toEqual(['2026-10', '2026-11', '2026-12']);
  });
  it('includes an earlier current month, is unique and sorted regardless of input order', () => {
    expect(availableMonths(BOOK, '2026-09')).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(availableMonths({ months: [SCENARIO, OCTOBER] }, '2026-10')).toEqual(['2026-10', '2026-11']);
    expect(availableMonths(EMPTY_BOOK, '2026-11')).toEqual(['2026-11']);
  });
  it('sorts across years and does not mutate the book', () => {
    const book = deepFreeze({ months: [month('2027-01'), month('2025-12')] });
    expect(availableMonths(book, '2026-06')).toEqual(['2025-12', '2026-06', '2027-01']);
  });
});

describe('adjacentMonth', () => {
  const list = ['2026-10', '2026-11', '2026-12'];
  it('returns neighbours', () => {
    expect(adjacentMonth(list, '2026-11', -1)).toBe('2026-10');
    expect(adjacentMonth(list, '2026-11', 1)).toBe('2026-12');
    expect(adjacentMonth(list, '2026-10', 1)).toBe('2026-11');
    expect(adjacentMonth(list, '2026-12', -1)).toBe('2026-11');
  });
  it('is null at the ends, for an unknown month and for an empty list', () => {
    expect(adjacentMonth(['2026-10', '2026-11'], '2026-10', -1)).toBeNull();
    expect(adjacentMonth(list, '2026-12', 1)).toBeNull();
    expect(adjacentMonth(list, '2026-09', 1)).toBeNull();
    expect(adjacentMonth(list, '2026-09', -1)).toBeNull();
    expect(adjacentMonth([], '2026-11', 1)).toBeNull();
    expect(adjacentMonth(['2026-11'], '2026-11', 1)).toBeNull();
    expect(adjacentMonth(['2026-11'], '2026-11', -1)).toBeNull();
  });
});

describe('monthSummaries', () => {
  it('matches the BOOK example exactly, newest first', () => {
    expect(monthSummaries(BOOK, '2026-11')).toEqual([
      { month: '2026-11', incomeCents: 320000, spentCents: 169482, leftToSpendCents: 150518, hasIncome: true, isStored: true },
      { month: '2026-10', incomeCents: 300000, spentCents: 349482, leftToSpendCents: -49482, hasIncome: true, isStored: true },
    ]);
  });
  it('an unstored current month shows the copy and isStored false', () => {
    const [first, second] = monthSummaries({ months: [OCTOBER] }, '2026-11');
    expect(first).toEqual({ month: '2026-11', incomeCents: 300000, spentCents: 0, leftToSpendCents: 300000, hasIncome: true, isStored: false });
    expect(second?.month).toBe('2026-10');
    expect(second?.isStored).toBe(true);
  });
  it('a month with expenses and no income has hasIncome false and negative left', () => {
    const sep: BudgetState = {
      ...createInitialState('2026-09'),
      categories: [{ id: 'c', name: 'C', plannedCents: 0 }],
      expenses: [{ id: 'e', categoryId: 'c', amountCents: 2000, note: '', date: '2026-09-02' }],
    };
    expect(monthSummaries({ months: [sep] }, '2026-09')).toEqual([
      { month: '2026-09', incomeCents: 0, spentCents: 2000, leftToSpendCents: -2000, hasIncome: false, isStored: true },
    ]);
  });
  it('one entry per available month, with gaps not invented', () => {
    const list = monthSummaries({ months: [month('2026-01'), month('2026-04')] }, '2026-04');
    expect(list.map((s) => s.month)).toEqual(['2026-04', '2026-01']);
  });
  it('empty book gives one unstored current month; does not mutate a frozen book', () => {
    expect(monthSummaries(EMPTY_BOOK, '2026-11')).toEqual([
      { month: '2026-11', incomeCents: 0, spentCents: 0, leftToSpendCents: 0, hasIncome: false, isStored: false },
    ]);
    expect(() => monthSummaries(deepFreeze(clone(BOOK)), '2026-12')).not.toThrow();
  });
  it('every figure is an integer', () => {
    for (const s of monthSummaries(BOOK, '2026-12')) {
      for (const n of [s.incomeCents, s.spentCents, s.leftToSpendCents]) expect(Number.isInteger(n)).toBe(true);
    }
  });
});
