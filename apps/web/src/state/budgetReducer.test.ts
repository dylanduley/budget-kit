import { describe, expect, it } from 'vitest';

import {
  type BudgetState,
  addCategory,
  addExpense,
  deleteExpense,
  removeCategory,
  setIncome,
  updateCategory,
} from '@/lib/budget';
import { SCENARIO } from '@/test/fixtures';
import { type BudgetAction, budgetReducer } from './budgetReducer';

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function frozenScenario(): BudgetState {
  return deepFreeze(JSON.parse(JSON.stringify(SCENARIO)) as BudgetState);
}

describe('budgetReducer delegates to the task 01 functions', () => {
  const newExpense = { categoryId: 'suggested-groceries', amountCents: 1234, note: ' milk ', date: '2026-11-20' };
  const cases: [string, BudgetAction, (s: BudgetState) => BudgetState][] = [
    ['setIncome', { type: 'setIncome', incomeCents: 500 }, (s) => setIncome(s, 500)],
    ['setIncome 0', { type: 'setIncome', incomeCents: 0 }, (s) => setIncome(s, 0)],
    [
      'addCategory',
      { type: 'addCategory', input: { name: ' Pets ', plannedCents: 2500 }, id: 'c-new' },
      (s) => addCategory(s, { name: ' Pets ', plannedCents: 2500 }, 'c-new'),
    ],
    [
      'updateCategory',
      { type: 'updateCategory', id: 'suggested-rent', patch: { name: 'Home', plannedCents: 1 } },
      (s) => updateCategory(s, 'suggested-rent', { name: 'Home', plannedCents: 1 }),
    ],
    ['removeCategory', { type: 'removeCategory', id: 'suggested-rent' }, (s) => removeCategory(s, 'suggested-rent')],
    ['addExpense', { type: 'addExpense', input: newExpense, id: 'x-1' }, (s) => addExpense(s, newExpense, 'x-1')],
    ['deleteExpense', { type: 'deleteExpense', id: 'e2' }, (s) => deleteExpense(s, 'e2')],
  ];

  it.each(cases)('%s', (_name, action, expected) => {
    const result = budgetReducer(frozenScenario(), action);
    expect(result).toEqual(expected(SCENARIO));
    expect(result).not.toEqual(SCENARIO);
  });

  it('actually changes state (guards against every case being a no-op)', () => {
    expect(budgetReducer(SCENARIO, { type: 'setIncome', incomeCents: 500 }).incomeCents).toBe(500);
    expect(budgetReducer(SCENARIO, { type: 'deleteExpense', id: 'e2' }).expenses.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(budgetReducer(SCENARIO, { type: 'removeCategory', id: 'suggested-rent' }).categories).toHaveLength(4);
  });
});

describe('budgetReducer unknown ids and invalid input', () => {
  it('unknown ids are no-ops that return the same state', () => {
    const state = frozenScenario();
    expect(budgetReducer(state, { type: 'deleteExpense', id: 'nope' })).toBe(state);
    expect(budgetReducer(state, { type: 'removeCategory', id: 'nope' })).toBe(state);
    expect(budgetReducer(state, { type: 'updateCategory', id: 'nope', patch: { name: 'x' } })).toEqual(SCENARIO);
  });

  it.each<[string, BudgetAction]>([
    ['setIncome float', { type: 'setIncome', incomeCents: 1.5 }],
    ['setIncome negative', { type: 'setIncome', incomeCents: -1 }],
    ['setIncome NaN', { type: 'setIncome', incomeCents: NaN }],
    ['addCategory duplicate name', { type: 'addCategory', input: { name: 'rent', plannedCents: 1 }, id: 'z' }],
    ['addCategory duplicate id', { type: 'addCategory', input: { name: 'Pets', plannedCents: 1 }, id: 'suggested-rent' }],
    [
      'addExpense unknown category',
      { type: 'addExpense', input: { categoryId: 'nope', amountCents: 1, note: '', date: '2026-11-01' }, id: 'z' },
    ],
    [
      'addExpense wrong month',
      { type: 'addExpense', input: { categoryId: 'suggested-rent', amountCents: 1, note: '', date: '2026-12-01' }, id: 'z' },
    ],
    [
      'addExpense amount 0',
      { type: 'addExpense', input: { categoryId: 'suggested-rent', amountCents: 0, note: '', date: '2026-11-01' }, id: 'z' },
    ],
    [
      'addExpense duplicate id',
      { type: 'addExpense', input: { categoryId: 'suggested-rent', amountCents: 5, note: '', date: '2026-11-01' }, id: 'e1' },
    ],
  ])('%s throws and leaves the input unchanged', (_name, action) => {
    const state = frozenScenario();
    expect(() => budgetReducer(state, action)).toThrow();
    expect(state).toEqual(SCENARIO);
  });

  it('an unknown action type returns undefined or throws, never a mutated state', () => {
    const state = frozenScenario();
    const bogus = { type: 'explode' } as unknown as BudgetAction;
    let result: unknown;
    try {
      result = budgetReducer(state, bogus);
    } catch {
      result = 'threw';
    }
    // The task does not specify this; pinned: no mutation, and never a half-built state.
    expect(state).toEqual(SCENARIO);
    expect([undefined, 'threw', state]).toContain(result);
  });
});

describe('budgetReducer purity', () => {
  it('does not mutate a deep-frozen input for any action and is repeatable', () => {
    const actions: BudgetAction[] = [
      { type: 'setIncome', incomeCents: 9 },
      { type: 'addCategory', input: { name: 'Pets', plannedCents: 5 }, id: 'p' },
      { type: 'updateCategory', id: 'suggested-rent', patch: { plannedCents: 3 } },
      { type: 'removeCategory', id: 'suggested-groceries' },
      { type: 'addExpense', input: { categoryId: 'suggested-rent', amountCents: 5, note: '', date: '2026-11-02' }, id: 'n' },
      { type: 'deleteExpense', id: 'e1' },
    ];
    const state = frozenScenario();
    for (const action of actions) {
      const first = budgetReducer(state, action);
      const second = budgetReducer(state, action);
      expect(first).toEqual(second);
      expect(first).not.toBe(state);
      expect(state).toEqual(SCENARIO);
    }
  });
});
