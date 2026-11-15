import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { type BudgetState, MAX_CENTS } from '@/lib/budget';
import { STORAGE_KEY, serializeBook } from '@/state/storage';
import { BOOK, SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import { type RenderAppResult, renderApp } from '@/test/renderApp';

const WELCOME = 'Welcome. Start on the Plan page: enter your monthly income and add the categories you spend on.';
const INVALID =
  "Your saved budget couldn't be read, so a new one was started. Your first change will replace the saved data.";
const REPLACED = "Your saved budget couldn't be read and has been replaced.";
const UNAVAILABLE =
  "This browser isn't letting the app save, so your changes will be lost when you close the page.";
const TOO_LARGE = 'That change would make a total too large.';
const NEW_MONTH_NOTE =
  'New month. Your income and categories were copied from November 2026. Change them on the Plan page.';
const PATHS = ['/', '/spending', '/plan', '/history'] as const;
const NAV_NAMES = { '/': 'Overview', '/spending': 'Spending', '/plan': 'Plan', '/history': 'History' } as const;

type View = RenderAppResult;

// ---------------------------------------------------------------- queries (roles and visible labels only)

function nav(name: string): HTMLElement {
  return within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name });
}

function region(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

// A Stat is a list item "<label><value>[<change>]" in the Summary region.
function statText(label: string): string {
  const found = within(region('Summary'))
    .getAllByRole('listitem')
    .find((li) => li.textContent?.startsWith(label));
  if (found === undefined) throw new Error(`No stat labelled ${label}`);
  return found.textContent ?? '';
}

function expectStat(label: string, value: string, change?: string): void {
  const text = statText(label);
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
  const table = screen.getByRole('table', { name: /^Expense table for / });
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      Array.from(row.querySelectorAll('th, td'))
        .slice(0, 4)
        .map((cell) => cell.textContent ?? ''),
    );
}

function plannedFields(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const box of within(region('Categories')).getAllByRole('textbox')) {
    const name = (box as HTMLInputElement).labels?.[0]?.textContent ?? '';
    out[name] = (box as HTMLInputElement).value;
  }
  return out;
}

function monthLabel(): string {
  const header = document.querySelector('header');
  const label = within(header as HTMLElement).queryByText(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/);
  return label?.textContent ?? '';
}

function historyRows(): string[][] {
  const table = screen.getByRole('table', { name: 'Months' });
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => Array.from(row.children).map((c) => c.textContent ?? ''));
}

// ---------------------------------------------------------------- actions (pointer)

async function go(user: UserEvent, name: string): Promise<void> {
  await user.click(nav(name));
}

