import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { metadata } from '@/app/layout';
import type { BudgetState } from '@/lib/budget';
import { BudgetProvider } from '@/state/BudgetProvider';
import { STORAGE_KEY } from '@/state/storage';
import { expectNoAxeViolations } from '@/test/axe';
import { SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import { type RenderWithBudgetOptions, type RenderWithBudgetResult, renderWithBudget } from '@/test/renderWithBudget';
import { BudgetApp } from './BudgetApp';

type View = RenderWithBudgetResult;
type Options = RenderWithBudgetOptions;

async function show(options: Options): Promise<View> {
  const view = renderWithBudget(<BudgetApp />, options);
  await screen.findByRole('heading', { level: 2, name: 'Summary' });
  return view;
}

const OVER_BUDGET: BudgetState = {
  month: '2026-11',
  incomeCents: 100000,
  categories: [
    { id: 'rent', name: 'Rent', plannedCents: 90000 },
    { id: 'food', name: 'Food', plannedCents: 30000 },
  ],
  expenses: [{ id: 'e1', categoryId: 'rent', amountCents: 120000, note: 'Deposit', date: '2026-11-02' }],
};

const UNPLANNED_SPEND: BudgetState = {
  month: '2026-11',
  incomeCents: 100000,
  categories: [
    { id: 'misc', name: 'Misc', plannedCents: 0 },
    { id: 'rent', name: 'Rent', plannedCents: 50000 },
  ],
  expenses: [{ id: 'e1', categoryId: 'misc', amountCents: 2500, note: '', date: '2026-11-02' }],
};

const NO_CATEGORIES: BudgetState = { month: '2026-11', incomeCents: 100000, categories: [], expenses: [] };
const NO_EXPENSES: BudgetState = { ...SCENARIO, expenses: [] };

describe('axe finds no violations in every state', () => {
  it('loading', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <BudgetProvider storage={createMemoryStorage()} getToday={() => '2026-11-14'}>
        <BudgetApp />
      </BudgetProvider>,
    );
    document.body.appendChild(container);
    try {
      expect(container.querySelector('main')).not.toBeNull();
      expect(container.querySelector('main')).toHaveAttribute('aria-busy', 'true');
      await expectNoAxeViolations();
    } finally {
      container.remove();
    }
  });

  const rendered: [string, Options][] = [
    ['first run', {}],
    ['populated (SCENARIO)', { state: SCENARIO }],
    ['over budget', { state: OVER_BUDGET }],
    ['unplanned-category spending', { state: UNPLANNED_SPEND }],
    ['no categories', { state: NO_CATEGORIES }],
    ['empty expense list', { state: NO_EXPENSES }],
    ['rollover notice', { state: SCENARIO, today: '2026-12-02' }],
    ['invalid saved data', { storage: createMemoryStorage({ [STORAGE_KEY]: 'not json' }) }],
    ['storage unavailable', { storage: createMemoryStorage({}, { throwOnGet: true, throwOnSet: true }) }],
  ];
  it.each(rendered)('%s', async (_name, options) => {
    await show(options);
    await expectNoAxeViolations();
  });

  it('the over-budget state really is over budget (so the axe pass covers it)', async () => {
    await show({ state: OVER_BUDGET });
    expect(screen.getByText('Over budget')).toBeInTheDocument();
    expect(screen.getByText('Spent $200.00 more than your income')).toBeInTheDocument();
    expect(screen.getByText('Planned $200.00 more than your income')).toBeInTheDocument();
  });

  it('the unplanned-spending state really shows No plan set', async () => {
    await show({ state: UNPLANNED_SPEND });
    expect(screen.getByText('No plan set')).toBeInTheDocument();
  });

  it('the no-categories state really has no categories', async () => {
    await show({ state: NO_CATEGORIES });
    expect(screen.queryByRole('button', { name: 'Add expense' })).not.toBeInTheDocument();
    expect(screen.getByText('No categories yet. Add one in Set up the month below.')).toBeInTheDocument();
  });

  it('add-expense dialog open', async () => {
    const { user } = await show({ state: SCENARIO });
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    await screen.findByRole('dialog', { name: 'Add expense' });
    await expectNoAxeViolations();
  });

  it('add-expense dialog with errors', async () => {
    const { user } = await show({ state: SCENARIO });
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
    await user.click(within(dialog).getByRole('button', { name: 'Save expense' }));
    expect(await within(dialog).findAllByRole('alert')).not.toHaveLength(0);
    await expectNoAxeViolations();
  });

  it('reset dialog open', async () => {
    const { user } = await show({ state: SCENARIO });
    const trigger = within(screen.getByRole('region', { name: 'Reset month' })).getByRole('button', {
      name: 'Reset month',
    });
    await user.click(trigger);
    await screen.findByRole('dialog', { name: 'Reset month?' });
    await expectNoAxeViolations();
  });

  it('after a rollover reset', async () => {
    const { user } = await show({ state: SCENARIO, today: '2026-12-02' });
    await user.click(screen.getByRole('button', { name: 'Start December 2026 budget' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset month?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    await screen.findByText('New budget started for December 2026.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await expectNoAxeViolations();
  });
});

describe('headings', () => {
  function headings(): { level: number; name: string }[] {
    return screen.getAllByRole('heading').map((h) => ({
      level: Number(h.tagName.slice(1)),
      name: h.textContent ?? '',
    }));
  }

  it('populated: one h1 Budget Kit; h2s in order; Categories is h3 between Set up the month and Reset month', async () => {
    await show({ state: SCENARIO });
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1.map((h) => h.textContent)).toEqual(['Budget Kit']);
    const h2 = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(h2).toEqual(['Summary', 'Spending by category', 'Expenses', 'Set up the month', 'Reset month']);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Categories']);
    const all = headings();
    const names = all.map((h) => h.name);
    expect(names.indexOf('Categories')).toBeGreaterThan(names.indexOf('Set up the month'));
    expect(names.indexOf('Categories')).toBeLessThan(names.indexOf('Reset month'));
    expect(all.find((h) => h.name === 'Categories')?.level).toBe(3);
    expect(all.some((h) => h.level > 3)).toBe(false);
  });

  it('no heading level is skipped, in the populated and rollover states', async () => {
    for (const options of [{ state: SCENARIO }, { state: SCENARIO, today: '2026-12-02' }] as Options[]) {
      const view = await show(options);
      let previous = 0;
      for (const { level } of headings()) {
        expect(level - previous, `level ${level} after ${previous}`).toBeLessThanOrEqual(1);
        previous = level;
      }
      view.unmount();
    }
  });

  it('rollover: New month is the first h2', async () => {
    await show({ state: SCENARIO, today: '2026-12-02' });
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'New month',
      'Summary',
      'Spending by category',
      'Expenses',
      'Set up the month',
      'Reset month',
    ]);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('every state keeps exactly one h1, Budget Kit, and no stray levels', async () => {
    const states: Options[] = [
      {},
      { state: OVER_BUDGET },
      { state: NO_CATEGORIES },
      { state: NO_EXPENSES },
      { storage: createMemoryStorage({ [STORAGE_KEY]: 'not json' }) },
      { storage: createMemoryStorage({}, { throwOnGet: true }) },
    ];
    for (const options of states) {
      const view = await show(options);
      expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Budget Kit']);
      const h3 = screen.queryAllByRole('heading', { level: 3 });
      for (const h of h3) expect(h.closest('section')).not.toBeNull();
      expect(screen.queryAllByRole('heading', { level: 4 })).toHaveLength(0);
      view.unmount();
    }
  });
});

describe('DOM order', () => {
  function before(a: Element, b: Element): boolean {
    return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }

  it('Summary, Add expense, Expenses, Set up the month, Reset month, all inside main', async () => {
    await show({ state: SCENARIO });
    const main = screen.getByRole('main');
    const summary = screen.getByRole('region', { name: 'Summary' });
    const add = screen.getByRole('button', { name: 'Add expense' });
    const expenses = screen.getByRole('region', { name: 'Expenses' });
    const setup = screen.getByRole('region', { name: 'Set up the month' });
    const reset = screen.getByRole('region', { name: 'Reset month' });
    for (const el of [summary, add, expenses, setup, reset]) expect(main).toContainElement(el);
    expect(before(summary, add)).toBe(true);
    expect(before(add, expenses)).toBe(true);
    expect(before(expenses, setup)).toBe(true);
    expect(before(setup, reset)).toBe(true);
  });

  it('rollover: the New month section precedes Summary', async () => {
    await show({ state: SCENARIO, today: '2026-12-02' });
    expect(
      before(screen.getByRole('region', { name: 'New month' }), screen.getByRole('region', { name: 'Summary' })),
    ).toBe(true);
  });

  it('first run: the prompts read the exact sentence and the setup section is below them', async () => {
    await show({});
    const prompts = screen.getAllByText('Enter your monthly income in Set up the month below');
    expect(prompts).toHaveLength(2);
    const setup = screen.getByRole('region', { name: 'Set up the month' });
    for (const prompt of prompts) expect(before(prompt, setup)).toBe(true);
    expect(before(prompts[0] as HTMLElement, screen.getByLabelText('Monthly income (USD)'))).toBe(true);
  });
});

describe('landmarks', () => {
  function textOutsideMain(): string[] {
    const stray: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? '';
      const parent = node.parentElement;
      if (text === '' || parent === null) continue;
      if (parent.closest('script, style, template, noscript') !== null) continue;
      if (parent.closest('[role="dialog"], [data-bk-dialog-root]') !== null) continue;
      if (parent.closest('main') === null) stray.push(text);
    }
    return stray;
  }

  const states: [string, Options][] = [
    ['first run', {}],
    ['populated', { state: SCENARIO }],
    ['rollover', { state: SCENARIO, today: '2026-12-02' }],
    ['invalid saved data', { storage: createMemoryStorage({ [STORAGE_KEY]: 'not json' }) }],
    ['storage unavailable', { storage: createMemoryStorage({}, { throwOnGet: true }) }],
    ['no categories', { state: NO_CATEGORIES }],
  ];

  it.each(states)('%s: one main and every visible text node is inside it', async (_name, options) => {
    await show(options);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(document.querySelectorAll('main')).toHaveLength(1);
    expect(textOutsideMain()).toEqual([]);
  });

  it('the text-outside-main check can fail (a stray paragraph is found)', async () => {
    await show({ state: SCENARIO });
    const stray = document.createElement('p');
    stray.textContent = 'stray';
    document.body.appendChild(stray);
    expect(textOutsideMain()).toEqual(['stray']);
    stray.remove();
  });

  it('dialogs are portalled outside main', async () => {
    const { user } = await show({ state: SCENARIO });
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
    expect(dialog.closest('main')).toBeNull();
    expect(textOutsideMain()).toEqual([]);
  });

  it('Cards are named regions', async () => {
    await show({ state: SCENARIO });
    for (const name of ['Summary', 'Spending by category', 'Expenses', 'Set up the month', 'Reset month']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });
});

describe('layout.tsx', () => {
  it('metadata title is Budget Kit', () => {
    expect(metadata.title).toBe('Budget Kit');
  });

  it('the html element has lang="en" (source)', () => {
    const source = readFileSync(join(import.meta.dirname, '..', 'app', 'layout.tsx'), 'utf8');
    expect(source).toMatch(/<html\b[^>]*\blang="en"/);
  });
});

describe('keyboard reachability: the first end-to-end scenario', () => {
  async function tabTo(user: UserEvent, target: HTMLElement): Promise<void> {
    for (let i = 0; i < 300 && document.activeElement !== target; i += 1) await user.tab();
    expect(document.activeElement, `could not Tab to ${target.outerHTML.slice(0, 80)}`).toBe(target);
  }

  async function typeInto(user: UserEvent, field: HTMLElement, text: string): Promise<void> {
    await tabTo(user, field);
    await user.keyboard(text);
  }

  // jsdom and user-event cannot drive a native select by keyboard, so the two selects (Category, Date)
  // are Tab-reached but their value is set programmatically. Keyboard operation of those selects is
  // covered only by the manual browser check, not by this test.
  async function choose(user: UserEvent, select: HTMLElement, label: string): Promise<void> {
    await tabTo(user, select);
    await user.selectOptions(select, label);
    expect((select as HTMLSelectElement).selectedOptions[0]?.textContent).toBe(label);
  }

  async function activate(user: UserEvent, button: HTMLElement): Promise<void> {
    await tabTo(user, button);
    await user.keyboard('{Enter}');
  }

  async function addExpense(
    user: UserEvent,
    e: { amount: string; category: string; note?: string; date: string },
  ): Promise<void> {
    await activate(user, screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
    await typeInto(user, within(dialog).getByLabelText('Amount (USD)'), e.amount);
    await choose(user, within(dialog).getByLabelText('Category'), e.category);
    if (e.note !== undefined) await typeInto(user, within(dialog).getByLabelText(/^Note/), e.note);
    await choose(user, within(dialog).getByLabelText('Date'), e.date);
    await activate(user, within(dialog).getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  }

  function stat(label: string): string {
    const li = within(screen.getByRole('region', { name: 'Summary' }))
      .getAllByRole('listitem')
      .find((item) => item.textContent?.startsWith(label));
    return li?.textContent ?? '';
  }

  it('reaches and operates every field and button with the keyboard; selects are set programmatically because jsdom cannot drive a native select by keyboard', async () => {
    const { user, readStored } = await show({ today: '2026-11-14' });
    await typeInto(user, screen.getByLabelText('Monthly income (USD)'), '3200');
    const planned = ['1500', '400', '120', '150', '100'];
    for (const [i, amount] of planned.entries()) {
      await typeInto(user, screen.getByLabelText(`Category ${i + 1} planned (USD)`), amount);
    }
    await addExpense(user, { amount: '1500', category: 'Rent', note: 'November rent', date: 'Nov 1, 2026' });
    await addExpense(user, { amount: '82.47', category: 'Groceries', date: 'Nov 3, 2026' });
    await addExpense(user, { amount: '112.35', category: 'Eating out', note: 'Birthday dinner', date: 'Nov 5, 2026' });

    expect(stat('Income')).toMatch(/^Income\$3,200\.00/);
    expect(stat('Planned')).toMatch(/^Planned\$2,270\.00/);
    expect(stat('Spent')).toMatch(/^Spent\$1,694\.82/);
    expect(stat('Left to spend')).toMatch(/^Left to spend\$1,505\.18/);
    expect(stat('Unplanned money')).toMatch(/^Unplanned money\$930\.00/);
    expect(screen.getByRole('progressbar', { name: 'Groceries' })).toHaveAttribute(
      'aria-valuetext',
      '$82.47 of $400.00',
    );
    expect(screen.getByRole('progressbar', { name: 'Eating out' })).toHaveAttribute(
      'aria-valuetext',
      '$112.35 of $100.00, over by $12.35',
    );
    expect(screen.getByText('Over budget')).toBeInTheDocument();
    const rows = within(screen.getByRole('region', { name: 'Expenses' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('th')?.textContent);
    expect(rows).toEqual(['Nov 5, 2026', 'Nov 3, 2026', 'Nov 1, 2026']);
    expect(readStored()?.expenses.map((x) => x.amountCents)).toEqual([150000, 8247, 11235]);
    expect(screen.queryByText(/Start by entering/)).not.toBeInTheDocument();
  });
});
