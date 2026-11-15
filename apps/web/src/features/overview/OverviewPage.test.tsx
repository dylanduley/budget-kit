import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { STORAGE_KEY } from '@/state/storage';
import { expectNoAxeViolations } from '@/test/axe';
import { SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import { renderApp } from '@/test/renderApp';

const WELCOME = 'Welcome. Start on the Plan page: enter your monthly income and add the categories you spend on.';
const INCOME_PROMPT = 'Enter your monthly income on the Plan page';

const stat = (label: string): HTMLElement =>
  screen.getByText(label, { selector: '[data-part="label"]' }).parentElement as HTMLElement;

describe('Overview page: first run', () => {
  it('empty storage: h1, the welcome line, Left to spend Not set with the Plan-page prompt, and the empty categories text', () => {
    renderApp({ path: '/' });
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText(WELCOME)).toBeInTheDocument();
    expect(stat('Left to spend')).toHaveTextContent('Not set');
    expect(stat('Left to spend')).toHaveTextContent(INCOME_PROMPT);
    expect(stat('Unplanned money')).toHaveTextContent('Not set');
    expect(screen.getAllByText(INCOME_PROMPT)).toHaveLength(2);
    expect(screen.getByText('No categories yet. Add them on the Plan page.')).toBeInTheDocument();
  });

  it('the welcome line comes before the Summary card', () => {
    renderApp({ path: '/' });
    const welcome = screen.getByText(WELCOME);
    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(welcome.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a stored book with no months shows the welcome line', () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 2, book: { months: [] } }) });
    renderApp({ storage, path: '/' });
    expect(screen.getByText(WELCOME)).toBeInTheDocument();
  });

  it('seeded SCENARIO: no welcome line', () => {
    renderApp({ state: SCENARIO, path: '/' });
    expect(screen.queryByText(WELCOME)).not.toBeInTheDocument();
    expect(screen.queryByText(/Welcome/)).not.toBeInTheDocument();
  });

  it('after any change the welcome line goes away', async () => {
    const { user } = renderApp({ path: '/plan' });
    await user.type(screen.getByRole('textbox', { name: 'Monthly income (USD)' }), '3200');
    await user.click(screen.getByRole('link', { name: 'Overview' }));
    expect(screen.queryByText(WELCOME)).not.toBeInTheDocument();
    expect(stat('Income')).toHaveTextContent('$3,200.00');
    expect(stat('Left to spend')).toHaveTextContent('$3,200.00');
    expect(screen.queryByText(INCOME_PROMPT)).not.toBeInTheDocument();
  });
});

describe('Overview page: seeded SCENARIO', () => {
  it('shows the five stats to the cent', () => {
    renderApp({ state: SCENARIO, path: '/' });
    expect(stat('Income')).toHaveTextContent('$3,200.00');
    expect(stat('Planned')).toHaveTextContent('$2,270.00');
    expect(stat('Spent')).toHaveTextContent('$1,694.82');
    expect(stat('Left to spend')).toHaveTextContent('$1,505.18');
    expect(stat('Unplanned money')).toHaveTextContent('$930.00');
    expect(stat('Unplanned money')).toHaveTextContent('Not yet assigned to a category');
  });

  it('marks Eating out Over budget with text, and others show what is left', () => {
    renderApp({ state: SCENARIO, path: '/' });
    const card = screen.getByRole('region', { name: 'Spending by category' });
    const eatingOut = within(card).getByText('Eating out').closest('li') as HTMLElement;
    expect(within(eatingOut).getByText('Over budget')).toBeInTheDocument();
    expect(within(card).getAllByText('Over budget')).toHaveLength(1);
    expect(within(card).getByText('$317.53 left')).toBeInTheDocument();
    expect(within(card).getByText('$0.00 left')).toBeInTheDocument();
  });

  it('has a single h1 and no month switcher or welcome yet', () => {
    renderApp({ state: SCENARIO, path: '/' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('overspent income: Left to spend is negative with the more-than-income text, not shown by colour alone', () => {
    renderApp({ state: { ...SCENARIO, incomeCents: 100000 }, path: '/' });
    expect(stat('Left to spend')).toHaveTextContent('-$694.82');
    expect(stat('Left to spend')).toHaveTextContent('Spent $694.82 more than your income');
    expect(stat('Unplanned money')).toHaveTextContent('Planned $1,270.00 more than your income');
  });

  it('a category with no plan shows No plan set and Spent, and removed categories are counted in a line', () => {
    renderApp({
      state: {
        ...SCENARIO,
        categories: [{ id: 'a', name: 'Gifts', plannedCents: 0 }],
        expenses: [
          { id: 'x1', categoryId: 'a', amountCents: 1234, note: '', date: '2026-11-02' },
          { id: 'x2', categoryId: 'gone', amountCents: 500, note: '', date: '2026-11-03' },
        ],
      },
      path: '/',
    });
    expect(screen.getByText('No plan set')).toBeInTheDocument();
    expect(screen.getByText('Spent $12.34')).toBeInTheDocument();
    expect(screen.getByText(/The Spent total includes \$5\.00 from removed categories/)).toBeInTheDocument();
  });

  it('no NaN or float text anywhere', () => {
    renderApp({ state: SCENARIO, path: '/' });
    expect(document.body.textContent).not.toMatch(/NaN|undefined|\d\.\d{1}\b(?!\d)/);
  });
});

describe('Overview page: accessibility (axe)', () => {
  it('first run', async () => {
    renderApp({ path: '/' });
    await expectNoAxeViolations();
  });

  it('populated with an over-budget category', async () => {
    renderApp({ state: SCENARIO, path: '/' });
    await expectNoAxeViolations();
  });
});
