import { Button } from '@budget-kit/ui';
import { screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { MAX_CENTS, type BudgetState } from '@/lib/budget';
import { type BudgetActions, TOTAL_TOO_LARGE_MESSAGE, useBudget } from '@/state/BudgetProvider';
import { expectNoAxeViolations } from '@/test/axe';
import { SCENARIO } from '@/test/fixtures';
import { renderWithBudget } from '@/test/renderWithBudget';
import { renderWithFakeBudget } from '@/test/renderWithFakeBudget';
import { PlanPage } from '@/features/plan/PlanPage';
import { MonthSetup } from './MonthSetup';

const GENERIC = 'Something went wrong. Your budget was not changed.';
const NAMES = ['Rent', 'Groceries', 'Transport', 'Utilities', 'Eating out'];
// A first-run state with five unplanned categories (the app itself now starts with none).
const FIVE: BudgetState = {
  month: '2026-11',
  incomeCents: 0,
  categories: NAMES.map((name) => ({ id: `suggested-${name.toLowerCase().replace(' ', '-')}`, name, plannedCents: 0 })),
  expenses: [],
};

const tooLarge = (): never => {
  throw new RangeError(TOTAL_TOO_LARGE_MESSAGE);
};
const boom = (): never => {
  throw new Error('boom');
};
const otherRange = (): never => {
  throw new RangeError('Something else entirely');
};
function allThrow(fn: () => never): Partial<BudgetActions> {
  return { setIncome: fn, addCategory: fn, updateCategory: fn, removeCategory: fn };
}
function failOnce(error: Error): () => void {
  let used = false;
  return () => {
    if (!used) {
      used = true;
      throw error;
    }
  };
}
function failOnceId(error: Error): () => string {
  let used = false;
  return () => {
    if (!used) {
      used = true;
      throw error;
    }
    return 'fake-id';
  };
}

const nameField = (n: number): HTMLInputElement =>
  screen.getByRole('textbox', { name: `Category ${n} name` }) as HTMLInputElement;
const plannedField = (n: number): HTMLInputElement =>
  screen.getByRole('textbox', { name: `Category ${n} planned (USD)` }) as HTMLInputElement;
const incomeField = (): HTMLInputElement =>
  screen.getByRole('textbox', { name: 'Monthly income (USD)' }) as HTMLInputElement;
const newName = (): HTMLInputElement => screen.getByRole('textbox', { name: 'New category name' }) as HTMLInputElement;
const newPlanned = (): HTMLInputElement =>
  screen.getByRole('textbox', { name: 'New category planned (USD)' }) as HTMLInputElement;
const addButton = (): HTMLElement => screen.getByRole('button', { name: 'Add category' });

function errorOf(input: HTMLElement): HTMLElement | null {
  return document.getElementById(`${input.id}-error`);
}
function errorText(input: HTMLElement): string | null {
  return errorOf(input)?.textContent ?? null;
}
function actionErrors(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-part="action-error"]'));
}
function stored(result: { readStored(): BudgetState | null }): BudgetState {
  const state = result.readStored();
  if (state === null) throw new Error('nothing stored');
  return state;
}
function expectStoredNamesValid(state: BudgetState): void {
  const keys = state.categories.map((c) => c.name.trim().toLowerCase());
  for (const key of keys) expect(key).not.toBe('');
  expect(new Set(keys).size).toBe(keys.length);
}

const EMPTY_STATE: BudgetState = { month: '2026-11', incomeCents: 0, categories: [], expenses: [] };
const ONE_CATEGORY: BudgetState = {
  month: '2026-11',
  incomeCents: 0,
  categories: [{ id: 'only', name: 'Only', plannedCents: 100 }],
  expenses: [],
};
function bigState(): BudgetState {
  return {
    month: '2026-11',
    incomeCents: 0,
    categories: [
      ...Array.from({ length: 90 }, (_v, i) => ({ id: `c${i}`, name: `C${i}`, plannedCents: MAX_CENTS })),
      { id: 'last', name: 'Last', plannedCents: 0 },
    ],
    expenses: [],
  };
}

