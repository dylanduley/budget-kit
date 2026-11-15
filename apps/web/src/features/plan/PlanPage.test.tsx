import { act, screen, within } from '@testing-library/react';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { MAX_CENTS, type BudgetState } from '@/lib/budget';
import { PlanPage } from '@/features/plan/PlanPage';
import { type BudgetActions, TOTAL_TOO_LARGE_MESSAGE, useBudget } from '@/state/BudgetProvider';
import { expectNoAxeViolations } from '@/test/axe';
import { BOOK, SCENARIO } from '@/test/fixtures';
import { renderApp } from '@/test/renderApp';
import { renderWithBudget } from '@/test/renderWithBudget';
import { renderWithFakeBudget } from '@/test/renderWithFakeBudget';

const GENERIC = 'Something went wrong. Your budget was not changed.';
const EMPTY_LINE = 'No categories yet. Add your own, or start from a suggestion below.';
const SUGGESTED = ['Rent', 'Groceries', 'Transport', 'Utilities', 'Eating out'];

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
    categories: Array.from({ length: 90 }, (_v, i) => ({ id: `c${i}`, name: `C${i}`, plannedCents: MAX_CENTS })),
    expenses: [],
  };
}

const nameField = (n: number): HTMLInputElement =>
  screen.getByRole('textbox', { name: `Category ${n} name` }) as HTMLInputElement;
const plannedField = (n: number): HTMLInputElement =>
  screen.getByRole('textbox', { name: `Category ${n} planned (USD)` }) as HTMLInputElement;
const incomeField = (): HTMLInputElement =>
  screen.getByRole('textbox', { name: 'Monthly income (USD)' }) as HTMLInputElement;
const addCategoryButton = (): HTMLElement => screen.getByRole('button', { name: 'Add category' });
const dialog = (): HTMLElement => screen.getByRole('dialog', { name: 'Add category' });
const dName = (): HTMLInputElement => within(dialog()).getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
const dPlanned = (): HTMLInputElement =>
  within(dialog()).getByRole('textbox', { name: 'Planned (USD)' }) as HTMLInputElement;
const save = (): HTMLElement => within(dialog()).getByRole('button', { name: 'Save category' });

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
const rows = (): HTMLElement[] =>
  within(screen.getByRole('region', { name: 'Categories' }))
    .getAllByRole('listitem')
    .filter((li) => li.querySelector('input') !== null);
function suggestionNames(): string[] {
  return screen
    .queryAllByRole('button', { name: /^Add (Rent|Groceries|Transport|Utilities|Eating out|Food)$/ })
    .map((b) => b.textContent ?? '');
}

