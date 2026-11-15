import { describe, expect, it } from 'vitest';

import { type BudgetState, MAX_CENTS } from '@/lib/budget';
import { SCENARIO } from '@/test/fixtures';

import { type ExpenseFormValues, NOTE_MAX_LENGTH, validateExpenseForm } from './expenseForm';

const VALID: ExpenseFormValues = {
  amountCents: 8247,
  categoryId: 'suggested-groceries',
  note: '  weekly shop ',
  date: '2026-11-03',
};

function errorsOf(values: ExpenseFormValues, state: BudgetState = SCENARIO): Record<string, string | undefined> {
  const result = validateExpenseForm(values, state);
  if (result.ok) throw new Error('expected validation errors');
  return result.errors;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('validateExpenseForm: success', () => {
  it('valid input returns the expense with a trimmed note', () => {
    expect(validateExpenseForm(VALID, SCENARIO)).toEqual({
      ok: true,
      expense: { categoryId: 'suggested-groceries', amountCents: 8247, note: 'weekly shop', date: '2026-11-03' },
    });
  });

  it('accepts the minimum amount of 1 cent', () => {
    const result = validateExpenseForm({ ...VALID, amountCents: 1 }, SCENARIO);
    expect(result.ok && result.expense.amountCents).toBe(1);
  });

  it('accepts MAX_CENTS and keeps it as an exact integer', () => {
    const result = validateExpenseForm({ ...VALID, amountCents: MAX_CENTS }, SCENARIO);
    expect(result.ok && result.expense.amountCents).toBe(MAX_CENTS);
  });

  it('an empty note is valid and stays empty', () => {
    const result = validateExpenseForm({ ...VALID, note: '' }, SCENARIO);
    expect(result.ok && result.expense.note).toBe('');
  });

  it('a whitespace-only note is valid and becomes empty', () => {
    const result = validateExpenseForm({ ...VALID, note: '   \t ' }, SCENARIO);
    expect(result.ok && result.expense.note).toBe('');
  });

  it('passes the date through unchanged', () => {
    const result = validateExpenseForm({ ...VALID, date: '2026-11-30' }, SCENARIO);
    expect(result.ok && result.expense.date).toBe('2026-11-30');
  });
});

describe('validateExpenseForm: amount', () => {
  it('null gives "Enter an amount like 12.50" and no other error', () => {
    expect(errorsOf({ ...VALID, amountCents: null })).toEqual({ amount: 'Enter an amount like 12.50' });
  });

  it('0 gives "Enter an amount more than 0.00" and no other error', () => {
    expect(errorsOf({ ...VALID, amountCents: 0 })).toEqual({ amount: 'Enter an amount more than 0.00' });
  });
});

describe('validateExpenseForm: category', () => {
  it('empty category gives "Choose a category" and no other error', () => {
    expect(errorsOf({ ...VALID, categoryId: '' })).toEqual({ category: 'Choose a category' });
  });

  it('a category id that is not in the state (suggested-pets) gives "Choose a category"', () => {
    expect(errorsOf({ ...VALID, categoryId: 'suggested-pets' })).toEqual({ category: 'Choose a category' });
  });

  it('a removed category is rejected', () => {
    const state: BudgetState = { ...SCENARIO, categories: SCENARIO.categories.filter((c) => c.id !== 'suggested-groceries') };
    expect(errorsOf(VALID, state)).toEqual({ category: 'Choose a category' });
  });

  it('every current category is accepted', () => {
    for (const category of SCENARIO.categories) {
      expect(validateExpenseForm({ ...VALID, categoryId: category.id }, SCENARIO).ok).toBe(true);
    }
  });

  it('with no categories at all any id is rejected', () => {
    expect(errorsOf(VALID, { ...SCENARIO, categories: [] })).toEqual({ category: 'Choose a category' });
  });
});

describe('validateExpenseForm: note', () => {
  it('NOTE_MAX_LENGTH is 100', () => {
    expect(NOTE_MAX_LENGTH).toBe(100);
  });

  it('a 100-character note passes', () => {
    const result = validateExpenseForm({ ...VALID, note: 'a'.repeat(100) }, SCENARIO);
    expect(result.ok && result.expense.note).toBe('a'.repeat(100));
  });

  it('a 101-character note fails with the exact message', () => {
    expect(errorsOf({ ...VALID, note: 'a'.repeat(101) })).toEqual({
      note: 'Keep the note to 100 characters or fewer',
    });
  });

  it('the note is trimmed before the limit: 100 characters plus padding passes', () => {
    const result = validateExpenseForm({ ...VALID, note: `  ${'a'.repeat(100)}  ` }, SCENARIO);
    expect(result.ok && result.expense.note).toBe('a'.repeat(100));
  });

  it('the note is trimmed before the limit: 101 characters plus padding still fails', () => {
    expect(errorsOf({ ...VALID, note: ` ${'a'.repeat(101)} ` }).note).toBe('Keep the note to 100 characters or fewer');
  });

  it('inner whitespace is kept', () => {
    const result = validateExpenseForm({ ...VALID, note: ' a  b ' }, SCENARIO);
    expect(result.ok && result.expense.note).toBe('a  b');
  });
});

describe('validateExpenseForm: all fields and the date', () => {
  it('amount, category and note all invalid give exactly those three errors', () => {
    expect(
      errorsOf({ amountCents: null, categoryId: '', note: 'a'.repeat(101), date: '2026-11-03' }),
    ).toEqual({
      amount: 'Enter an amount like 12.50',
      category: 'Choose a category',
      note: 'Keep the note to 100 characters or fewer',
    });
  });

  it('0 amount, unknown category and long note give the three errors with the zero message', () => {
    expect(
      errorsOf({ amountCents: 0, categoryId: 'suggested-pets', note: 'b'.repeat(150), date: '2026-11-03' }),
    ).toEqual({
      amount: 'Enter an amount more than 0.00',
      category: 'Choose a category',
      note: 'Keep the note to 100 characters or fewer',
    });
  });

  it.each(['', 'not-a-date', '2025-01-01', '2026-11-31', '2026-12-01'])(
    'the errors never have a date key (date %j)',
    (date) => {
      const errors = errorsOf({ amountCents: null, categoryId: '', note: 'a'.repeat(101), date });
      expect(Object.keys(errors)).not.toContain('date');
      expect(Object.keys(errors).sort()).toEqual(['amount', 'category', 'note']);
    },
  );

  it('only the invalid fields appear as keys', () => {
    expect(Object.keys(errorsOf({ ...VALID, amountCents: 0 }))).toEqual(['amount']);
  });
});

describe('validateExpenseForm: purity', () => {
  it('does not mutate values or state (deep-frozen inputs)', () => {
    const state = deepFreeze(structuredClone(SCENARIO));
    const values = deepFreeze({ ...VALID });
    expect(validateExpenseForm(values, state).ok).toBe(true);
    expect(validateExpenseForm(deepFreeze({ ...VALID, amountCents: null, categoryId: '' }), state).ok).toBe(false);
    expect(state).toEqual(SCENARIO);
    expect(values).toEqual(VALID);
  });

  it('returns the same result for the same input', () => {
    expect(validateExpenseForm(VALID, SCENARIO)).toEqual(validateExpenseForm(VALID, SCENARIO));
  });
});
