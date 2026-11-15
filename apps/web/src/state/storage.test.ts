import { describe, expect, it } from 'vitest';

import { MAX_CENTS, getCategorySummaries, getTotals } from '@/lib/budget';
import type { BudgetState } from '@/lib/budget';
import { SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import {
  STORAGE_KEY,
  canBeTotalled,
  STORAGE_VERSION,
  isBudgetState,
  loadBudget,
  parseStoredBudget,
  saveBudget,
} from './storage';
import type { StorageLike } from './storage';
import { serializeBudget } from './storage';

const CORRUPT = { status: 'invalid', reason: 'corrupt' } as const;
const UNSUPPORTED = { status: 'invalid', reason: 'unsupported-version' } as const;

function clone(): BudgetState {
  return JSON.parse(JSON.stringify(SCENARIO)) as BudgetState;
}

function stored(mutate: (state: Record<string, unknown>) => void): string {
  const state = clone() as unknown as Record<string, unknown>;
  mutate(state);
  return JSON.stringify({ version: 1, state });
}

function manyCategories(n: number, plannedCents: number): string {
  const categories = Array.from({ length: n }, (_v, i) => ({ id: `c${i}`, name: 'x', plannedCents }));
  return JSON.stringify({ version: 1, state: { month: '2026-11', incomeCents: 0, categories, expenses: [] } });
}

function manyExpenses(n: number, amountCents: number): string {
  const expenses = Array.from({ length: n }, (_v, i) => ({
    id: `x${i}`,
    categoryId: 'c0',
    amountCents,
    note: '',
    date: '2026-11-10',
  }));
  const categories = [{ id: 'c0', name: 'x', plannedCents: 0 }];
  return JSON.stringify({ version: 1, state: { month: '2026-11', incomeCents: 0, categories, expenses } });
}

describe('storage constants', () => {
  it('uses the documented key and version', () => {
    expect(STORAGE_KEY).toBe('budget-kit:budget');
    expect(STORAGE_VERSION).toBe(1);
  });
});

describe('serializeBudget / parseStoredBudget', () => {
  it('serializes to JSON of { version: 1, state }', () => {
    expect(JSON.parse(serializeBudget(SCENARIO))).toEqual({ version: 1, state: SCENARIO });
  });

  it('round trips SCENARIO to an equal, fresh copy', () => {
    const result = parseStoredBudget(serializeBudget(SCENARIO));
    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.state).toEqual(SCENARIO);
    expect(result.state).not.toBe(SCENARIO);
    expect(result.state.categories).not.toBe(SCENARIO.categories);
    expect(result.state.categories[0]).not.toBe(SCENARIO.categories[0]);
    expect(result.state.expenses[0]).not.toBe(SCENARIO.expenses[0]);
  });

  it('round trips an empty budget and extreme amounts', () => {
    const edge: BudgetState = {
      month: '2024-02',
      incomeCents: MAX_CENTS,
      categories: [{ id: 'a', name: '', plannedCents: 0 }, { id: 'b', name: 'Big', plannedCents: MAX_CENTS }],
      expenses: [{ id: 'x', categoryId: 'gone', amountCents: 1, note: '', date: '2024-02-29' }],
    };
    expect(parseStoredBudget(serializeBudget(edge))).toEqual({ status: 'loaded', state: edge });
    const empty: BudgetState = { month: '2026-01', incomeCents: 0, categories: [], expenses: [] };
    expect(parseStoredBudget(serializeBudget(empty))).toEqual({ status: 'loaded', state: empty });
  });

  it('returns empty for null', () => {
    expect(parseStoredBudget(null)).toEqual({ status: 'empty' });
  });

  it('keeps empty, corrupt and unsupported-version as three distinct results', () => {
    const results = [
      parseStoredBudget(null),
      parseStoredBudget('not json'),
      parseStoredBudget('{"version":2,"state":{}}'),
    ];
    expect(results).toEqual([{ status: 'empty' }, CORRUPT, UNSUPPORTED]);
  });

  it.each([
    ['empty string', ''],
    ['not json', 'not json'],
    ['null', 'null'],
    ['array', '[]'],
    ['empty object', '{}'],
    ['number', '5'],
    ['string', '"abc"'],
    ['string version', JSON.stringify({ version: '1', state: SCENARIO })],
    ['float version', JSON.stringify({ version: 1.5, state: SCENARIO })],
    ['null version', JSON.stringify({ version: null, state: SCENARIO })],
    ['missing version', JSON.stringify({ state: SCENARIO })],
    ['missing state', '{"version":1}'],
    ['null state', '{"version":1,"state":null}'],
    ['array state', '{"version":1,"state":[]}'],
    ['truncated JSON', serializeBudget(SCENARIO).slice(0, 40)],
  ])('is corrupt for %s', (_name, raw) => {
    expect(parseStoredBudget(raw)).toEqual(CORRUPT);
  });

  it.each([2, 0, -1, 99])('is unsupported-version for version %i', (version) => {
    expect(parseStoredBudget(JSON.stringify({ version, state: SCENARIO }))).toEqual(UNSUPPORTED);
  });

  it('checks the version before the state (unsupported version with a garbage state)', () => {
    expect(parseStoredBudget('{"version":2,"state":"whatever"}')).toEqual(UNSUPPORTED);
  });
});

