import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { type BudgetState, MAX_CENTS } from '@/lib/budget';
import { STORAGE_KEY, serializeBudget } from '@/state/storage';
import { SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import { type RenderWithBudgetOptions, type RenderWithBudgetResult, renderWithBudget } from '@/test/renderWithBudget';
import { BudgetApp } from './BudgetApp';

const FIRST_RUN = 'Start by entering your monthly income and what you plan to spend in each category.';
const INVALID =
  "Your saved budget couldn't be read, so a new one was started. Your first change will replace the saved data.";
const REPLACED = "Your saved budget couldn't be read and has been replaced.";
const UNAVAILABLE =
  "This browser isn't letting the app save, so your changes will be lost when you close the page.";
const TOO_LARGE = 'That change would make a total too large.';

type View = RenderWithBudgetResult;

async function ready(): Promise<void> {
  await screen.findByRole('heading', { level: 2, name: 'Summary' });
}

function region(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

// A Stat is a list item "<label><value>[<change>]" inside the Summary region.
function statItem(label: string): HTMLElement {
  const found = within(region('Summary'))
    .getAllByRole('listitem')
    .find((li) => li.textContent?.startsWith(label));
  if (found === undefined) throw new Error(`No stat labelled ${label}`);
  return found;
}

function expectStat(label: string, value: string, change?: string): void {
  const text = statItem(label).textContent ?? '';
  expect(text.startsWith(`${label}${value}`), `${label} should read ${value}, got "${text}"`).toBe(true);
  // The character after the value must not continue the number.
  expect(text.slice(label.length + value.length, label.length + value.length + 1)).not.toMatch(/[0-9.,]/);
  if (change !== undefined) expect(text).toContain(change);
}

function categoryItem(name: string): HTMLElement {
  const found = within(region('Spending by category'))
    .getAllByRole('listitem')
    .find((li) => li.textContent?.startsWith(name));
  if (found === undefined) throw new Error(`No category item ${name}`);
  return found;
}

function expenseRows(): string[][] {
  const table = within(region('Expenses')).getByRole('table');
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      Array.from(row.querySelectorAll('th, td'))
        .slice(0, 4)
        .map((cell) => cell.textContent ?? ''),
    );
}

function fieldValues(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const box of within(region('Set up the month')).getAllByRole('textbox')) {
    const name = box.getAttribute('aria-label') ?? (box as HTMLInputElement).labels?.[0]?.textContent ?? '';
    out[name] = (box as HTMLInputElement).value;
  }
  return out;
}

async function setUpMonth(user: UserEvent): Promise<void> {
  await user.type(screen.getByLabelText('Monthly income (USD)'), '3200');
  const planned = ['1500', '400', '120', '150', '100'];
  for (const [i, amount] of planned.entries()) {
    await user.type(screen.getByLabelText(`Category ${i + 1} planned (USD)`), amount);
  }
}

interface NewExpense {
  amount: string;
  category: string;
  note?: string;
  date?: string;
}