describe('first run and labels', () => {
  it('first run: income empty, five suggested rows in order, planned fields empty, headings', () => {
    renderWithBudget(<MonthSetup />, { state: FIVE });
    expect(screen.getByRole('heading', { level: 2, name: 'Set up the month' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Categories' })).toBeInTheDocument();
    expect(
      screen.getByText('Enter your monthly income and how much you plan to spend in each category.'),
    ).toBeInTheDocument();
    expect(incomeField()).toHaveValue('');
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    NAMES.forEach((name, i) => {
      expect(nameField(i + 1)).toHaveValue(name);
      expect(plannedField(i + 1)).toHaveValue('');
      expect(screen.getByRole('button', { name: `Remove ${name}` })).toHaveTextContent('Remove');
    });
    expect(newName()).toHaveValue('');
    expect(newPlanned()).toHaveValue('');
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('labels state the unit: every money field ends in (USD), text fields do not', () => {
    renderWithBudget(<MonthSetup />, { state: FIVE });
    const textboxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(textboxes).toHaveLength(13);
    const money = textboxes.filter((input) => input.getAttribute('inputmode') === 'decimal');
    const names = money.map((input) => input.labels?.[0]?.textContent);
    expect(names).toEqual([
      'Monthly income (USD)',
      'Category 1 planned (USD)',
      'Category 2 planned (USD)',
      'Category 3 planned (USD)',
      'Category 4 planned (USD)',
      'Category 5 planned (USD)',
      'New category planned (USD)',
    ]);
    for (const name of names) expect(name?.endsWith(' (USD)')).toBe(true);
    const text = textboxes.filter((input) => input.getAttribute('inputmode') !== 'decimal');
    expect(text.map((input) => input.labels?.[0]?.textContent)).toEqual([
      'Category 1 name',
      'Category 2 name',
      'Category 3 name',
      'Category 4 name',
      'Category 5 name',
      'New category name',
    ]);
  });

  it('structure: a region, a list and a named form with a submit button', () => {
    renderWithBudget(<MonthSetup />, { state: FIVE });
    expect(screen.getByRole('region', { name: 'Set up the month' })).toBeInTheDocument();
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('role', 'list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    const form = screen.getByRole('form', { name: 'Add a category' });
    expect(form).toHaveAttribute('novalidate');
    expect(within(form).getByRole('button', { name: 'Add category' })).toHaveAttribute('type', 'submit');
  });

  it('seeded with SCENARIO the fields show formatted amounts', () => {
    renderWithBudget(<MonthSetup />, { state: SCENARIO });
    expect(incomeField()).toHaveValue('3,200.00');
    ['1,500.00', '400.00', '120.00', '150.00', '100.00'].forEach((value, i) => {
      expect(plannedField(i + 1)).toHaveValue(value);
    });
  });

  it('a blank-named category in state is labelled Unnamed category on its Remove button', () => {
    renderWithFakeBudget(<MonthSetup />, {
      state: { ...ONE_CATEGORY, categories: [{ id: 'x', name: '', plannedCents: 0 }] },
    });
    expect(screen.getByRole('button', { name: 'Remove Unnamed category' })).toBeInTheDocument();
  });

  it('no categories: shows the empty message and no list', () => {
    renderWithBudget(<MonthSetup />, { state: EMPTY_STATE });
    expect(screen.getByText('No categories yet. Add one below.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(newName()).toBeInTheDocument();
  });
});

describe('income and planned amounts', () => {
  it('typing 1200 calls setIncome with cents per keystroke and ends at exactly 120000', async () => {
    const { user, actions } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO });
    await user.clear(incomeField());
    actions.setIncome.mockClear();
    await user.type(incomeField(), '1200');
    expect(actions.setIncome.mock.calls.map((c) => c[0])).toEqual([100, 1200, 12000, 120000]);
  });

  it('typing 1200 stores 120000 in the real provider and persists across a refresh', async () => {
    const result = renderWithBudget(<MonthSetup />);
    await result.user.type(incomeField(), '1200');
    expect(stored(result).incomeCents).toBe(120000);
    result.refresh();
    expect(incomeField()).toHaveValue('1,200.00');
  });

  it('typing 3,200 and tabbing away shows 3,200.00 and stores 320000', async () => {
    const result = renderWithBudget(<MonthSetup />);
    await result.user.type(incomeField(), '3,200');
    expect(stored(result).incomeCents).toBe(320000);
    await result.user.tab();
    expect(incomeField()).toHaveValue('3,200.00');
    expect(stored(result).incomeCents).toBe(320000);
  });

  it('typing 12.5 stores 1250 while the field still shows 12.5; 1,200.00 stores 120000', async () => {
    const result = renderWithBudget(<MonthSetup />);
    await result.user.type(incomeField(), '12.5');
    expect(stored(result).incomeCents).toBe(1250);
    expect(incomeField()).toHaveValue('12.5');
    await result.user.clear(incomeField());
    await result.user.type(incomeField(), '1,200.00');
    expect(stored(result).incomeCents).toBe(120000);
  });

  it('the draft is never re-synced from state while typing: 12. stays 12.', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: FIVE });
    await result.user.type(incomeField(), '12.');
    expect(incomeField()).toHaveValue('12.');
    await result.user.type(plannedField(1), '7.');
    expect(plannedField(1)).toHaveValue('7.');
    expect(stored(result).categories[0]?.plannedCents).toBe(700);
  });

  it('draft rule: select all, Backspace, type 45 shows 45 (never 0.00) and stores 4500; clearing stores 0 and stays empty', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    expect(incomeField()).toHaveValue('3,200.00');
    await result.user.tripleClick(incomeField());
    await result.user.keyboard('{Backspace}');
    expect(incomeField()).toHaveValue('');
    expect(stored(result).incomeCents).toBe(0);
    await result.user.keyboard('45');
    expect(incomeField()).toHaveValue('45');
    expect(stored(result).incomeCents).toBe(4500);
    await result.user.clear(incomeField());
    expect(incomeField()).toHaveValue('');
    await result.user.tab();
    expect(incomeField()).toHaveValue('');
    expect(stored(result).incomeCents).toBe(0);
  });

  it('invalid text abc in income shows the library error on blur and stores 0', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.clear(incomeField());
    await result.user.type(incomeField(), 'abc');
    await result.user.tab();
    expect(errorText(incomeField())).toBe('Enter an amount like 12.50');
    expect(stored(result).incomeCents).toBe(0);
  });

  it('typing abc into Category 1 planned shows Enter an amount like 12.50 on blur; stored plannedCents is 0', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.clear(plannedField(1));
    await result.user.type(plannedField(1), 'abc');
    await result.user.tab();
    expect(errorText(plannedField(1))).toBe('Enter an amount like 12.50');
    expect(stored(result).categories[0]?.plannedCents).toBe(0);
    expect(stored(result).categories[0]?.name).toBe('Rent');
  });

  it('planned amounts typed for all five store the exact cents', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: FIVE });
    const amounts = ['1500', '400', '120', '150', '100'];
    for (let i = 0; i < 5; i += 1) await result.user.type(plannedField(i + 1), amounts[i] ?? '');
    expect(stored(result).categories.map((c) => c.plannedCents)).toEqual([150000, 40000, 12000, 15000, 10000]);
    expect(stored(result).categories.map((c) => c.name)).toEqual(NAMES);
    for (const c of stored(result).categories) expect(Number.isInteger(c.plannedCents)).toBe(true);
  });

  it('a planned change in one row does not touch other rows or income', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.clear(plannedField(2));
    await result.user.type(plannedField(2), '55.5');
    const after = stored(result);
    expect(after.incomeCents).toBe(320000);
    expect(after.categories.map((c) => c.plannedCents)).toEqual([150000, 5550, 12000, 15000, 10000]);
    expect(after.expenses).toEqual(SCENARIO.expenses);
  });
});