describe('empty state', () => {
  it('empty storage: h1, regions, empty income, empty line, suggestions in order, no category rows, nothing written', () => {
    const { storage } = renderApp({ path: '/plan' });
    expect(screen.getByRole('heading', { level: 1, name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Income' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Categories' })).toBeInTheDocument();
    expect(incomeField()).toHaveValue('');
    expect(screen.getByText(EMPTY_LINE)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Suggestions' })).toBeInTheDocument();
    const buttons = suggestionNames();
    expect(buttons).toEqual(SUGGESTED.map((n) => `Add ${n}`));
    expect(screen.queryByRole('textbox', { name: 'Category 1 name' })).not.toBeInTheDocument();
    expect(storage.setItemCalls).toBe(0);
  });

  it('rendering and re-rendering the empty page writes nothing even after interacting without changes', async () => {
    const { storage, user } = renderApp({ path: '/plan' });
    await user.click(addCategoryButton());
    await user.keyboard('{Escape}');
    expect(storage.setItemCalls).toBe(0);
  });
});

describe('suggestions', () => {
  it('clicking Add Groceries adds a row at $0 with the planned field focused, and removes only that suggestion', async () => {
    const result = renderApp({ path: '/plan' });
    await result.user.click(screen.getByRole('button', { name: 'Add Groceries' }));
    expect(nameField(1)).toHaveValue('Groceries');
    expect(plannedField(1)).toHaveValue('');
    expect(plannedField(1)).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Add Groceries' })).not.toBeInTheDocument();
    expect(suggestionNames()).toEqual(['Add Rent', 'Add Transport', 'Add Utilities', 'Add Eating out']);
    expect(screen.queryByText(EMPTY_LINE)).not.toBeInTheDocument();
    expect(stored(result).categories).toEqual([expect.objectContaining({ name: 'Groceries', plannedCents: 0 })]);
    expect(stored(result).categories).toHaveLength(1);
  });

  it('typing 400 in the new planned field stores 40000', async () => {
    const result = renderApp({ path: '/plan' });
    await result.user.click(screen.getByRole('button', { name: 'Add Groceries' }));
    await result.user.keyboard('400');
    expect(stored(result).categories[0]?.plannedCents).toBe(40000);
  });

  it('adding a later suggestion focuses its own planned field (row 2)', async () => {
    const result = renderApp({ path: '/plan' });
    await result.user.click(screen.getByRole('button', { name: 'Add Rent' }));
    await result.user.click(screen.getByRole('button', { name: 'Add Transport' }));
    expect(nameField(2)).toHaveValue('Transport');
    expect(plannedField(2)).toHaveFocus();
    expect(stored(result).categories.map((c) => c.name)).toEqual(['Rent', 'Transport']);
  });

  it('after adding all five the Suggestions heading is gone', async () => {
    const { user } = renderApp({ path: '/plan' });
    for (const name of SUGGESTED) await user.click(screen.getByRole('button', { name: `Add ${name}` }));
    expect(screen.queryByRole('heading', { name: 'Suggestions' })).not.toBeInTheDocument();
    expect(suggestionNames()).toEqual([]);
    expect(rows()).toHaveLength(5);
  });

  it('a name differing only by case and trailing space keeps the suggestion hidden; a real rename on blur brings it back', async () => {
    const { user } = renderApp({ path: '/plan' });
    await user.click(screen.getByRole('button', { name: 'Add Groceries' }));
    await user.clear(nameField(1));
    await user.type(nameField(1), 'groceries ');
    await user.tab();
    expect(screen.queryByRole('button', { name: 'Add Groceries' })).not.toBeInTheDocument();
    await user.clear(nameField(1));
    await user.type(nameField(1), 'Food');
    // Still typing: not saved until blur.
    expect(screen.queryByRole('button', { name: 'Add Groceries' })).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Add Groceries' })).toBeInTheDocument();
  });

  it('a category pre-seeded as "  rent " hides Add Rent (trim and case)', () => {
    const state: BudgetState = {
      ...EMPTY_STATE,
      categories: [{ id: 'x', name: '  rent ', plannedCents: 0 }],
    };
    renderApp({ state, path: '/plan' });
    expect(screen.queryByRole('button', { name: 'Add Rent' })).not.toBeInTheDocument();
    expect(suggestionNames()).toEqual(['Add Groceries', 'Add Transport', 'Add Utilities', 'Add Eating out']);
  });

  it('removing a category brings its suggestion back (even after a deliberate removal)', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/plan' });
    expect(screen.queryByRole('heading', { name: 'Suggestions' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Transport' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Suggestions' })).toBeInTheDocument();
    expect(suggestionNames()).toEqual(['Add Transport']);
  });

  it('keyboard: Enter on Add Rent adds it', async () => {
    const result = renderApp({ path: '/plan' });
    screen.getByRole('button', { name: 'Add Rent' }).focus();
    await result.user.keyboard('{Enter}');
    expect(stored(result).categories.map((c) => c.name)).toEqual(['Rent']);
    expect(plannedField(1)).toHaveFocus();
  });

  it('suggestion action error (total too large) appears in one action-error paragraph after the list; no row added', async () => {
    const { user } = renderWithFakeBudget(<PlanPage />, { state: EMPTY_STATE, actions: allThrow(tooLarge) });
    await user.click(screen.getByRole('button', { name: 'Add Rent' }));
    const errors = actionErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toHaveAttribute('role', 'alert');
    expect(errors[0]?.textContent).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(errors[0]?.previousElementSibling?.tagName).toBe('UL');
    expect(screen.queryByRole('textbox', { name: 'Category 1 name' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Rent' })).toBeInTheDocument();
  });

  it('suggestion action error (other) shows the generic message', async () => {
    const { user } = renderWithFakeBudget(<PlanPage />, { state: EMPTY_STATE, actions: allThrow(boom) });
    await user.click(screen.getByRole('button', { name: 'Add Rent' }));
    expect(actionErrors().map((e) => e.textContent)).toEqual([GENERIC]);
  });

  it('suggestion action error clears on the next successful click', async () => {
    const { user } = renderWithFakeBudget(<PlanPage />, {
      state: EMPTY_STATE,
      actions: { addCategory: ((): (() => string) => {
        let used = false;
        return () => {
          if (!used) {
            used = true;
            throw new Error('boom');
          }
          return 'fake';
        };
      })() },
    });
    await user.click(screen.getByRole('button', { name: 'Add Rent' }));
    expect(actionErrors()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Add Rent' }));
    expect(actionErrors()).toHaveLength(0);
  });
});

describe('Add category dialog', () => {
  it('Add category opens the dialog with focus in Name and both fields empty', async () => {
    const { user } = renderApp({ path: '/plan' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(addCategoryButton());
    expect(dialog()).toBeInTheDocument();
    expect(dName()).toHaveFocus();
    expect(dName()).toHaveValue('');
    expect(dPlanned()).toHaveValue('');
    expect(within(dialog()).getByText('Optional. Leave empty for $0.00.')).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('Name empty: Enter a category name on Name, focus on Name, dialog open, nothing stored', async () => {
    const result = renderApp({ path: '/plan' });
    await result.user.click(addCategoryButton());
    await result.user.type(dPlanned(), '5');
    await result.user.click(save());
    expect(errorText(dName())).toBe('Enter a category name');
    expect(dName()).toHaveAttribute('aria-invalid', 'true');
    expect(dName()).toHaveFocus();
    expect(dialog()).toBeInTheDocument();
    expect(result.storage.setItemCalls).toBe(0);
    expect(actionErrors()).toHaveLength(0);
  });

  it('Name of only spaces counts as blank', async () => {
    const result = renderApp({ path: '/plan' });
    await result.user.click(addCategoryButton());
    await result.user.type(dName(), '   ');
    await result.user.click(save());
    expect(errorText(dName())).toBe('Enter a category name');
    expect(result.storage.setItemCalls).toBe(0);
  });

  it('Name rent while Rent exists: duplicate error on Name with focus, nothing stored', async () => {
    const result = renderApp({ state: SCENARIO, path: '/plan' });
    await result.user.click(addCategoryButton());
    await result.user.type(dName(), 'rent');
    await result.user.click(save());
    expect(errorText(dName())).toBe('You already have a category called Rent');
    expect(dName()).toHaveFocus();
    expect(dialog()).toBeInTheDocument();
    expect(stored(result).categories).toHaveLength(5);
    expect(result.storage.setItemCalls).toBe(0);
  });

  it('a duplicate differing by trailing space is still a duplicate', async () => {
    const result = renderApp({ state: SCENARIO, path: '/plan' });
    await result.user.click(addCategoryButton());
    await result.user.type(dName(), ' EATING OUT ');
    await result.user.click(save());
    expect(errorText(dName())).toBe('You already have a category called Eating out');
    expect(stored(result).categories).toHaveLength(5);
  });

  it('editing Name clears its error', async () => {
    const { user } = renderApp({ path: '/plan' });
    await user.click(addCategoryButton());
    await user.click(save());
    expect(errorOf(dName())).not.toBeNull();
    await user.type(dName(), 'P');
    expect(errorOf(dName())).toBeNull();
  });

  it('Pets with Planned empty closes the dialog, returns focus to Add category, stores Pets at 0', async () => {
    const result = renderApp({ path: '/plan' });
    await result.user.click(addCategoryButton());
    await result.user.type(dName(), 'Pets');
    await result.user.click(save());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(addCategoryButton()).toHaveFocus();
    expect(stored(result).categories).toEqual([expect.objectContaining({ name: 'Pets', plannedCents: 0 })]);
    expect(stored(result).categories).toHaveLength(1);
    expect(nameField(1)).toHaveValue('Pets');
  });

  it('Gifts with Planned 25.50 stores exactly 2550 integer cents', async () => {
    const result = renderApp({ path: '/plan' });
    await result.user.click(addCategoryButton());
    await result.user.type(dName(), 'Gifts');
    await result.user.type(dPlanned(), '25.50');
    await result.user.click(save());
    const cents = stored(result).categories[0]?.plannedCents;
    expect(cents).toBe(2550);
    expect(Number.isInteger(cents)).toBe(true);
  });

  it('the name is trimmed when stored', async () => {
    const result = renderApp({ path: '/plan' });
    await result.user.click(addCategoryButton());
    await result.user.type(dName(), '  Pets  ');
    await result.user.click(save());
    expect(stored(result).categories[0]?.name).toBe('Pets');
  });

  // user-event cannot model implicit submission when the submit button sits outside the form
  // (form="..." attribute), so Enter-to-submit is a manual browser check. This pins the wiring.
  it('Save category is a submit button associated with the dialog form (so Enter submits in a browser)', async () => {
    const { user } = renderApp({ path: '/plan' });
    await user.click(addCategoryButton());
    const form = dialog().querySelector('form');
    expect(form).not.toBeNull();
    expect(form).toHaveAttribute('novalidate');
    expect(save()).toHaveAttribute('type', 'submit');
    expect(save()).toHaveAttribute('form', form?.id ?? 'missing');
    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toHaveAttribute('type', 'button');
  });

  it('Cancel closes without storing, returns focus to Add category, and reopening shows empty fields', async () => {
    const result = renderApp({ path: '/plan' });
    await result.user.click(addCategoryButton());
    await result.user.type(dName(), 'Pets');
    await result.user.type(dPlanned(), '9');
    await result.user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(addCategoryButton()).toHaveFocus();
    expect(result.storage.setItemCalls).toBe(0);
    await result.user.click(addCategoryButton());
    expect(dName()).toHaveValue('');
    expect(dPlanned()).toHaveValue('');
    expect(dName()).toHaveFocus();
  });

  it('Esc closes without storing and reopening shows empty fields and no errors', async () => {
    const result = renderApp({ path: '/plan' });
    await result.user.click(addCategoryButton());
    await result.user.click(save());
    expect(errorOf(dName())).not.toBeNull();
    await result.user.type(dName(), 'Pets');
    await result.user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(result.storage.setItemCalls).toBe(0);
    await result.user.click(addCategoryButton());
    expect(dName()).toHaveValue('');
    expect(errorOf(dName())).toBeNull();
    expect(dPlanned()).toHaveValue('');
  });

  it('fields are empty on the next open after a successful save', async () => {
    const { user } = renderApp({ path: '/plan' });
    await user.click(addCategoryButton());
    await user.type(dName(), 'Pets');
    await user.type(dPlanned(), '5');
    await user.click(save());
    await user.click(addCategoryButton());
    expect(dName()).toHaveValue('');
    expect(dPlanned()).toHaveValue('');
  });

  it('seeded with 90 categories at MAX_CENTS, Big at 999999999999.99: total too large on Planned (USD), dialog open, nothing stored', async () => {
    const result = renderApp({ state: bigState(), path: '/plan' });
    await result.user.click(addCategoryButton());
    await result.user.type(dName(), 'Big');
    await result.user.type(dPlanned(), '999999999999.99');
    const before = result.storage.setItemCalls;
    await result.user.click(save());
    expect(errorText(dPlanned())).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(errorOf(dPlanned())).toHaveAttribute('role', 'alert');
    expect(actionErrors()).toHaveLength(0);
    expect(dialog()).toBeInTheDocument();
    expect(dName()).toHaveValue('Big');
    expect(dPlanned()).toHaveValue('999,999,999,999.99');
    expect(result.storage.setItemCalls).toBe(before);
    expect(stored(result).categories).toHaveLength(90);
  }, 30000);

  it('other error: generic message in the one action-error paragraph inside the dialog; values kept; dialog open', async () => {
    const { user } = renderWithFakeBudget(<PlanPage />, {
      state: SCENARIO,
      actions: { addCategory: boom },
    });
    await user.click(addCategoryButton());
    await user.type(dName(), 'Pets');
    await user.type(dPlanned(), '25');
    await user.click(save());
    const errors = actionErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toHaveAttribute('role', 'alert');
    expect(errors[0]?.tagName).toBe('P');
    expect(errors[0]?.textContent).toBe(GENERIC);
    expect(dialog()).toContainElement(errors[0] ?? null);
    expect(dName()).toHaveValue('Pets');
    expect(dPlanned()).toHaveValue('25.00');
    expect(errorOf(dName())).toBeNull();
    expect(errorOf(dPlanned())).toBeNull();
    await user.type(dName(), 's');
    expect(actionErrors()).toHaveLength(0);
  });

  it('a RangeError with another message is the generic message', async () => {
    const { user } = renderWithFakeBudget(<PlanPage />, { state: SCENARIO, actions: { addCategory: otherRange } });
    await user.click(addCategoryButton());
    await user.type(dName(), 'Pets');
    await user.click(save());
    expect(actionErrors().map((e) => e.textContent)).toEqual([GENERIC]);
    expect(errorOf(dPlanned())).toBeNull();
  });

  it('a total-too-large error on Planned clears when Planned is edited, and a later success closes the dialog', async () => {
    const { user, actions } = renderWithFakeBudget(<PlanPage />, {
      state: SCENARIO,
      actions: {
        addCategory: ((): BudgetActions['addCategory'] => {
          let used = false;
          return () => {
            if (!used) {
              used = true;
              throw new RangeError(TOTAL_TOO_LARGE_MESSAGE);
            }
            return 'fake-id';
          };
        })(),
      },
    });
    await user.click(addCategoryButton());
    await user.type(dName(), 'Pets');
    await user.type(dPlanned(), '25');
    await user.click(save());
    expect(errorText(dPlanned())).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(actions.addCategory).toHaveBeenCalledWith({ name: 'Pets', plannedCents: 2500 });
    await user.type(dPlanned(), '1');
    expect(errorOf(dPlanned())).toBeNull();
    await user.click(save());
    expect(actions.addCategory).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('repeated clicks on Save with a blank name never call addCategory', async () => {
    const { user, actions } = renderWithFakeBudget(<PlanPage />, { state: SCENARIO });
    await user.click(addCategoryButton());
    await user.click(save());
    await user.click(save());
    expect(actions.addCategory).not.toHaveBeenCalled();
  });

  it('the dialog money field is named Planned (USD)', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/plan' });
    await user.click(addCategoryButton());
    const money = within(dialog())
      .getAllByRole('textbox')
      .filter((i) => i.getAttribute('inputmode') === 'decimal');
    expect(money.map((i) => (i as HTMLInputElement).labels?.[0]?.textContent)).toEqual(['Planned (USD)']);
  });
});

describe('income card', () => {
  it('typing 3200 stores 320000; 1,500 stores 150000; 82.47 stores 8247; $40 stores 4000', async () => {
    for (const [typed, cents] of [
      ['3200', 320000],
      ['1,500', 150000],
      ['82.47', 8247],
      ['$40', 4000],
    ] as const) {
      const result = renderApp({ path: '/plan' });
      await result.user.type(incomeField(), typed);
      expect(result.readStored()?.incomeCents, typed).toBe(cents);
      expect(Number.isInteger(result.readStored()?.incomeCents)).toBe(true);
      result.unmount();
    }
  });

  it('stores on every change: typing 1200 ends at 120000', async () => {
    const { user, actions } = renderWithFakeBudget(<PlanPage />, { state: EMPTY_STATE });
    await user.type(incomeField(), '1200');
    expect(actions.setIncome).toHaveBeenCalledTimes(4);
    expect(actions.setIncome).toHaveBeenLastCalledWith(120000);
  });

  it('formats on blur: 3,200 then Tab shows 3,200.00', async () => {
    const result = renderApp({ path: '/plan' });
    await result.user.type(incomeField(), '3,200');
    await result.user.tab();
    expect(incomeField()).toHaveValue('3,200.00');
    expect(result.readStored()?.incomeCents).toBe(320000);
  });

  it('seeded income shows formatted and clearing it stores 0 and leaves the field empty', async () => {
    const result = renderApp({ state: SCENARIO, path: '/plan' });
    expect(incomeField()).toHaveValue('3,200.00');
    await result.user.clear(incomeField());
    expect(incomeField()).toHaveValue('');
    expect(result.readStored()?.incomeCents).toBe(0);
  });

  it('invalid 12.345 shows a field error on blur and 0 is stored', async () => {
    const result = renderApp({ path: '/plan' });
    await result.user.type(incomeField(), '12.345');
    await result.user.tab();
    expect(errorOf(incomeField())).not.toBeNull();
    expect(result.readStored()?.incomeCents).toBe(0);
  });

  it('total too large is shown on the income field; generic for other errors; clears on next edit', async () => {
    const a = renderWithFakeBudget(<PlanPage />, { state: SCENARIO, actions: allThrow(tooLarge) });
    await a.user.type(incomeField(), '5');
    expect(errorText(incomeField())).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(actionErrors()).toHaveLength(0);
    a.unmount();
    const b = renderWithFakeBudget(<PlanPage />, {
      state: SCENARIO,
      actions: { setIncome: failOnce(new Error('boom')) },
    });
    await b.user.type(incomeField(), '5');
    expect(errorText(incomeField())).toBe(GENERIC);
    await b.user.type(incomeField(), '6');
    expect(errorOf(incomeField())).toBeNull();
  });
});

describe('category rows with SCENARIO', () => {
  it('five rows with names and planned amounts, no suggestions', () => {
    renderApp({ state: SCENARIO, path: '/plan' });
    expect(rows()).toHaveLength(5);
    ['Rent', 'Groceries', 'Transport', 'Utilities', 'Eating out'].forEach((n, i) => {
      expect(nameField(i + 1)).toHaveValue(n);
    });
    expect([1, 2, 3, 4, 5].map((n) => plannedField(n).value)).toEqual([
      '1,500.00',
      '400.00',
      '120.00',
      '150.00',
      '100.00',
    ]);
    expect(screen.queryByRole('heading', { name: 'Suggestions' })).not.toBeInTheDocument();
  });

  it('each Remove button is ghost, md, and named Remove {category}', () => {
    renderApp({ state: SCENARIO, path: '/plan' });
    for (const name of SUGGESTED) {
      const button = screen.getByRole('button', { name: `Remove ${name}` });
      expect(button).toHaveAttribute('data-variant', 'ghost');
      expect(button).toHaveAttribute('data-size', 'md');
      expect(button).toHaveTextContent('Remove');
    }
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(5);
  });

  it('Remove names follow renames', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/plan' });
    await user.clear(nameField(1));
    await user.type(nameField(1), 'Home');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Remove Home' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Rent' })).not.toBeInTheDocument();
  });

  it('a blank-named category in state is labelled Unnamed category on its Remove button', () => {
    const state: BudgetState = { ...EMPTY_STATE, categories: [{ id: 'b', name: '', plannedCents: 0 }] };
    renderApp({ state, path: '/plan' });
    expect(screen.getByRole('button', { name: 'Remove Unnamed category' })).toBeInTheDocument();
  });

  it('the only money textboxes are the income and the five planned fields', () => {
    renderApp({ state: SCENARIO, path: '/plan' });
    const money = (screen.getAllByRole('textbox') as HTMLInputElement[]).filter(
      (i) => i.getAttribute('inputmode') === 'decimal',
    );
    const labels = money.map((i) => i.labels?.[0]?.textContent);
    expect(labels).toEqual([
      'Monthly income (USD)',
      ...[1, 2, 3, 4, 5].map((n) => `Category ${n} planned (USD)`),
    ]);
  });

  it('planned edits store exact cents for one row only', async () => {
    const result = renderApp({ state: SCENARIO, path: '/plan' });
    await result.user.clear(plannedField(2));
    await result.user.type(plannedField(2), '82.47');
    const s = stored(result);
    expect(s.categories[1]?.plannedCents).toBe(8247);
    expect(s.categories[0]?.plannedCents).toBe(150000);
    expect(s.incomeCents).toBe(320000);
  });

  it('clearing a planned field stores 0 and stays empty', async () => {
    const result = renderApp({ state: SCENARIO, path: '/plan' });
    await result.user.clear(plannedField(1));
    expect(plannedField(1)).toHaveValue('');
    expect(stored(result).categories[0]?.plannedCents).toBe(0);
  });

  it('rename saves on blur only, trimmed, keeping id, planned and expenses', async () => {
    const result = renderApp({ state: SCENARIO, path: '/plan' });
    await result.user.clear(nameField(2));
    await result.user.type(nameField(2), '  Food ');
    expect(stored(result).categories[1]?.name).toBe('Groceries');
    await result.user.tab();
    const c = stored(result).categories[1];
    expect(c).toEqual({ id: 'suggested-groceries', name: 'Food', plannedCents: 40000 });
    expect(nameField(2)).toHaveValue('Food');
    expect(stored(result).expenses).toEqual(SCENARIO.expenses);
  });

  it('duplicate rename: live error, on blur reverts with "{problem}. The name is still {name}." and nothing is saved', async () => {
    const result = renderApp({ state: SCENARIO, path: '/plan' });
    await result.user.clear(nameField(2));
    await result.user.type(nameField(2), 'rent');
    expect(errorText(nameField(2))).toBe('You already have a category called Rent');
    await result.user.tab();
    expect(nameField(2)).toHaveValue('Groceries');
    expect(errorText(nameField(2))).toBe('You already have a category called Rent. The name is still Groceries.');
    expect(stored(result).categories.map((c) => c.name)).toEqual(SUGGESTED);
  });

  it('blank rename reverts with "Enter a category name. The name is still {name}."', async () => {
    const result = renderApp({ state: SCENARIO, path: '/plan' });
    await result.user.clear(nameField(3));
    await result.user.tab();
    expect(nameField(3)).toHaveValue('Transport');
    expect(errorText(nameField(3))).toBe('Enter a category name. The name is still Transport.');
    expect(stored(result).categories[2]?.name).toBe('Transport');
  });

  it('renaming a category to its own name in another case is allowed', async () => {
    const result = renderApp({ state: SCENARIO, path: '/plan' });
    await result.user.clear(nameField(1));
    await result.user.type(nameField(1), 'RENT');
    await result.user.tab();
    expect(stored(result).categories[0]?.name).toBe('RENT');
    expect(errorOf(nameField(1))).toBeNull();
  });

  it('blur without an edit saves nothing', async () => {
    const result = renderApp({ state: SCENARIO, path: '/plan' });
    nameField(1).focus();
    await result.user.tab();
    expect(result.storage.setItemCalls).toBe(0);
  });

  it('rename failing: error on the name field, field reverts; other rows unaffected', async () => {
    const { user } = renderWithFakeBudget(<PlanPage />, { state: SCENARIO, actions: allThrow(boom) });
    await user.type(nameField(2), 'x');
    await user.tab();
    expect(errorText(nameField(2))).toBe(GENERIC);
    expect(nameField(2)).toHaveValue('Groceries');
    expect(errorOf(nameField(1))).toBeNull();
    expect(errorOf(plannedField(2))).toBeNull();
  });

  it('planned edit failing: total too large and generic land on that row planned field only', async () => {
    const a = renderWithFakeBudget(<PlanPage />, { state: SCENARIO, actions: allThrow(tooLarge) });
    await a.user.type(plannedField(1), '1');
    expect(errorText(plannedField(1))).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(errorOf(plannedField(2))).toBeNull();
    expect(actionErrors()).toHaveLength(0);
    a.unmount();
    const b = renderWithFakeBudget(<PlanPage />, { state: SCENARIO, actions: allThrow(boom) });
    await b.user.type(plannedField(3), '1');
    expect(errorText(plannedField(3))).toBe(GENERIC);
  });
});

describe('remove', () => {
  it('Remove Groceries: no confirmation, four rows, expenses kept, focus on Remove Transport', async () => {
    const result = renderApp({ state: SCENARIO, path: '/plan' });
    await result.user.click(screen.getByRole('button', { name: 'Remove Groceries' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(rows()).toHaveLength(4);
    expect(stored(result).categories.map((c) => c.name)).toEqual(['Rent', 'Transport', 'Utilities', 'Eating out']);
    expect(stored(result).expenses).toEqual(SCENARIO.expenses);
    expect(screen.getByRole('button', { name: 'Remove Transport' })).toHaveFocus();
  });

  it('Overview shows the removed-categories line after a removal', async () => {
    const result = renderApp({ state: SCENARIO, path: '/plan' });
    await result.user.click(screen.getByRole('button', { name: 'Remove Groceries' }));
    result.goTo('/');
    expect(screen.getByText(/The Spent total includes \$82\.47 from removed categories/)).toBeInTheDocument();
  });

  it('removing the first row focuses the next row Remove', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/plan' });
    await user.click(screen.getByRole('button', { name: 'Remove Rent' }));
    expect(screen.getByRole('button', { name: 'Remove Groceries' })).toHaveFocus();
  });

  it('removing the last row focuses the previous row Remove', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/plan' });
    await user.click(screen.getByRole('button', { name: 'Remove Eating out' }));
    expect(screen.getByRole('button', { name: 'Remove Utilities' })).toHaveFocus();
  });

  it('removing the only row shows the empty line and focuses Add category', async () => {
    const result = renderApp({ state: ONE_CATEGORY, path: '/plan' });
    await result.user.click(screen.getByRole('button', { name: 'Remove Only' }));
    expect(screen.getByText(EMPTY_LINE)).toBeInTheDocument();
    expect(addCategoryButton()).toHaveFocus();
    expect(stored(result).categories).toHaveLength(0);
  });

  it('keyboard: Enter on Remove Transport removes it and focuses Remove Utilities', async () => {
    const result = renderApp({ state: SCENARIO, path: '/plan' });
    screen.getByRole('button', { name: 'Remove Transport' }).focus();
    await result.user.keyboard('{Enter}');
    expect(stored(result).categories.map((c) => c.name)).toEqual(['Rent', 'Groceries', 'Utilities', 'Eating out']);
    expect(screen.getByRole('button', { name: 'Remove Utilities' })).toHaveFocus();
  });

  it('rows keep their own drafts when an earlier row is removed', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/plan' });
    await user.clear(plannedField(3));
    await user.type(plannedField(3), '7.');
    await user.click(screen.getByRole('button', { name: 'Remove Rent' }));
    expect(plannedField(2)).toHaveValue('7.00');
    expect(nameField(2)).toHaveValue('Transport');
  });

  it('Remove error: action-error paragraph in that row, row stays, focus stays on the button', async () => {
    const { user } = renderWithFakeBudget(<PlanPage />, { state: SCENARIO, actions: allThrow(tooLarge) });
    const button = screen.getByRole('button', { name: 'Remove Groceries' });
    await user.click(button);
    const errors = actionErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toHaveAttribute('role', 'alert');
    expect(errors[0]?.textContent).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(button.closest('li')).toContainElement(errors[0] ?? null);
    expect(button.nextElementSibling).toBe(errors[0]);
    expect(rows()).toHaveLength(5);
    expect(button).toHaveFocus();
  });

  it('Remove unexpected error shows the generic message and clears on the next successful remove', async () => {
    const { user } = renderWithFakeBudget(<PlanPage />, {
      state: SCENARIO,
      actions: { removeCategory: failOnce(new Error('boom')) },
    });
    await user.click(screen.getByRole('button', { name: 'Remove Groceries' }));
    expect(actionErrors().map((e) => e.textContent)).toEqual([GENERIC]);
    await user.click(screen.getByRole('button', { name: 'Remove Groceries' }));
    expect(actionErrors()).toHaveLength(0);
  });
});

function Probe(): ReactElement {
  const budget = useBudget();
  if (budget.status !== 'ready') return <p>loading</p>;
  return (
    <>
      <button type="button" onClick={() => budget.viewMonth('2026-10')}>
        probe october
      </button>
      <button type="button" onClick={() => budget.actions.deleteAllData()}>
        probe delete
      </button>
    </>
  );
}

describe('drafts reset on month or generation change', () => {
  it('typing 9 in income without leaving, then switching to October shows 3,000.00', async () => {
    const { user } = renderWithBudget(
      <>
        <Probe />
        <PlanPage />
      </>,
      { book: BOOK },
    );
    await user.clear(incomeField());
    await user.type(incomeField(), '9');
    expect(incomeField()).toHaveValue('9');
    await user.click(screen.getByRole('button', { name: 'probe october' }));
    expect(incomeField()).toHaveValue('3,000.00');
  });

  it('a category name draft is reset by the month switch', async () => {
    const { user } = renderWithBudget(
      <>
        <Probe />
        <PlanPage />
      </>,
      { book: BOOK },
    );
    await user.type(nameField(1), 'zzz');
    await user.click(screen.getByRole('button', { name: 'probe october' }));
    expect(nameField(1)).toHaveValue('Rent');
  });

  it('deleting all data resets the drafts (generation change)', async () => {
    const { user } = renderWithBudget(
      <>
        <Probe />
        <PlanPage />
      </>,
      { state: SCENARIO },
    );
    await user.type(incomeField(), '9');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'probe delete' }));
    });
    expect(incomeField()).toHaveValue('');
    expect(screen.queryByRole('textbox', { name: 'Category 1 name' })).not.toBeInTheDocument();
  });
});