async function addExpense(user: UserEvent, e: NewExpense): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Add expense' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
  await user.type(within(dialog).getByLabelText('Amount (USD)'), e.amount);
  await user.selectOptions(within(dialog).getByLabelText('Category'), e.category);
  if (e.note !== undefined) await user.type(within(dialog).getByLabelText(/^Note/), e.note);
  if (e.date !== undefined) await user.selectOptions(within(dialog).getByLabelText('Date'), e.date);
  await user.click(within(dialog).getByRole('button', { name: 'Save expense' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

async function firstScenario(user: UserEvent): Promise<void> {
  await setUpMonth(user);
  await addExpense(user, { amount: '1500', category: 'Rent', note: 'November rent', date: 'Nov 1, 2026' });
  await addExpense(user, { amount: '82.47', category: 'Groceries', date: 'Nov 3, 2026' });
  await addExpense(user, { amount: '112.35', category: 'Eating out', note: 'Birthday dinner', date: 'Nov 5, 2026' });
}

async function deleteExpense(user: UserEvent, name: string): Promise<void> {
  await user.click(within(region('Expenses')).getByRole('button', { name }));
}

async function startFresh(options: RenderWithBudgetOptions = { today: '2026-11-14' }): Promise<View> {
  const view = renderWithBudget(<BudgetApp />, options);
  await ready();
  return view;
}

describe('new user, 5 categories, 3 expenses, correct totals', () => {
  it('shows the first-run line before anything is entered', async () => {
    await startFresh();
    expect(screen.getByText(FIRST_RUN)).toBeInTheDocument();
    expectStat('Income', '$0.00');
    expectStat('Left to spend', 'Not set');
  });

  it('computes every figure to the cent after setup and three expenses', async () => {
    const view = await startFresh();
    await setUpMonth(view.user);
    expectStat('Income', '$3,200.00');
    expectStat('Planned', '$2,270.00');

    await addExpense(view.user, { amount: '1500', category: 'Rent', note: 'November rent', date: 'Nov 1, 2026' });
    expect(screen.queryByText(FIRST_RUN)).not.toBeInTheDocument();
    await addExpense(view.user, { amount: '82.47', category: 'Groceries', date: 'Nov 3, 2026' });
    await addExpense(view.user, { amount: '112.35', category: 'Eating out', note: 'Birthday dinner', date: 'Nov 5, 2026' });

    expectStat('Income', '$3,200.00');
    expectStat('Planned', '$2,270.00');
    expectStat('Spent', '$1,694.82');
    expectStat('Left to spend', '$1,505.18');
    expectStat('Unplanned money', '$930.00');

    const groceries = screen.getByRole('progressbar', { name: 'Groceries' });
    expect(groceries).toHaveAttribute('aria-valuetext', '$82.47 of $400.00');
    expect(within(categoryItem('Groceries')).getByText('$317.53 left')).toBeInTheDocument();

    const eatingOut = screen.getByRole('progressbar', { name: 'Eating out' });
    expect(eatingOut).toHaveAttribute('aria-valuetext', '$112.35 of $100.00, over by $12.35');
    expect(within(categoryItem('Eating out')).getByText('Over budget')).toBeInTheDocument();

    expect(expenseRows()).toEqual([
      ['Nov 5, 2026', 'Eating out', 'Birthday dinner', '$112.35'],
      ['Nov 3, 2026', 'Groceries', '', '$82.47'],
      ['Nov 1, 2026', 'Rent', 'November rent', '$1,500.00'],
    ]);
    expect(view.readStored()?.expenses.map((x) => x.amountCents)).toEqual([150000, 8247, 11235]);
  });
});

describe('overspending to the cent', () => {
  it('shows a negative Left to spend and an over-budget Transport', async () => {
    const view = await startFresh();
    await firstScenario(view.user);
    await addExpense(view.user, { amount: '2000', category: 'Transport', date: 'Nov 10, 2026' });
    expectStat('Spent', '$3,694.82');
    expectStat('Left to spend', '-$494.82', 'Spent $494.82 more than your income');
    expect(within(categoryItem('Transport')).getByText('Over budget')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Transport' })).toHaveAttribute(
      'aria-valuetext',
      '$2,000.00 of $120.00, over by $1,880.00',
    );
  });
});

describe('deleting an expense to the cent', () => {
  it('recomputes after deleting Transport then Groceries', async () => {
    const view = await startFresh();
    await firstScenario(view.user);
    await addExpense(view.user, { amount: '2000', category: 'Transport', date: 'Nov 10, 2026' });
    await deleteExpense(view.user, 'Delete $2,000.00 Transport expense from Nov 10, 2026');
    expectStat('Spent', '$1,694.82');
    await deleteExpense(view.user, 'Delete $82.47 Groceries expense from Nov 3, 2026');
    expectStat('Spent', '$1,612.35');
    expectStat('Left to spend', '$1,587.65');
    expect(screen.getByRole('progressbar', { name: 'Groceries' })).toHaveAttribute(
      'aria-valuetext',
      '$0.00 of $400.00',
    );
    expect(expenseRows()).toHaveLength(2);
    expect(view.readStored()?.expenses).toHaveLength(2);
  });
});

async function untilRemovedCategory(view: View): Promise<void> {
  await firstScenario(view.user);
  await addExpense(view.user, { amount: '2000', category: 'Transport', date: 'Nov 10, 2026' });
  await deleteExpense(view.user, 'Delete $2,000.00 Transport expense from Nov 10, 2026');
  await deleteExpense(view.user, 'Delete $82.47 Groceries expense from Nov 3, 2026');
  await view.user.click(screen.getByRole('button', { name: 'Remove Eating out' }));
}

describe('removed category', () => {
  it('drops the plan, keeps the spending and relabels the expense row', async () => {
    const view = await startFresh();
    await untilRemovedCategory(view);
    expectStat('Planned', '$2,170.00');
    expectStat('Spent', '$1,612.35');
    expect(
      screen.getByText(
        'The Spent total includes $112.35 from removed categories, which are not listed above.',
      ),
    ).toBeInTheDocument();
    expect(expenseRows()[0]).toEqual(['Nov 5, 2026', 'Removed category', 'Birthday dinner', '$112.35']);
    expect(screen.queryByRole('progressbar', { name: 'Eating out' })).not.toBeInTheDocument();
  });
});

describe('refresh keeps everything', () => {
  it('every figure, row, category name and planned field is unchanged after refresh', async () => {
    const view = await startFresh();
    await untilRemovedCategory(view);
    const labels = ['Income', 'Planned', 'Spent', 'Left to spend', 'Unplanned money'];
    const before = {
      stats: labels.map((l) => statItem(l).textContent),
      rows: expenseRows(),
      fields: fieldValues(),
      categories: within(region('Spending by category'))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
      note: screen.getByText(/The Spent total includes/).textContent,
    };
    expect(Object.keys(before.fields).length).toBeGreaterThan(8);
    view.refresh();
    await ready();
    expect(labels.map((l) => statItem(l).textContent)).toEqual(before.stats);
    expect(expenseRows()).toEqual(before.rows);
    expect(fieldValues()).toEqual(before.fields);
    expect(
      within(region('Spending by category'))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(before.categories);
    expect(screen.getByText(/The Spent total includes/).textContent).toBe(before.note);
    expect(screen.getByText('Budget for November 2026')).toBeInTheDocument();
  });
});

describe('reset only after confirming', () => {
  async function populated(): Promise<View> {
    const view = await startFresh({ state: SCENARIO, today: '2026-11-14' });
    return view;
  }

  it('Esc and Cancel change nothing, confirming resets, and the reset survives a refresh', async () => {
    const view = await populated();
    const { user, storage } = view;
    const stored = storage.dump()[STORAGE_KEY];
    const trigger = region('Reset month').querySelector('button') as HTMLButtonElement;
    expect(trigger).toHaveAccessibleName('Reset month');

    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Reset month?' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expectStat('Spent', '$1,694.82');
    expect(storage.dump()[STORAGE_KEY]).toBe(stored);

    await user.click(trigger);
    const second = await screen.findByRole('dialog', { name: 'Reset month?' });
    await user.click(within(second).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expectStat('Spent', '$1,694.82');
    expect(storage.dump()[STORAGE_KEY]).toBe(stored);
    expect(storage.setItemCalls).toBe(0);

    await user.click(trigger);
    const third = await screen.findByRole('dialog', { name: 'Reset month?' });
    await user.click(within(third).getByRole('button', { name: 'Reset month' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(screen.getByLabelText('Monthly income (USD)')).toHaveValue('');
    expectStat('Planned', '$0.00');
    expectStat('Spent', '$0.00');
    expectStat('Left to spend', 'Not set');
    ['Rent', 'Groceries', 'Transport', 'Utilities', 'Eating out'].forEach((name, i) => {
      expect(screen.getByLabelText(`Category ${i + 1} name`)).toHaveValue(name);
      expect(screen.getByLabelText(`Category ${i + 1} planned (USD)`)).toHaveValue('');
    });
    expect(screen.getByText('No expenses yet this month.')).toBeInTheDocument();
    expect(screen.getByText(FIRST_RUN)).toBeInTheDocument();
    expect(trigger).toHaveFocus();

    view.refresh();
    await ready();
    expect(screen.getByLabelText('Monthly income (USD)')).toHaveValue('');
    expectStat('Spent', '$0.00');
    expect(screen.getByText('No expenses yet this month.')).toBeInTheDocument();
    expect(screen.getByText(FIRST_RUN)).toBeInTheDocument();
  });
});

describe('first expense with no plan is not red', () => {
  it('shows No plan set and Not set, with no over-budget text and no danger tone', async () => {
    const view = await startFresh();
    expect(screen.getByText(FIRST_RUN)).toBeInTheDocument();
    await addExpense(view.user, { amount: '20', category: 'Groceries' });
    expect(screen.queryByText(FIRST_RUN)).not.toBeInTheDocument();
    const item = categoryItem('Groceries');
    expect(within(item).getByText('No plan set')).toBeInTheDocument();
    expect(within(item).getByText('Spent $20.00')).toBeInTheDocument();
    expect(screen.queryByText(/Over budget/)).not.toBeInTheDocument();
    expect(document.body.querySelector('[data-tone="danger"]')).toBeNull();
    expectStat('Left to spend', 'Not set');
    expect(expenseRows()[0]).toEqual(['Nov 14, 2026', 'Groceries', '', '$20.00']);
  });
});

describe('rollover', () => {
  it('shows the notice first, leaves storage alone, then starts December and survives refresh', async () => {
    const view = await startFresh({ state: SCENARIO, today: '2026-12-02' });
    const { user, storage } = view;
    const stored = storage.dump()[STORAGE_KEY];

    expect(screen.getByText('This budget is for November 2026. It is now December 2026.')).toBeInTheDocument();
    expect(screen.getByText('Budget for November 2026')).toBeInTheDocument();
    const notice = screen.getByRole('region', { name: 'New month' });
    const summary = region('Summary');
    expect(notice.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const main = screen.getByRole('main');
    const heading = screen.getByRole('heading', { level: 1 });
    // First in the page after the heading block.
    const blocks = Array.from(main.children);
    expect(blocks.indexOf(notice)).toBe(blocks.indexOf(heading.parentElement as HTMLElement) + 1);
    expectStat('Spent', '$1,694.82');
    expectStat('Income', '$3,200.00');
    expect(within(categoryItem('Groceries')).getByText('$317.53 left')).toBeInTheDocument();
    expect(expenseRows()).toHaveLength(3);
    expect(storage.dump()[STORAGE_KEY]).toBe(stored);
    expect(storage.setItemCalls).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Start December 2026 budget' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset month?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(screen.getByText('Budget for December 2026')).toBeInTheDocument();
    expectStat('Spent', '$0.00');
    expectStat('Income', '$0.00');
    expect(screen.getByText('No expenses yet this month.')).toBeInTheDocument();
    expect(screen.getByText(FIRST_RUN)).toBeInTheDocument();
    expect(screen.getByText('New budget started for December 2026.')).toHaveFocus();
    expect(view.readStored()?.month).toBe('2026-12');

    view.refresh();
    await ready();
    expect(screen.getByText('Budget for December 2026')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'New month' })).not.toBeInTheDocument();
    expect(screen.queryByText(/It is now/)).not.toBeInTheDocument();
  });
});

describe('category names', () => {
  it('rejects a duplicate rename (keeps Groceries everywhere) and accepts Food after blur', async () => {
    const view = await startFresh({ state: SCENARIO, today: '2026-11-14' });
    const { user } = view;
    const name = screen.getByLabelText('Category 2 name');
    await user.clear(name);
    await user.type(name, 'rent');
    await user.tab();

    expect(screen.getByLabelText('Category 2 name')).toHaveValue('Groceries');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('You already have a category called Rent. The name is still Groceries.');
    expect(within(region('Spending by category')).getByRole('progressbar', { name: 'Groceries' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
    const options = within(within(dialog).getByLabelText('Category')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('Groceries');
    expect(options.filter((o) => o?.toLowerCase() === 'rent')).toEqual(['Rent']);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const again = screen.getByLabelText('Category 2 name');
    await user.clear(again);
    await user.type(again, 'Food');
    await user.tab();
    expect(screen.getByLabelText('Category 2 name')).toHaveValue('Food');
    expect(within(region('Spending by category')).getByRole('progressbar', { name: 'Food' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Groceries' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog2 = await screen.findByRole('dialog', { name: 'Add expense' });
    const options2 = within(within(dialog2).getByLabelText('Category')).getAllByRole('option').map((o) => o.textContent);
    expect(options2).toContain('Food');
    expect(options2).not.toContain('Groceries');
    expect(view.readStored()?.categories[1]?.name).toBe('Food');
  });
});

describe('saved-data messages', () => {
  it('invalid data: first message, stored value untouched, replaced message after the first change, none after refresh', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: 'not json' });
    const view = await startFresh({ storage, today: '2026-11-14' });
    expect(screen.getByText(INVALID)).toBeInTheDocument();
    expect(storage.dump()[STORAGE_KEY]).toBe('not json');

    await view.user.type(screen.getByLabelText('Monthly income (USD)'), '3200');
    expect(screen.queryByText(INVALID)).not.toBeInTheDocument();
    expect(screen.getByText(REPLACED)).toBeInTheDocument();
    expect(view.readStored()?.incomeCents).toBe(320000);
    expect(storage.dump()[STORAGE_KEY]).not.toBe('not json');

    view.refresh();
    await ready();
    expect(screen.queryByText(INVALID)).not.toBeInTheDocument();
    expect(screen.queryByText(REPLACED)).not.toBeInTheDocument();
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
  });

  it('shows neither message for loaded or empty storage', async () => {
    await startFresh({ state: SCENARIO });
    for (const text of [INVALID, REPLACED, UNAVAILABLE]) expect(screen.queryByText(text)).not.toBeInTheDocument();
  });

  it('shows neither message for empty storage', async () => {
    await startFresh();
    for (const text of [INVALID, REPLACED, UNAVAILABLE]) expect(screen.queryByText(text)).not.toBeInTheDocument();
  });

  it('unavailable storage: message shown and the first scenario step still updates the Stats', async () => {
    const storage = createMemoryStorage({}, { throwOnGet: true, throwOnSet: true });
    const view = await startFresh({ storage });
    expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
    expect(screen.queryByText(INVALID)).not.toBeInTheDocument();
    await view.user.type(screen.getByLabelText('Monthly income (USD)'), '3200');
    expectStat('Income', '$3,200.00');
    expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
  });
});

describe('totals safety end to end', () => {
  function withExpenses(count: number): BudgetState {
    return {
      month: '2026-11',
      incomeCents: 0,
      categories: [{ id: 'c1', name: 'Rent', plannedCents: 0 }],
      expenses: Array.from({ length: count }, (_v, i) => ({
        id: `e${i}`,
        categoryId: 'c1',
        amountCents: MAX_CENTS,
        note: '',
        date: '2026-11-01',
      })),
    };
  }

  it('91 expenses of MAX_CENTS: invalid message, initial state, no crash', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeBudget(withExpenses(91)) });
    await startFresh({ storage });
    expect(screen.getByText(INVALID)).toBeInTheDocument();
    expect(screen.getByText('No expenses yet this month.')).toBeInTheDocument();
    expectStat('Spent', '$0.00');
  });

  it('90 expenses of MAX_CENTS: one more shows the total-too-large error, dialog stays open, Stats unchanged', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeBudget(withExpenses(90)) });
    const view = await startFresh({ storage });
    expect(screen.queryByText(INVALID)).not.toBeInTheDocument();
    const spentBefore = statItem('Spent').textContent;
    const stored = storage.dump()[STORAGE_KEY];

    await view.user.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
    await view.user.type(within(dialog).getByLabelText('Amount (USD)'), '999999999999.99');
    await view.user.selectOptions(within(dialog).getByLabelText('Category'), 'Rent');
    await view.user.click(within(dialog).getByRole('button', { name: 'Save expense' }));

    const amount = within(dialog).getByLabelText('Amount (USD)');
    expect(await within(dialog).findByText(TOO_LARGE)).toBeInTheDocument();
    expect(amount).toHaveAccessibleDescription(TOO_LARGE);
    expect(screen.getByRole('dialog', { name: 'Add expense' })).toBeInTheDocument();
    expect(amount).toHaveValue('999,999,999,999.99');
    expect(statItem('Spent').textContent).toBe(spentBefore);
    expect(storage.dump()[STORAGE_KEY]).toBe(stored);
  });
});

describe('one dialog at a time', () => {
  it('Reset month is inert while Add expense is open, and vice versa; never two dialogs', async () => {
    const view = await startFresh({ state: SCENARIO, today: '2026-11-14' });
    const { user } = view;
    const resetButton = region('Reset month').querySelector('button') as HTMLButtonElement;
    const addButton = screen.getByRole('button', { name: 'Add expense' });
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);

    await user.click(addButton);
    await screen.findByRole('dialog', { name: 'Add expense' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(resetButton.closest('[inert]')).not.toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(resetButton.closest('[inert]')).toBeNull();

    await user.click(resetButton);
    await screen.findByRole('dialog', { name: 'Reset month?' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(addButton.closest('[inert]')).not.toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(addButton.closest('[inert]')).toBeNull();
  });

  it('in rollover the notice button is inert while Add expense is open', async () => {
    const view = await startFresh({ state: SCENARIO, today: '2026-12-02' });
    const { user } = view;
    const noticeButton = screen.getByRole('button', { name: 'Start December 2026 budget' });
    const resetButton = region('Reset month').querySelector('button') as HTMLButtonElement;
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    await screen.findByRole('dialog', { name: 'Add expense' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(noticeButton.closest('[inert]')).not.toBeNull();
    expect(resetButton.closest('[inert]')).not.toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(noticeButton);
    await screen.findByRole('dialog', { name: 'Reset month?' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Add expense', hidden: true }).closest('[inert]')).not.toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('the whole new-user scenario never shows more than one dialog', async () => {
    const view = await startFresh();
    let max = 0;
    const observer = new MutationObserver(() => {
      max = Math.max(max, document.querySelectorAll('[role="dialog"]').length);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    try {
      await firstScenario(view.user);
    } finally {
      observer.disconnect();
    }
    expect(max).toBe(1);
  });
});