describe('invalid version 1 states are rejected as corrupt', () => {
  const cases: [string, (s: Record<string, unknown>) => void][] = [
    ['incomeCents float 1250.5', (s) => (s.incomeCents = 1250.5)],
    ['incomeCents string "1250"', (s) => (s.incomeCents = '1250')],
    ['incomeCents -1', (s) => (s.incomeCents = -1)],
    ['incomeCents null', (s) => (s.incomeCents = null)],
    ['incomeCents above MAX_CENTS', (s) => (s.incomeCents = MAX_CENTS + 1)],
    ['incomeCents unsafe integer', (s) => (s.incomeCents = 2 ** 60)],
    ['incomeCents missing', (s) => delete s.incomeCents],
    ['month 2026-13', (s) => (s.month = '2026-13')],
    ['month 2026-00', (s) => (s.month = '2026-00')],
    ['month a date', (s) => (s.month = '2026-11-01')],
    ['month a number', (s) => (s.month = 202611)],
    ['month missing', (s) => delete s.month],
    ['categories not an array', (s) => (s.categories = {})],
    ['categories null', (s) => (s.categories = null)],
    ['categories missing', (s) => delete s.categories],
    ['expenses missing', (s) => delete s.expenses],
    ['expenses not an array', (s) => (s.expenses = 'none')],
    ['category plannedCents null', (s) => ((s.categories as Record<string, unknown>[])[0]!.plannedCents = null)],
    ['category plannedCents float', (s) => ((s.categories as Record<string, unknown>[])[0]!.plannedCents = 0.5)],
    ['category plannedCents negative', (s) => ((s.categories as Record<string, unknown>[])[0]!.plannedCents = -5)],
    [
      'category plannedCents above MAX_CENTS',
      (s) => ((s.categories as Record<string, unknown>[])[0]!.plannedCents = MAX_CENTS + 1),
    ],
    ['category id empty', (s) => ((s.categories as Record<string, unknown>[])[0]!.id = '')],
    ['category id number', (s) => ((s.categories as Record<string, unknown>[])[0]!.id = 7)],
    ['category name number', (s) => ((s.categories as Record<string, unknown>[])[0]!.name = 7)],
    ['category null entry', (s) => ((s.categories as unknown[])[1] = null)],
    ['category array entry', (s) => ((s.categories as unknown[])[1] = [])],
    ['duplicate category ids', (s) => ((s.categories as Record<string, unknown>[])[1]!.id = 'suggested-rent')],
    ['expense amountCents 0', (s) => ((s.expenses as Record<string, unknown>[])[0]!.amountCents = 0)],
    ['expense amountCents negative', (s) => ((s.expenses as Record<string, unknown>[])[0]!.amountCents = -100)],
    ['expense amountCents float', (s) => ((s.expenses as Record<string, unknown>[])[0]!.amountCents = 82.47)],
    ['expense amountCents string', (s) => ((s.expenses as Record<string, unknown>[])[0]!.amountCents = '8247')],
    [
      'expense amountCents above MAX_CENTS',
      (s) => ((s.expenses as Record<string, unknown>[])[0]!.amountCents = MAX_CENTS + 1),
    ],
    ['expense date 2026-11-31', (s) => ((s.expenses as Record<string, unknown>[])[0]!.date = '2026-11-31')],
    ['expense date 2026-02-30', (s) => ((s.expenses as Record<string, unknown>[])[0]!.date = '2026-02-30')],
    ['expense date 2026-02-29 (not a leap year)', (s) => ((s.expenses as Record<string, unknown>[])[0]!.date = '2026-02-29')],
    ['expense date month 13', (s) => ((s.expenses as Record<string, unknown>[])[0]!.date = '2026-13-01')],
    ['expense date day 00', (s) => ((s.expenses as Record<string, unknown>[])[0]!.date = '2026-11-00')],
    ['expense date a month only', (s) => ((s.expenses as Record<string, unknown>[])[0]!.date = '2026-11')],
    ['expense date null', (s) => ((s.expenses as Record<string, unknown>[])[0]!.date = null)],
    ['expense id empty', (s) => ((s.expenses as Record<string, unknown>[])[0]!.id = '')],
    ['expense categoryId number', (s) => ((s.expenses as Record<string, unknown>[])[0]!.categoryId = 3)],
    ['expense note null', (s) => ((s.expenses as Record<string, unknown>[])[0]!.note = null)],
    ['expense note missing', (s) => delete (s.expenses as Record<string, unknown>[])[0]!.note],
    ['duplicate expense ids', (s) => ((s.expenses as Record<string, unknown>[])[1]!.id = 'e1')],
  ];

  it.each(cases)('%s', (_name, mutate) => {
    const raw = stored(mutate);
    expect(parseStoredBudget(raw)).toEqual(CORRUPT);
    expect(isBudgetState(JSON.parse(raw).state)).toBe(false);
  });

  it('rejects Infinity from crafted JSON (1e999) and never accepts NaN', () => {
    const raw = serializeBudget(SCENARIO).replace('"incomeCents":320000', '"incomeCents":1e999');
    expect(raw).toContain('1e999');
    expect(parseStoredBudget(raw)).toEqual(CORRUPT);
    expect(parseStoredBudget(raw.replace('1e999', '-1e999'))).toEqual(CORRUPT);
    expect(isBudgetState({ ...SCENARIO, incomeCents: NaN })).toBe(false);
    expect(isBudgetState({ ...SCENARIO, incomeCents: Infinity })).toBe(false);
    expect(isBudgetState({ ...SCENARIO, incomeCents: -Infinity })).toBe(false);
    const planned = serializeBudget(SCENARIO).replace('"plannedCents":150000', '"plannedCents":1e999');
    expect(parseStoredBudget(planned)).toEqual(CORRUPT);
  });

  it('accepts amounts exactly at the boundaries', () => {
    const atMax = parseStoredBudget(
      stored((s) => {
        s.incomeCents = MAX_CENTS;
        (s.categories as Record<string, unknown>[])[0]!.plannedCents = MAX_CENTS;
        (s.expenses as Record<string, unknown>[])[0]!.amountCents = MAX_CENTS;
      }),
    );
    expect(atMax.status).toBe('loaded');
    const atMin = parseStoredBudget(
      stored((s) => {
        s.incomeCents = 0;
        (s.categories as Record<string, unknown>[])[0]!.plannedCents = 0;
        (s.expenses as Record<string, unknown>[])[0]!.amountCents = 1;
      }),
    );
    expect(atMin.status).toBe('loaded');
  });

  it('accepts a leap day', () => {
    const result = parseStoredBudget(
      stored((s) => ((s.expenses as Record<string, unknown>[])[0]!.date = '2028-02-29')),
    );
    expect(result.status).toBe('loaded');
  });
});

