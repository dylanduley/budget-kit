import { act, fireEvent, screen, within } from '@testing-library/react';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { UserEvent } from '@testing-library/user-event';
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
async function selectAll(user: UserEvent, input: HTMLElement): Promise<void> {
  await user.click(input);
  await user.keyboard('{Control>}a{/Control}');
}
async function replaceWith(user: UserEvent, input: HTMLElement, text: string): Promise<void> {
  await selectAll(user, input);
  await user.keyboard(text);
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
    await replaceWith(user, dPlanned(), '1');
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

  it('invalid 12.345 shows a field error and keeps the last valid keystroke (1234) instead of storing 0', async () => {
    const result = renderApp({ path: '/plan' });
    await result.user.type(incomeField(), '12.345');
    expect(errorOf(incomeField())).not.toBeNull();
    expect(result.readStored()?.incomeCents).toBe(1234);
    await result.user.tab();
    expect(errorOf(incomeField())).not.toBeNull();
    expect(result.readStored()?.incomeCents).toBe(1234);
  });

  it('total too large is shown on the income field; generic for other errors; clears on next edit', async () => {
    const a = renderWithFakeBudget(<PlanPage />, { state: SCENARIO, actions: allThrow(tooLarge) });
    await replaceWith(a.user, incomeField(), '5');
    expect(errorText(incomeField())).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(actionErrors()).toHaveLength(0);
    a.unmount();
    const b = renderWithFakeBudget(<PlanPage />, {
      state: SCENARIO,
      actions: { setIncome: failOnce(new Error('boom')) },
    });
    await replaceWith(b.user, incomeField(), '5');
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
    await replaceWith(a.user, plannedField(1), '1');
    expect(errorText(plannedField(1))).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(errorOf(plannedField(2))).toBeNull();
    expect(actionErrors()).toHaveLength(0);
    a.unmount();
    const b = renderWithFakeBudget(<PlanPage />, { state: SCENARIO, actions: allThrow(boom) });
    await replaceWith(b.user, plannedField(3), '1');
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

describe('invalid money text is not saved (app task 26)', () => {
  const INVALID = 'Enter an amount like 12.50';
  const TOO_BIG = 'Amount is too large';
  const NEGATIVE = "Amount can't be negative";

  describe('income field', () => {
    it('stray keystroke: 3,200.00x shows the error before blur, keeps 320000, saves nothing, and survives Tab', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      const before = result.storage.setItemCalls;
      await result.user.type(incomeField(), 'x');
      expect(incomeField()).toHaveValue('3,200.00x');
      expect(errorText(incomeField())).toBe(INVALID);
      expect(errorOf(incomeField())).toHaveAttribute('role', 'alert');
      expect(incomeField()).toHaveAttribute('aria-invalid', 'true');
      expect(incomeField()).toHaveAccessibleDescription(new RegExp(INVALID));
      expect(incomeField()).toHaveFocus();
      expect(stored(result).incomeCents).toBe(320000);
      expect(result.storage.setItemCalls).toBe(before);
      await result.user.tab();
      expect(incomeField()).toHaveValue('3,200.00x');
      expect(errorText(incomeField())).toBe(INVALID);
      expect(stored(result).incomeCents).toBe(320000);
      expect(result.storage.setItemCalls).toBe(before);
    });

    it('fixing it: Backspace clears the error and aria-invalid without blur, field shows 3,200.00, stored 320000', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await result.user.type(incomeField(), 'x');
      await result.user.keyboard('{Backspace}');
      expect(incomeField()).toHaveValue('3,200.00');
      expect(errorOf(incomeField())).toBeNull();
      expect(incomeField()).not.toHaveAttribute('aria-invalid', 'true');
      expect(stored(result).incomeCents).toBe(320000);
    });

    it.each([
      ['abc', INVALID, 'paste'],
      ['1,2,3', INVALID, 'paste'],
      ['1000000000000', TOO_BIG, 'paste'],
      ['1234567890123', TOO_BIG, 'paste'],
      ['-', INVALID, 'type'],
      ['-5', NEGATIVE, 'type'],
    ] as const)('example: select all and enter %s shows the error at once and stored stays 320000', async (text, message, how) => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      const before = result.storage.setItemCalls;
      await selectAll(result.user, incomeField());
      if (how === 'paste') await result.user.paste(text);
      else await result.user.keyboard(text);
      expect(incomeField()).toHaveValue(text);
      expect(errorText(incomeField())).toBe(message);
      expect(incomeField()).toHaveAttribute('aria-invalid', 'true');
      expect(stored(result).incomeCents).toBe(320000);
      expect(result.storage.setItemCalls).toBe(before);
    });

    it('invalid 12.345 typed over a saved value keeps the last valid keystroke (1234) and shows the error, never 0', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await replaceWith(result.user, incomeField(), '12.345');
      expect(incomeField()).toHaveValue('12.345');
      expect(errorText(incomeField())).toBe(INVALID);
      expect(stored(result).incomeCents).toBe(1234);
    });

    it('example: paste 1,2,3 and paste 1000000000000 over the saved income keep 320000 and write nothing', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      const before = result.storage.setItemCalls;
      await selectAll(result.user, incomeField());
      await result.user.paste('1,2,3');
      expect(incomeField()).toHaveValue('1,2,3');
      expect(errorText(incomeField())).toBe(INVALID);
      await selectAll(result.user, incomeField());
      await result.user.paste('1000000000000');
      expect(incomeField()).toHaveValue('1000000000000');
      expect(errorText(incomeField())).toBe(TOO_BIG);
      expect(stored(result).incomeCents).toBe(320000);
      expect(result.storage.setItemCalls).toBe(before);
    });

    it('example: select all and type 45 stores 4500 with no error; clearing stores 0 with no error', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await replaceWith(result.user, incomeField(), '45');
      expect(incomeField()).toHaveValue('45');
      expect(errorOf(incomeField())).toBeNull();
      expect(stored(result).incomeCents).toBe(4500);
      await result.user.clear(incomeField());
      expect(incomeField()).toHaveValue('');
      expect(errorOf(incomeField())).toBeNull();
      expect(incomeField()).not.toHaveAttribute('aria-invalid', 'true');
      expect(stored(result).incomeCents).toBe(0);
    });

    it('recovering from invalid to valid text clears the error and saves the new amount', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await replaceWith(result.user, incomeField(), 'abc');
      expect(errorText(incomeField())).toBe(INVALID);
      await replaceWith(result.user, incomeField(), '77.5');
      expect(errorOf(incomeField())).toBeNull();
      expect(stored(result).incomeCents).toBe(7750);
    });

    it('invalid text keeps the previously stored value even when it was typed from empty (no 0 written)', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await replaceWith(result.user, incomeField(), '45');
      await result.user.type(incomeField(), 'z');
      expect(errorText(incomeField())).toBe(INVALID);
      expect(incomeField()).toHaveValue('45z');
      expect(stored(result).incomeCents).toBe(4500);
    });

    it('refresh restores the saved amount with no error', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await result.user.type(incomeField(), 'x');
      result.unmount();
      const again = renderApp({ state: stored(result), storage: result.storage, path: '/plan' });
      expect(incomeField()).toHaveValue('3,200.00');
      expect(errorOf(incomeField())).toBeNull();
      expect(stored(again).incomeCents).toBe(320000);
    });

    it('invalid income never calls setIncome; the next valid text calls it once with 500', async () => {
      const { user, actions } = renderWithFakeBudget(<PlanPage />, { state: SCENARIO });
      await replaceWith(user, incomeField(), 'abc');
      expect(actions.setIncome).toHaveBeenCalledTimes(0);
      await replaceWith(user, incomeField(), '5');
      expect(actions.setIncome).toHaveBeenCalledTimes(1);
      expect(actions.setIncome).toHaveBeenCalledWith(500);
    });

    it('action error then invalid text: the library error replaces it, no extra call, and Backspace saves again and shows the action error', async () => {
      const { user, actions } = renderWithFakeBudget(<PlanPage />, {
        state: SCENARIO,
        actions: { setIncome: tooLarge },
      });
      await replaceWith(user, incomeField(), '5');
      expect(errorText(incomeField())).toBe(TOTAL_TOO_LARGE_MESSAGE);
      expect(actions.setIncome).toHaveBeenCalledTimes(1);
      await user.keyboard('x');
      expect(incomeField()).toHaveValue('5x');
      expect(errorText(incomeField())).toBe(INVALID);
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(actions.setIncome).toHaveBeenCalledTimes(1);
      await user.keyboard('{Backspace}');
      expect(actions.setIncome).toHaveBeenCalledTimes(2);
      expect(actions.setIncome).toHaveBeenLastCalledWith(500);
      expect(errorText(incomeField())).toBe(TOTAL_TOO_LARGE_MESSAGE);
    });

    it('totals elsewhere unchanged: a stray x then Overview still shows Income $3,200.00 and Left to spend $1,505.18', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await result.user.type(incomeField(), 'x');
      await result.user.click(screen.getByRole('link', { name: 'Overview' }));
      const stat = (label: string): HTMLElement =>
        screen.getByText(label, { selector: '[data-part="label"]' }).parentElement as HTMLElement;
      expect(within(stat('Income')).getByText('$3,200.00')).toBeInTheDocument();
      expect(within(stat('Left to spend')).getByText('$1,505.18')).toBeInTheDocument();
      expect(within(stat('Spent')).getByText('$1,694.82')).toBeInTheDocument();
    });
  });

  describe('category planned fields', () => {
    it.each([
      ['abc', INVALID],
      ['1,2,3', INVALID],
      ['12.345', INVALID],
      ['1000000000000', TOO_BIG],
    ])('Rent planned: select all and paste %s shows the error before blur and saves nothing', async (text, message) => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      const before = result.storage.setItemCalls;
      await selectAll(result.user, plannedField(1));
      await result.user.paste(text);
      expect(plannedField(1)).toHaveValue(text);
      expect(errorText(plannedField(1))).toBe(message);
      expect(plannedField(1)).toHaveAttribute('aria-invalid', 'true');
      expect(stored(result).categories[0]?.plannedCents).toBe(150000);
      expect(result.storage.setItemCalls).toBe(before);
      await result.user.tab();
      expect(plannedField(1)).toHaveValue(text);
      expect(errorText(plannedField(1))).toBe(message);
      expect(stored(result).categories[0]?.plannedCents).toBe(150000);
    });

    it('invalid text in one row leaves every other row and the income untouched', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await replaceWith(result.user, plannedField(3), 'abc');
      expect(errorText(plannedField(3))).toBe(INVALID);
      expect(errorOf(plannedField(2))).toBeNull();
      expect(stored(result).categories.map((c) => c.plannedCents)).toEqual([150000, 40000, 12000, 15000, 10000]);
      expect(stored(result).incomeCents).toBe(320000);
    });

    it('a stray keystroke in a saved planned field keeps its stored cents, and Backspace clears the error', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await result.user.type(plannedField(2), 'x');
      expect(plannedField(2)).toHaveValue('400.00x');
      expect(errorText(plannedField(2))).toBe(INVALID);
      expect(stored(result).categories[1]?.plannedCents).toBe(40000);
      await result.user.keyboard('{Backspace}');
      expect(errorOf(plannedField(2))).toBeNull();
      expect(stored(result).categories[1]?.plannedCents).toBe(40000);
    });

    it('recovering to valid text clears the error and saves exactly that row', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await replaceWith(result.user, plannedField(4), '-');
      expect(errorText(plannedField(4))).toBe(INVALID);
      await replaceWith(result.user, plannedField(4), '82.47');
      expect(errorOf(plannedField(4))).toBeNull();
      expect(stored(result).categories.map((c) => c.plannedCents)).toEqual([150000, 40000, 12000, 8247, 10000]);
    });

    it('clearing a planned field is empty, not invalid: no error and 0 stored for that row only', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await result.user.clear(plannedField(2));
      expect(errorOf(plannedField(2))).toBeNull();
      expect(stored(result).categories.map((c) => c.plannedCents)).toEqual([150000, 0, 12000, 15000, 10000]);
    });

    it('typing 1,200 into a cleared Category 2: 100, 100, 100, 100, then 120000, with errors on the half-typed steps', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await result.user.clear(plannedField(2));
      const cents = (): number | undefined => stored(result).categories[1]?.plannedCents;
      await result.user.keyboard('1');
      expect(cents()).toBe(100);
      expect(errorOf(plannedField(2))).toBeNull();
      for (const [key, shown] of [
        [',', '1,'],
        ['2', '1,2'],
        ['0', '1,20'],
      ] as const) {
        await result.user.keyboard(key);
        expect(plannedField(2)).toHaveValue(shown);
        expect(errorText(plannedField(2))).toBe(INVALID);
        expect(cents()).toBe(100);
      }
      await result.user.keyboard('0');
      expect(plannedField(2)).toHaveValue('1,200');
      expect(errorOf(plannedField(2))).toBeNull();
      expect(cents()).toBe(120000);
    });

    it('invalid planned text never calls updateCategory; the next valid text calls it once', async () => {
      const { user, actions } = renderWithFakeBudget(<PlanPage />, { state: SCENARIO });
      await replaceWith(user, plannedField(2), '-');
      expect(actions.updateCategory).toHaveBeenCalledTimes(0);
      await replaceWith(user, plannedField(2), '5');
      expect(actions.updateCategory).toHaveBeenCalledTimes(1);
      expect(actions.updateCategory).toHaveBeenCalledWith('suggested-groceries', { plannedCents: 500 });
    });

    it('a per-row action error (total too large) is replaced by the invalid-text error and returns on the next valid edit', async () => {
      const { user, actions } = renderWithFakeBudget(<PlanPage />, {
        state: SCENARIO,
        actions: { updateCategory: tooLarge },
      });
      await replaceWith(user, plannedField(1), '1');
      expect(errorText(plannedField(1))).toBe(TOTAL_TOO_LARGE_MESSAGE);
      await user.keyboard('x');
      expect(errorText(plannedField(1))).toBe(INVALID);
      expect(actions.updateCategory).toHaveBeenCalledTimes(1);
      await user.keyboard('{Backspace}');
      expect(actions.updateCategory).toHaveBeenCalledTimes(2);
      expect(errorText(plannedField(1))).toBe(TOTAL_TOO_LARGE_MESSAGE);
      expect(errorOf(plannedField(2))).toBeNull();
    });
  });

  describe('Add category dialog', () => {
    async function openWith(
      result: { user: UserEvent },
      name: string,
      planned: string,
    ): Promise<void> {
      await result.user.click(addCategoryButton());
      if (name !== '') await result.user.type(dName(), name);
      if (planned !== '') await result.user.type(dPlanned(), planned);
    }

    it('invalid Planned shows its error before blur; Save keeps the dialog open, adds nothing, focuses Planned', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await openWith(result, 'Pets', 'abc');
      expect(dPlanned()).toHaveAttribute('aria-invalid', 'true');
      expect(errorText(dPlanned())).toBe(INVALID);
      const before = result.storage.setItemCalls;
      await result.user.click(save());
      expect(dialog()).toBeInTheDocument();
      expect(dName()).toHaveValue('Pets');
      expect(dPlanned()).toHaveValue('abc');
      expect(dPlanned()).toHaveFocus();
      expect(errorText(dPlanned())).toBe(INVALID);
      expect(stored(result).categories.map((c) => c.name)).not.toContain('Pets');
      expect(result.storage.setItemCalls).toBe(before);
    });

    // jsdom cannot press Enter to submit (Save lives outside the form via form=), so submit the form directly.
    it('form submit (the Enter path) with invalid Planned: dialog stays, nothing added, focus moves to Planned', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await openWith(result, 'Pets', 'abc');
      await result.user.click(dName());
      expect(dName()).toHaveFocus();
      const before = result.storage.setItemCalls;
      const form = dialog().querySelector('form');
      expect(form).not.toBeNull();
      fireEvent.submit(form as HTMLFormElement);
      expect(dialog()).toBeInTheDocument();
      expect(dName()).toHaveValue('Pets');
      expect(dPlanned()).toHaveValue('abc');
      expect(dPlanned()).toHaveFocus();
      expect(errorText(dPlanned())).toBe(INVALID);
      expect(stored(result).categories.map((c) => c.name)).not.toContain('Pets');
      expect(result.storage.setItemCalls).toBe(before);
    });

    it('fake budget: abc and -5 never call addCategory; then 25 calls it once with Pets 2500 and closes', async () => {
      const { user, actions } = renderWithFakeBudget(<PlanPage />, { state: SCENARIO });
      await openWith({ user }, 'Pets', 'abc');
      await user.click(save());
      expect(actions.addCategory).toHaveBeenCalledTimes(0);
      await replaceWith(user, dPlanned(), '-5');
      expect(errorText(dPlanned())).toBe(NEGATIVE);
      await user.click(save());
      expect(actions.addCategory).toHaveBeenCalledTimes(0);
      expect(dialog()).toBeInTheDocument();
      await replaceWith(user, dPlanned(), '25');
      expect(errorOf(dPlanned())).toBeNull();
      await user.click(save());
      expect(actions.addCategory).toHaveBeenCalledTimes(1);
      expect(actions.addCategory).toHaveBeenCalledWith({ name: 'Pets', plannedCents: 2500 });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('too-large Planned text blocks Save too', async () => {
      const { user, actions } = renderWithFakeBudget(<PlanPage />, { state: SCENARIO });
      await openWith({ user }, 'Pets', '1000000000000');
      expect(errorText(dPlanned())).toBe(TOO_BIG);
      await user.click(save());
      expect(actions.addCategory).toHaveBeenCalledTimes(0);
      expect(dPlanned()).toHaveFocus();
    });

    it('name problem wins first: empty Name with Planned abc shows the Name error, focuses Name, adds nothing', async () => {
      const { user, actions } = renderWithFakeBudget(<PlanPage />, { state: SCENARIO });
      await openWith({ user }, '', 'abc');
      await user.click(save());
      expect(errorText(dName())).toBe('Enter a category name');
      expect(dName()).toHaveFocus();
      expect(actions.addCategory).toHaveBeenCalledTimes(0);
    });

    it('empty Planned still adds the category at $0.00 and closes the dialog', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await openWith(result, 'Pets', '');
      await result.user.click(save());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(stored(result).categories.find((c) => c.name === 'Pets')?.plannedCents).toBe(0);
    });

    it('Planned that was invalid then cleared is empty again and adds at 0', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await openWith(result, 'Pets', 'abc');
      await result.user.clear(dPlanned());
      expect(errorOf(dPlanned())).toBeNull();
      await result.user.click(save());
      expect(stored(result).categories.find((c) => c.name === 'Pets')?.plannedCents).toBe(0);
    });

    it('Planned 25 adds Pets at exactly 2500', async () => {
      const result = renderApp({ state: SCENARIO, path: '/plan' });
      await openWith(result, 'Pets', '25');
      await result.user.click(save());
      expect(stored(result).categories.find((c) => c.name === 'Pets')?.plannedCents).toBe(2500);
    });
  });

  describe('unchanged parts', () => {
    it('AddExpense and expenseForm sources are untouched since the plan commit', () => {
      const dir = join(__dirname, '..', 'expenses');
      expect(readFileSync(join(dir, 'AddExpense.tsx'), 'utf8')).not.toMatch(/validateOn/);
      expect(readFileSync(join(dir, 'expenseForm.ts'), 'utf8')).not.toMatch(/validateOn/);
    });

    it('README states the new behaviour and the old sentence is gone', () => {
      const readme = readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'docs', 'tasks', 'app', 'README.md'), 'utf8');
      expect(readme).toContain('invalid text is not saved and shows the library error at once (app task 26)');
      expect(readme).not.toContain('empty or invalid income/planned stores 0');
    });
  });

  describe('accessibility', () => {
    it('axe: income showing 3,200.00x and its error', async () => {
      const { user } = renderApp({ state: SCENARIO, path: '/plan' });
      await user.type(incomeField(), 'x');
      expect(errorText(incomeField())).toBe(INVALID);
      await expectNoAxeViolations();
    });

    it('axe: a planned row with invalid text after blur', async () => {
      const { user } = renderApp({ state: SCENARIO, path: '/plan' });
      await replaceWith(user, plannedField(1), '1,2,3');
      await user.tab();
      expect(errorText(plannedField(1))).toBe(INVALID);
      await expectNoAxeViolations();
    });

    it('axe: Add category dialog open showing the Planned error after Save', async () => {
      const { user } = renderApp({ state: SCENARIO, path: '/plan' });
      await user.click(addCategoryButton());
      await user.type(dName(), 'Pets');
      await user.type(dPlanned(), 'abc');
      await user.click(save());
      expect(errorText(dPlanned())).toBe(INVALID);
      await expectNoAxeViolations();
    });
  });
});
