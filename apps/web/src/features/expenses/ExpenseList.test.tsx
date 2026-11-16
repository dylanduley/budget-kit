import { render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { renderApp } from '@/test/renderApp';
import {
  type BudgetState,
  type Expense,
  MAX_CENTS,
  categoryLabel,
  createInitialState,
  expensesForMonth,
} from '@/lib/budget';
import { formatDate, formatMoney } from '@/lib/format';
import { BudgetContext, TOTAL_TOO_LARGE_MESSAGE } from '@/state/BudgetProvider';
import { expectNoAxeViolations } from '@/test/axe';
import { SCENARIO } from '@/test/fixtures';
import { renderWithBudget } from '@/test/renderWithBudget';
import { renderWithFakeBudget } from '@/test/renderWithFakeBudget';
import { ExpenseList } from './ExpenseList';

const GENERIC = 'Something went wrong. Your budget was not changed.';
const EG = 'Delete $82.47 Groceries expense from Nov 3, 2026';
const EE = 'Delete $112.35 Eating out expense from Nov 5, 2026';
const ER = 'Delete $1,500.00 Rent expense from Nov 1, 2026';

function exp(id: string, date: string, over: Partial<Expense> = {}): Expense {
  return { id, categoryId: 'suggested-groceries', amountCents: 100, note: '', date, ...over };
}
function withExpenses(expenses: Expense[], base: BudgetState = SCENARIO): BudgetState {
  return { ...base, expenses };
}
function bodyRows(): HTMLElement[] {
  return screen.getAllByRole('row').slice(1);
}
function rowText(row: HTMLElement): string[] {
  return Array.from(row.querySelectorAll('th, td')).map((c) => c.textContent ?? '');
}

// The table's scroll region is named by the caption.
function scrollRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Expense table for November 2026' });
}

