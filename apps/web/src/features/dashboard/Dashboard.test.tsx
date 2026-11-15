import { screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import {
  type BudgetState,
  MAX_CENTS,
  createInitialState,
  getCategorySummaries,
  getTotals,
  removeCategory,
  updateCategory,
} from '@/lib/budget';
import { formatMoney } from '@/lib/format';
import { BudgetProvider } from '@/state/BudgetProvider';
import { renderApp } from '@/test/renderApp';
import { expectNoAxeViolations } from '@/test/axe';
import { SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import { renderWithBudget } from '@/test/renderWithBudget';
import { Dashboard } from './Dashboard';

const PROMPT = 'Enter your monthly income on the Plan page';
const REMOVED_LINE = 'from removed categories, which are not listed above.';

// A page-like wrapper so heading order and landmark rules are checked as on the real page.
function Page(): ReactElement {
  return (
    <main>
      <h1>Budget Kit</h1>
      <Dashboard />
    </main>
  );
}

async function show(state: BudgetState) {
  const result = renderWithBudget(<Page />, { state });
  await screen.findByRole('heading', { level: 2, name: 'Summary' });
  return result;
}

function statLabels(): string[] {
  const region = screen.getByRole('region', { name: 'Summary' });
  return Array.from(region.querySelectorAll('[data-part="label"]')).map((el) => el.textContent ?? '');
}

function stat(label: string): HTMLElement {
  const region = screen.getByRole('region', { name: 'Summary' });
  const labelEl = Array.from(region.querySelectorAll('[data-part="label"]')).find((el) => el.textContent === label);
  if (labelEl === undefined || labelEl.parentElement === null) throw new Error(`No Stat ${label}`);
  return labelEl.parentElement;
}

function statValue(label: string): string | null {
  return stat(label).querySelector('[data-part="value"]')?.textContent ?? null;
}

function statChange(label: string): string | null {
  const change = stat(label).querySelector('[data-part="change"]');
  if (change === null) return null;
  // Own text only: drops the "!" marker and the hidden "Bad: " text.
  return Array.from(change.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent ?? '')
    .join('');
}

function tone(label: string): string | null {
  return stat(label).getAttribute('data-tone');
}

function item(name: string): HTMLElement {
  const list = within(screen.getByRole('region', { name: 'Spending by category' })).getAllByRole('listitem');
  const found = list.find((li) => li.textContent?.startsWith(name));
  if (found === undefined) throw new Error(`No list item for ${name}`);
  return found;
}

function withExpense(state: BudgetState, categoryId: string, amountCents: number, id = 'x1'): BudgetState {
  return {
    ...state,
    expenses: [...state.expenses, { id, categoryId, amountCents, note: '', date: '2026-11-10' }],
  };
}

function withPlan(state: BudgetState, categoryId: string, plannedCents: number): BudgetState {
  return updateCategory(state, categoryId, { plannedCents });
}

// The five categories the app once started with, so the first-run rows stay covered.
const FIRST_RUN: BudgetState = {
  ...createInitialState('2026-11'),
  categories: ['Rent', 'Groceries', 'Transport', 'Utilities', 'Eating out'].map((name) => ({
    id: `suggested-${name.toLowerCase().replace(' ', '-')}`,
    name,
    plannedCents: 0,
  })),
};

describe('SCENARIO Stats', () => {
  it('shows the five Stats in order with the exact labels and values', async () => {
    await show(SCENARIO);
    expect(statLabels()).toEqual(['Income', 'Planned', 'Spent', 'Left to spend', 'Unplanned money']);
    expect(statValue('Income')).toBe('$3,200.00');
    expect(statValue('Planned')).toBe('$2,270.00');
    expect(statValue('Spent')).toBe('$1,694.82');
    expect(statValue('Left to spend')).toBe('$1,505.18');
    expect(statValue('Unplanned money')).toBe('$930.00');
  });

  it('has the five Stats as five list items of one list', async () => {
    await show(SCENARIO);
    const region = screen.getByRole('region', { name: 'Summary' });
    expect(within(region).getAllByRole('list')).toHaveLength(1);
    expect(within(region).getAllByRole('listitem')).toHaveLength(5);
  });

  it('shows Not yet assigned to a category for Unplanned money and no change on the others', async () => {
    await show(SCENARIO);
    expect(statChange('Unplanned money')).toBe('Not yet assigned to a category');
    expect(statChange('Income')).toBeNull();
    expect(statChange('Planned')).toBeNull();
    expect(statChange('Spent')).toBeNull();
    expect(statChange('Left to spend')).toBeNull();
  });

  it('has no Stat with data-tone bad and all neutral', async () => {
    const { container } = await show(SCENARIO);
    expect(container.querySelectorAll('[data-tone="bad"]')).toHaveLength(0);
    for (const label of statLabels()) expect(tone(label)).toBe('neutral');
    expect(screen.queryByText(/Bad:/)).not.toBeInTheDocument();
  });

  it('shows zero unplanned money with no change line', async () => {
    await show({ ...SCENARIO, incomeCents: 227000 });
    expect(statValue('Unplanned money')).toBe('$0.00');
    expect(statChange('Unplanned money')).toBeNull();
    expect(tone('Unplanned money')).toBe('neutral');
  });
});

describe('SCENARIO categories', () => {
  it('shows progressbars named Rent, Groceries, Transport, Utilities, Eating out in order', async () => {
    await show(SCENARIO);
    const names = screen.getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-labelledby'));
    const texts = names.map((id) => document.getElementById(id ?? '')?.textContent);
    expect(texts).toEqual(['Rent', 'Groceries', 'Transport', 'Utilities', 'Eating out']);
    for (const name of ['Rent', 'Groceries', 'Transport', 'Utilities', 'Eating out']) {
      expect(screen.getByRole('progressbar', { name })).toBeInTheDocument();
    }
  });

  it('has one list item per category in the category list', async () => {
    await show(SCENARIO);
    const region = screen.getByRole('region', { name: 'Spending by category' });
    expect(within(region).getAllByRole('listitem')).toHaveLength(5);
  });

  it('Groceries reads $82.47 of $400.00 and $317.53 left', async () => {
    await show(SCENARIO);
    expect(screen.getByRole('progressbar', { name: 'Groceries' })).toHaveAttribute('aria-valuetext', '$82.47 of $400.00');
    expect(within(item('Groceries')).getByText('$317.53 left')).toBeInTheDocument();
    expect(within(item('Groceries')).queryByText('Over budget')).not.toBeInTheDocument();
  });

  it('Eating out reads $112.35 of $100.00, over by $12.35 with an Over budget badge', async () => {
    await show(SCENARIO);
    expect(screen.getByRole('progressbar', { name: 'Eating out' })).toHaveAttribute(
      'aria-valuetext',
      '$112.35 of $100.00, over by $12.35',
    );
    const li = item('Eating out');
    expect(within(li).getByText('Over budget')).toHaveAttribute('data-variant', 'danger');
    expect(within(li).getByText('Over budget')).toHaveClass('self-start');
    expect(within(li).getByText(/over by \$12\.35/)).toBeInTheDocument();
    expect(within(li).queryByText(/ left$/)).not.toBeInTheDocument();
  });

  it('has exactly one Over budget badge on the page', async () => {
    await show(SCENARIO);
    expect(screen.getAllByText('Over budget')).toHaveLength(1);
  });

  it('shows Rent, Transport and Utilities with their exact left text', async () => {
    await show(SCENARIO);
    expect(screen.getByRole('progressbar', { name: 'Rent' })).toHaveAttribute('aria-valuetext', '$1,500.00 of $1,500.00');
    expect(within(item('Rent')).getByText('$0.00 left')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Transport' })).toHaveAttribute('aria-valuetext', '$0.00 of $120.00');
    expect(within(item('Transport')).getByText('$120.00 left')).toBeInTheDocument();
    expect(within(item('Utilities')).getByText('$150.00 left')).toBeInTheDocument();
  });

  it('shows no No plan set badge when every category is planned', async () => {
    await show(SCENARIO);
    expect(screen.queryByText('No plan set')).not.toBeInTheDocument();
  });
});

describe('boundaries', () => {
  it('exactly at plan is not over: Groceries planned 8247 shows $0.00 left and no badge', async () => {
    await show(withPlan(SCENARIO, 'suggested-groceries', 8247));
    expect(within(item('Groceries')).getByText('$0.00 left')).toBeInTheDocument();
    expect(within(item('Groceries')).queryByText('Over budget')).not.toBeInTheDocument();
    expect(screen.getAllByText('Over budget')).toHaveLength(1);
  });

  it('one cent over is over: Transport planned 1 and spent 2 shows Over budget', async () => {
    const state = withExpense(withPlan(SCENARIO, 'suggested-transport', 1), 'suggested-transport', 2);
    await show(state);
    expect(within(item('Transport')).getByText('Over budget')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Transport' })).toHaveAttribute(
      'aria-valuetext',
      '$0.02 of $0.01, over by $0.01',
    );
    expect(screen.getAllByText('Over budget')).toHaveLength(2);
  });

  it('planned 0 with spent 1 shows No plan set and not Over budget', async () => {
    const state = withExpense(withPlan(SCENARIO, 'suggested-transport', 0), 'suggested-transport', 1);
    await show(state);
    const li = item('Transport');
    expect(within(li).getByText('No plan set')).toBeInTheDocument();
    expect(within(li).getByText('No plan set')).toHaveClass('self-start');
    expect(within(li).getByText('Spent $0.01')).toBeInTheDocument();
    expect(within(li).queryByText('Over budget')).not.toBeInTheDocument();
    expect(within(li).queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('progressbar', { name: 'Transport' })).toBeNull();
    expect(screen.getAllByRole('progressbar')).toHaveLength(4);
    expect(screen.getAllByText('Over budget')).toHaveLength(1);
  });
});

describe('deleting an expense', () => {
  it('SCENARIO without e2 shows updated totals and Groceries', async () => {
    await show({ ...SCENARIO, expenses: SCENARIO.expenses.filter((e) => e.id !== 'e2') });
    expect(statValue('Spent')).toBe('$1,612.35');
    expect(statValue('Left to spend')).toBe('$1,587.65');
    expect(screen.getByRole('progressbar', { name: 'Groceries' })).toHaveAttribute('aria-valuetext', '$0.00 of $400.00');
    expect(within(item('Groceries')).getByText('$400.00 left')).toBeInTheDocument();
  });
});

describe('overspent', () => {
  const state = withExpense(SCENARIO, 'suggested-transport', 200000);

  it('shows negative Left to spend as bad with the sentence and hidden Bad: text', async () => {
    await show(state);
    expect(statValue('Left to spend')).toBe('-$494.82');
    expect(tone('Left to spend')).toBe('bad');
    expect(within(stat('Left to spend')).getByText('Spent $494.82 more than your income')).toBeInTheDocument();
    expect(stat('Left to spend')).toHaveTextContent('Bad:');
    expect(statChange('Left to spend')).toBe('Spent $494.82 more than your income');
  });

  it('keeps Unplanned money neutral and shows Transport as Over budget', async () => {
    await show(state);
    expect(tone('Unplanned money')).toBe('neutral');
    expect(within(item('Transport')).getByText('Over budget')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Transport' })).toHaveAttribute(
      'aria-valuetext',
      '$2,000.00 of $120.00, over by $1,880.00',
    );
    expect(screen.getAllByText('Over budget')).toHaveLength(2);
  });
});

describe('over-planned', () => {
  const state = { ...SCENARIO, incomeCents: 200000 };

  it('shows negative Unplanned money as bad with the sentence', async () => {
    await show(state);
    expect(statValue('Unplanned money')).toBe('-$270.00');
    expect(tone('Unplanned money')).toBe('bad');
    expect(statChange('Unplanned money')).toBe('Planned $270.00 more than your income');
    expect(stat('Unplanned money')).toHaveTextContent('Bad:');
    expect(screen.queryByText('Not yet assigned to a category')).not.toBeInTheDocument();
  });

  it('shows Left to spend $305.18 neutral', async () => {
    await show(state);
    expect(statValue('Left to spend')).toBe('$305.18');
    expect(tone('Left to spend')).toBe('neutral');
    expect(statChange('Left to spend')).toBeNull();
    expect(document.querySelectorAll('[data-tone="bad"]')).toHaveLength(1);
  });
});

describe('not by colour alone', () => {
  it('over-budget, over by and more-than-your-income are all text; bad Stats have hidden Bad:', async () => {
    await show(withExpense({ ...SCENARIO, incomeCents: 200000 }, 'suggested-transport', 200000));
    expect(screen.getAllByText('Over budget').length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar', { name: 'Eating out' }).getAttribute('aria-valuetext')).toContain('over by');
    expect(within(item('Eating out')).getByText(/over by \$12\.35/)).toBeInTheDocument();
    expect(screen.getAllByText(/more than your income/, { selector: '[data-part="change"]' })).toHaveLength(2);
    const bad = Array.from(document.querySelectorAll('[data-tone="bad"]'));
    expect(bad).toHaveLength(2);
    for (const el of bad) {
      expect(el).toHaveTextContent('Bad:');
      expect(el).toHaveTextContent('more than your income');
    }
  });

  it('the unplanned-category state is told apart by the text No plan set', async () => {
    await show(withExpense(FIRST_RUN, 'suggested-groceries', 8247));
    expect(within(item('Groceries')).getByText('No plan set')).toBeInTheDocument();
  });
});

describe('first run', () => {
  it('shows $0.00 Stats, Not set with the prompt, and neither is bad', async () => {
    await show(FIRST_RUN);
    expect(statValue('Income')).toBe('$0.00');
    expect(statValue('Planned')).toBe('$0.00');
    expect(statValue('Spent')).toBe('$0.00');
    expect(statValue('Left to spend')).toBe('Not set');
    expect(statValue('Unplanned money')).toBe('Not set');
    expect(statChange('Left to spend')).toBe(PROMPT);
    expect(statChange('Unplanned money')).toBe(PROMPT);
    expect(tone('Left to spend')).toBe('neutral');
    expect(tone('Unplanned money')).toBe('neutral');
    expect(document.querySelectorAll('[data-tone="bad"]')).toHaveLength(0);
    expect(stat('Left to spend')).not.toHaveTextContent('Bad:');
    expect(document.body.textContent).not.toContain('-$');
  });

  it('shows no progressbars, five No plan set badges, five Spent $0.00 and no Over budget', async () => {
    await show(FIRST_RUN);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
    const badges = screen.getAllByText('No plan set');
    expect(badges).toHaveLength(5);
    for (const badge of badges) expect(badge).toHaveAttribute('data-variant', 'neutral');
    expect(screen.getAllByText('Spent $0.00')).toHaveLength(5);
    expect(screen.queryByText('Over budget')).not.toBeInTheDocument();
    expect(screen.queryByText(/from removed categories/)).not.toBeInTheDocument();
    expect(screen.queryByText('No categories yet. Add them on the Plan page.')).not.toBeInTheDocument();
  });

  it('lists the five suggested categories by name in order', async () => {
    await show(FIRST_RUN);
    const names = ['Rent', 'Groceries', 'Transport', 'Utilities', 'Eating out'];
    const items = within(screen.getByRole('region', { name: 'Spending by category' })).getAllByRole('listitem');
    expect(items.map((li, i) => li.textContent?.startsWith(names[i] ?? '?'))).toEqual([true, true, true, true, true]);
  });
});

describe('income set, nothing spent', () => {
  it('shows Left to spend and Unplanned money $3,200.00 and no Not set', async () => {
    await show({ ...FIRST_RUN, incomeCents: 320000 });
    expect(statValue('Left to spend')).toBe('$3,200.00');
    expect(statValue('Unplanned money')).toBe('$3,200.00');
    expect(statChange('Unplanned money')).toBe('Not yet assigned to a category');
    expect(statChange('Left to spend')).toBeNull();
    expect(screen.queryByText('Not set')).not.toBeInTheDocument();
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it('income of 1 cent counts as set', async () => {
    await show({ ...FIRST_RUN, incomeCents: 1 });
    expect(statValue('Left to spend')).toBe('$0.01');
    expect(screen.queryByText('Not set')).not.toBeInTheDocument();
  });
});

describe('zero income hides the negative', () => {
  it('SCENARIO with income 0 shows Not set for both rows and keeps Spent and Planned', async () => {
    await show({ ...SCENARIO, incomeCents: 0 });
    expect(statValue('Left to spend')).toBe('Not set');
    expect(statValue('Unplanned money')).toBe('Not set');
    expect(statChange('Left to spend')).toBe(PROMPT);
    expect(statChange('Unplanned money')).toBe(PROMPT);
    expect(tone('Left to spend')).toBe('neutral');
    expect(tone('Unplanned money')).toBe('neutral');
    expect(statValue('Spent')).toBe('$1,694.82');
    expect(statValue('Planned')).toBe('$2,270.00');
    expect(document.body.textContent).not.toContain('-$1,694.82');
    expect(document.body.textContent).not.toContain('-$2,270.00');
    expect(document.querySelectorAll('[data-tone="bad"]')).toHaveLength(0);
  });
});

describe('first expense, no plan', () => {
  it('shows name, neutral No plan set badge and Spent $82.47 with no bar, no Over budget, no danger', async () => {
    await show(withExpense(FIRST_RUN, 'suggested-groceries', 8247));
    const li = item('Groceries');
    expect(within(li).getByText('Groceries')).toBeInTheDocument();
    expect(within(li).getByText('No plan set')).toHaveAttribute('data-variant', 'neutral');
    expect(within(li).getByText('Spent $82.47')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Groceries' })).toBeNull();
    expect(screen.queryByText('Over budget')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-tone="danger"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-variant="danger"]')).toHaveLength(0);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
    expect(statValue('Spent')).toBe('$82.47');
  });

  it('planning Groceries at 5000 replaces it with an over-by bar and a danger badge', async () => {
    await show(withPlan(withExpense(FIRST_RUN, 'suggested-groceries', 8247), 'suggested-groceries', 5000));
    expect(screen.getByRole('progressbar', { name: 'Groceries' })).toHaveAttribute(
      'aria-valuetext',
      '$82.47 of $50.00, over by $32.47',
    );
    expect(within(item('Groceries')).getByText('Over budget')).toHaveAttribute('data-variant', 'danger');
    expect(within(item('Groceries')).queryByText('No plan set')).not.toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getAllByText('No plan set')).toHaveLength(4);
  });
});

describe('no categories', () => {
  const state: BudgetState = { ...SCENARIO, categories: [], expenses: [] };

  it('shows the empty-state line and no list or progressbar', async () => {
    await show(state);
    const region = screen.getByRole('region', { name: 'Spending by category' });
    expect(within(region).getByText('No categories yet. Add them on the Plan page.')).toBeInTheDocument();
    expect(within(region).queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });

  it('still shows the five Stats', async () => {
    await show(state);
    expect(statLabels()).toEqual(['Income', 'Planned', 'Spent', 'Left to spend', 'Unplanned money']);
    expect(statValue('Planned')).toBe('$0.00');
    expect(statValue('Unplanned money')).toBe('$3,200.00');
  });

  it('does not show the empty-state line when categories exist', async () => {
    await show(SCENARIO);
    expect(screen.queryByText(/No categories yet/)).not.toBeInTheDocument();
  });
});

describe('removed category', () => {
  const removed = removeCategory(SCENARIO, 'suggested-eating-out');

  it('shows four progressbars, adjusted totals and the removed-categories line', async () => {
    await show(removed);
    expect(screen.getAllByRole('progressbar')).toHaveLength(4);
    expect(screen.queryByRole('progressbar', { name: 'Eating out' })).toBeNull();
    expect(statValue('Spent')).toBe('$1,694.82');
    expect(statValue('Planned')).toBe('$2,170.00');
    expect(statValue('Unplanned money')).toBe('$1,030.00');
    expect(
      screen.getByText(
        'The Spent total includes $112.35 from removed categories, which are not listed above.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Over budget')).not.toBeInTheDocument();
  });

  it('puts the removed-categories line after the list, inside the category Card', async () => {
    await show(removed);
    const region = screen.getByRole('region', { name: 'Spending by category' });
    const line = within(region).getByText(/from removed categories/);
    const list = within(region).getByRole('list');
    expect(list.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line.closest('li')).toBeNull();
  });

  it('is absent when SCENARIO is unchanged', async () => {
    await show(SCENARIO);
    expect(document.body.textContent).not.toContain('from removed categories');
  });

  it('is absent when the removed category had no spending', async () => {
    await show(removeCategory(SCENARIO, 'suggested-utilities'));
    expect(document.body.textContent).not.toContain('from removed categories');
  });

  it('is shown beside the empty-state line when all categories are removed', async () => {
    const all: BudgetState = { ...SCENARIO, categories: [] };
    await show(all);
    expect(screen.getByText('No categories yet. Add them on the Plan page.')).toBeInTheDocument();
    expect(screen.getByText(`The Spent total includes $1,694.82 ${REMOVED_LINE}`)).toBeInTheDocument();
  });

  it('is absent when the expense of a removed category belongs to another month', async () => {
    const other: BudgetState = {
      ...SCENARIO,
      expenses: [
        ...SCENARIO.expenses,
        { id: 'old', categoryId: 'gone', amountCents: 500, note: '', date: '2026-10-30' },
      ],
    };
    await show(other);
    expect(document.body.textContent).not.toContain('from removed categories');
    expect(statValue('Spent')).toBe('$1,694.82');
  });
});

describe('large amounts', () => {
  const big: BudgetState = {
    ...SCENARIO,
    incomeCents: MAX_CENTS,
    expenses: [1, 2, 3].map((n) => ({
      id: `big-${n}`,
      categoryId: 'suggested-transport',
      amountCents: MAX_CENTS,
      note: '',
      date: '2026-11-10',
    })),
  };

  it('shows Spent $2,999,999,999,999.97 and Left to spend -$1,999,999,999,999.98', async () => {
    await show(big);
    expect(statValue('Spent')).toBe('$2,999,999,999,999.97');
    expect(statValue('Left to spend')).toBe('-$1,999,999,999,999.98');
    expect(statValue('Income')).toBe('$999,999,999,999.99');
    expect(statChange('Left to spend')).toBe('Spent $1,999,999,999,999.98 more than your income');
    expect(tone('Left to spend')).toBe('bad');
  });

  it('renders every figure without NaN, undefined or exponent text', async () => {
    await show(big);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/NaN|undefined|Infinity|e\+/);
    expect(screen.getByRole('progressbar', { name: 'Transport' })).toHaveAttribute(
      'aria-valuetext',
      '$2,999,999,999,999.97 of $120.00, over by $2,999,999,999,879.97',
    );
  });

  it('shows a planned category with large plan and zero spending without throwing', async () => {
    await show({ ...FIRST_RUN, incomeCents: MAX_CENTS, categories: [{ id: 'a', name: 'Big', plannedCents: MAX_CENTS }] });
    expect(screen.getByRole('progressbar', { name: 'Big' })).toHaveAttribute(
      'aria-valuetext',
      '$0.00 of $999,999,999,999.99',
    );
    expect(screen.getByText('$999,999,999,999.99 left')).toBeInTheDocument();
  });
});

describe('figures equal lib/budget results', () => {
  const states: [string, BudgetState][] = [
    ['SCENARIO', SCENARIO],
    ['first run', FIRST_RUN],
    ['overspent', withExpense(SCENARIO, 'suggested-transport', 200000)],
    ['over-planned', { ...SCENARIO, incomeCents: 200000 }],
    ['removed', removeCategory(SCENARIO, 'suggested-groceries')],
    ['cents', withExpense({ ...SCENARIO, incomeCents: 1 }, 'suggested-utilities', 7)],
    ['planned 1, spent 1', withExpense(withPlan(SCENARIO, 'suggested-utilities', 1), 'suggested-utilities', 1)],
  ];

  for (const [name, state] of states) {
    it(`every Stat and category figure matches getTotals and getCategorySummaries: ${name}`, async () => {
      await show(state);
      const totals = getTotals(state);
      expect(statValue('Income')).toBe(formatMoney(totals.incomeCents));
      expect(statValue('Planned')).toBe(formatMoney(totals.plannedCents));
      expect(statValue('Spent')).toBe(formatMoney(totals.spentCents));
      expect(statValue('Left to spend')).toBe(totals.hasIncome ? formatMoney(totals.leftToSpendCents) : 'Not set');
      expect(statValue('Unplanned money')).toBe(totals.hasIncome ? formatMoney(totals.unplannedCents) : 'Not set');
      expect(tone('Left to spend')).toBe(totals.hasIncome && totals.leftToSpendCents < 0 ? 'bad' : 'neutral');
      expect(tone('Unplanned money')).toBe(totals.hasIncome && totals.unplannedCents < 0 ? 'bad' : 'neutral');
      const summaries = getCategorySummaries(state);
      expect(screen.queryAllByRole('progressbar')).toHaveLength(summaries.filter((s) => s.hasPlan).length);
      expect(screen.queryAllByText('No plan set')).toHaveLength(summaries.filter((s) => !s.hasPlan).length);
      expect(screen.queryAllByText('Over budget')).toHaveLength(
        summaries.filter((s) => s.hasPlan && s.isOverBudget).length,
      );
      for (const s of summaries) {
        const li = item(s.category.name);
        if (s.hasPlan) {
          const spent = formatMoney(s.spentCents);
          const planned = formatMoney(s.category.plannedCents);
          const bar = within(li).getByRole('progressbar', { name: s.category.name });
          const expected = s.isOverBudget
            ? `${spent} of ${planned}, over by ${formatMoney(s.spentCents - s.category.plannedCents)}`
            : `${spent} of ${planned}`;
          expect(bar).toHaveAttribute('aria-valuetext', expected);
          if (!s.isOverBudget) expect(within(li).getByText(`${formatMoney(s.remainingCents)} left`)).toBeInTheDocument();
        } else {
          expect(within(li).getByText(`Spent ${formatMoney(s.spentCents)}`)).toBeInTheDocument();
        }
      }
      if (totals.removedCategoriesSpentCents > 0) {
        expect(
          screen.getByText(
            `The Spent total includes ${formatMoney(totals.removedCategoriesSpentCents)} ${REMOVED_LINE}`,
          ),
        ).toBeInTheDocument();
      } else {
        expect(document.body.textContent).not.toContain('from removed categories');
      }
    });
  }
});

describe('structure and accessibility', () => {
  it('has Summary and Spending by category as labelled regions with h2 headings under one h1', async () => {
    await show(SCENARIO);
    expect(screen.getByRole('region', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Spending by category' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Summary' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Spending by category' })).toBeInTheDocument();
    const levels = screen.getAllByRole('heading').map((h) => [h.tagName, h.textContent]);
    expect(levels).toEqual([
      ['H1', 'Budget Kit'],
      ['H2', 'Summary'],
      ['H2', 'Spending by category'],
    ]);
  });

  it('renders nothing while loading', () => {
    const html = renderToString(
      <BudgetProvider storage={createMemoryStorage()}>
        <Dashboard />
      </BudgetProvider>,
    );
    expect(html).toBe('');
  });

  it('has nothing focusable and Tab moves nowhere', async () => {
    const { container, user } = await show(SCENARIO);
    expect(
      container.querySelectorAll('a[href], button, input, select, textarea, [tabindex], [contenteditable]'),
    ).toHaveLength(0);
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it('has no alert, status or live region', async () => {
    const { container } = await show(withExpense(SCENARIO, 'suggested-transport', 200000));
    expect(container.querySelectorAll('[role="alert"], [role="status"], [aria-live]')).toHaveLength(0);
  });

  it('shows over-budget text inside its list item, so it is not colour alone', async () => {
    await show(SCENARIO);
    expect(item('Eating out').textContent).toContain('Over budget');
    expect(item('Eating out').textContent).toContain('over by $12.35');
  });

  const axeStates: [string, BudgetState][] = [
    ['first run', FIRST_RUN],
    ['first expense in an unplanned category', withExpense(FIRST_RUN, 'suggested-groceries', 8247)],
    ['SCENARIO', SCENARIO],
    ['overspent', withExpense(SCENARIO, 'suggested-transport', 200000)],
    ['over-planned', { ...SCENARIO, incomeCents: 200000 }],
    ['no categories', { ...SCENARIO, categories: [], expenses: [] }],
    ['removed-category spending', removeCategory(SCENARIO, 'suggested-eating-out')],
    ['zero income with data', { ...SCENARIO, incomeCents: 0 }],
    ['large amounts', { ...SCENARIO, incomeCents: MAX_CENTS, expenses: [{ id: 'b', categoryId: 'suggested-transport', amountCents: MAX_CENTS, note: '', date: '2026-11-02' }] }],
  ];
  // axe runs without color-contrast in jsdom; contrast is a manual browser check.
  for (const [name, state] of axeStates) {
    it(`has no axe violations: ${name}`, async () => {
      await show(state);
      await expectNoAxeViolations();
    });
  }
});

describe('mounted in the Overview page', () => {
  it('renders the dashboard under the single h1 inside main and passes axe', async () => {
    renderApp({ state: SCENARIO });
    await screen.findByRole('heading', { level: 2, name: 'Summary' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(screen.getByRole('main')).getByRole('region', { name: 'Spending by category' })).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(5);
    await expectNoAxeViolations();
  });
});

describe('source rules', () => {
  const root = join(import.meta.dirname, '..');
  const read = (path: string): string => readFileSync(join(root, path), 'utf8');
  const strip = (code: string): string =>
    code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const dashboard = strip(read('dashboard/Dashboard.tsx'));
  const budgetApp = strip(read('overview/OverviewPage.tsx'));

  it('starts with the use client directive', () => {
    expect(read('dashboard/Dashboard.tsx').startsWith("'use client';")).toBe(true);
  });

  it('uses no native button, input, select, textarea, table, dialog or style prop', () => {
    for (const source of [dashboard, budgetApp]) {
      expect(source).not.toMatch(/<(button|input|select|textarea|table|dialog)\b/);
      expect(source).not.toMatch(/\bstyle\s*=/);
    }
  });

  it('has no float parsing or money scaling', () => {
    expect(dashboard).not.toMatch(/parseFloat|toFixed|Number\(|parseInt|\*\s*100|\/\s*100/);
  });

  it('negates only the two negative figures for the sentences and does no other money arithmetic', () => {
    expect(dashboard).not.toMatch(/\w\s[-+*/%]\s\w/);
    expect(dashboard.match(/-\s*(leftToSpendCents|unplannedCents)/g)).toHaveLength(2);
    expect(dashboard).not.toMatch(/\bMath\./);
  });

  it('has no alert, status or aria-live', () => {
    expect(dashboard).not.toMatch(/role\s*=\s*["']?\{?["']?(alert|status)|aria-live/);
  });

  it('has no any, ts-ignore or ts-expect-error', () => {
    expect(dashboard).not.toMatch(/:\s*any\b|\bas any\b|<any>|@ts-ignore|@ts-expect-error/);
    expect(read('dashboard/Dashboard.tsx')).not.toMatch(/@ts-ignore|@ts-expect-error/);
  });

  it('imports library components only from @budget-kit/ui and not from src paths', () => {
    expect(dashboard).toContain("from '@budget-kit/ui'");
    expect(dashboard).not.toMatch(/@budget-kit\/ui\/src/);
  });

  it('uses only layout Tailwind classes on plain elements and no className on library components except self-* on Badge', () => {
    const classNames = Array.from(dashboard.matchAll(/className="([^"]*)"/g)).flatMap((m) => (m[1] ?? '').split(/\s+/));
    for (const cls of classNames) {
      expect(cls).toMatch(/^(sm:)?(flex|grid|gap-|p-|px-|py-|m|list-none|grid-cols-|flex-col|items-|self-|justify-|max-w-|w-full)/);
    }
    expect(dashboard).not.toMatch(/<(Stat|Card|ProgressBar)\b[^>]*className/);
    expect(dashboard).toMatch(/sm:grid-cols-2/);
  });

  it('OverviewPage imports and mounts Dashboard once', () => {
    expect(budgetApp.match(/Dashboard/g)).toHaveLength(3);
    expect(budgetApp).toContain("import { Dashboard } from '@/features/dashboard/Dashboard';");
    expect(budgetApp.match(/<Dashboard \/>/g)).toHaveLength(1);
  });
});