describe('rename on blur', () => {
  it('typing saves nothing while focused; Tab commits the trimmed name and the button is renamed', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    const before = result.storage.setItemCalls;
    await result.user.clear(nameField(2));
    await result.user.type(nameField(2), ' Food ');
    expect(result.storage.setItemCalls).toBe(before);
    expect(stored(result).categories[1]?.name).toBe('Groceries');
    expect(nameField(2)).toHaveFocus();
    await result.user.tab();
    expect(stored(result).categories[1]?.name).toBe('Food');
    expect(result.storage.setItemCalls).toBe(before + 1);
    expect(nameField(2)).toHaveValue('Food');
    expect(screen.getByRole('button', { name: 'Remove Food' })).toBeInTheDocument();
    expect(errorOf(nameField(2))).toBeNull();
  });

  it('a rename keeps the category id, planned amount and its expenses', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.clear(nameField(2));
    await result.user.type(nameField(2), 'Food');
    await result.user.tab();
    expect(stored(result).categories[1]).toEqual({ id: 'suggested-groceries', name: 'Food', plannedCents: 40000 });
    expect(stored(result).expenses).toEqual(SCENARIO.expenses);
  });

  it('typing makes no updateCategory call until blur (one call, trimmed name)', async () => {
    const { user, actions } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO });
    await user.type(nameField(1), ' Home ');
    expect(actions.updateCategory).not.toHaveBeenCalled();
    await user.tab();
    expect(actions.updateCategory).toHaveBeenCalledTimes(1);
    expect(actions.updateCategory).toHaveBeenCalledWith('suggested-rent', { name: 'Rent Home' });
  });

  it('blank name: live error with aria-invalid, reverts on blur with the explanatory message, never saved', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    const before = result.storage.setItemCalls;
    await result.user.clear(nameField(1));
    expect(errorText(nameField(1))).toBe('Enter a category name');
    expect(errorOf(nameField(1))).toHaveAttribute('role', 'alert');
    expect(nameField(1)).toHaveAttribute('aria-invalid', 'true');
    expect(stored(result).categories[0]?.name).toBe('Rent');
    await result.user.tab();
    expect(nameField(1)).toHaveValue('Rent');
    expect(errorText(nameField(1))).toBe('Enter a category name. The name is still Rent.');
    expect(stored(result).categories.map((c) => c.name)).toEqual(NAMES);
    expect(result.storage.setItemCalls).toBe(before);
    expect(screen.getByRole('button', { name: 'Remove Rent' })).toBeInTheDocument();
    await result.user.type(nameField(1), 'x');
    expect(errorOf(nameField(1))).toBeNull();
  });

  it('a name of only spaces counts as blank and is never saved', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.clear(nameField(3));
    await result.user.type(nameField(3), '   ');
    await result.user.tab();
    expect(nameField(3)).toHaveValue('Transport');
    expect(errorText(nameField(3))).toBe('Enter a category name. The name is still Transport.');
    expect(stored(result).categories[2]?.name).toBe('Transport');
  });

  it('duplicate name (any case, spaces): live error, reverts on blur, never saved', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    const before = result.storage.setItemCalls;
    await result.user.clear(nameField(2));
    await result.user.type(nameField(2), ' rent ');
    expect(errorText(nameField(2))).toBe('You already have a category called Rent');
    expect(stored(result).categories[1]?.name).toBe('Groceries');
    await result.user.tab();
    expect(nameField(2)).toHaveValue('Groceries');
    expect(errorText(nameField(2))).toBe('You already have a category called Rent. The name is still Groceries.');
    expect(stored(result).categories.map((c) => c.name)).toEqual(NAMES);
    expect(result.storage.setItemCalls).toBe(before);
    await result.user.type(nameField(2), 's');
    expect(errorOf(nameField(2))).toBeNull();
  });

  it('renaming Rent to RENT (the same category) is allowed and saves RENT', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.clear(nameField(1));
    await result.user.type(nameField(1), 'RENT');
    expect(errorOf(nameField(1))).toBeNull();
    await result.user.tab();
    expect(stored(result).categories[0]?.name).toBe('RENT');
    expect(nameField(1)).toHaveValue('RENT');
  });

  it('blur without an edit, or an edit that restores the saved name, saves nothing and shows no error', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    const before = result.storage.setItemCalls;
    await result.user.click(nameField(1));
    await result.user.tab();
    expect(result.storage.setItemCalls).toBe(before);
    await result.user.type(nameField(2), 'x');
    await result.user.keyboard('{Backspace}');
    await result.user.tab();
    expect(result.storage.setItemCalls).toBe(before);
    expect(errorOf(nameField(2))).toBeNull();
    expect(nameField(2)).toHaveValue('Groceries');
  });

  it('a name with only surrounding spaces added is trimmed and not saved when it equals the saved name', async () => {
    const { user, actions } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO });
    await user.type(nameField(1), ' ');
    await user.tab();
    expect(actions.updateCategory).not.toHaveBeenCalled();
    expect(nameField(1)).toHaveValue('Rent');
  });

  it('the revert error stays after the focus leaves and returns without editing', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.clear(nameField(1));
    await result.user.tab();
    await result.user.tab({ shift: true });
    await result.user.tab();
    expect(errorText(nameField(1))).toBe('Enter a category name. The name is still Rent.');
  });

  it('two rows renamed to each other names both revert; a swap via a free name works; stored names stay valid', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.clear(nameField(1));
    await result.user.type(nameField(1), 'Groceries');
    await result.user.tab();
    expect(nameField(1)).toHaveValue('Rent');
    expect(errorText(nameField(1))).toBe('You already have a category called Groceries. The name is still Rent.');
    await result.user.clear(nameField(2));
    await result.user.type(nameField(2), 'Rent');
    await result.user.tab();
    expect(nameField(2)).toHaveValue('Groceries');
    expectStoredNamesValid(stored(result));
    expect(stored(result).categories.map((c) => c.name)).toEqual(NAMES);

    await result.user.clear(nameField(1));
    await result.user.type(nameField(1), 'Tmp');
    await result.user.tab();
    await result.user.clear(nameField(2));
    await result.user.type(nameField(2), 'Rent');
    await result.user.tab();
    expect(stored(result).categories.slice(0, 2).map((c) => c.name)).toEqual(['Tmp', 'Rent']);
    expectStoredNamesValid(stored(result));
  });
});