describe('keyboard only', () => {
  it('Tab from income reaches Add category, then each row (name, planned, Remove), then the suggestions', async () => {
    const { user } = renderApp({
      state: { ...EMPTY_STATE, categories: [{ id: 'a', name: 'Pets', plannedCents: 0 }] },
      path: '/plan',
    });
    incomeField().focus();
    await user.tab();
    expect(addCategoryButton()).toHaveFocus();
    await user.tab();
    expect(nameField(1)).toHaveFocus();
    await user.tab();
    expect(plannedField(1)).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Remove Pets' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Add Rent' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Add Groceries' })).toHaveFocus();
  });

  it('whole dialog flow by keyboard: Enter on Add category, type, Tab to Save, Enter', async () => {
    const result = renderApp({ path: '/plan' });
    addCategoryButton().focus();
    await result.user.keyboard('{Enter}');
    await result.user.keyboard('Pets');
    await result.user.tab(); // Planned
    await result.user.tab(); // Cancel
    await result.user.tab(); // Save
    expect(save()).toHaveFocus();
    await result.user.keyboard('{Enter}');
    expect(stored(result).categories.map((c) => c.name)).toEqual(['Pets']);
    expect(addCategoryButton()).toHaveFocus();
  });
});

describe('accessibility', () => {
  it('axe: empty state', async () => {
    renderApp({ path: '/plan' });
    await expectNoAxeViolations();
  });
  it('axe: SCENARIO', async () => {
    renderApp({ state: SCENARIO, path: '/plan' });
    await expectNoAxeViolations();
  });
  it('axe: dialog open', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/plan' });
    await user.click(addCategoryButton());
    await expectNoAxeViolations();
  });
  it('axe: dialog with a name error', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/plan' });
    await user.click(addCategoryButton());
    await user.click(save());
    expect(errorOf(dName())).not.toBeNull();
    await expectNoAxeViolations();
  });
  it('axe: dialog with a planned error and one with an action error', async () => {
    const a = renderApp({ state: bigState(), path: '/plan' });
    await a.user.click(addCategoryButton());
    await a.user.type(dName(), 'Big');
    await a.user.type(dPlanned(), '999999999999.99');
    await a.user.click(save());
    expect(errorOf(dPlanned())).not.toBeNull();
    await expectNoAxeViolations();
    a.unmount();
    const b = renderWithFakeBudget(<PlanPage />, { state: SCENARIO, actions: { addCategory: boom } });
    await b.user.click(addCategoryButton());
    await b.user.type(dName(), 'Pets');
    await b.user.click(save());
    expect(actionErrors()).toHaveLength(1);
    await expectNoAxeViolations();
  }, 30000);
});

