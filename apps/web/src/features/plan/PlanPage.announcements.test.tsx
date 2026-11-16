import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { BudgetState } from '@/lib/budget';
import { recordFocus, statusText } from '@/test/announcements';
import { SCENARIO } from '@/test/fixtures';
import { renderApp } from '@/test/renderApp';
import { renderWithBudget } from '@/test/renderWithBudget';
import { renderWithFakeBudget } from '@/test/renderWithFakeBudget';

import { AddCategoryDialog } from './AddCategoryDialog';
import { PlanPage } from './PlanPage';

const card = (): HTMLElement => screen.getByRole('region', { name: 'Categories' });
const region = (): HTMLElement => card().querySelector<HTMLElement>('[data-part="status-message"]') as HTMLElement;
const addButton = (): HTMLElement => screen.getByRole('button', { name: 'Add category' });
const dialog = (): HTMLElement => screen.getByRole('dialog', { name: 'Add category' });

async function addThroughDialog(user: UserEvent, name: string, planned?: string): Promise<void> {
  await user.click(addButton());
  await user.type(within(dialog()).getByRole('textbox', { name: 'Name' }), name);
  if (planned !== undefined) await user.type(within(dialog()).getByRole('textbox', { name: 'Planned (USD)' }), planned);
  await user.click(within(dialog()).getByRole('button', { name: 'Save category' }));
}

const ONE_CATEGORY: BudgetState = {
  month: '2026-11',
  incomeCents: 0,
  categories: [{ id: 'only', name: 'Only', plannedCents: 100 }],
  expenses: [],
};
const ONLY_RENT: BudgetState = { ...SCENARIO, categories: SCENARIO.categories.slice(0, 1), expenses: [] };
const NO_RENT: BudgetState = { ...SCENARIO, categories: SCENARIO.categories.slice(1), expenses: [] };