describe('add a category', () => {
  it('Pets / 25 adds a sixth row with id-1, clears both fields and focuses New category name', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: FIVE });
    await result.user.type(newName(), 'Pets');
    await result.user.type(newPlanned(), '25');
    await result.user.click(addButton());
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(nameField(6)).toHaveValue('Pets');
    expect(plannedField(6)).toHaveValue('25.00');
    expect(stored(result).categories[5]).toEqual({ id: 'id-1', name: 'Pets', plannedCents: 2500 });
    expect(newName()).toHaveValue('');
    expect(newPlanned()).toHaveValue('');
    expect(errorOf(newName())).toBeNull();
    expect(errorOf(newPlanned())).toBeNull();
    expect(newName()).toHaveFocus();
    expect(actionErrors()).toHaveLength(0);
  });

  it('pressing Enter in New category planned submits; the name is trimmed by the provider', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: FIVE });
    await result.user.type(newName(), ' Pets ');
    await result.user.type(newPlanned(), '25{Enter}');
    expect(stored(result).categories).toHaveLength(6);
    expect(stored(result).categories[5]).toEqual({ id: 'id-1', name: 'Pets', plannedCents: 2500 });
    expect(newName()).toHaveFocus();
  });

  it('both fields empty: both errors, focus on the name, nothing added', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: FIVE });
    await result.user.click(addButton());
    expect(errorText(newName())).toBe('Enter a category name');
    expect(errorText(newPlanned())).toBe('Enter an amount like 250.00');
    expect(newName()).toHaveFocus();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(result.readStored()).toEqual(FIVE);
    expect(result.storage.setItemCalls).toBe(0);
  });

  it('name Pets with planned abc adds nothing and focuses the planned field', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: FIVE });
    await result.user.type(newName(), 'Pets');
    await result.user.type(newPlanned(), 'abc');
    await result.user.click(addButton());
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(newPlanned()).toHaveFocus();
    expect(newPlanned()).toHaveAttribute('aria-invalid', 'true');
    expect(errorOf(newPlanned())).not.toBeNull();
    expect(result.readStored()).toEqual(FIVE);
    expect(newName()).toHaveValue('Pets');
  });

  it('name Pets with an empty planned shows Enter an amount like 250.00 on the planned field only and focuses it', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: FIVE });
    await result.user.type(newName(), 'Pets');
    await result.user.click(addButton());
    expect(errorOf(newName())).toBeNull();
    expect(errorText(newPlanned())).toBe('Enter an amount like 250.00');
    expect(newPlanned()).toHaveFocus();
    expect(result.readStored()).toEqual(FIVE);
  });

  it('a name of only spaces counts as empty', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: FIVE });
    await result.user.type(newName(), '   ');
    await result.user.type(newPlanned(), '5');
    await result.user.click(addButton());
    expect(errorText(newName())).toBe('Enter a category name');
    expect(newName()).toHaveFocus();
    expect(result.readStored()).toEqual(FIVE);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('a duplicate name (trimmed, case-insensitive) shows the duplicate error and adds nothing', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: FIVE });
    await result.user.type(newName(), ' groceries ');
    await result.user.type(newPlanned(), '5');
    await result.user.click(addButton());
    expect(errorText(newName())).toBe('You already have a category called Groceries');
    expect(newName()).toHaveFocus();
    expect(result.readStored()).toEqual(FIVE);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('planned 0 is valid and adds a category with 0 cents', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: FIVE });
    await result.user.type(newName(), 'Gifts');
    await result.user.type(newPlanned(), '0');
    await result.user.click(addButton());
    expect(stored(result).categories[5]).toEqual({ id: 'id-1', name: 'Gifts', plannedCents: 0 });
  });

  it('editing a field clears its submit error', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: FIVE });
    await result.user.click(addButton());
    await result.user.type(newName(), 'P');
    expect(errorOf(newName())).toBeNull();
    expect(errorOf(newPlanned())).not.toBeNull();
    await result.user.type(newPlanned(), '2');
    expect(errorOf(newPlanned())).toBeNull();
  });

  it('a removed name can be added again, then is a duplicate; ids come from the provider', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.click(screen.getByRole('button', { name: 'Remove Rent' }));
    await result.user.type(newName(), 'Rent');
    await result.user.type(newPlanned(), '10');
    await result.user.click(addButton());
    expect(stored(result).categories.map((c) => c.name)).toEqual([
      'Groceries',
      'Transport',
      'Utilities',
      'Eating out',
      'Rent',
    ]);
    expect(stored(result).categories[4]?.id).toBe('id-1');
    await result.user.type(newName(), 'rent');
    await result.user.type(newPlanned(), '10');
    await result.user.click(addButton());
    expect(errorText(newName())).toBe('You already have a category called Rent');
    expect(stored(result).categories).toHaveLength(5);
    expectStoredNamesValid(stored(result));
  });

  it('keyboard only: fill the form with Tab and submit with Enter on the button', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: FIVE });
    newName().focus();
    await result.user.keyboard('Pets');
    await result.user.tab();
    await result.user.keyboard('25');
    await result.user.tab();
    expect(addButton()).toHaveFocus();
    await result.user.keyboard('{Enter}');
    expect(stored(result).categories[5]).toEqual({ id: 'id-1', name: 'Pets', plannedCents: 2500 });
    expect(newName()).toHaveFocus();
  });
});

