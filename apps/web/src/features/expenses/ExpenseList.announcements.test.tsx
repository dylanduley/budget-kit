import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BudgetState } from '@/lib/budget';
import { recordFocus, statusText } from '@/test/announcements';
import { SCENARIO } from '@/test/fixtures';
import { renderApp } from '@/test/renderApp';
import { renderWithFakeBudget } from '@/test/renderWithFakeBudget';

import { ExpenseList } from './ExpenseList';

const card = (): HTMLElement => screen.getByRole('region', { name: 'Expenses in November 2026' });
const region = (): HTMLElement => card().querySelector<HTMLElement>('[data-part="status-message"]') as HTMLElement;
const del = (label: string): HTMLElement => screen.getByRole('button', { name: label });

describe('ExpenseList announcements', () => {
  it('region 2 exists inside the Expenses card, hidden and empty, and Spending has exactly two regions', () => {
    renderApp({ state: SCENARIO, path: '/spending' });
    expect(region()).toHaveAttribute('data-visually-hidden', 'true');
    expect(region().textContent).toBe('');
    expect(document.querySelectorAll('[data-part="status-message"]')).toHaveLength(2);
    expect(region().closest('[role="dialog"], [data-bk-dialog-root]')).toBeNull();
  });

  it('region 2 directly follows the table, before the card ends (also with an empty table)', () => {
    renderApp({ state: { ...SCENARIO, expenses: [] }, path: '/spending' });
    expect(region()).toBeInTheDocument();
    expect(region().textContent).toBe('');
  });

  it('deleting Groceries: focus moves to the next Delete button while the region is empty, then the exact message', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/spending' });
    const el = region();
    const { snapshots, stop } = recordFocus(el);
    await user.click(del('Delete $82.47 Groceries expense from Nov 3, 2026'));
    await waitFor(() => expect(el.textContent).not.toBe(''));
    stop();
    const next = del('Delete $1,500.00 Rent expense from Nov 1, 2026');
    expect(next).toHaveFocus();
    expect(snapshots.find((s) => s.target === next)?.text).toBe('');
    expect(el.textContent).toBe('Expense deleted: $82.47 for Groceries on Nov 3, 2026. Left to spend: $1,587.65.');
    expect(region()).toBe(el);
  });

  it('deleting the last remaining expense keeps the region and announces it; the empty state is focused', async () => {
    const state: BudgetState = { ...SCENARIO, expenses: SCENARIO.expenses.filter((e) => e.id === 'e2') };
    const { user } = renderApp({ state, path: '/spending' });
    const el = region();
    await user.click(del('Delete $82.47 Groceries expense from Nov 3, 2026'));
    const empty = await screen.findByText('No expenses in November 2026.');
    expect(empty).toHaveFocus();
    await waitFor(() =>
      expect(el.textContent).toBe(
        'Expense deleted: $82.47 for Groceries on Nov 3, 2026. Left to spend: $3,200.00.',
      ),
    );
    expect(region()).toBe(el);
  });

  it('removed category: the label falls back to "Removed category"', async () => {
    const state: BudgetState = {
      ...SCENARIO,
      categories: SCENARIO.categories.filter((c) => c.id !== 'suggested-eating-out'),
    };
    const { user } = renderApp({ state, path: '/spending' });
    await user.click(del('Delete $112.35 Removed category expense from Nov 5, 2026'));
    await waitFor(() =>
      expect(region().textContent).toBe(
        'Expense deleted: $112.35 for Removed category on Nov 5, 2026. Left to spend: $1,617.53.',
      ),
    );
  });

  it('no income: no left-to-spend sentence; repeating the same message gives a new status-text node', async () => {
    const state: BudgetState = {
      ...SCENARIO,
      incomeCents: 0,
      expenses: [
        { id: 'a', categoryId: 'suggested-groceries', amountCents: 500, note: '', date: '2026-11-03' },
        { id: 'b', categoryId: 'suggested-groceries', amountCents: 500, note: '', date: '2026-11-03' },
      ],
    };
    const { user } = renderApp({ state, path: '/spending' });
    const message = 'Expense deleted: $5.00 for Groceries on Nov 3, 2026.';
    const label = 'Delete $5.00 Groceries expense from Nov 3, 2026';
    await user.click(screen.getAllByRole('button', { name: label })[0]!);
    await waitFor(() => expect(region().textContent).toBe(message));
    const first = statusText(region());
    await user.click(screen.getByRole('button', { name: label }));
    await waitFor(() => expect(statusText(region())).not.toBe(first));
    expect(region().textContent).toBe(message);
  });

  it('failure: a throwing deleteExpense shows the action error and leaves the region text unchanged', async () => {
    const { user } = renderWithFakeBudget(<ExpenseList />, {
      state: SCENARIO,
      actions: {
        deleteExpense: () => {
          throw new Error('boom');
        },
      },
    });
    await user.click(del('Delete $82.47 Groceries expense from Nov 3, 2026'));
    expect(await within(card()).findByRole('alert')).toHaveTextContent('Something went wrong. Your budget was not changed.');
    expect(region().textContent).toBe('');
  });

  it('no announcement on first render of Spending', () => {
    renderApp({ state: SCENARIO, path: '/spending' });
    for (const r of document.querySelectorAll('[data-part="status-message"]')) expect(r.textContent).toBe('');
  });
});
