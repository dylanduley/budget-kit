import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SCENARIO } from '@/test/fixtures';
import { recordFocus, statusText } from '@/test/announcements';
import { renderWithBudget } from '@/test/renderWithBudget';
import { renderWithFakeBudget } from '@/test/renderWithFakeBudget';

import { AddExpense } from './AddExpense';

const trigger = (): HTMLElement => screen.getByRole('button', { name: 'Add expense' });
const dialog = (): HTMLElement => screen.getByRole('dialog', { name: 'Add expense' });
const regionOf = (): HTMLElement => trigger().nextElementSibling as HTMLElement;

async function addExpense(
  user: UserEvent,
  values: { amount: string; category: string; date?: string },
): Promise<void> {
  await user.click(trigger());
  await user.type(within(dialog()).getByRole('textbox', { name: 'Amount (USD)' }), values.amount);
  await user.selectOptions(within(dialog()).getByRole('combobox', { name: 'Category' }), values.category);
  if (values.date !== undefined) {
    await user.selectOptions(within(dialog()).getByRole('combobox', { name: 'Date' }), values.date);
  }
  await user.click(within(dialog()).getByRole('button', { name: 'Save expense' }));
}

describe('AddExpense announcements', () => {
  it('region 1 exists before any change: hidden, empty, the next sibling of Add expense, exactly one', () => {
    renderWithBudget(<AddExpense />, { state: SCENARIO });
    const region = regionOf();
    expect(region).toHaveAttribute('data-part', 'status-message');
    expect(region).toHaveAttribute('data-visually-hidden', 'true');
    expect(region).toHaveAttribute('role', 'status');
    expect(region.textContent).toBe('');
    expect(document.querySelectorAll('[data-part="status-message"]')).toHaveLength(1);
  });

  it('adding 20 / Groceries / default date puts the exact message in the same element, focus on Add expense', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    const region = regionOf();
    await addExpense(user, { amount: '20', category: 'Groceries' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger()).toHaveFocus();
    await waitFor(() =>
      expect(region.textContent).toBe(
        'Expense added: $20.00 for Groceries on Nov 14, 2026. Left to spend: $1,485.18.',
      ),
    );
    expect(regionOf()).toBe(region);
    expect(region.closest('[inert]')).toBeNull();
    expect(region.closest('[role="dialog"], [data-bk-dialog-root]')).toBeNull();
  });

  it('order: the region is empty and nothing is inert when focus returns to Add expense; text follows after', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    const region = regionOf();
    const { snapshots, stop } = recordFocus(region);
    await addExpense(user, { amount: '20', category: 'Groceries' });
    await waitFor(() => expect(region.textContent).not.toBe(''));
    stop();
    const back = snapshots.filter((s) => s.target === trigger());
    expect(back.length).toBeGreaterThan(0);
    const last = back[back.length - 1]!;
    expect(last.text).toBe('');
    expect(last.inertPresent).toBe(false);
    expect(region.closest('[inert]')).toBeNull();
  });

  it('overspending: 2000 / Transport / Nov 10 gives a negative left to spend', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await addExpense(user, { amount: '2000', category: 'Transport', date: 'Nov 10, 2026' });
    await waitFor(() =>
      expect(regionOf().textContent).toBe(
        'Expense added: $2,000.00 for Transport on Nov 10, 2026. Left to spend: -$494.82.',
      ),
    );
  });

  it('no income: the message has no left-to-spend sentence', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: { ...SCENARIO, incomeCents: 0 } });
    await addExpense(user, { amount: '20', category: 'Groceries' });
    await waitFor(() =>
      expect(regionOf().textContent).toBe('Expense added: $20.00 for Groceries on Nov 14, 2026.'),
    );
  });

  it('repeat: the same message twice lands in a new status-text node', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: { ...SCENARIO, incomeCents: 0 } });
    const message = 'Expense added: $5.00 for Groceries on Nov 14, 2026.';
    await addExpense(user, { amount: '5', category: 'Groceries' });
    await waitFor(() => expect(regionOf().textContent).toBe(message));
    const first = statusText(regionOf());
    expect(first).not.toBeNull();
    await addExpense(user, { amount: '5', category: 'Groceries' });
    await waitFor(() => expect(statusText(regionOf())).not.toBe(first));
    expect(regionOf().textContent).toBe(message);
    expect(document.querySelectorAll('[data-part="status-message"]')).toHaveLength(1);
  });

  it('failure: a throwing addExpense shows the action error, keeps the dialog open and the region empty', async () => {
    const { user } = renderWithFakeBudget(<AddExpense />, {
      state: SCENARIO,
      actions: {
        addExpense: () => {
          throw new Error('boom');
        },
      },
    });
    await addExpense(user, { amount: '20', category: 'Groceries' });
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      'Something went wrong. Your budget was not changed.',
    );
    expect(dialog()).toBeInTheDocument();
    expect(regionOf().textContent).toBe('');
  });

  it('invalid save (empty form) announces nothing and keeps the dialog open', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await user.click(trigger());
    await user.click(within(dialog()).getByRole('button', { name: 'Save expense' }));
    expect(dialog()).toBeInTheDocument();
    expect(regionOf().textContent).toBe('');
  });

  it('Cancel and Esc announce nothing', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await user.click(trigger());
    await user.type(within(dialog()).getByRole('textbox', { name: 'Amount (USD)' }), '20');
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(regionOf().textContent).toBe('');
    await user.click(trigger());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(regionOf().textContent).toBe('');
  });

  it('the dialog is mounted only while open; while open the region is inert and outside it', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[data-bk-dialog-root]')).toBeNull();
    await user.click(trigger());
    const region = regionOf();
    expect(region.closest('[inert]')).not.toBeNull();
    expect(region.closest('[role="dialog"], [data-bk-dialog-root]')).toBeNull();
    expect(dialog().querySelector('[role="status"]')).toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    expect(document.querySelector('[data-bk-dialog-root]')).toBeNull();
  });

  it('no announcement on initial render or after only opening the dialog', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    expect(regionOf().textContent).toBe('');
    await user.click(trigger());
    expect(regionOf().textContent).toBe('');
  });
});