describe('remove a category', () => {
  it('Remove Groceries leaves four rows, keeps expenses, focuses Remove Transport', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.click(screen.getByRole('button', { name: 'Remove Groceries' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect([1, 2, 3, 4].map((n) => nameField(n).value)).toEqual(['Rent', 'Transport', 'Utilities', 'Eating out']);
    expect(stored(result).categories).toHaveLength(4);
    expect(stored(result).expenses).toEqual(SCENARIO.expenses);
    expect(stored(result).expenses).toHaveLength(3);
    expect(stored(result).incomeCents).toBe(320000);
    expect(screen.getByRole('button', { name: 'Remove Transport' })).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Category 2 name' })).toHaveValue('Transport');
  });

  it('removing the first row focuses the row that took its place', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.click(screen.getByRole('button', { name: 'Remove Rent' }));
    expect(screen.getByRole('button', { name: 'Remove Groceries' })).toHaveFocus();
    expect(stored(result).categories[0]?.name).toBe('Groceries');
  });

  it('removing the last row focuses the new last row Remove button', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.click(screen.getByRole('button', { name: 'Remove Eating out' }));
    expect(screen.getByRole('button', { name: 'Remove Utilities' })).toHaveFocus();
    expect(stored(result).categories).toHaveLength(4);
  });

  it('removing the only row shows the empty message and focuses New category name', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: ONE_CATEGORY });
    await result.user.click(screen.getByRole('button', { name: 'Remove Only' }));
    expect(screen.getByText('No categories yet. Add one below.')).toBeInTheDocument();
    expect(newName()).toHaveFocus();
    expect(stored(result).categories).toHaveLength(0);
  });

  it('remove works with the keyboard (Enter on the focused button)', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    screen.getByRole('button', { name: 'Remove Transport' }).focus();
    await result.user.keyboard('{Enter}');
    expect(stored(result).categories.map((c) => c.name)).toEqual(['Rent', 'Groceries', 'Utilities', 'Eating out']);
    expect(screen.getByRole('button', { name: 'Remove Utilities' })).toHaveFocus();
  });

  it('Remove aria-labels are distinct and follow renames', async () => {
    renderWithBudget(<MonthSetup />, { state: SCENARIO });
    const labels = screen.getAllByRole('button', { name: /^Remove / }).map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(NAMES.map((n) => `Remove ${n}`));
    expect(new Set(labels).size).toBe(5);
  });

  it('rows keep their own drafts when an earlier row is removed (keyed by id)', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.clear(plannedField(3));
    await result.user.type(plannedField(3), '7.');
    expect(plannedField(3)).toHaveValue('7.');
    await result.user.click(screen.getByRole('button', { name: 'Remove Rent' }));
    expect(plannedField(2)).toHaveValue('7.00');
    expect(nameField(2)).toHaveValue('Transport');
    expect(result.readStored()).not.toBeNull();
  });
});