describe('isBudgetState', () => {
  it('accepts SCENARIO and rejects non-objects', () => {
    expect(isBudgetState(SCENARIO)).toBe(true);
    for (const value of [null, undefined, 0, '', 'x', [], [SCENARIO], true, () => SCENARIO]) {
      expect(isBudgetState(value)).toBe(false);
    }
  });
});

describe('totals safety', () => {
  it('rejects 91 categories at 99999999999999 (planned total unsafe) as corrupt', () => {
    expect(parseStoredBudget(manyCategories(91, 99999999999999))).toEqual(CORRUPT);
  });

  it('rejects 91 expenses of MAX_CENTS in the month as corrupt', () => {
    expect(parseStoredBudget(manyExpenses(91, MAX_CENTS))).toEqual(CORRUPT);
  });

  it('still loads 90 categories and 90 expenses at MAX_CENTS (the total is safe)', () => {
    expect(90 * MAX_CENTS).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    const cats = parseStoredBudget(manyCategories(90, MAX_CENTS));
    expect(cats.status).toBe('loaded');
    const exps = parseStoredBudget(manyExpenses(90, MAX_CENTS));
    expect(exps.status).toBe('loaded');
  });

  it('is decided by the sum, not the count: 91 small categories load', () => {
    expect(parseStoredBudget(manyCategories(91, 1)).status).toBe('loaded');
  });

  it('loadBudget reports it as invalid/corrupt and writes nothing, leaving the string untouched', () => {
    const raw = manyCategories(91, 99999999999999);
    const storage = createMemoryStorage({ [STORAGE_KEY]: raw });
    expect(loadBudget(storage)).toEqual(CORRUPT);
    expect(storage.setItemCalls).toBe(0);
    expect(storage.dump()[STORAGE_KEY]).toBe(raw);
  });

  it('canBeTotalled is true for ordinary and boundary states', () => {
    expect(canBeTotalled(SCENARIO)).toBe(true);
    expect(canBeTotalled({ month: '2026-11', incomeCents: 0, categories: [], expenses: [] })).toBe(true);
    const big = JSON.parse(manyCategories(90, MAX_CENTS)) as { state: BudgetState };
    expect(canBeTotalled(big.state)).toBe(true);
  });

  it('canBeTotalled is false when planned or spent sums overflow, and never throws', () => {
    const planned = (JSON.parse(manyCategories(91, MAX_CENTS)) as { state: BudgetState }).state;
    const spent = (JSON.parse(manyExpenses(91, MAX_CENTS)) as { state: BudgetState }).state;
    expect(canBeTotalled(planned)).toBe(false);
    expect(canBeTotalled(spent)).toBe(false);
    expect(() => canBeTotalled(null as unknown as BudgetState)).not.toThrow();
    expect(canBeTotalled(null as unknown as BudgetState)).toBe(false);
  });

  it('expenses outside the month do not count towards the total', () => {
    const state = (JSON.parse(manyExpenses(91, MAX_CENTS)) as { state: BudgetState }).state;
    const elsewhere = { ...state, expenses: state.expenses.map((e) => ({ ...e, date: '2026-10-10' })) };
    expect(canBeTotalled(elsewhere)).toBe(true);
  });
});