describe('the table', () => {
  it('SCENARIO: named table, headers, rows in order, date cells are row headers', async () => {
    renderWithBudget(<ExpenseList />, { state: SCENARIO });
    const table = await screen.findByRole('table', { name: 'Expense table for November 2026' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Date',
      'Category',
      'Note',
      'Amount',
      'Actions',
    ]);
    const rows = bodyRows();
    expect(rows).toHaveLength(3);
    expect(rowText(rows[0]!).slice(0, 4)).toEqual(['Nov 5, 2026', 'Eating out', 'Birthday dinner', '$112.35']);
    expect(rowText(rows[1]!).slice(0, 4)).toEqual(['Nov 3, 2026', 'Groceries', '', '$82.47']);
    expect(rowText(rows[2]!).slice(0, 4)).toEqual(['Nov 1, 2026', 'Rent', 'November rent', '$1,500.00']);
    for (const row of rows) expect(within(row).getAllByRole('rowheader')).toHaveLength(1);
    expect(within(rows[0]!).getByRole('rowheader')).toHaveTextContent('Nov 5, 2026');
    expect(screen.getByRole('heading', { name: 'Expenses in November 2026' })).toBeInTheDocument();
    expect(screen.getByText('Newest first.')).toBeInTheDocument();
  });

  it('renders nothing while loading', () => {
    const { container } = render(
      <BudgetContext.Provider value={{ status: 'loading' }}>
        <ExpenseList />
      </BudgetContext.Provider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('newest first with ties: c, a, b; the other-month d is not shown', async () => {
    const state = withExpenses([
      exp('a', '2026-11-05', { note: 'a' }),
      exp('b', '2026-11-01', { note: 'b' }),
      exp('c', '2026-11-05', { note: 'c' }),
      exp('d', '2026-10-31', { note: 'd' }),
    ]);
    renderWithBudget(<ExpenseList />, { state });
    await screen.findByRole('table');
    expect(bodyRows().map((r) => rowText(r)[2])).toEqual(['c', 'a', 'b']);
    expect(screen.queryByText('d')).not.toBeInTheDocument();
  });

  it('other-month expenses in the later month are excluded too', async () => {
    const state = withExpenses([exp('a', '2026-11-30', { note: 'a' }), exp('z', '2026-12-01', { note: 'z' })]);
    renderWithBudget(<ExpenseList />, { state });
    await screen.findByRole('table');
    expect(bodyRows().map((r) => rowText(r)[2])).toEqual(['a']);
  });

  it('matches expensesForMonth, formatDate, categoryLabel and formatMoney for every row', async () => {
    const state = withExpenses([
      exp('a', '2026-11-05', { amountCents: 5 }),
      exp('b', '2026-11-09', { amountCents: 123456789 }),
      exp('c', '2026-11-09', { categoryId: 'gone', amountCents: 99 }),
    ]);
    renderWithBudget(<ExpenseList />, { state });
    await screen.findByRole('table');
    const expected = expensesForMonth(state);
    const rows = bodyRows();
    expect(rows).toHaveLength(expected.length);
    expected.forEach((e, i) => {
      const cells = rowText(rows[i]!);
      expect(cells[0]).toBe(formatDate(e.date));
      expect(cells[1]).toBe(categoryLabel(state, e.categoryId));
      expect(cells[3]).toBe(formatMoney(e.amountCents));
    });
  });

  it('amount column cells are marked numeric (right-aligned by the library); other columns are not', async () => {
    renderWithBudget(<ExpenseList />, { state: SCENARIO });
    await screen.findByRole('table');
    const amountHeader = screen.getByRole('columnheader', { name: 'Amount' });
    expect(amountHeader).toHaveAttribute('data-numeric', 'true');
    expect(screen.getByRole('columnheader', { name: 'Note' })).not.toHaveAttribute('data-numeric');
    for (const row of bodyRows()) {
      const cells = within(row).getAllByRole('cell');
      expect(cells[2]).toHaveAttribute('data-numeric', 'true');
      expect(cells[1]).not.toHaveAttribute('data-numeric');
    }
  });

  it('removed category and unnamed category labels, in cells and button names', async () => {
    const renamed: BudgetState = {
      ...SCENARIO,
      categories: SCENARIO.categories.map((c) => (c.id === 'suggested-groceries' ? { ...c, name: '' } : c)),
    };
    const removed: BudgetState = {
      ...renamed,
      categories: renamed.categories.filter((c) => c.id !== 'suggested-eating-out'),
    };
    renderWithBudget(<ExpenseList />, { state: removed });
    await screen.findByRole('table');
    const rows = bodyRows();
    expect(rowText(rows[0]!)[1]).toBe('Removed category');
    expect(rowText(rows[1]!)[1]).toBe('Unnamed category');
    expect(screen.getByRole('button', { name: 'Delete $112.35 Removed category expense from Nov 5, 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete $82.47 Unnamed category expense from Nov 3, 2026' })).toBeInTheDocument();
  });

  it('a state without the Eating out category labels its row Removed category', async () => {
    function Wrap(): React.ReactElement {
      return <ExpenseList />;
    }
    const view = renderWithBudget(<Wrap />, {
      state: { ...SCENARIO, categories: SCENARIO.categories.filter((c) => c.id !== 'suggested-eating-out') },
    });
    await screen.findByRole('table');
    expect(rowText(bodyRows()[0]!)[1]).toBe('Removed category');
    view.unmount();
  });

  it('empty note gives an empty cell; a 100-character note is shown in full', async () => {
    const long = 'x'.repeat(100);
    renderWithBudget(<ExpenseList />, {
      state: withExpenses([exp('a', '2026-11-05', { note: long }), exp('b', '2026-11-04', { note: '' })]),
    });
    await screen.findByRole('table');
    const rows = bodyRows();
    expect(rowText(rows[0]!)[2]).toBe(long);
    expect(rowText(rows[1]!)[2]).toBe('');
  });

  it('amounts near MAX_CENTS are formatted exactly', async () => {
    renderWithBudget(<ExpenseList />, {
      state: withExpenses([exp('a', '2026-11-05', { amountCents: MAX_CENTS }), exp('b', '2026-11-04', { amountCents: 1 })]),
    });
    await screen.findByRole('table');
    expect(rowText(bodyRows()[0]!)[3]).toBe(formatMoney(MAX_CENTS));
    expect(rowText(bodyRows()[0]!)[3]).toBe('$999,999,999,999.99');
    expect(rowText(bodyRows()[1]!)[3]).toBe('$0.01');
    expect(document.body.textContent).not.toMatch(/NaN|e\+|Infinity/);
  });

  it('Delete buttons have distinct names with amount, category and date', async () => {
    renderWithBudget(<ExpenseList />, { state: SCENARIO });
    await screen.findByRole('table');
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual([EE, EG, ER]);
    expect(new Set(names).size).toBe(3);
    expect(screen.getByRole('button', { name: EG })).toHaveTextContent('Delete');
  });
});

describe('delete', () => {
  it('clicking Groceries leaves Eating out and Rent, removes only e2 from storage, focus on Rent button', async () => {
    const view = renderWithBudget(<ExpenseList />, { state: SCENARIO });
    await screen.findByRole('table');
    await view.user.click(screen.getByRole('button', { name: EG }));
    expect(bodyRows().map((r) => rowText(r)[1])).toEqual(['Eating out', 'Rent']);
    const stored = view.readStored();
    expect(stored?.expenses.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(stored?.incomeCents).toBe(SCENARIO.incomeCents);
    expect(stored?.categories).toEqual(SCENARIO.categories);
    expect(screen.getByRole('button', { name: ER })).toHaveFocus();
    expect(document.querySelector('[data-part="action-error"]')).toBeNull();
  });

  it('deleting the first (newest) row focuses the button now at that position', async () => {
    const view = renderWithBudget(<ExpenseList />, { state: SCENARIO });
    await screen.findByRole('table');
    await view.user.click(screen.getByRole('button', { name: EE }));
    expect(screen.getByRole('button', { name: EG })).toHaveFocus();
  });

  it('deleting the last row (Rent) focuses the Eating out button... new last row', async () => {
    const state = withExpenses(SCENARIO.expenses.filter((e) => e.id !== 'e2'));
    const view = renderWithBudget(<ExpenseList />, { state });
    await screen.findByRole('table');
    await view.user.click(screen.getByRole('button', { name: ER }));
    expect(screen.getByRole('button', { name: EE })).toHaveFocus();
  });

  it('deleting the last row of three focuses the new last row (Groceries)', async () => {
    const view = renderWithBudget(<ExpenseList />, { state: SCENARIO });
    await screen.findByRole('table');
    await view.user.click(screen.getByRole('button', { name: ER }));
    expect(screen.getByRole('button', { name: EG })).toHaveFocus();
  });

  it('deleting the only remaining row shows the empty state and focuses its paragraph', async () => {
    const view = renderWithBudget(<ExpenseList />, { state: withExpenses([SCENARIO.expenses[0]!]) });
    await screen.findByRole('table');
    await view.user.click(screen.getByRole('button', { name: ER }));
    const empty = screen.getByText('No expenses in November 2026.');
    expect(empty).toHaveFocus();
    expect(view.readStored()?.expenses).toEqual([]);
  });

  it('after a delete by keyboard the next Tab moves on from the focused button', async () => {
    const view = renderWithBudget(<ExpenseList />, { state: SCENARIO });
    await screen.findByRole('table');
    await view.user.click(screen.getByRole('button', { name: EE }));
    await view.user.tab();
    expect(screen.getByRole('button', { name: ER })).toHaveFocus();
  });

  it('keyboard only: Tab reaches the scroll region, then each Delete button in row order', async () => {
    const view = renderWithBudget(<ExpenseList />, { state: SCENARIO });
    await screen.findByRole('table');
    await view.user.tab();
    expect(scrollRegion()).toHaveFocus();
    await view.user.tab();
    expect(screen.getByRole('button', { name: EE })).toHaveFocus();
    await view.user.tab();
    expect(screen.getByRole('button', { name: EG })).toHaveFocus();
    await view.user.tab();
    expect(screen.getByRole('button', { name: ER })).toHaveFocus();
  });

  it('Enter on a Delete button deletes that row', async () => {
    const view = renderWithBudget(<ExpenseList />, { state: SCENARIO });
    await screen.findByRole('table');
    await view.user.tab();
    await view.user.tab();
    await view.user.tab();
    expect(screen.getByRole('button', { name: EG })).toHaveFocus();
    await view.user.keyboard('{Enter}');
    expect(view.readStored()?.expenses.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(screen.queryByRole('button', { name: EG })).not.toBeInTheDocument();
  });

  it('Space on a Delete button deletes that row', async () => {
    const view = renderWithBudget(<ExpenseList />, { state: SCENARIO });
    await screen.findByRole('table');
    await view.user.tab();
    await view.user.tab();
    await view.user.tab();
    await view.user.tab();
    expect(screen.getByRole('button', { name: ER })).toHaveFocus();
    await view.user.keyboard(' ');
    expect(view.readStored()?.expenses.map((e) => e.id)).toEqual(['e2', 'e3']);
    expect(screen.getByRole('button', { name: EG })).toHaveFocus();
  });

  it('never removes another expense: identical rows differing only by id', async () => {
    const state = withExpenses([exp('x1', '2026-11-05'), exp('x2', '2026-11-05')]);
    const view = renderWithBudget(<ExpenseList />, { state });
    await screen.findByRole('table');
    // Equal dates: later-added (x2) is the first row. Delete the second row, which is x1.
    const buttons = screen.getAllByRole('button', { name: /^Delete/ });
    expect(buttons).toHaveLength(2);
    await view.user.click(buttons[1]!);
    expect(view.readStored()?.expenses.map((e) => e.id)).toEqual(['x2']);
    expect(screen.getAllByRole('button', { name: /^Delete/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Delete/ })).toHaveFocus();
  });

  it('deleting the first of identical rows removes the first-shown one (x2) and keeps x1', async () => {
    const state = withExpenses([exp('x1', '2026-11-05'), exp('x2', '2026-11-05')]);
    const view = renderWithBudget(<ExpenseList />, { state });
    await screen.findByRole('table');
    await view.user.click(screen.getAllByRole('button', { name: /^Delete/ })[0]!);
    expect(view.readStored()?.expenses.map((e) => e.id)).toEqual(['x1']);
  });

  it('deleting in a list that hides other-month expenses keeps the hidden ones', async () => {
    const state = withExpenses([exp('old', '2026-10-31'), exp('a', '2026-11-02'), exp('b', '2026-11-03')]);
    const view = renderWithBudget(<ExpenseList />, { state });
    await screen.findByRole('table');
    await view.user.click(screen.getAllByRole('button', { name: /^Delete/ })[0]!);
    expect(view.readStored()?.expenses.map((e) => e.id)).toEqual(['old', 'a']);
  });

  it('deleting every row one by one never loses focus into the body', async () => {
    const view = renderWithBudget(<ExpenseList />, { state: SCENARIO });
    await screen.findByRole('table');
    for (let n = 0; n < 3; n += 1) {
      await view.user.click(screen.getAllByRole('button', { name: /^Delete/ })[0]!);
      expect(document.body).not.toHaveFocus();
    }
    expect(screen.getByText('No expenses in November 2026.')).toHaveFocus();
  });
});

describe('empty state', () => {
  it('shows the headers and one cell with the message, in a programmatically focusable paragraph', async () => {
    renderWithBudget(<ExpenseList />, { state: createInitialState('2026-11') });
    const table = await screen.findByRole('table', { name: 'Expense table for November 2026' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Date',
      'Category',
      'Note',
      'Amount',
      'Actions',
    ]);
    expect(within(table).getAllByRole('cell')).toHaveLength(1);
    const p = screen.getByText('No expenses in November 2026.');
    expect(p.tagName).toBe('P');
    expect(p).toHaveAttribute('tabindex', '-1');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('a state whose only expenses are in another month is empty', async () => {
    renderWithBudget(<ExpenseList />, { state: withExpenses([exp('d', '2026-10-31')]) });
    await screen.findByRole('table');
    expect(screen.getByText('No expenses in November 2026.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('the empty paragraph is not a tab stop', async () => {
    const view = renderWithBudget(<ExpenseList />, { state: createInitialState('2026-11') });
    await screen.findByRole('table');
    await view.user.tab();
    expect(scrollRegion()).toHaveFocus();
    await view.user.tab();
    expect(screen.getByText('No expenses in November 2026.')).not.toHaveFocus();
  });
});

describe('failed delete', () => {
  it('plain Error: row stays, focus stays, generic message after the table, called once with e2', async () => {
    const view = renderWithFakeBudget(<ExpenseList />, {
      state: SCENARIO,
      actions: {
        deleteExpense: () => {
          throw new Error('boom');
        },
      },
    });
    const button = screen.getByRole('button', { name: EG });
    await view.user.click(button);
    expect(bodyRows()).toHaveLength(3);
    expect(button).toHaveFocus();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(GENERIC);
    expect(alert.textContent).toBe(GENERIC);
    expect(alert.tagName).toBe('P');
    expect(alert).toHaveAttribute('data-part', 'action-error');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(view.actions.deleteExpense).toHaveBeenCalledTimes(1);
    expect(view.actions.deleteExpense).toHaveBeenCalledWith('e2');
    const table = screen.getByRole('table');
    expect(table.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(alert.closest('table')).toBeNull();
    expect(alert.closest('[role="region"]')).toBeNull();
  });

  it('RangeError with the exact message shows the too-large text', async () => {
    const view = renderWithFakeBudget(<ExpenseList />, {
      state: SCENARIO,
      actions: {
        deleteExpense: () => {
          throw new RangeError(TOTAL_TOO_LARGE_MESSAGE);
        },
      },
    });
    await view.user.click(screen.getByRole('button', { name: EG }));
    expect(screen.getByRole('alert').textContent).toBe('That change would make a total too large.');
    expect(screen.getByRole('button', { name: EG })).toHaveFocus();
    expect(bodyRows()).toHaveLength(3);
  });

  it('a RangeError with another message, and an Error with the too-large text, show the generic message', async () => {
    const a = renderWithFakeBudget(<ExpenseList />, {
      state: SCENARIO,
      actions: {
        deleteExpense: () => {
          throw new RangeError('something else');
        },
      },
    });
    await a.user.click(screen.getByRole('button', { name: EG }));
    expect(screen.getByRole('alert').textContent).toBe(GENERIC);
    a.unmount();
    const b = renderWithFakeBudget(<ExpenseList />, {
      state: SCENARIO,
      actions: {
        deleteExpense: () => {
          throw new Error(TOTAL_TOO_LARGE_MESSAGE);
        },
      },
    });
    await b.user.click(screen.getByRole('button', { name: EG }));
    expect(screen.getByRole('alert').textContent).toBe(GENERIC);
  });

  it('a thrown non-Error value shows the generic message', async () => {
    const view = renderWithFakeBudget(<ExpenseList />, {
      state: SCENARIO,
      actions: {
        deleteExpense: () => {
          throw 'nope';
        },
      },
    });
    await view.user.click(screen.getByRole('button', { name: EG }));
    expect(screen.getByRole('alert').textContent).toBe(GENERIC);
  });

  it('no alert before any delete; error persists until the next successful delete, then clears', async () => {
    let fail = true;
    const view = renderWithFakeBudget(<ExpenseList />, {
      state: SCENARIO,
      actions: {
        deleteExpense: () => {
          if (fail) throw new Error('boom');
        },
      },
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await view.user.click(screen.getByRole('button', { name: EG }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await view.user.click(screen.getByRole('button', { name: EG }));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    fail = false;
    await view.user.click(screen.getByRole('button', { name: EE }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.querySelector('[data-part="action-error"]')).toBeNull();
    expect(view.actions.deleteExpense).toHaveBeenCalledTimes(3);
  });

  it('after a failure then a failing delete of a different row, focus stays on that row button', async () => {
    const view = renderWithFakeBudget(<ExpenseList />, {
      state: SCENARIO,
      actions: {
        deleteExpense: () => {
          throw new Error('boom');
        },
      },
    });
    await view.user.click(screen.getByRole('button', { name: ER }));
    expect(screen.getByRole('button', { name: ER })).toHaveFocus();
    await view.user.click(screen.getByRole('button', { name: EE }));
    expect(screen.getByRole('button', { name: EE })).toHaveFocus();
  });

  it('a failure does not queue a focus move that fires on a later re-render', async () => {
    let fail = true;
    const view = renderWithFakeBudget(<ExpenseList />, {
      state: SCENARIO,
      actions: {
        deleteExpense: () => {
          if (fail) throw new Error('boom');
        },
      },
    });
    await view.user.click(screen.getByRole('button', { name: EG }));
    expect(screen.getByRole('button', { name: EG })).toHaveFocus();
    fail = false;
    await view.user.click(screen.getByRole('button', { name: EE }));
    // Fake actions do not change state; focus stays where the user clicked.
    await waitFor(() => expect(screen.getByRole('button', { name: EE })).toHaveFocus());
  });
});

describe('accessibility', () => {
  it('axe: populated, empty, long note, error and removed-category states (contrast is disabled in jsdom)', async () => {
    const populated = renderWithBudget(<ExpenseList />, { state: SCENARIO });
    await screen.findByRole('table');
    await expectNoAxeViolations(populated.container);
    populated.unmount();

    const empty = renderWithBudget(<ExpenseList />, { state: createInitialState('2026-11') });
    await screen.findByRole('table');
    await expectNoAxeViolations(empty.container);
    empty.unmount();

    const longNote = renderWithBudget(<ExpenseList />, {
      state: withExpenses([exp('a', '2026-11-05', { note: 'n'.repeat(100) })]),
    });
    await screen.findByRole('table');
    await expectNoAxeViolations(longNote.container);
    longNote.unmount();

    const removed = renderWithBudget(<ExpenseList />, {
      state: { ...SCENARIO, categories: SCENARIO.categories.filter((c) => c.id !== 'suggested-eating-out') },
    });
    await screen.findByRole('table');
    await expectNoAxeViolations(removed.container);
    removed.unmount();

    const err = renderWithFakeBudget(<ExpenseList />, {
      state: SCENARIO,
      actions: {
        deleteExpense: () => {
          throw new Error('boom');
        },
      },
    });
    await err.user.click(screen.getByRole('button', { name: EG }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await expectNoAxeViolations(err.container);
  });

  it('axe after one delete', async () => {
    const view = renderWithBudget(<ExpenseList />, { state: SCENARIO });
    await screen.findByRole('table');
    await view.user.click(screen.getByRole('button', { name: EG }));
    await expectNoAxeViolations(view.container);
  });

  it('the scroll region is one focusable named region', async () => {
    renderWithBudget(<ExpenseList />, { state: SCENARIO });
    await screen.findByRole('table');
    const regions = screen.getAllByRole('region');
    const named = regions.filter((r) => r.getAttribute('aria-labelledby') !== null);
    const region = scrollRegion();
    expect(named).toContain(region);
    expect(region).toHaveAttribute('tabindex', '0');
  });

  it('inside the page, heading order has no skipped level under the single h1', async () => {
    renderApp({ state: SCENARIO, path: '/spending' });
    await screen.findByRole('table');
    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.forEach((level, i) => {
      if (i > 0) expect(level).toBeLessThanOrEqual(levels[i - 1]! + 1);
    });
    expect(screen.getByRole('table', { name: 'Expense table for November 2026' })).toBeInTheDocument();
  });

  it('the Spending page renders the list and still has no other alerts/live regions from it', async () => {
    render(<p>placeholder</p>);
    renderApp({ state: SCENARIO, path: '/spending' });
    await screen.findByRole('table');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const regions = screen.getAllByRole('status');
    expect(regions).toHaveLength(2);
    for (const region of regions) {
      expect(region).toHaveAttribute('data-part', 'status-message');
      expect(region).toHaveAttribute('data-visually-hidden', 'true');
      expect(region).toHaveTextContent('');
    }
  });
});

describe('source rules', () => {
  const dir = import.meta.dirname;
  const src = readFileSync(join(dir, 'ExpenseList.tsx'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const app = readFileSync(join(dir, '..', 'spending', 'SpendingPage.tsx'), 'utf8');

  it('starts with the client directive and imports library components only from @budget-kit/ui', () => {
    expect(src.startsWith("'use client';")).toBe(true);
    expect(src).not.toMatch(/@budget-kit\/ui\/src/);
    expect(src).not.toMatch(/from ['"]\.\.?\//);
  });

  it('no native button, input, select, textarea, table, dialog, style prop or css import', () => {
    expect(code).not.toMatch(/<(button|input|select|textarea|table|dialog)[\s>]/);
    expect(code).not.toMatch(/\bstyle=/);
    expect(code).not.toMatch(/\.css['"]/);
  });

  it('no className at all (the task allows none here)', () => {
    expect(code).not.toMatch(/className/);
  });

  it('no any, ts-ignore or ts-expect-error', () => {
    expect(code).not.toMatch(/:\s*any\b|\bas any\b|<any>/);
    expect(src).not.toMatch(/@ts-ignore|@ts-expect-error/);
  });

  it('no float parsing or arithmetic on amounts, and no Date parsing', () => {
    expect(code).not.toMatch(/parseFloat|toFixed|Number\(|\* 100|\/ 100|new Date\(|Date\.now/);
  });

  it('money only through formatMoney', () => {
    expect(code).toMatch(/formatMoney\(e\.amountCents\)/);
    expect(code).not.toMatch(/toLocaleString|Intl\.|formatCents/);
  });

  it('only one role="alert" (action-error) and no status or aria-live', () => {
    expect(code.match(/role="alert"/g)).toHaveLength(1);
    expect(code).toMatch(/<p role="alert" data-part="action-error">/);
    expect(code).not.toMatch(/role="status"|aria-live/);
  });

  it('every actions.* call is inside a try block with a catch', () => {
    const calls = [...code.matchAll(/actions\.\w+\(/g)];
    expect(calls).toHaveLength(1);
    const tryAt = code.indexOf('try {');
    const catchAt = code.indexOf('catch');
    expect(tryAt).toBeGreaterThan(-1);
    expect(calls[0]!.index).toBeGreaterThan(tryAt);
    expect(calls[0]!.index).toBeLessThan(catchAt);
  });

  it('SpendingPage mounts <ExpenseList /> exactly once', () => {
    expect(app.match(/<ExpenseList \/>/g)).toHaveLength(1);
    expect(app.match(/ExpenseList\b/g)).toHaveLength(3);
  });
});