describe('action errors', () => {
  it('setIncome total too large: shown on the income field with role=alert, called once, draft kept', async () => {
    const { user, actions } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(tooLarge) });
    await user.clear(incomeField());
    actions.setIncome.mockClear();
    await user.type(incomeField(), '5');
    expect(actions.setIncome).toHaveBeenCalledTimes(1);
    expect(actions.setIncome).toHaveBeenCalledWith(500);
    expect(errorText(incomeField())).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(errorOf(incomeField())).toHaveAttribute('role', 'alert');
    expect(incomeField()).toHaveValue('5');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(actionErrors()).toHaveLength(0);
  });

  it('setIncome unexpected error: generic message on the income field', async () => {
    const { user } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(boom) });
    await user.type(incomeField(), '5');
    expect(errorText(incomeField())).toBe(GENERIC);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('a RangeError with another message is the generic message', async () => {
    const { user } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(otherRange) });
    await user.type(incomeField(), '5');
    expect(errorText(incomeField())).toBe(GENERIC);
  });

  it('setIncome error clears on the next successful edit', async () => {
    const { user } = renderWithFakeBudget(<MonthSetup />, {
      state: SCENARIO,
      actions: { setIncome: failOnce(new RangeError(TOTAL_TOO_LARGE_MESSAGE)) },
    });
    await user.type(incomeField(), '5');
    expect(errorOf(incomeField())).not.toBeNull();
    await user.type(incomeField(), '6');
    expect(errorOf(incomeField())).toBeNull();
    expect(incomeField()).toHaveValue('3,200.0056');
  });

  it('updateCategory planned total too large: on that row planned field only, called once', async () => {
    const { user, actions } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(tooLarge) });
    await user.clear(plannedField(1));
    actions.updateCategory.mockClear();
    await user.type(plannedField(1), '5');
    expect(actions.updateCategory).toHaveBeenCalledTimes(1);
    expect(actions.updateCategory).toHaveBeenCalledWith('suggested-rent', { plannedCents: 500 });
    expect(errorText(plannedField(1))).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(errorOf(plannedField(1))).toHaveAttribute('role', 'alert');
    expect(plannedField(1)).toHaveValue('5');
    expect(errorOf(plannedField(2))).toBeNull();
    expect(errorOf(incomeField())).toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('updateCategory planned unexpected error: generic on that planned field', async () => {
    const { user } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(boom) });
    await user.type(plannedField(3), '1');
    expect(errorText(plannedField(3))).toBe(GENERIC);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('updateCategory planned error clears on the next successful edit', async () => {
    const { user } = renderWithFakeBudget(<MonthSetup />, {
      state: SCENARIO,
      actions: { updateCategory: failOnce(new Error('boom')) },
    });
    await user.type(plannedField(1), '1');
    expect(errorOf(plannedField(1))).not.toBeNull();
    await user.type(plannedField(1), '2');
    expect(errorOf(plannedField(1))).toBeNull();
  });

  it('rename failing with total too large: message on the name field and the field reverts', async () => {
    const { user, actions } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(tooLarge) });
    await user.clear(nameField(1));
    await user.type(nameField(1), ' Renamed ');
    await user.tab();
    expect(actions.updateCategory).toHaveBeenCalledTimes(1);
    expect(actions.updateCategory).toHaveBeenCalledWith('suggested-rent', { name: 'Renamed' });
    expect(nameField(1)).toHaveValue('Rent');
    expect(errorText(nameField(1))).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(errorOf(nameField(1))).toHaveAttribute('role', 'alert');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    await user.type(nameField(1), 'x');
    expect(errorOf(nameField(1))).toBeNull();
  });

  it('rename unexpected error: generic message on the name field and Rent again', async () => {
    const { user } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(boom) });
    await user.clear(nameField(1));
    await user.type(nameField(1), 'Home');
    await user.tab();
    expect(errorText(nameField(1))).toBe(GENERIC);
    expect(nameField(1)).toHaveValue('Rent');
    expect(screen.getByRole('button', { name: 'Remove Rent' })).toBeInTheDocument();
  });

  it('addCategory total too large: on New category planned, values kept, focus stays in the form, called once', async () => {
    const { user, actions } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(tooLarge) });
    await user.type(newName(), 'Pets');
    await user.type(newPlanned(), '25');
    await user.click(addButton());
    expect(actions.addCategory).toHaveBeenCalledTimes(1);
    expect(actions.addCategory).toHaveBeenCalledWith({ name: 'Pets', plannedCents: 2500 });
    expect(errorText(newPlanned())).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(errorOf(newPlanned())).toHaveAttribute('role', 'alert');
    expect(newName()).toHaveValue('Pets');
    expect(newPlanned()).toHaveValue('25.00');
    expect(screen.getByRole('form', { name: 'Add a category' }).contains(document.activeElement)).toBe(true);
    expect(newName()).not.toHaveFocus();
    expect(actionErrors()).toHaveLength(0);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('addCategory total error clears on edit and a later success clears the form', async () => {
    const { user, actions } = renderWithFakeBudget(<MonthSetup />, {
      state: SCENARIO,
      actions: { addCategory: failOnceId(new RangeError(TOTAL_TOO_LARGE_MESSAGE)) },
    });
    await user.type(newName(), 'Pets');
    await user.type(newPlanned(), '25');
    await user.click(addButton());
    expect(errorOf(newPlanned())).not.toBeNull();
    await user.clear(newPlanned());
    expect(errorOf(newPlanned())).toBeNull();
    await user.type(newPlanned(), '25');
    await user.click(addButton());
    expect(actions.addCategory).toHaveBeenCalledTimes(2);
    expect(newName()).toHaveValue('');
    expect(newPlanned()).toHaveValue('');
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(newName()).toHaveFocus();
  });

  it('addCategory unexpected error: action-error paragraph directly after Add category inside the form, fields kept', async () => {
    const { user } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(boom) });
    await user.type(newName(), 'Pets');
    await user.type(newPlanned(), '25');
    await user.click(addButton());
    const errors = actionErrors();
    expect(errors).toHaveLength(1);
    const paragraph = errors[0];
    expect(paragraph?.tagName).toBe('P');
    expect(paragraph).toHaveAttribute('role', 'alert');
    expect(paragraph).toHaveTextContent(GENERIC);
    expect(paragraph?.textContent).toBe(GENERIC);
    expect(addButton().nextElementSibling).toBe(paragraph);
    expect(screen.getByRole('form', { name: 'Add a category' })).toContainElement(paragraph ?? null);
    expect(newName()).toHaveValue('Pets');
    expect(newPlanned()).toHaveValue('25.00');
    expect(errorOf(newPlanned())).toBeNull();
    await user.type(newName(), 's');
    expect(actionErrors()).toHaveLength(0);
  });

  it('addCategory unexpected error clears on editing the planned field and on a successful submit', async () => {
    const { user } = renderWithFakeBudget(<MonthSetup />, {
      state: SCENARIO,
      actions: { addCategory: failOnceId(new Error('boom')) },
    });
    await user.type(newName(), 'Pets');
    await user.type(newPlanned(), '25');
    await user.click(addButton());
    expect(actionErrors()).toHaveLength(1);
    await user.type(newPlanned(), '1');
    expect(actionErrors()).toHaveLength(0);
    await user.click(addButton());
    expect(actionErrors()).toHaveLength(0);
    await user.click(addButton());
    expect(actionErrors()).toHaveLength(0);

    const second = renderWithFakeBudget(<MonthSetup />, {
      state: SCENARIO,
      actions: { addCategory: failOnceId(new Error('boom')) },
    });
    const forms = screen.getAllByRole('form', { name: 'Add a category' });
    const form = forms[forms.length - 1] as HTMLElement;
    await second.user.type(within(form).getByRole('textbox', { name: 'New category name' }), 'Cats');
    await second.user.type(within(form).getByRole('textbox', { name: 'New category planned (USD)' }), '3');
    await second.user.click(within(form).getByRole('button', { name: 'Add category' }));
    expect(form.querySelectorAll('[data-part="action-error"]')).toHaveLength(1);
    await second.user.click(within(form).getByRole('button', { name: 'Add category' }));
    expect(form.querySelectorAll('[data-part="action-error"]')).toHaveLength(0);
  });

  it('removeCategory error (total too large): action-error paragraph right after that Remove button, row stays', async () => {
    const { user, actions } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(tooLarge) });
    const button = screen.getByRole('button', { name: 'Remove Groceries' });
    await user.click(button);
    expect(actions.removeCategory).toHaveBeenCalledTimes(1);
    const errors = actionErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toHaveAttribute('role', 'alert');
    expect(errors[0]?.textContent).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(button.nextElementSibling).toBe(errors[0]);
    expect(button.closest('li')).toContainElement(errors[0] ?? null);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(nameField(2)).toHaveValue('Groceries');
    expect(button).toHaveFocus();
  });

  it('removeCategory unexpected error: generic message inside the Groceries list item only', async () => {
    const { user } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(boom) });
    await user.click(screen.getByRole('button', { name: 'Remove Groceries' }));
    const item = screen.getByRole('button', { name: 'Remove Groceries' }).closest('li') as HTMLElement;
    expect(within(item).getByRole('alert')).toHaveTextContent(GENERIC);
    expect(actionErrors()).toHaveLength(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Remove Groceries' })).toHaveFocus();
  });

  it('removeCategory error clears on the next successful remove from the same control', async () => {
    const { user } = renderWithFakeBudget(<MonthSetup />, {
      state: SCENARIO,
      actions: { removeCategory: failOnce(new Error('boom')) },
    });
    await user.click(screen.getByRole('button', { name: 'Remove Groceries' }));
    expect(actionErrors()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Remove Groceries' }));
    expect(actionErrors()).toHaveLength(0);
  });

  it('a failed rename of one row does not show errors on other rows', async () => {
    const { user } = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(boom) });
    await user.type(nameField(2), 'x');
    await user.tab();
    expect(errorText(nameField(2))).toBe(GENERIC);
    expect(errorOf(nameField(1))).toBeNull();
    expect(errorOf(plannedField(2))).toBeNull();
  });
});