describe('CategoriesCard announcements', () => {
  it('region 3 exists in the Categories card, hidden and empty, also with no categories; one per card', () => {
    renderWithBudget(<PlanPage />, { state: { ...SCENARIO, categories: [], expenses: [] } });
    expect(region()).toHaveAttribute('data-visually-hidden', 'true');
    expect(region().textContent).toBe('');
    expect(card().querySelectorAll('[data-part="status-message"]')).toHaveLength(1);
    expect(region().closest('[role="dialog"], [data-bk-dialog-root]')).toBeNull();
  });

  it('dialog add with a planned amount: focus returns to Add category while the region is empty and nothing is inert', async () => {
    const { user } = renderWithBudget(<PlanPage />, { state: SCENARIO });
    const el = region();
    const { snapshots, stop } = recordFocus(el);
    await addThroughDialog(user, 'Pets', '25');
    await waitFor(() => expect(el.textContent).not.toBe(''));
    stop();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(addButton()).toHaveFocus();
    const back = snapshots.filter((s) => s.target === addButton());
    expect(back.length).toBeGreaterThan(0);
    const last = back[back.length - 1]!;
    expect(last.text).toBe('');
    expect(last.inertPresent).toBe(false);
    expect(el.textContent).toBe('Category added: Pets. Planned: $25.00.');
    expect(region()).toBe(el);
    expect(el.closest('[inert]')).toBeNull();
  });

  it('dialog add with Planned empty: no Planned sentence', async () => {
    const { user } = renderWithBudget(<PlanPage />, { state: SCENARIO });
    await addThroughDialog(user, 'Pets');
    await waitFor(() => expect(region().textContent).toBe('Category added: Pets.'));
  });

  it('dialog add with Planned 0: no Planned sentence', async () => {
    const { user } = renderWithBudget(<PlanPage />, { state: SCENARIO });
    await addThroughDialog(user, 'Pets', '0');
    await waitFor(() => expect(region().textContent).toBe('Category added: Pets.'));
  });

  it('suggestion: focus moves to the new planned field while the region is empty, then Category added: Groceries.', async () => {
    const { user } = renderWithBudget(<PlanPage />, { state: ONLY_RENT });
    const el = region();
    const { snapshots, stop } = recordFocus(el);
    await user.click(screen.getByRole('button', { name: 'Add Groceries' }));
    await waitFor(() => expect(el.textContent).not.toBe(''));
    stop();
    const field = screen.getByRole('textbox', { name: 'Category 2 planned (USD)' });
    expect(field).toHaveFocus();
    expect(snapshots.find((s) => s.target === field)?.text).toBe('');
    expect(el.textContent).toBe('Category added: Groceries.');
  });

  it('remove: focus moves to Remove Transport while the region is empty, then Category removed: Groceries.', async () => {
    const { user } = renderWithBudget(<PlanPage />, { state: SCENARIO });
    const el = region();
    const { snapshots, stop } = recordFocus(el);
    await user.click(screen.getByRole('button', { name: 'Remove Groceries' }));
    await waitFor(() => expect(el.textContent).not.toBe(''));
    stop();
    const next = screen.getByRole('button', { name: 'Remove Transport' });
    expect(next).toHaveFocus();
    expect(snapshots.find((s) => s.target === next)?.text).toBe('');
    expect(el.textContent).toBe('Category removed: Groceries.');
  });

  it('removing the only category leaves the region with the message and shows the empty line', async () => {
    const { user } = renderWithBudget(<PlanPage />, { state: ONE_CATEGORY });
    const el = region();
    await user.click(screen.getByRole('button', { name: 'Remove Only' }));
    expect(
      await screen.findByText('No categories yet. Add your own, or start from a suggestion below.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(el.textContent).toBe('Category removed: Only.'));
    expect(region()).toBe(el);
  });

  it('repeat: add Rent, remove it, add Rent again gives two different status-text nodes with the same text', async () => {
    const { user } = renderWithBudget(<PlanPage />, { state: NO_RENT });
    await user.click(screen.getByRole('button', { name: 'Add Rent' }));
    await waitFor(() => expect(region().textContent).toBe('Category added: Rent.'));
    const first = statusText(region());
    await user.click(screen.getByRole('button', { name: 'Remove Rent' }));
    await waitFor(() => expect(region().textContent).toBe('Category removed: Rent.'));
    await user.click(screen.getByRole('button', { name: 'Add Rent' }));
    await waitFor(() => expect(region().textContent).toBe('Category added: Rent.'));
    expect(statusText(region())).not.toBe(first);
  });

  it('failures: addCategory throwing (dialog and suggestion) and removeCategory throwing leave the region empty', async () => {
    const boom = (): never => {
      throw new Error('boom');
    };
    const { user } = renderWithFakeBudget(<PlanPage />, {
      state: ONLY_RENT,
      actions: { addCategory: boom, removeCategory: boom },
    });
    await addThroughDialog(user, 'Pets', '25');
    expect(await within(dialog()).findByRole('alert')).toBeInTheDocument();
    expect(region().textContent).toBe('');
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(region().textContent).toBe('');
    await user.click(screen.getByRole('button', { name: 'Add Groceries' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(region().textContent).toBe('');
    await user.click(screen.getByRole('button', { name: 'Remove Rent' }));
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(region().textContent).toBe('');
  });

  it('validation failure (empty name) and Esc announce nothing', async () => {
    const { user } = renderWithBudget(<PlanPage />, { state: SCENARIO });
    await user.click(addButton());
    await user.click(within(dialog()).getByRole('button', { name: 'Save category' }));
    expect(dialog()).toBeInTheDocument();
    expect(region().textContent).toBe('');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(region().textContent).toBe('');
  });

  it('the dialog is mounted only while open; the region is inert and outside it while open', async () => {
    const { user } = renderWithBudget(<PlanPage />, { state: SCENARIO });
    expect(document.querySelector('[role="dialog"], [data-bk-dialog-root]')).toBeNull();
    await user.click(addButton());
    expect(region().closest('[inert]')).not.toBeNull();
    expect(dialog().querySelector('[role="status"]')).toBeNull();
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    expect(document.querySelector('[data-bk-dialog-root]')).toBeNull();
  });

  it('income, planned and name edits, and a month change, announce nothing', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/plan' });
    await user.type(screen.getByRole('textbox', { name: 'Monthly income (USD)' }), '5');
    await user.type(screen.getByRole('textbox', { name: 'Category 1 planned (USD)' }), '1');
    const name = screen.getByRole('textbox', { name: 'Category 2 name' });
    await user.clear(name);
    await user.type(name, 'Food');
    await user.tab();
    for (const r of document.querySelectorAll('[data-part="status-message"]')) expect(r.textContent).toBe('');
  });
});

describe('AddCategoryDialog onAdded', () => {
  it('is called once with the id addCategory returned, only on success, before onClose', async () => {
    const order: string[] = [];
    const onAdded = vi.fn((id: string) => order.push(`added:${id}`));
    const onClose = vi.fn(() => order.push('close'));
    const { user } = renderWithFakeBudget(<AddCategoryDialog open onClose={onClose} onAdded={onAdded} />, {
      state: SCENARIO,
    });
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save category' }));
    expect(onAdded).not.toHaveBeenCalled();
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Pets');
    await user.click(screen.getByRole('button', { name: 'Save category' }));
    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(onAdded).toHaveBeenCalledWith('fake-id');
    expect(order).toEqual(['added:fake-id', 'close']);
  });

  it('is not called when addCategory throws', async () => {
    const onAdded = vi.fn();
    const { user } = renderWithFakeBudget(<AddCategoryDialog open onClose={vi.fn()} onAdded={onAdded} />, {
      state: SCENARIO,
      actions: {
        addCategory: () => {
          throw new Error('boom');
        },
      },
    });
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Pets');
    await user.click(screen.getByRole('button', { name: 'Save category' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onAdded).not.toHaveBeenCalled();
  });
});