describe('unknown keys and removed categories', () => {
  it('drops unknown keys anywhere in the state', () => {
    const raw = stored((s) => {
      s.theme = 'dark';
      (s.categories as Record<string, unknown>[])[0]!.colour = 'red';
      (s.expenses as Record<string, unknown>[])[0]!.tags = ['x'];
    });
    const result = parseStoredBudget(raw);
    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.state).toEqual(SCENARIO);
    expect(Object.keys(result.state).sort()).toEqual(['categories', 'expenses', 'incomeCents', 'month']);
    expect(Object.keys(result.state.categories[0]!).sort()).toEqual(['id', 'name', 'plannedCents']);
    expect(Object.keys(result.state.expenses[0]!).sort()).toEqual(['amountCents', 'categoryId', 'date', 'id', 'note']);
  });

  it('ignores unknown keys next to version', () => {
    const raw = JSON.stringify({ version: 1, extra: true, state: SCENARIO });
    expect(parseStoredBudget(raw)).toEqual({ status: 'loaded', state: SCENARIO });
  });

  it('loads an expense whose categoryId matches no category', () => {
    const raw = stored((s) => ((s.expenses as Record<string, unknown>[])[0]!.categoryId = 'removed-long-ago'));
    const result = parseStoredBudget(raw);
    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.state.expenses[0]!.categoryId).toBe('removed-long-ago');
  });

  it('allows an expense to share an id with a category (uniqueness is per list)', () => {
    const raw = stored((s) => ((s.expenses as Record<string, unknown>[])[0]!.id = 'suggested-rent'));
    expect(parseStoredBudget(raw).status).toBe('loaded');
  });

  it('does not let a __proto__ key pollute the loaded state', () => {
    const raw = '{"version":1,"state":' + JSON.stringify(SCENARIO).replace('{"month"', '{"__proto__":{"polluted":1},"month"') + '}';
    const result = parseStoredBudget(raw);
    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(Object.keys(result.state)).not.toContain('__proto__');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('loadBudget / saveBudget', () => {
  it('loads what saveBudget saved', () => {
    const storage = createMemoryStorage();
    expect(loadBudget(storage)).toEqual({ status: 'empty' });
    expect(saveBudget(storage, SCENARIO)).toBe(true);
    expect(storage.dump()[STORAGE_KEY]).toBe(serializeBudget(SCENARIO));
    expect(loadBudget(storage)).toEqual({ status: 'loaded', state: SCENARIO });
  });

  it('reports corrupt and unsupported-version through loadBudget as separate results', () => {
    expect(loadBudget(createMemoryStorage({ [STORAGE_KEY]: 'garbage' }))).toEqual(CORRUPT);
    expect(loadBudget(createMemoryStorage({ [STORAGE_KEY]: '{"version":2,"state":{}}' }))).toEqual(UNSUPPORTED);
  });

  it('reads only STORAGE_KEY', () => {
    const storage = createMemoryStorage({ other: serializeBudget(SCENARIO) });
    expect(loadBudget(storage)).toEqual({ status: 'empty' });
  });

  it('loadBudget never writes', () => {
    for (const raw of [undefined, 'garbage', '{"version":2}', serializeBudget(SCENARIO)]) {
      const storage = createMemoryStorage(raw === undefined ? {} : { [STORAGE_KEY]: raw });
      loadBudget(storage);
      expect(storage.setItemCalls).toBe(0);
      expect(storage.dump()[STORAGE_KEY]).toBe(raw);
    }
  });

  it('loadBudget returns unavailable (no throw) when getItem throws', () => {
    const storage = createMemoryStorage({}, { throwOnGet: true });
    expect(() => loadBudget(storage)).not.toThrow();
    expect(loadBudget(storage)).toEqual({ status: 'unavailable' });
  });

  it('saveBudget returns false (no throw) when setItem throws', () => {
    const storage = createMemoryStorage({}, { throwOnSet: true });
    expect(() => saveBudget(storage, SCENARIO)).not.toThrow();
    expect(saveBudget(storage, SCENARIO)).toBe(false);
    expect(storage.dump()).toEqual({});
  });

  it('returns the same for null storage', () => {
    expect(loadBudget(null)).toEqual({ status: 'unavailable' });
    expect(saveBudget(null, SCENARIO)).toBe(false);
  });

  it('does not throw for undefined storage (private mode, no localStorage)', () => {
    const missing = undefined as unknown as StorageLike;
    expect(() => loadBudget(missing)).not.toThrow();
    expect(() => saveBudget(missing, SCENARIO)).not.toThrow();
    expect(loadBudget(missing)).toEqual({ status: 'unavailable' });
    expect(saveBudget(missing, SCENARIO)).toBe(false);
  });

  it('survives any exception type, including non-Error values', () => {
    const throwing: StorageLike = {
      getItem() {
        throw 'a string';
      },
      setItem() {
        throw { quota: true };
      },
      removeItem() {},
    };
    expect(loadBudget(throwing)).toEqual({ status: 'unavailable' });
    expect(saveBudget(throwing, SCENARIO)).toBe(false);
  });

  it('treats a getItem that returns a non-string as no crash', () => {
    const odd = { getItem: () => 42, setItem() {}, removeItem() {} } as unknown as StorageLike;
    expect(() => loadBudget(odd)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Fuzz
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const int = (rng: Rng, n: number): number => Math.floor(rng() * n);
const pick = <T,>(rng: Rng, items: readonly T[]): T => items[int(rng, items.length)] as T;

const JUNK: readonly unknown[] = [
  null, undefined, true, false, 0, -0, 1, -1, 0.5, 1250.5, '1250', '', 'x', '2026-02-30', '2026-13', '2026-11-31',
  [], {}, [1, 2], { a: 1 }, MAX_CENTS, MAX_CENTS + 1, 2 ** 53, 2 ** 53 + 2, -(2 ** 31), 1e21, 1e-7, 'null', '__proto__',
];

function randomJson(rng: Rng, depth = 0): unknown {
  const kind = int(rng, depth > 2 ? 5 : 7);
  switch (kind) {
    case 0: return null;
    case 1: return int(rng, 2) === 0;
    case 2: return (rng() - 0.5) * 10 ** int(rng, 16);
    case 3: return Math.floor((rng() - 0.3) * 10 ** int(rng, 16));
    case 4: return pick(rng, ['', 'x', '2026-11', '2026-11-14', 'id-1', '__proto__', '\u0000']);
    case 5: return Array.from({ length: int(rng, 4) }, () => randomJson(rng, depth + 1));
    default: {
      const o: Record<string, unknown> = {};
      for (const key of ['version', 'state', 'month', 'incomeCents', 'categories', 'expenses', 'id', 'x']) {
        if (int(rng, 3) === 0) o[key] = randomJson(rng, depth + 1);
      }
      return o;
    }
  }
}

function collectPaths(value: unknown, path: (string | number)[], out: (string | number)[][]): void {
  out.push(path);
  if (Array.isArray(value)) value.forEach((item, i) => collectPaths(item, [...path, i], out));
  else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) collectPaths(item, [...path, key], out);
  }
}

function getAt(root: unknown, path: (string | number)[]): unknown {
  let node = root;
  for (const key of path) node = (node as Record<string | number, unknown>)[key];
  return node;
}

function deepCopy(value: unknown): unknown {
  return value === undefined ? null : (JSON.parse(JSON.stringify(value)) as unknown);
}

function mutateOnce(root: unknown, rng: Rng): unknown {
  const paths: (string | number)[][] = [];
  collectPaths(root, [], paths);
  const path = pick(rng, paths);
  if (path.length === 0) return pick(rng, JUNK);
  const parent = getAt(root, path.slice(0, -1)) as Record<string | number, unknown> | unknown[];
  const key = path[path.length - 1] as string | number;
  const action = int(rng, 6);
  if (action === 0) {
    if (Array.isArray(parent)) parent.splice(Number(key), 1);
    else delete (parent as Record<string, unknown>)[key as string];
  } else if (action === 1) {
    (parent as Record<string | number, unknown>)[key] = pick(rng, JUNK);
  } else if (action === 2) {
    (parent as Record<string | number, unknown>)[key] = randomJson(rng);
  } else if (action === 3) {
    // duplicate: copy a sibling's value (including ids) over this one
    const siblings = Array.isArray(parent) ? parent : Object.values(parent);
    if (siblings.length > 0) {
      (parent as Record<string | number, unknown>)[key] = deepCopy(pick(rng, siblings));
    }
  } else if (action === 4) {
    const value = (parent as Record<string | number, unknown>)[key];
    if (typeof value === 'number') (parent as Record<string | number, unknown>)[key] = value + pick(rng, [0.5, -1, 1, -value - 1]);
    else if (typeof value === 'string') (parent as Record<string | number, unknown>)[key] = value.slice(0, int(rng, value.length + 1));
    else if (Array.isArray(parent)) parent.push(deepCopy(value));
  } else {
    (parent as Record<string | number, unknown>)[`extra${int(rng, 3)}`] = pick(rng, JUNK);
  }
  return root;
}

function fuzzInput(rng: Rng): string {
  const mode = int(rng, 10);
  if (mode === 0) return JSON.stringify(randomJson(rng));
  const base = JSON.parse(serializeBudget(SCENARIO)) as { state: BudgetState };
  if (mode === 3 || mode === 4) {
    // Overflow-bearing: many extra amounts at or near MAX_CENTS, so totals sit around the safe limit.
    const extra = 80 + int(rng, 20);
    const amount = pick(rng, [MAX_CENTS, MAX_CENTS - 1, 99999999999999, 10 ** 13]);
    for (let i = 0; i < extra; i++) {
      if (mode === 3) base.state.categories.push({ id: `o${i}`, name: 'o', plannedCents: amount });
      else base.state.expenses.push({ id: `o${i}`, categoryId: 'suggested-rent', amountCents: amount, note: '', date: '2026-11-15' });
    }
  }
  let value: unknown = base;
  const rounds = 1 + int(rng, 4);
  for (let i = 0; i < rounds; i++) value = mutateOnce(value, rng);
  let raw = JSON.stringify(value) ?? 'undefined';
  if (mode === 1) raw = raw.slice(0, int(rng, raw.length + 1));
  else if (mode === 2 && raw.length > 0) {
    const at = int(rng, raw.length);
    raw = raw.slice(0, at) + pick(rng, ['', '{', '}', '"', ',', '1e999', '-0', 'NaN', 'null', '\\']) + raw.slice(at + 1);
  }
  return raw;
}

describe('fuzz', () => {
  const SEEDS = [1, 20260514, 0xc0ffee];
  const PER_SEED = 4000;

  it.each(SEEDS)(`loadBudget never throws; ok results satisfy isBudgetState and survive getTotals (seed %i, ${PER_SEED} inputs)`, (seed) => {
    const rng = mulberry32(seed);
    const counts = { loaded: 0, corrupt: 0, unsupported: 0, empty: 0, overflowRejected: 0, overflowLoaded: 0 };
    for (let i = 0; i < PER_SEED; i++) {
      const raw = fuzzInput(rng);
      let result;
      try {
        result = loadBudget(createMemoryStorage({ [STORAGE_KEY]: raw }));
        const direct = parseStoredBudget(raw);
        expect(direct).toEqual(result);
      } catch (error) {
        throw new Error(`loadBudget threw for input ${raw} (seed ${seed}, #${i}): ${String(error)}`);
      }
      if (result.status === 'loaded' && result.state.categories.length + result.state.expenses.length > 60) counts.overflowLoaded++;
      if (result.status === 'invalid' && raw.includes('"o79"')) counts.overflowRejected++;
      if (result.status === 'loaded') {
        counts.loaded++;
        try {
          expect(isBudgetState(result.state)).toBe(true);
          expect(canBeTotalled(result.state)).toBe(true);
          expect(Object.keys(result.state).sort()).toEqual(['categories', 'expenses', 'incomeCents', 'month']);
          const totals = getTotals(result.state);
          for (const n of Object.values(totals)) {
            if (typeof n === 'number') expect(Number.isSafeInteger(n)).toBe(true);
          }
          for (const summary of getCategorySummaries(result.state)) {
            expect(Number.isSafeInteger(summary.spentCents)).toBe(true);
            expect(Number.isSafeInteger(summary.remainingCents)).toBe(true);
          }
          // the loaded state serializes and loads again to itself
          expect(parseStoredBudget(serializeBudget(result.state))).toEqual({ status: 'loaded', state: result.state });
        } catch (error) {
          throw new Error(`Loaded state misbehaved for input ${raw} (seed ${seed}, #${i}): ${String(error)}`);
        }
      } else if (result.status === 'invalid') {
        if (result.reason === 'corrupt') counts.corrupt++;
        else counts.unsupported++;
      } else if (result.status === 'empty') counts.empty++;
      else throw new Error(`parse/load returned ${result.status} for ${raw}`);
    }
    // The generator must actually exercise every outcome, otherwise the fuzz proves nothing.
    expect(counts.loaded).toBeGreaterThan(50);
    expect(counts.corrupt).toBeGreaterThan(500);
    expect(counts.unsupported).toBeGreaterThan(5);
    expect(counts.overflowRejected).toBeGreaterThan(20);
    expect(counts.overflowLoaded).toBeGreaterThan(20);
  });

  it('is deterministic for a given seed', () => {
    const a = Array.from({ length: 50 }, (() => { const r = mulberry32(7); return () => fuzzInput(r); })());
    const b = Array.from({ length: 50 }, (() => { const r = mulberry32(7); return () => fuzzInput(r); })());
    expect(a).toEqual(b);
  });
});