describe('real overflow through the provider', () => {
  it('typing past the limit shows the message and stored ends at the last keystroke that fit', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: bigState() });
    const last = plannedField(91);
    await result.user.type(last, '9999999999');
    expect(errorOf(last)).toBeNull();
    expect(stored(result).categories[90]?.plannedCents).toBe(999999999900);
    await result.user.type(last, '9');
    expect(errorText(last)).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(errorOf(last)).toHaveAttribute('role', 'alert');
    expect(stored(result).categories[90]?.plannedCents).toBe(999999999900);
    await result.user.type(last, '9.99');
    expect(last).toHaveValue('999999999999.99');
    expect(errorText(last)).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(stored(result).categories[90]?.plannedCents).toBe(999999999900);
    const total = stored(result).categories.reduce((sum, c) => sum + c.plannedCents, 0);
    expect(Number.isSafeInteger(total)).toBe(true);
  }, 30000);

  it('adding one more category at the maximum shows the message on the planned field and saves nothing', async () => {
    const seed = bigState();
    seed.categories.pop();
    const result = renderWithBudget(<MonthSetup />, { state: seed });
    const before = result.storage.setItemCalls;
    await result.user.type(newName(), 'More');
    await result.user.type(newPlanned(), '999999999999.99');
    await result.user.click(addButton());
    expect(errorText(newPlanned())).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(newName()).toHaveValue('More');
    expect(newPlanned()).toHaveValue('999,999,999,999.99');
    expect(stored(result).categories).toHaveLength(90);
    expect(result.storage.setItemCalls).toBe(before);
    expect(actionErrors()).toHaveLength(0);
  }, 30000);
});

describe('remount on delete all data', () => {
  function DeleteProbe(): ReactElement | null {
    const budget = useBudget();
    if (budget.status !== 'ready') return null;
    return <Button onClick={() => budget.actions.deleteAllData()}>Delete now</Button>;
  }
  function Harness(): ReactElement | null {
    const budget = useBudget();
    if (budget.status !== 'ready') return null;
    return (
      <>
        <MonthSetup key={`${budget.viewedMonth}:${budget.generation}`} />
        <DeleteProbe />
      </>
    );
  }

  it('after deleteAllData the income field is empty and no categories remain', async () => {
    const result = renderWithBudget(<Harness />, { state: FIVE });
    await result.user.type(incomeField(), '500');
    await result.user.clear(nameField(1));
    await result.user.type(nameField(1), 'Mortgage');
    await result.user.tab();
    await result.user.click(screen.getByRole('button', { name: 'Remove Groceries' }));
    expect(incomeField()).toHaveValue('500.00');
    await result.user.click(screen.getByRole('button', { name: 'Delete now' }));
    expect(incomeField()).toHaveValue('');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('PlanPage mounts MonthSetup with a key that changes on delete: the screen remounts', async () => {
    function AppWithDelete(): ReactElement {
      return (
        <>
          <PlanPage />
          <DeleteProbe />
        </>
      );
    }
    const result = renderWithBudget(<AppWithDelete />, { state: FIVE });
    await result.user.type(incomeField(), '500');
    await result.user.type(plannedField(1), '12');
    expect(incomeField()).toHaveValue('500.00');
    await result.user.click(screen.getByRole('button', { name: 'Delete now' }));
    expect(incomeField()).toHaveValue('');
    expect(screen.queryByRole('textbox', { name: 'Category 1 planned (USD)' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Set up the month' })).toBeInTheDocument();
  });
});

describe('keyboard and DOM order', () => {
  it('Tab visits income, each name, planned and Remove in row order, then the add form', async () => {
    const { user } = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    const expected = [
      'Monthly income (USD)',
      ...NAMES.flatMap((name, i) => [`Category ${i + 1} name`, `Category ${i + 1} planned (USD)`, `Remove ${name}`]),
      'New category name',
      'New category planned (USD)',
      'Add category',
    ];
    const visited: string[] = [];
    const nameOf = (element: Element): string => {
      if (element instanceof HTMLInputElement) return element.labels?.[0]?.textContent ?? '';
      return element.getAttribute('aria-label') ?? element.textContent ?? '';
    };
    for (let i = 0; i < expected.length; i += 1) {
      await user.tab();
      visited.push(nameOf(document.activeElement as Element));
    }
    expect(visited).toEqual(expected);
    const inDom = Array.from(
      document.querySelectorAll('input, button'),
    ).map(nameOf);
    expect(inDom).toEqual(expected);
  });
});

describe('library-only alerts', () => {
  it('no role=status, aria-live or stray alert at rest, with field errors, or with action errors', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: FIVE });
    const noLive = (): void => {
      expect(document.querySelectorAll('[role="status"], [aria-live]')).toHaveLength(0);
    };
    noLive();
    await result.user.click(addButton());
    noLive();
    for (const alert of screen.getAllByRole('alert')) expect(alert.getAttribute('data-part')).toBe('error');
    await result.user.clear(nameField(1));
    noLive();
    const fake = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(boom) });
    await fake.user.click(within(fake.container).getByRole('button', { name: 'Remove Groceries' }));
    noLive();
    for (const alert of screen.getAllByRole('alert')) {
      const part = alert.getAttribute('data-part');
      expect(['error', 'action-error']).toContain(part);
    }
  });
});

