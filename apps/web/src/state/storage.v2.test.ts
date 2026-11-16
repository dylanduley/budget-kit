import { describe, expect, it } from 'vitest';

import { type BudgetState, MAX_CENTS } from '@/lib/budget';
import { BOOK, OCTOBER, SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import {
  STORAGE_KEY,
  loadBudget,
  parseStoredBudget,
  saveBook,
  serializeBook,
} from './storage';

const CORRUPT = { status: 'invalid', reason: 'corrupt' } as const;
const UNSUPPORTED = { status: 'invalid', reason: 'unsupported-version' } as const;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
// Exactly what the previous serializer (version 1) wrote.
const v1 = (state: unknown): string => JSON.stringify({ version: 1, state });
const v2 = (months: unknown): string => JSON.stringify({ version: 2, book: { months } });

describe('version 2 round trip', () => {
  it('serializeBook then parse gives the same book, fromVersion 2', () => {
    expect(parseStoredBudget(serializeBook(BOOK))).toEqual({ status: 'loaded', book: BOOK, fromVersion: 2 });
  });
  it('writes exactly { version: 2, book: { months } }', () => {
    expect(JSON.parse(serializeBook(BOOK))).toEqual({ version: 2, book: { months: BOOK.months } });
    expect(serializeBook({ months: [] })).toBe('{"version":2,"book":{"months":[]}}');
  });
  it('loads an empty book', () => {
    expect(parseStoredBudget(serializeBook({ months: [] }))).toEqual({ status: 'loaded', book: { months: [] }, fromVersion: 2 });
  });
  it('loads out-of-order months sorted ascending', () => {
    const result = parseStoredBudget(serializeBook({ months: [SCENARIO, OCTOBER] }));
    expect(result).toEqual({ status: 'loaded', book: { months: [OCTOBER, SCENARIO] }, fromVersion: 2 });
  });
  it('returns fresh copies, not the serialized originals', () => {
    const result = parseStoredBudget(serializeBook(BOOK));
    if (result.status !== 'loaded') throw new Error('not loaded');
    expect(result.book.months[0]).not.toBe(OCTOBER);
  });
  it('keeps extreme but valid amounts', () => {
    const big: BudgetState = {
      month: '2024-02',
      incomeCents: MAX_CENTS,
      categories: [{ id: 'a', name: '', plannedCents: MAX_CENTS }],
      expenses: [{ id: 'x', categoryId: 'a', amountCents: MAX_CENTS, note: '', date: '2024-02-29' }],
    };
    expect(parseStoredBudget(serializeBook({ months: [big] }))).toEqual({ status: 'loaded', book: { months: [big] }, fromVersion: 2 });
  });
});

describe('version 1 migration (payloads as written by the previous app)', () => {
  it('SCENARIO loads as a one-month book with fromVersion 1', () => {
    expect(parseStoredBudget(v1(SCENARIO))).toEqual({ status: 'loaded', book: { months: [SCENARIO] }, fromVersion: 1 });
  });
  it('a first-run v1 value (no categories) and a v1 with orphan expense category load', () => {
    const empty: BudgetState = { month: '2026-01', incomeCents: 0, categories: [], expenses: [] };
    expect(parseStoredBudget(v1(empty))).toEqual({ status: 'loaded', book: { months: [empty] }, fromVersion: 1 });
    const orphan: BudgetState = { ...empty, expenses: [{ id: 'x', categoryId: 'gone', amountCents: 1, note: '', date: '2026-01-02' }] };
    expect(parseStoredBudget(v1(orphan))).toEqual({ status: 'loaded', book: { months: [orphan] }, fromVersion: 1 });
  });
  it('drops unknown fields in v1', () => {
    const s = clone(SCENARIO) as unknown as Record<string, unknown>;
    s.note = 'x';
    (s.categories as Record<string, unknown>[])[0]!.colour = 'red';
    (s.expenses as Record<string, unknown>[])[0]!.tag = 't';
    expect(parseStoredBudget(JSON.stringify({ version: 1, state: s, extra: 1 }))).toEqual({
      status: 'loaded',
      book: { months: [SCENARIO] },
      fromVersion: 1,
    });
  });
  it.each<[string, (s: Record<string, unknown>) => void]>([
    ['income float', (s) => (s.incomeCents = 1250.5)],
    ['income negative', (s) => (s.incomeCents = -1)],
    ['income above max', (s) => (s.incomeCents = MAX_CENTS + 1)],
    ['bad month', (s) => (s.month = '2026-13')],
    ['expense zero amount', (s) => ((s.expenses as Record<string, unknown>[])[0]!.amountCents = 0)],
    ['expense bad date', (s) => ((s.expenses as Record<string, unknown>[])[0]!.date = '2026-02-30')],
    ['duplicate category ids', (s) => ((s.categories as Record<string, unknown>[])[1]!.id = 'suggested-rent')],
    ['duplicate expense ids', (s) => ((s.expenses as Record<string, unknown>[])[1]!.id = 'e1')],
    ['categories missing', (s) => delete s.categories],
  ])('v1 invalid (%s) is corrupt', (_n, mutate) => {
    const s = clone(SCENARIO) as unknown as Record<string, unknown>;
    mutate(s);
    expect(parseStoredBudget(v1(s))).toEqual(CORRUPT);
  });
  it('v1 with 91 categories at MAX_CENTS (cannot be totalled) is corrupt', () => {
    const categories = Array.from({ length: 91 }, (_v, i) => ({ id: `c${i}`, name: 'x', plannedCents: MAX_CENTS }));
    expect(parseStoredBudget(v1({ month: '2026-11', incomeCents: 0, categories, expenses: [] }))).toEqual(CORRUPT);
  });
  it('v1 with expenses that cannot be totalled is corrupt', () => {
    const expenses = Array.from({ length: 91 }, (_v, i) => ({ id: `x${i}`, categoryId: 'c', amountCents: MAX_CENTS, note: '', date: '2026-11-01' }));
    expect(parseStoredBudget(v1({ month: '2026-11', incomeCents: 0, categories: [{ id: 'c', name: 'c', plannedCents: 0 }], expenses }))).toEqual(CORRUPT);
  });
  it('v1 with "months" instead of "state" is corrupt', () => {
    expect(parseStoredBudget(JSON.stringify({ version: 1, book: { months: [SCENARIO] } }))).toEqual(CORRUPT);
  });
});

describe('version 2 rejects the WHOLE value for any invalid month', () => {
  const valid = clone(OCTOBER);
  it.each<[string, string]>([
    ['book missing', JSON.stringify({ version: 2 })],
    ['book null', JSON.stringify({ version: 2, book: null })],
    ['book an array', JSON.stringify({ version: 2, book: [] })],
    ['book a string', JSON.stringify({ version: 2, book: 'x' })],
    ['months missing', JSON.stringify({ version: 2, book: {} })],
    ['months not an array', JSON.stringify({ version: 2, book: { months: {} } })],
    ['months null', JSON.stringify({ version: 2, book: { months: null } })],
    ['state key used instead of book', JSON.stringify({ version: 2, state: SCENARIO })],
    ['a month is null', v2([valid, null])],
    ['a month is a string', v2([valid, 'x'])],
    ['a month is an array', v2([valid, []])],
    ['income float in second month', v2([valid, { ...clone(SCENARIO), incomeCents: 1250.5 }])],
    ['income float in first month', v2([{ ...clone(SCENARIO), incomeCents: 1250.5 }, valid])],
    ['negative income', v2([valid, { ...clone(SCENARIO), incomeCents: -1 }])],
    ['bad month key', v2([valid, { ...clone(SCENARIO), month: '2026-13' }])],
    ['month key a date', v2([valid, { ...clone(SCENARIO), month: '2026-11-01' }])],
    ['duplicate months', v2([clone(SCENARIO), clone(SCENARIO)])],
    ['duplicate months with different content', v2([valid, clone(SCENARIO), { ...clone(SCENARIO), incomeCents: 5 }])],
    ['duplicate expense ids within a month', v2([valid, { ...clone(SCENARIO), expenses: [SCENARIO.expenses[0], SCENARIO.expenses[0]] }])],
    ['duplicate category ids within a month', v2([valid, { ...clone(SCENARIO), categories: [SCENARIO.categories[0], SCENARIO.categories[0]] }])],
    ['expense with bad date', v2([valid, { ...clone(SCENARIO), expenses: [{ ...SCENARIO.expenses[0], date: '2026-11-31' }] }])],
    ['expense with zero amount', v2([valid, { ...clone(SCENARIO), expenses: [{ ...SCENARIO.expenses[0], amountCents: 0 }] }])],
    ['category missing name', v2([valid, { ...clone(SCENARIO), categories: [{ id: 'a', plannedCents: 1 }] }])],
    ['categories missing', v2([valid, { month: '2026-11', incomeCents: 0, expenses: [] }])],
  ])('%s is corrupt', (_n, raw) => {
    expect(parseStoredBudget(raw)).toEqual(CORRUPT);
  });

  it('91 categories at MAX_CENTS in one month (cannot be totalled) rejects the whole value', () => {
    const categories = Array.from({ length: 91 }, (_v, i) => ({ id: `c${i}`, name: 'x', plannedCents: MAX_CENTS }));
    expect(parseStoredBudget(v2([valid, { month: '2026-11', incomeCents: 0, categories, expenses: [] }]))).toEqual(CORRUPT);
    expect(parseStoredBudget(v2([{ month: '2026-01', incomeCents: 0, categories, expenses: [] }, valid]))).toEqual(CORRUPT);
  });
  it('90 categories at MAX_CENTS (the largest totalable sum) still loads', () => {
    const categories = Array.from({ length: 90 }, (_v, i) => ({ id: `c${i}`, name: 'x', plannedCents: MAX_CENTS }));
    const result = parseStoredBudget(v2([{ month: '2026-11', incomeCents: 0, categories, expenses: [] }]));
    expect(result.status).toBe('loaded');
  });
  it('expenses that cannot be totalled in one month reject the whole value', () => {
    const expenses = Array.from({ length: 91 }, (_v, i) => ({ id: `x${i}`, categoryId: 'c', amountCents: MAX_CENTS, note: '', date: '2026-11-01' }));
    const bad = { month: '2026-11', incomeCents: 0, categories: [{ id: 'c', name: 'c', plannedCents: 0 }], expenses };
    expect(parseStoredBudget(v2([valid, bad]))).toEqual(CORRUPT);
  });
  it('an empty-string id is rejected', () => {
    expect(parseStoredBudget(v2([{ ...clone(SCENARIO), categories: [{ id: '', name: 'a', plannedCents: 1 }], expenses: [] }]))).toEqual(CORRUPT);
  });
  it('the same category ids in two different months are valid', () => {
    const result = parseStoredBudget(serializeBook(BOOK));
    expect(result.status).toBe('loaded');
    expect(OCTOBER.categories[0]!.id).toBe(SCENARIO.categories[0]!.id);
  });
  it('the same expense id in two different months is valid', () => {
    const a = { ...clone(SCENARIO), month: '2026-09', expenses: [{ ...SCENARIO.expenses[0]!, date: '2026-09-01' }] };
    const result = parseStoredBudget(v2([a, clone(SCENARIO)]));
    expect(result.status).toBe('loaded');
  });
});

describe('versions', () => {
  it.each([3, 0, -1, 99, 1000])('version %i is unsupported-version', (version) => {
    expect(parseStoredBudget(JSON.stringify({ version, book: { months: [] }, state: SCENARIO }))).toEqual(UNSUPPORTED);
  });
  it.each<[string, unknown]>([
    ['string "2"', '2'],
    ['float 2.5', 2.5],
    ['null', null],
    ['true', true],
    ['array', [2]],
  ])('version %s is corrupt', (_n, version) => {
    expect(parseStoredBudget(JSON.stringify({ version, book: { months: [] } }))).toEqual(CORRUPT);
  });
  it('missing version, non-object and unparseable values are corrupt; null is empty', () => {
    expect(parseStoredBudget(JSON.stringify({ book: { months: [] } }))).toEqual(CORRUPT);
    for (const raw of ['', 'nope', '[]', 'null', '5', '"x"', serializeBook(BOOK).slice(0, 30)]) {
      expect(parseStoredBudget(raw)).toEqual(CORRUPT);
    }
    expect(parseStoredBudget(null)).toEqual({ status: 'empty' });
  });
});

describe('unknown fields are dropped', () => {
  it('book.theme, month.note, category.colour (and expense extras)', () => {
    const book = clone(BOOK) as unknown as { theme?: string; months: Record<string, unknown>[] };
    book.theme = 'dark';
    book.months[0]!.note = 'hi';
    (book.months[0]!.categories as Record<string, unknown>[])[0]!.colour = 'red';
    (book.months[1]!.expenses as Record<string, unknown>[])[0]!.tag = 'x';
    const result = parseStoredBudget(JSON.stringify({ version: 2, book, top: 1 }));
    expect(result).toEqual({ status: 'loaded', book: BOOK, fromVersion: 2 });
    if (result.status === 'loaded') {
      expect(result.book).not.toHaveProperty('theme');
      expect(result.book.months[0]).not.toHaveProperty('note');
      expect(result.book.months[0]!.categories[0]).not.toHaveProperty('colour');
      expect(result.book.months[1]!.expenses[0]).not.toHaveProperty('tag');
    }
  });
});

describe('loadBudget / saveBook', () => {
  it('load reads the key, returns empty / loaded / invalid', () => {
    expect(loadBudget(createMemoryStorage())).toEqual({ status: 'empty' });
    expect(loadBudget(createMemoryStorage({ [STORAGE_KEY]: serializeBook(BOOK) }))).toEqual({ status: 'loaded', book: BOOK, fromVersion: 2 });
    expect(loadBudget(createMemoryStorage({ [STORAGE_KEY]: v1(SCENARIO) }))).toEqual({ status: 'loaded', book: { months: [SCENARIO] }, fromVersion: 1 });
    expect(loadBudget(createMemoryStorage({ [STORAGE_KEY]: 'junk' }))).toEqual(CORRUPT);
  });
  it('load never writes, even for v1 data', () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: v1(SCENARIO) });
    loadBudget(storage);
    expect(storage.setItemCalls).toBe(0);
    expect(storage.dump()[STORAGE_KEY]).toBe(v1(SCENARIO));
  });
  it('unavailable for null and throwing storage; never throws', () => {
    expect(loadBudget(null)).toEqual({ status: 'unavailable' });
    expect(loadBudget(createMemoryStorage({}, { throwOnGet: true }))).toEqual({ status: 'unavailable' });
  });
  it('save returns true and writes under the key; false for null or throwing storage', () => {
    const storage = createMemoryStorage();
    expect(saveBook(storage, BOOK)).toBe(true);
    expect(storage.dump()[STORAGE_KEY]).toBe(serializeBook(BOOK));
    expect(saveBook(null, BOOK)).toBe(false);
    expect(saveBook(createMemoryStorage({}, { throwOnSet: true }), BOOK)).toBe(false);
  });
  it('save then load round trips an empty book', () => {
    const storage = createMemoryStorage();
    saveBook(storage, { months: [] });
    expect(loadBudget(storage)).toEqual({ status: 'loaded', book: { months: [] }, fromVersion: 2 });
  });
});