async function addExpense(
  user: UserEvent,
  e: { amount: string; category: string; note?: string; date?: string },
): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Add expense' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
  await user.type(within(dialog).getByLabelText('Amount (USD)'), e.amount);
  await user.selectOptions(within(dialog).getByLabelText('Category'), e.category);
  if (e.note !== undefined) await user.type(within(dialog).getByLabelText(/^Note/), e.note);
  if (e.date !== undefined) await user.selectOptions(within(dialog).getByLabelText('Date'), e.date);
  await user.click(within(dialog).getByRole('button', { name: 'Save expense' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

const SUGGESTIONS = ['Rent', 'Groceries', 'Transport', 'Utilities', 'Eating out'];
const PLANNED = ['1500', '400', '120', '150', '100'];

async function setUpPlan(user: UserEvent): Promise<void> {
  await go(user, 'Plan');
  await user.type(screen.getByLabelText('Monthly income (USD)'), '3200');
  for (const name of SUGGESTIONS) await user.click(screen.getByRole('button', { name: `Add ${name}` }));
  for (const [i, amount] of PLANNED.entries()) {
    await user.type(screen.getByLabelText(`Category ${i + 1} planned (USD)`), amount);
  }
}

async function addThreeExpenses(user: UserEvent): Promise<void> {
  await addExpense(user, { amount: '1500', category: 'Rent', note: 'November rent', date: 'Nov 1, 2026' });
  await addExpense(user, { amount: '82.47', category: 'Groceries', date: 'Nov 3, 2026' });
  await addExpense(user, { amount: '112.35', category: 'Eating out', note: 'Birthday dinner', date: 'Nov 5, 2026' });
}

async function firstScenario(user: UserEvent): Promise<void> {
  expect(screen.getByText(WELCOME)).toBeInTheDocument();
  await setUpPlan(user);
  await addThreeExpenses(user);
  await go(user, 'Overview');
}

function expectFirstScenarioFigures(): void {
  expectStat('Income', '$3,200.00');
  expectStat('Planned', '$2,270.00');
  expectStat('Spent', '$1,694.82');
  expectStat('Left to spend', '$1,505.18');
  expectStat('Unplanned money', '$930.00');
  expect(screen.getByRole('progressbar', { name: 'Groceries' })).toHaveAttribute('aria-valuetext', '$82.47 of $400.00');
  expect(within(categoryItem('Groceries')).getByText('$317.53 left')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Eating out' })).toHaveAttribute(
    'aria-valuetext',
    '$112.35 of $100.00, over by $12.35',
  );
  expect(within(categoryItem('Eating out')).getByText('Over budget')).toBeInTheDocument();
  expect(screen.queryByText(WELCOME)).not.toBeInTheDocument();
}

const THREE_ROWS = [
  ['Nov 5, 2026', 'Eating out', 'Birthday dinner', '$112.35'],
  ['Nov 3, 2026', 'Groceries', '', '$82.47'],
  ['Nov 1, 2026', 'Rent', 'November rent', '$1,500.00'],
];

// New user -> overspend -> delete two -> remove Eating out. Leaves the user on Overview.
async function untilRemovedCategory(view: View): Promise<void> {
  const { user } = view;
  await firstScenario(user);
  await addExpense(user, { amount: '2000', category: 'Transport', date: 'Nov 10, 2026' });
  await go(user, 'Spending');
  await user.click(screen.getByRole('button', { name: 'Delete $2,000.00 Transport expense from Nov 10, 2026' }));
  await user.click(screen.getByRole('button', { name: 'Delete $82.47 Groceries expense from Nov 3, 2026' }));
  await go(user, 'Plan');
  await user.click(screen.getByRole('button', { name: 'Remove Eating out' }));
  await go(user, 'Overview');
}

// ---------------------------------------------------------------- criteria

describe('new user, without instructions', () => {
  it('shows the welcome line on / and the four-link nav, with Plan reachable', () => {
    renderApp();
    expect(screen.getByText(WELCOME)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(['Overview', 'Spending', 'Plan', 'History'].map((n) => nav(n).textContent)).toEqual([
      'Overview',
      'Spending',
      'Plan',
      'History',
    ]);
  });

  it('computes every figure to the cent through the nav, Plan page and the header Add expense', async () => {
    const view = renderApp();
    const { user } = view;
    await setUpPlan(user);

    // Plan state after setup, before any expense.
    expect(screen.getByLabelText('Monthly income (USD)')).toHaveValue('3,200.00');
    expect(
      SUGGESTIONS.map((_n, i) => (screen.getByLabelText(`Category ${i + 1} name`) as HTMLInputElement).value),
    ).toEqual(SUGGESTIONS);
    await go(user, 'Overview');
    expectStat('Income', '$3,200.00');
    expectStat('Planned', '$2,270.00');

    await addExpense(user, { amount: '1500', category: 'Rent', note: 'November rent', date: 'Nov 1, 2026' });
    expect(screen.queryByText(WELCOME)).not.toBeInTheDocument();
    await addExpense(user, { amount: '82.47', category: 'Groceries', date: 'Nov 3, 2026' });
    await addExpense(user, { amount: '112.35', category: 'Eating out', note: 'Birthday dinner', date: 'Nov 5, 2026' });

    expectFirstScenarioFigures();
    await go(user, 'Spending');
    expect(expenseRows()).toEqual(THREE_ROWS);
    expect(view.readStored()?.expenses.map((x) => x.amountCents)).toEqual([150000, 8247, 11235]);
    expect(view.readStored()?.incomeCents).toBe(320000);
    expect(view.readStored()?.categories.map((c) => c.plannedCents)).toEqual([150000, 40000, 12000, 15000, 10000]);
  });
});

describe('overspending to the cent', () => {
  it('shows a negative Left to spend and an over-budget Transport', async () => {
    const view = renderApp();
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

describe('deleting to the cent', () => {
  it('recomputes after deleting Transport then Groceries on Spending', async () => {
    const view = renderApp();
    const { user } = view;
    await firstScenario(user);
    await addExpense(user, { amount: '2000', category: 'Transport', date: 'Nov 10, 2026' });
    await go(user, 'Spending');
    expect(expenseRows()).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'Delete $2,000.00 Transport expense from Nov 10, 2026' }));
    await user.click(screen.getByRole('button', { name: 'Delete $82.47 Groceries expense from Nov 3, 2026' }));
    expect(expenseRows()).toHaveLength(2);
    await go(user, 'Overview');
    expectStat('Spent', '$1,612.35');
    expectStat('Left to spend', '$1,587.65');
    expect(screen.getByRole('progressbar', { name: 'Groceries' })).toHaveAttribute('aria-valuetext', '$0.00 of $400.00');
    expect(view.readStored()?.expenses).toHaveLength(2);
  });
});

describe('removed category', () => {
  it('drops the plan, keeps the spending and relabels the Nov 5 row', async () => {
    const view = renderApp();
    await untilRemovedCategory(view);
    expectStat('Planned', '$2,170.00');
    expectStat('Spent', '$1,612.35');
    expect(
      screen.getByText('The Spent total includes $112.35 from removed categories, which are not listed above.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Eating out' })).not.toBeInTheDocument();
    await go(view.user, 'Spending');
    expect(expenseRows()[0]).toEqual(['Nov 5, 2026', 'Removed category', 'Birthday dinner', '$112.35']);
  });
});

describe('refresh keeps everything on each of the four paths', () => {
  async function snapshot(path: (typeof PATHS)[number]): Promise<unknown> {
    switch (path) {
      case '/':
        return {
          stats: ['Income', 'Planned', 'Spent', 'Left to spend', 'Unplanned money'].map(statText),
          categories: within(region('Spending by category'))
            .getAllByRole('listitem')
            .map((li) => li.textContent),
          note: screen.getByText(/The Spent total includes/).textContent,
        };
      case '/spending':
        return expenseRows();
      case '/plan':
        return plannedFields();
      default:
        return historyRows();
    }
  }

  it.each(PATHS)('%s: every figure, row, name and planned field is unchanged after refresh()', async (path) => {
    const view = renderApp();
    await untilRemovedCategory(view);
    // Dirty the viewed month too: refresh must come back to the current month.
    view.goTo(path);
    const before = await snapshot(path);
    expect(before).toBeTruthy();
    view.refresh();
    await screen.findByRole('heading', { level: 1, name: NAV_NAMES[path] });
    expect(await snapshot(path)).toEqual(before);
    expect(monthLabel()).toBe(path === '/history' ? '' : 'November 2026');
    if (path === '/plan') {
      expect(Object.keys(plannedFields())).toHaveLength(4 * 2);
      expect(screen.getByLabelText('Monthly income (USD)')).toHaveValue('3,200.00');
    }
  });

  it('after refresh() every other path still shows the same figures (state is read from storage, not memory)', async () => {
    const view = renderApp();
    await untilRemovedCategory(view);
    view.refresh();
    await screen.findByRole('heading', { level: 1, name: 'Overview' });
    expectStat('Spent', '$1,612.35');
    expectStat('Planned', '$2,170.00');
    view.goTo('/spending');
    expect(expenseRows()).toHaveLength(2);
    view.goTo('/history');
    expect(historyRows()).toEqual([['November 2026 (this month)', '$3,200.00', '$1,612.35', '$1,587.65', 'View']]);
  });

  it('the viewed month is the current month again after refresh() (BOOK, October viewed)', async () => {
    const view = renderApp({ book: BOOK });
    await view.user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(monthLabel()).toBe('October 2026');
    view.goTo('/spending');
    expect(screen.getByRole('heading', { level: 2, name: 'Expenses in October 2026' })).toBeInTheDocument();
    view.refresh();
    expect(await screen.findByRole('heading', { level: 2, name: 'Expenses in November 2026' })).toBeInTheDocument();
    expect(monthLabel()).toBe('November 2026');
  });
});

describe('a new month keeps the old one', () => {
  async function stored(): Promise<{ view: View; storage: ReturnType<typeof createMemoryStorage> }> {
    const storage = createMemoryStorage();
    const view = renderApp({ storage, today: '2026-11-14' });
    await untilRemovedCategory(view);
    view.unmount();
    return { view, storage };
  }

  it('starts December as a copy, adds to it, and November stays separate and editable', async () => {
    const { storage } = await stored();
    const raw = storage.dump()[STORAGE_KEY];
    const view = renderApp({ storage, today: '2026-12-02' });
    const { user } = view;

    expect(monthLabel()).toBe('December 2026');
    expect(screen.getByText(NEW_MONTH_NOTE)).toBeInTheDocument();
    expectStat('Income', '$3,200.00');
    expectStat('Planned', '$2,170.00');
    expectStat('Spent', '$0.00');
    view.goTo('/spending');
    view.goTo('/plan');
    view.goTo('/history');
    view.goTo('/');
    expect(storage.dump()[STORAGE_KEY]).toBe(raw);

    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
    expect(within(dialog).getByLabelText('Date')).toHaveDisplayValue('Dec 2, 2026');
    await user.type(within(dialog).getByLabelText('Amount (USD)'), '50');
    await user.selectOptions(within(dialog).getByLabelText('Category'), 'Groceries');
    await user.click(within(dialog).getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText(NEW_MONTH_NOTE)).not.toBeInTheDocument();
    expectStat('Spent', '$50.00');
    // The copied December holds only the new expense: nothing came across from November.
    const december = view.readStoredBook()?.months.find((m) => m.month === '2026-12');
    expect(december?.expenses.map((x) => [x.amountCents, x.date])).toEqual([[5000, '2026-12-02']]);
    expect(december?.categories.map((c) => c.name)).toEqual(['Rent', 'Groceries', 'Transport', 'Utilities']);
    expect(view.readStoredBook()?.months.map((m) => m.month)).toEqual(['2026-11', '2026-12']);

    await go(user, 'History');
    expect(historyRows()).toEqual([
      ['December 2026 (this month)', '$3,200.00', '$50.00', '$3,150.00', 'View'],
      ['November 2026', '$3,200.00', '$1,612.35', '$1,587.65', 'View'],
    ]);

    await user.click(screen.getByRole('button', { name: 'View November 2026' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(monthLabel()).toBe('November 2026');
    expectStat('Income', '$3,200.00');
    expectStat('Planned', '$2,170.00');
    expectStat('Spent', '$1,612.35');
    expectStat('Left to spend', '$1,587.65');

    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const second = await screen.findByRole('dialog', { name: 'Add expense' });
    expect(within(second).getByLabelText('Date')).toHaveDisplayValue('Nov 1, 2026');
    await user.type(within(second).getByLabelText('Amount (USD)'), '10');
    await user.selectOptions(within(second).getByLabelText('Category'), 'Rent');
    await user.click(within(second).getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expectStat('Spent', '$1,622.35');

    await go(user, 'History');
    expect(historyRows()).toEqual([
      ['December 2026 (this month)', '$3,200.00', '$50.00', '$3,150.00', 'View'],
      ['November 2026', '$3,200.00', '$1,622.35', '$1,577.65', 'View'],
    ]);
    await user.click(screen.getByRole('button', { name: 'View December 2026' }));
    expectStat('Spent', '$50.00');
  });

  it('merely opening every page in the new month writes nothing and the month copy has no expenses', async () => {
    const { storage } = await stored();
    const raw = storage.dump()[STORAGE_KEY];
    const writes = storage.setItemCalls;
    const view = renderApp({ storage, today: '2026-12-02' });
    for (const path of PATHS) view.goTo(path);
    view.goTo('/spending');
    expect(screen.getByText('No expenses in December 2026.')).toBeInTheDocument();
    view.goTo('/plan');
    expect(screen.getByLabelText('Monthly income (USD)')).toHaveValue('3,200.00');
    expect(storage.setItemCalls).toBe(writes);
    expect(storage.dump()[STORAGE_KEY]).toBe(raw);
  });
});

describe('first expense with no plan is not red', () => {
  it('shows No plan set and Not set, with no over-budget text and no danger tone', async () => {
    const { user } = renderApp();
    await go(user, 'Plan');
    await user.click(screen.getByRole('button', { name: 'Add Groceries' }));
    await addExpense(user, { amount: '20', category: 'Groceries', date: 'Nov 14, 2026' });
    await go(user, 'Overview');
    const item = categoryItem('Groceries');
    expect(within(item).getByText('No plan set')).toBeInTheDocument();
    expect(within(item).getByText('Spent $20.00')).toBeInTheDocument();
    expectStat('Spent', '$20.00');
    expectStat('Left to spend', 'Not set');
    expect(screen.queryByText(/Over budget/)).not.toBeInTheDocument();
    expect(document.body.querySelector('[data-tone="danger"]')).toBeNull();
    // The welcome line goes once a month is stored.
    expect(screen.queryByText(WELCOME)).not.toBeInTheDocument();
  });
});

describe('Delete all data only after confirming', () => {
  it('Esc and Cancel change nothing, confirming empties storage and focus, / and refresh() stay empty', async () => {
    const view = renderApp({ state: SCENARIO, path: '/history' });
    const { user, storage } = view;
    const raw = storage.dump()[STORAGE_KEY];
    const trigger = screen.getByRole('button', { name: 'Delete all data' });

    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Delete all data?' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(storage.dump()[STORAGE_KEY]).toBe(raw);

    await user.click(trigger);
    const second = await screen.findByRole('dialog', { name: 'Delete all data?' });
    await user.click(within(second).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(storage.dump()[STORAGE_KEY]).toBe(raw);
    expect(storage.setItemCalls).toBe(0);
    expect(historyRows()).toHaveLength(1);

    await user.click(trigger);
    const third = await screen.findByRole('dialog', { name: 'Delete all data?' });
    await user.click(within(third).getByRole('button', { name: 'Delete all data' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(view.readStoredBook()).toEqual({ months: [] });
    expect(storage.dump()[STORAGE_KEY]).toBe('{"version":2,"book":{"months":[]}}');
    expect(screen.getByText("All data deleted. You're starting fresh with November 2026.")).toHaveFocus();

    await go(user, 'Overview');
    expect(screen.getByText(WELCOME)).toBeInTheDocument();
    view.refresh();
    expect(await screen.findByText(WELCOME)).toBeInTheDocument();
    expect(view.readStoredBook()).toEqual({ months: [] });
    expectStat('Spent', '$0.00');
  });
});

describe('category names', () => {
  it('rejects a duplicate rename everywhere, accepts Food after blur', async () => {
    const view = renderApp({ state: SCENARIO, path: '/plan' });
    const { user } = view;
    const name = screen.getByLabelText('Category 2 name');
    await user.clear(name);
    await user.type(name, 'rent');
    await user.tab();

    expect(screen.getByLabelText('Category 2 name')).toHaveValue('Groceries');
    expect(screen.getByLabelText('Category 2 name')).toHaveAccessibleDescription(
      'You already have a category called Rent. The name is still Groceries.',
    );
    await go(user, 'Overview');
    expect(screen.getByRole('progressbar', { name: 'Groceries' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
    const options = within(within(dialog).getByLabelText('Category')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('Groceries');
    expect(options.filter((o) => o?.toLowerCase() === 'rent')).toEqual(['Rent']);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await go(user, 'Plan');
    const again = screen.getByLabelText('Category 2 name');
    await user.clear(again);
    await user.type(again, 'Food');
    await user.tab();
    expect(screen.getByLabelText('Category 2 name')).toHaveValue('Food');
    await go(user, 'Overview');
    expect(screen.getByRole('progressbar', { name: 'Food' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Groceries' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const second = await screen.findByRole('dialog', { name: 'Add expense' });
    const options2 = within(within(second).getByLabelText('Category')).getAllByRole('option').map((o) => o.textContent);
    expect(options2).toContain('Food');
    expect(options2).not.toContain('Groceries');
    expect(view.readStored()?.categories[1]?.name).toBe('Food');
  });
});

describe('migration of version 1 data', () => {
  const V1 = JSON.stringify({ version: 1, state: SCENARIO });

  it('every page shows SCENARIO, storage stays version 1 until the first change, then version 2', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: V1 });
    const view = renderApp({ storage, today: '2026-11-14' });
    const { user } = view;
    expectFirstScenarioFigures();
    await go(user, 'Spending');
    expect(expenseRows()).toEqual(THREE_ROWS);
    await go(user, 'Plan');
    expect(screen.getByLabelText('Monthly income (USD)')).toHaveValue('3,200.00');
    SCENARIO.categories.forEach((c, i) => {
      expect(screen.getByLabelText(`Category ${i + 1} name`)).toHaveValue(c.name);
    });
    await go(user, 'History');
    expect(historyRows()).toEqual([['November 2026 (this month)', '$3,200.00', '$1,694.82', '$1,505.18', 'View']]);
    expect(storage.dump()[STORAGE_KEY]).toBe(V1);
    expect(storage.setItemCalls).toBe(0);

    await go(user, 'Plan');
    await user.clear(screen.getByLabelText('Category 5 planned (USD)'));
    await user.type(screen.getByLabelText('Category 5 planned (USD)'), '100');
    expect(JSON.parse(storage.dump()[STORAGE_KEY] ?? '{}')).toMatchObject({ version: 2 });
    expect(view.readStored()).toEqual(SCENARIO);
    await go(user, 'Overview');
    expectFirstScenarioFigures();
  });

  it('with today 2026-12-02 December is a copy and November is in History unchanged', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: V1 });
    const view = renderApp({ storage, today: '2026-12-02' });
    const { user } = view;
    expect(monthLabel()).toBe('December 2026');
    expectStat('Income', '$3,200.00');
    expectStat('Planned', '$2,270.00');
    expectStat('Spent', '$0.00');
    await go(user, 'Plan');
    expect(screen.getByLabelText('Monthly income (USD)')).toHaveValue('3,200.00');
    expect(
      SCENARIO.categories.map((_c, i) => (screen.getByLabelText(`Category ${i + 1} name`) as HTMLInputElement).value),
    ).toEqual(SCENARIO.categories.map((c) => c.name));
    await go(user, 'History');
    expect(historyRows()).toEqual([
      ['December 2026 (this month)', '$3,200.00', '$0.00', '$3,200.00', 'View'],
      ['November 2026', '$3,200.00', '$1,694.82', '$1,505.18', 'View'],
    ]);
    expect(storage.dump()[STORAGE_KEY]).toBe(V1);
    await user.click(screen.getByRole('button', { name: 'View November 2026' }));
    expectFirstScenarioFigures();
  });
});

describe('saved-data messages', () => {
  it('invalid data: first message on every path, replaced after typing on Plan, neither after refresh()', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: 'not json' });
    const view = renderApp({ storage });
    const { user } = view;
    for (const path of PATHS) {
      view.goTo(path);
      expect(screen.getByText(INVALID), path).toBeInTheDocument();
      expect(screen.queryByText(REPLACED), path).not.toBeInTheDocument();
    }
    expect(storage.dump()[STORAGE_KEY]).toBe('not json');

    view.goTo('/plan');
    await user.type(screen.getByLabelText('Monthly income (USD)'), '3200');
    for (const path of PATHS) {
      view.goTo(path);
      expect(screen.getByText(REPLACED), path).toBeInTheDocument();
      expect(screen.queryByText(INVALID), path).not.toBeInTheDocument();
    }
    expect(storage.dump()[STORAGE_KEY]).not.toBe('not json');
    expect(view.readStored()?.incomeCents).toBe(320000);

    view.refresh();
    for (const path of PATHS) {
      view.goTo(path);
      for (const text of [INVALID, REPLACED, UNAVAILABLE]) expect(screen.queryByText(text), path).not.toBeInTheDocument();
    }
  });

  it('valid or empty storage shows none of the three messages on any path', () => {
    for (const options of [{ state: SCENARIO }, {}]) {
      const view = renderApp(options);
      for (const path of PATHS) {
        view.goTo(path);
        for (const text of [INVALID, REPLACED, UNAVAILABLE]) expect(screen.queryByText(text), path).not.toBeInTheDocument();
      }
      view.unmount();
    }
  });

  it('unavailable storage: the message shows on every path and the first steps still update Overview across pages', async () => {
    const storage = createMemoryStorage({}, { throwOnGet: true, throwOnSet: true });
    const view = renderApp({ storage });
    const { user } = view;
    for (const path of PATHS) {
      view.goTo(path);
      expect(screen.getByText(UNAVAILABLE), path).toBeInTheDocument();
      expect(screen.queryByText(INVALID), path).not.toBeInTheDocument();
    }
    await go(user, 'Plan');
    await user.type(screen.getByLabelText('Monthly income (USD)'), '3200');
    await user.click(screen.getByRole('button', { name: 'Add Rent' }));
    await user.type(screen.getByLabelText('Category 1 planned (USD)'), '1500');
    await go(user, 'Overview');
    expectStat('Income', '$3,200.00');
    expectStat('Planned', '$1,500.00');
    await addExpense(user, { amount: '82.47', category: 'Rent' });
    await go(user, 'Spending');
    expect(expenseRows()).toEqual([['Nov 14, 2026', 'Rent', '', '$82.47']]);
    await go(user, 'History');
    expect(historyRows()).toEqual([['November 2026 (this month)', '$3,200.00', '$82.47', '$3,117.53', 'View']]);
    await go(user, 'Overview');
    expectStat('Spent', '$82.47');
    expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
  });
});

describe('totals safety', () => {
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
  const seed = (count: number) =>
    createMemoryStorage({ [STORAGE_KEY]: serializeBook({ months: [withExpenses(count)] }) });

  it('91 expenses of MAX_CENTS: the invalid message and a first-run app on every path', () => {
    const storage = seed(91);
    const raw = storage.dump()[STORAGE_KEY];
    const view = renderApp({ storage });
    for (const path of PATHS) {
      view.goTo(path);
      expect(screen.getByText(INVALID), path).toBeInTheDocument();
    }
    view.goTo('/');
    expect(screen.getByText(WELCOME)).toBeInTheDocument();
    expectStat('Spent', '$0.00');
    view.goTo('/spending');
    expect(screen.getByText('No expenses in November 2026.')).toBeInTheDocument();
    expect(storage.dump()[STORAGE_KEY]).toBe(raw);
  });

  it('90 expenses: one more shows the too-large error on Amount (USD), the dialog stays open, Overview unchanged', async () => {
    const storage = seed(90);
    const view = renderApp({ storage });
    const { user } = view;
    expect(screen.queryByText(INVALID)).not.toBeInTheDocument();
    const spentBefore = statText('Spent');
    const raw = storage.dump()[STORAGE_KEY];

    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
    await user.type(within(dialog).getByLabelText('Amount (USD)'), '999999999999.99');
    await user.selectOptions(within(dialog).getByLabelText('Category'), 'Rent');
    await user.click(within(dialog).getByRole('button', { name: 'Save expense' }));

    const amount = within(dialog).getByLabelText('Amount (USD)');
    expect(await within(dialog).findByText(TOO_LARGE)).toBeInTheDocument();
    expect(amount).toHaveAccessibleDescription(TOO_LARGE);
    expect(screen.getByRole('dialog', { name: 'Add expense' })).toBeInTheDocument();
    expect(amount).toHaveValue('999,999,999,999.99');
    expect(storage.dump()[STORAGE_KEY]).toBe(raw);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(statText('Spent')).toBe(spentBefore);
    expect(storage.dump()[STORAGE_KEY]).toBe(raw);
  });
});

describe('one dialog at a time', () => {
  it('while Add expense is open the nav, switcher and page buttons are inert, and never two dialogs', async () => {
    const view = renderApp({ book: BOOK });
    const { user } = view;
    let max = 0;
    const observer = new MutationObserver(() => {
      max = Math.max(max, document.querySelectorAll('[role="dialog"]').length);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    try {
      const inertWhileOpen = async (names: string[]): Promise<void> => {
        await user.click(screen.getByRole('button', { name: 'Add expense' }));
        await screen.findByRole('dialog', { name: 'Add expense' });
        expect(screen.getAllByRole('dialog')).toHaveLength(1);
        for (const name of names) {
          const el = screen.getByRole(name.startsWith('link:') ? 'link' : 'button', {
            name: name.replace('link:', ''),
            hidden: true,
          });
          expect(el.closest('[inert]'), name).not.toBeNull();
        }
        for (const n of ['Overview', 'Spending', 'Plan', 'History']) {
          expect(nav(n).closest('[inert]'), n).not.toBeNull();
        }
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        for (const n of ['Overview', 'Spending', 'Plan', 'History']) expect(nav(n).closest('[inert]'), n).toBeNull();
      };

      await inertWhileOpen(['Previous month']);
      expect(screen.getByRole('button', { name: 'Previous month' }).closest('[inert]')).toBeNull();
      await go(user, 'Plan');
      await inertWhileOpen(['Add category', 'Previous month', 'Next month']);
      await go(user, 'History');
      await inertWhileOpen(['Delete all data']);

      // And the other way round: Add expense is inert while a page dialog is open.
      await user.click(screen.getByRole('button', { name: 'Delete all data' }));
      await screen.findByRole('dialog', { name: 'Delete all data?' });
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Add expense', hidden: true }).closest('[inert]')).not.toBeNull();
      expect(nav('Plan').closest('[inert]')).not.toBeNull();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await go(user, 'Plan');
      await user.click(screen.getByRole('button', { name: 'Add category' }));
      await screen.findByRole('dialog', { name: 'Add category' });
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Add expense', hidden: true }).closest('[inert]')).not.toBeNull();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    } finally {
      observer.disconnect();
    }
    expect(max).toBe(1);
  });

  it('the whole new-user scenario never shows more than one dialog', async () => {
    const view = renderApp();
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

describe('keyboard only', () => {
  async function tabTo(user: UserEvent, target: HTMLElement): Promise<void> {
    for (let i = 0; i < 400 && document.activeElement !== target; i += 1) await user.tab();
    expect(document.activeElement, `could not Tab to ${target.outerHTML.slice(0, 80)}`).toBe(target);
  }
  async function typeInto(user: UserEvent, field: HTMLElement, text: string): Promise<void> {
    await tabTo(user, field);
    await user.keyboard(text);
  }
  async function press(user: UserEvent, button: HTMLElement): Promise<void> {
    await tabTo(user, button);
    await user.keyboard('{Enter}');
  }
  // Native <select> cannot be operated by keyboard in jsdom: Tab to it, then user.selectOptions.
  async function choose(user: UserEvent, select: HTMLElement, label: string): Promise<void> {
    await tabTo(user, select);
    await user.selectOptions(select, label);
    expect((select as HTMLSelectElement).selectedOptions[0]?.textContent).toBe(label);
  }

  it('the first scenario passes using only Tab, Enter and typing (selects: Tab then selectOptions)', async () => {
    const view = renderApp();
    const { user } = view;
    await press(user, nav('Plan'));
    await typeInto(user, screen.getByLabelText('Monthly income (USD)'), '3200');
    for (const name of SUGGESTIONS) await press(user, screen.getByRole('button', { name: `Add ${name}` }));
    for (const [i, amount] of PLANNED.entries()) {
      await typeInto(user, screen.getByLabelText(`Category ${i + 1} planned (USD)`), amount);
    }
    const add = async (e: { amount: string; category: string; note?: string; date: string }): Promise<void> => {
      await press(user, screen.getByRole('button', { name: 'Add expense' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
      await typeInto(user, within(dialog).getByLabelText('Amount (USD)'), e.amount);
      await choose(user, within(dialog).getByLabelText('Category'), e.category);
      if (e.note !== undefined) await typeInto(user, within(dialog).getByLabelText(/^Note/), e.note);
      await choose(user, within(dialog).getByLabelText('Date'), e.date);
      // user-event cannot submit a form through a form= button by pressing Enter in a field; Enter on Save works.
      await press(user, within(dialog).getByRole('button', { name: 'Save expense' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    };
    await add({ amount: '1500', category: 'Rent', note: 'November rent', date: 'Nov 1, 2026' });
    await add({ amount: '82.47', category: 'Groceries', date: 'Nov 3, 2026' });
    await add({ amount: '112.35', category: 'Eating out', note: 'Birthday dinner', date: 'Nov 5, 2026' });
    await press(user, nav('Overview'));
    expectFirstScenarioFigures();
    await press(user, nav('Spending'));
    expect(expenseRows()).toEqual(THREE_ROWS);
    expect(view.readStored()?.expenses.map((x) => x.amountCents)).toEqual([150000, 8247, 11235]);
  }, 120_000);
});