describe('accessibility (axe, colour contrast disabled in jsdom)', () => {
  it('first run', async () => {
    renderWithBudget(<MonthSetup />);
    await expectNoAxeViolations();
  });

  it('SCENARIO', async () => {
    renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await expectNoAxeViolations();
  });

  it('blank name (live and reverted)', async () => {
    const result = renderWithBudget(<MonthSetup />, { state: SCENARIO });
    await result.user.clear(nameField(1));
    await expectNoAxeViolations();
    await result.user.tab();
    await expectNoAxeViolations();
  });

  it('no categories', async () => {
    renderWithBudget(<MonthSetup />, { state: EMPTY_STATE });
    await expectNoAxeViolations();
  });

  it('add-category errors', async () => {
    const result = renderWithBudget(<MonthSetup />);
    await result.user.click(addButton());
    await expectNoAxeViolations();
  });

  it('action errors on a field, on the add form and on a row', async () => {
    const total = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(tooLarge) });
    await total.user.type(incomeField(), '5');
    await expectNoAxeViolations();
    total.unmount();
    const generic = renderWithFakeBudget(<MonthSetup />, { state: SCENARIO, actions: allThrow(boom) });
    await generic.user.type(newName(), 'Pets');
    await generic.user.type(newPlanned(), '5');
    await generic.user.click(addButton());
    await generic.user.click(screen.getByRole('button', { name: 'Remove Groceries' }));
    expect(actionErrors()).toHaveLength(2);
    await expectNoAxeViolations();
  });
});

describe('source rules', () => {
  const SRC = join(import.meta.dirname, '..', '..');
  const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');
  const strip = (code: string): string =>
    code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const source = strip(read('features/setup/MonthSetup.tsx'));

  it('has a client directive, no style attribute and no native controls', () => {
    expect(read('features/setup/MonthSetup.tsx').startsWith("'use client';")).toBe(true);
    expect(source).not.toMatch(/\bstyle=/);
    expect(source).not.toMatch(/<(button|input|select|textarea|table|dialog)\b/);
  });

  it('imports components only from @budget-kit/ui and uses no src deep import', () => {
    expect(source).not.toMatch(/@budget-kit\/ui\/src/);
    expect(source).toMatch(/from '@budget-kit\/ui'/);
  });

  it('uses only the allowed Tailwind classes, multi-column only behind sm:', () => {
    const allowed = [
      /^flex$/,
      /^flex-(col|row)$/,
      /^grid$/,
      /^grid-cols-\d+$/,
      /^gap-\d+$/,
      /^p[xytrbl]?-\d+$/,
      /^m[xytrbl]?-\d+$/,
      /^max-w-[\w[\].-]+$/,
      /^w-full$/,
      /^items-[\w-]+$/,
      /^justify-[\w-]+$/,
      /^list-none$/,
      /^text-2xl$/,
      /^font-semibold$/,
      /^text-text$/,
      /^text-text-muted$/,
    ];
    const classNames = [...source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)];
    expect(classNames.length).toBeGreaterThan(0);
    for (const match of classNames) {
      for (const token of (match[1] ?? match[2] ?? '').split(/\s+/).filter(Boolean)) {
        const bare = token.replace(/^sm:/, '');
        expect(allowed.some((pattern) => pattern.test(bare)), `class ${token}`).toBe(true);
        const columns = /^grid-cols-(\d+)$/.exec(bare);
        if (columns !== null && Number(columns[1]) > 1) expect(token.startsWith('sm:'), `class ${token}`).toBe(true);
      }
    }
  });

  it('puts no className on library components', () => {
    const lines = source.split('\n');
    let current: string | null = null;
    for (const line of lines) {
      const open = /^\s*<(Card|MoneyField|TextField|Button)\b/.exec(line);
      if (open !== null) current = open[1] ?? null;
      if (current !== null) {
        expect(line, `className on ${current}`).not.toMatch(/className=/);
        if (/\/>\s*$/.test(line) || /^\s*>\s*$/.test(line) || /<\/(Card|Button)>/.test(line)) current = null;
        else if (open !== null && /[^=]>\s*$/.test(line) && !/=>\s*$/.test(line)) current = null;
      }
    }
  });

  it('does no float or text-number maths on amounts', () => {
    expect(source).not.toMatch(/parseFloat|toFixed|Number\(|parseInt|\*\s*100\b|\/\s*100\b|Math\.(round|floor|ceil)/);
  });

  it('has no any, ts-ignore or ts-expect-error', () => {
    const raw = read('features/setup/MonthSetup.tsx');
    expect(raw).not.toMatch(/:\s*any\b|\bas any\b|<any>|@ts-ignore|@ts-expect-error/);
  });

  it('every actions.* call is inside a try block', () => {
    const lines = source.split('\n');
    const calls = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => /\bactions\.\w+\(/.test(line));
    expect(calls.length).toBeGreaterThanOrEqual(5);
    for (const { index } of calls) {
      const window = lines.slice(Math.max(0, index - 3), index).join('\n');
      expect(window).toMatch(/\btry\s*\{/);
    }
    expect((source.match(/\bcatch\b/g) ?? []).length).toBeGreaterThanOrEqual(calls.length);
  });

  it('the only role=alert is the action-error paragraph; no role=status or aria-live', () => {
    const alerts = [...source.matchAll(/role="alert"/g)];
    expect(alerts.length).toBeGreaterThan(0);
    for (const match of alerts) {
      const around = source.slice(Math.max(0, (match.index ?? 0) - 20), (match.index ?? 0) + 60);
      expect(around).toMatch(/<p role="alert" data-part="action-error">/);
    }
    expect(source).not.toMatch(/role="status"|aria-live|aria-atomic|role='/);
  });

  it('PlanPage mounts only the keyed MonthSetup', () => {
    const app = read('features/plan/PlanPage.tsx');
    expect(app).toContain("import { MonthSetup } from '@/features/setup/MonthSetup';");
    expect(app).toContain('<MonthSetup key={`${budget.viewedMonth}:${budget.generation}`} />');
    expect((app.match(/<MonthSetup\b/g) ?? []).length).toBe(1);
    expect((app.match(/^import .*MonthSetup/gm) ?? []).length).toBe(1);
  });
});