describe('source rules for features/plan', () => {
  const dir = join(import.meta.dirname);
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
  const source = (f: string): string => readFileSync(join(dir, f), 'utf8');

  const ALLOWED_PLAIN =
    /^(?:sm:)?(?:flex(?:-[a-z]+)?|grid(?:-cols-\d+)?|gap-\d+|gap-[xy]-\d+|p[xytrbl]?-\d+|m[xytrbl]?-\d+|max-w-[\w[\].-]+|w-full|items-[a-z]+|justify-[a-z]+|list-none|text-2xl|font-semibold|text-text|text-text-muted)$/;
  const ALLOWED_LIB = /^(?:w-full|self-[a-z]+|justify-self-[a-z]+|col-span-\d+)$/;

  it('the five component files and the page exist, and features/setup is gone', () => {
    for (const f of ['PlanPage', 'IncomeCard', 'CategoriesCard', 'CategoryRow', 'AddCategoryDialog', 'Suggestions']) {
      expect(files, f).toContain(`${f}.tsx`);
    }
    expect(existsSync(join(dir, '..', 'setup'))).toBe(false);
  });

  it('every className token is in the allowed Tailwind set (plain elements) or the library set; multi-column grids are behind sm:', () => {
    for (const f of files) {
      const code = source(f);
      for (const m of code.matchAll(/<([A-Za-z][\w]*)\b[^<>]*?\bclassName=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const tag = m[1] ?? '';
        const tokens = (m[2] ?? m[3] ?? '').split(/\s+/).filter(Boolean);
        const library = /^[A-Z]/.test(tag);
        for (const token of tokens) {
          expect(token, `${f} <${tag}>`).toMatch(library ? ALLOWED_LIB : ALLOWED_PLAIN);
          const cols = /^grid-cols-(\d+)$/.exec(token);
          if (cols !== null) expect(Number(cols[1]) === 1, `${f}: ${token} must be behind sm:`).toBe(true);
        }
      }
    }
  });

  it('no style prop, native controls, live regions, any or ts-ignore', () => {
    for (const f of files) {
      const code = source(f);
      expect(code, f).not.toMatch(/\sstyle=/);
      expect(code, f).not.toMatch(/<(button|input|select|textarea|table|dialog|a)[\s>]/);
      expect(code, f).not.toMatch(/role="status"|aria-live/);
      expect(code, f).not.toMatch(/\bany\b|@ts-ignore|@ts-expect-error/);
      expect(code, f).not.toMatch(/parseFloat|toFixed|\* 100|\/ 100/);
    }
  });

  it('only components that need it start with use client; every call to actions is inside a try block', () => {
    for (const f of files.filter((n) => n !== 'actionMessage.ts')) {
      expect(source(f).startsWith("'use client';"), f).toBe(true);
    }
    for (const f of files) {
      const code = source(f);
      for (const m of code.matchAll(/actions\.(\w+)\(/g)) {
        const before = code.slice(0, m.index);
        const lastTry = before.lastIndexOf('try {');
        const lastCatch = before.lastIndexOf('} catch');
        expect(lastTry > lastCatch && lastTry !== -1, `${f}: actions.${m[1]} not in try`).toBe(true);
      }
    }
  });
});
