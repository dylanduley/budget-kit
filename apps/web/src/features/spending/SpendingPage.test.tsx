import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createInitialState } from '@/lib/budget';
import { expectNoAxeViolations } from '@/test/axe';
import { SCENARIO } from '@/test/fixtures';
import { renderApp } from '@/test/renderApp';

const NO_CATEGORIES_LINE = 'Add a category on the Plan page before adding expenses.';

const card = (): HTMLElement => screen.getByRole('region', { name: 'Expenses in November 2026' });
const table = (): HTMLElement => screen.getByRole('table', { name: 'Expense table for November 2026' });
const bodyRows = (): HTMLElement[] => within(table()).getAllByRole('row').slice(1);
const deleteButtons = (): HTMLElement[] => within(table()).getAllByRole('button', { name: /^Delete / });

describe('Spending page: layout', () => {
  it('has the h1 Spending and a region named Expenses in November 2026', () => {
    renderApp({ state: SCENARIO, path: '/spending' });
    expect(screen.getByRole('heading', { level: 1, name: 'Spending' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Expenses in November 2026' })).toBeInTheDocument();
    expect(card()).toBeInTheDocument();
    expect(screen.getByText('Newest first.')).toBeInTheDocument();
  });

  it('the card region and the table are named differently (landmark names stay unique)', () => {
    renderApp({ state: SCENARIO, path: '/spending' });
    expect(screen.getAllByRole('region', { name: 'Expenses in November 2026' })).toHaveLength(1);
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(table()).toHaveAccessibleName('Expense table for November 2026');
    expect(table()).not.toHaveAccessibleName('Expenses in November 2026');
    expect(card().contains(table())).toBe(true);
  });
});

describe('Spending page: rows', () => {
  it('lists Nov 5, Nov 3, Nov 1 newest first with exact amounts', () => {
    renderApp({ state: SCENARIO, path: '/spending' });
    const rows = bodyRows();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Nov 5, 2026');
    expect(rows[0]).toHaveTextContent('Eating out');
    expect(rows[0]).toHaveTextContent('$112.35');
    expect(rows[1]).toHaveTextContent('Nov 3, 2026');
    expect(rows[1]).toHaveTextContent('$82.47');
    expect(rows[2]).toHaveTextContent('Nov 1, 2026');
    expect(rows[2]).toHaveTextContent('$1,500.00');
  });

  it('same-day expenses: the one added later comes first', () => {
    renderApp({
      state: {
        ...SCENARIO,
        expenses: [
          { id: 'a', categoryId: 'suggested-rent', amountCents: 100, note: 'first', date: '2026-11-04' },
          { id: 'b', categoryId: 'suggested-rent', amountCents: 200, note: 'second', date: '2026-11-04' },
        ],
      },
      path: '/spending',
    });
    const rows = bodyRows();
    expect(rows[0]).toHaveTextContent('second');
    expect(rows[1]).toHaveTextContent('first');
  });

  it('a Delete button has a descriptive name', () => {
    renderApp({ state: SCENARIO, path: '/spending' });
    expect(
      screen.getByRole('button', { name: 'Delete $112.35 Eating out expense from Nov 5, 2026' }),
    ).toBeInTheDocument();
  });

  it('deleting needs no confirmation and focus moves to the next row Delete, else the previous', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/spending' });
    await user.click(deleteButtons()[0] as HTMLElement);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bodyRows()).toHaveLength(2);
    expect(deleteButtons()[0]).toHaveFocus();
    expect(bodyRows()[0]).toHaveTextContent('Nov 3, 2026');
    await user.click(deleteButtons()[1] as HTMLElement);
    expect(bodyRows()).toHaveLength(1);
    expect(deleteButtons()[0]).toHaveFocus();
  });

  it('deleting all three shows No expenses in November 2026. and focuses it', async () => {
    const { user, readStored } = renderApp({ state: SCENARIO, path: '/spending' });
    for (let i = 0; i < 3; i += 1) await user.click(deleteButtons()[0] as HTMLElement);
    const empty = screen.getByText('No expenses in November 2026.');
    expect(empty).toHaveFocus();
    expect(screen.queryByText(NO_CATEGORIES_LINE)).not.toBeInTheDocument();
    expect(readStored()?.expenses).toEqual([]);
  });

  it('deleting is reflected on Overview after navigating (one provider)', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/spending' });
    await user.click(deleteButtons()[0] as HTMLElement);
    await user.click(screen.getByRole('link', { name: 'Overview' }));
    const spent = screen.getByText('Spent', { selector: '[data-part="label"]' }).parentElement;
    expect(spent).toHaveTextContent('$1,582.47');
  });
});

describe('Spending page: no categories', () => {
  it('shows the empty state, the Plan-page line, and no Add expense button', () => {
    renderApp({ state: createInitialState('2026-11'), path: '/spending' });
    expect(screen.getByText('No expenses in November 2026.')).toBeInTheDocument();
    expect(screen.getByText(NO_CATEGORIES_LINE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add expense' })).not.toBeInTheDocument();
  });

  it('the Plan-page line comes after the table', () => {
    renderApp({ state: createInitialState('2026-11'), path: '/spending' });
    const line = screen.getByText(NO_CATEGORIES_LINE);
    expect(table().compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('with categories the line is not shown', () => {
    renderApp({ state: { ...SCENARIO, expenses: [] }, path: '/spending' });
    expect(screen.getByText('No expenses in November 2026.')).toBeInTheDocument();
    expect(screen.queryByText(NO_CATEGORIES_LINE)).not.toBeInTheDocument();
  });
});

describe('Spending page: accessibility (axe)', () => {
  it('populated', async () => {
    renderApp({ state: SCENARIO, path: '/spending' });
    await expectNoAxeViolations();
  });

  it('empty with no categories', async () => {
    renderApp({ state: createInitialState('2026-11'), path: '/spending' });
    await expectNoAxeViolations();
  });
});
