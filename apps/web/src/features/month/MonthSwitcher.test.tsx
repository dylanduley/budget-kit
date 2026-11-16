import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { BudgetBook } from '@/lib/months';
import { BudgetContext } from '@/state/BudgetProvider';
import { expectNoAxeViolations } from '@/test/axe';
import { BOOK, OCTOBER, SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import { renderApp } from '@/test/renderApp';
import { renderWithFakeBudget } from '@/test/renderWithFakeBudget';

import { MonthSwitcher } from './MonthSwitcher';

const PAST_NOTE = "You're looking at a past month. Changes are saved to October 2026.";
const NEW_NOTE =
  'New month. Your income and categories were copied from November 2026. Change them on the Plan page.';

const previous = (): HTMLElement => screen.getByRole('button', { name: 'Previous month' });
const next = (): HTMLElement => screen.getByRole('button', { name: 'Next month' });
const stat = (label: string): HTMLElement =>
  screen.getByText(label, { selector: '[data-part="label"]' }).parentElement as HTMLElement;
const label = (month: string): HTMLElement => screen.getByText(month, { selector: '[aria-live]' });
const SEPTEMBER = { ...OCTOBER, month: '2026-09', expenses: [] };
const THREE: BudgetBook = { months: [SEPTEMBER, OCTOBER, SCENARIO] };

describe('MonthSwitcher: current month', () => {
  it('seeded BOOK, today 2026-11-14: banner shows November 2026 between Previous (enabled) and Next (disabled), no notes', () => {
    renderApp({ book: BOOK, path: '/' });
    const banner = document.querySelector('header') as HTMLElement;
    const row = within(banner).getByText('November 2026').parentElement as HTMLElement;
    const order = Array.from(row.children).map((c) => c.textContent);
    expect(order).toEqual(['Previous', 'November 2026', 'Next']);
    expect(previous()).toBeEnabled();
    expect(next()).toBeDisabled();
    expect(screen.queryByText(/past month/)).not.toBeInTheDocument();
    expect(screen.queryByText(/New month\./)).not.toBeInTheDocument();
  });

  it('first run (empty storage): label November 2026, both buttons disabled, no notes', () => {
    renderApp({});
    expect(label('November 2026')).toBeInTheDocument();
    expect(previous()).toBeDisabled();
    expect(next()).toBeDisabled();
    expect(screen.queryByText(/past month/)).not.toBeInTheDocument();
    expect(screen.queryByText(/New month\./)).not.toBeInTheDocument();
  });

  it('no future month: Next is natively disabled on the latest month', () => {
    renderApp({ book: BOOK });
    expect(next()).toHaveAttribute('disabled');
  });
});

describe('MonthSwitcher: Previous month click', () => {
  it('shows October 2026, its figures, the past-month note, disables Previous, focuses Next, and does not write storage', async () => {
    const { user, storage } = renderApp({ book: BOOK });
    const before = storage.setItemCalls;
    await user.click(previous());
    expect(label('October 2026')).toBeInTheDocument();
    expect(stat('Income')).toHaveTextContent('$3,000.00');
    expect(stat('Spent')).toHaveTextContent('$3,494.82');
    expect(stat('Left to spend')).toHaveTextContent('-$494.82');
    expect(stat('Left to spend')).toHaveTextContent('Spent $494.82 more than your income');
    expect(screen.getByText(PAST_NOTE)).toBeInTheDocument();
    expect(previous()).toBeDisabled();
    expect(next()).toBeEnabled();
    expect(document.activeElement).toBe(next());
    expect(storage.setItemCalls).toBe(before);
  });

  it('switching back and forth never writes storage', async () => {
    const { user, storage } = renderApp({ book: BOOK });
    const before = storage.setItemCalls;
    const dump = storage.dump();
    await user.click(previous());
    await user.click(next());
    await user.click(previous());
    expect(storage.setItemCalls).toBe(before);
    expect(storage.dump()).toEqual(dump);
  });

  it('switching does not touch window.localStorage either', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    const { user } = renderApp({ book: BOOK });
    await user.click(previous());
    await user.click(next());
    expect(spy).not.toHaveBeenCalled();
  });

  it('the past-month note is gone again on returning to the current month', async () => {
    const { user } = renderApp({ book: BOOK });
    await user.click(previous());
    await user.click(next());
    expect(screen.queryByText(PAST_NOTE)).not.toBeInTheDocument();
    expect(label('November 2026')).toBeInTheDocument();
    expect(stat('Spent')).toHaveTextContent('$1,694.82');
  });
});

describe('MonthSwitcher: live region', () => {
  it('the label has aria-live="polite", is the only raw live region, and its text changes in place', async () => {
    const { user } = renderApp({ book: BOOK });
    const el = label('November 2026');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(
      document.querySelectorAll(
        '[aria-live]:not([data-part="status-message"]), [role="status"]:not([data-part="status-message"])',
      ),
    ).toHaveLength(1);
    await user.click(previous());
    expect(label('October 2026')).toBe(el);
    expect(el).toHaveAttribute('aria-live', 'polite');
  });
});

describe('MonthSwitcher: calls viewMonth with the adjacent month', () => {
  it('Previous calls viewMonth with the earlier month, Next with the later month', async () => {
    const { user, viewMonth } = renderWithFakeBudget(<MonthSwitcher />, { state: OCTOBER, book: THREE });
    expect(previous()).toBeEnabled();
    expect(next()).toBeEnabled();
    await user.click(previous());
    expect(viewMonth).toHaveBeenCalledTimes(1);
    expect(viewMonth).toHaveBeenLastCalledWith('2026-09');
    await user.click(next());
    expect(viewMonth).toHaveBeenCalledTimes(2);
    expect(viewMonth).toHaveBeenLastCalledWith('2026-11');
  });

  it('a natively disabled button does not call viewMonth', async () => {
    const { user, viewMonth } = renderWithFakeBudget(<MonthSwitcher />, { state: SCENARIO, book: BOOK });
    await user.click(next());
    expect(viewMonth).not.toHaveBeenCalled();
  });

  it('focus stays on the pressed button when both buttons remain enabled', async () => {
    const { user } = renderWithFakeBudget(<MonthSwitcher />, { state: OCTOBER, book: THREE });
    await user.click(previous());
    expect(document.activeElement).toBe(previous());
  });
});

describe('MonthSwitcher: focus across three months', () => {
  it('stepping to the middle keeps focus on the pressed button; reaching the end moves focus to the other', async () => {
    const { user } = renderApp({ book: THREE });
    await user.click(previous());
    expect(label('October 2026')).toBeInTheDocument();
    expect(document.activeElement).toBe(previous());
    await user.click(previous());
    expect(label('September 2026')).toBeInTheDocument();
    expect(previous()).toBeDisabled();
    expect(document.activeElement).toBe(next());
    await user.click(next());
    await user.click(next());
    expect(label('November 2026')).toBeInTheDocument();
    expect(next()).toBeDisabled();
    expect(document.activeElement).toBe(previous());
  });
});

describe('MonthSwitcher: pages follow the viewed month', () => {
  it('/spending lists only October rows', async () => {
    const { user } = renderApp({ book: BOOK, path: '/spending' });
    await user.click(previous());
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(screen.getByText('Oct 12, 2026')).toBeInTheDocument();
    expect(screen.getByText('Oct 1, 2026')).toBeInTheDocument();
    expect(screen.queryByText('Nov 3, 2026')).not.toBeInTheDocument();
  });

  it('Add expense in October: Date options Oct 1 to Oct 31, selected Oct 1, and saving stores it in October only', async () => {
    const { user, readStoredBook } = renderApp({ book: BOOK, path: '/spending' });
    await user.click(previous());
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = screen.getByRole('dialog', { name: 'Add expense' });
    const date = within(dialog).getByRole('combobox', { name: 'Date' }) as HTMLSelectElement;
    const options = within(date).getAllByRole('option').map((o) => o.textContent);
    expect(options).toHaveLength(31);
    expect(options[0]).toBe('Oct 1, 2026');
    expect(options[30]).toBe('Oct 31, 2026');
    expect(date.selectedOptions[0]?.textContent).toBe('Oct 1, 2026');
    await user.type(within(dialog).getByRole('textbox', { name: 'Amount (USD)' }), '5');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Category' }), 'Rent');
    await user.click(within(dialog).getByRole('button', { name: 'Save expense' }));
    const book = readStoredBook();
    const oct = book?.months.find((m) => m.month === '2026-10');
    const nov = book?.months.find((m) => m.month === '2026-11');
    expect(oct?.expenses).toHaveLength(3);
    expect(oct?.expenses.some((e) => e.amountCents === 500 && e.date === '2026-10-01')).toBe(true);
    expect(nov?.expenses).toHaveLength(3);
    expect(nov?.expenses.some((e) => e.amountCents === 500)).toBe(false);
  });

  it('/plan shows Monthly income (USD) 3,000.00 for October', async () => {
    const { user } = renderApp({ book: BOOK, path: '/plan' });
    await user.click(previous());
    expect(screen.getByRole('textbox', { name: 'Monthly income (USD)' })).toHaveValue('3,000.00');
  });

  it('the viewed month survives navigation and resets on refresh()', async () => {
    const { user, refresh } = renderApp({ book: BOOK, path: '/' });
    await user.click(previous());
    await user.click(screen.getByRole('link', { name: 'Plan' }));
    await user.click(screen.getByRole('link', { name: 'Overview' }));
    expect(label('October 2026')).toBeInTheDocument();
    expect(stat('Income')).toHaveTextContent('$3,000.00');
    refresh();
    expect(await screen.findByText('November 2026', { selector: '[aria-live]' })).toBeInTheDocument();
  });
});

describe('MonthSwitcher: new month', () => {
  it('today 2026-12-02: December 2026, Next disabled, new-month note, copied figures, storage untouched', () => {
    const { storage } = renderApp({ book: BOOK, today: '2026-12-02' });
    expect(label('December 2026')).toBeInTheDocument();
    expect(next()).toBeDisabled();
    expect(previous()).toBeEnabled();
    expect(screen.getByText(NEW_NOTE)).toBeInTheDocument();
    expect(screen.queryByText(/past month/)).not.toBeInTheDocument();
    expect(stat('Income')).toHaveTextContent('$3,200.00');
    expect(stat('Planned')).toHaveTextContent('$2,270.00');
    expect(stat('Spent')).toHaveTextContent('$0.00');
    expect(storage.setItemCalls).toBe(0);
  });

  it('after adding an expense the note disappears; Previous goes to November with unchanged figures', async () => {
    const { user } = renderApp({ book: BOOK, today: '2026-12-02' });
    await user.click(await screen.findByRole('button', { name: 'Add expense' }));
    const dialog = screen.getByRole('dialog', { name: 'Add expense' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Amount (USD)' }), '20');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Category' }), 'Rent');
    await user.click(within(dialog).getByRole('button', { name: 'Save expense' }));
    expect(screen.queryByText(NEW_NOTE)).not.toBeInTheDocument();
    await user.click(previous());
    expect(label('November 2026')).toBeInTheDocument();
    expect(stat('Spent')).toHaveTextContent('$1,694.82');
    expect(stat('Income')).toHaveTextContent('$3,200.00');
  });

  it('the new-month note is a plain paragraph, separate from the live label', () => {
    renderApp({ book: BOOK, today: '2026-12-02' });
    expect(screen.getAllByText(/month/i, { selector: 'p:not([aria-live])' }).map((p) => p.textContent)).toContain(NEW_NOTE);
  });
});

describe('MonthSwitcher: new-month note needs an unstored month', () => {
  it('a stored viewed month never shows the new-month note even if a copy source were reported', () => {
    render(
      <BudgetContext.Provider
        value={{
          status: 'ready',
          state: SCENARIO,
          today: '2026-11-14',
          currentMonth: '2026-11',
          book: BOOK,
          viewedMonth: '2026-11',
          months: ['2026-10', '2026-11'],
          isViewedMonthStored: true,
          copiedFromMonth: '2026-10',
          generation: 0,
          loadStatus: 'loaded',
          savedDataReplaced: false,
          viewMonth: () => undefined,
          actions: {} as never,
        }}
      >
        <MonthSwitcher />
      </BudgetContext.Provider>,
    );
    expect(screen.queryByText(/New month\./)).not.toBeInTheDocument();
  });
});

describe('MonthSwitcher: gaps', () => {
  it('only October stored, today 2026-12-02: Previous from December goes to October 2026', async () => {
    const { user } = renderApp({ book: { months: [OCTOBER] }, today: '2026-12-02' });
    expect(label('December 2026')).toBeInTheDocument();
    await user.click(previous());
    expect(label('October 2026')).toBeInTheDocument();
    expect(screen.queryByText('November 2026')).not.toBeInTheDocument();
    expect(previous()).toBeDisabled();
  });
});

describe('MonthSwitcher: hidden states', () => {
  it('/history: no Previous or Next month buttons', () => {
    renderApp({ book: BOOK, path: '/history' });
    expect(screen.queryByRole('button', { name: 'Previous month' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next month' })).not.toBeInTheDocument();
  });

  it('reappears when navigating from /history to /', () => {
    const { goTo } = renderApp({ book: BOOK, path: '/history' });
    goTo('/');
    expect(previous()).toBeInTheDocument();
  });

  it('renders nothing while loading', () => {
    const { container } = render(
      <BudgetContext.Provider value={{ status: 'loading' }}>
        <MonthSwitcher />
      </BudgetContext.Provider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('MonthSwitcher: keyboard only', () => {
  it('Tab to Previous, Enter moves to October and focuses Next; Enter returns to November and focuses Previous', async () => {
    const { user } = renderApp({ book: BOOK });
    await user.tab();
    while (document.activeElement !== previous()) {
      expect(document.activeElement).not.toBe(document.body);
      await user.tab();
    }
    await user.keyboard('{Enter}');
    expect(label('October 2026')).toBeInTheDocument();
    expect(document.activeElement).toBe(next());
    await user.keyboard('{Enter}');
    expect(label('November 2026')).toBeInTheDocument();
    expect(document.activeElement).toBe(previous());
  });

  it('Space also activates the focused button', async () => {
    const { user } = renderApp({ book: BOOK });
    previous().focus();
    await user.keyboard(' ');
    expect(label('October 2026')).toBeInTheDocument();
    expect(document.activeElement).toBe(next());
  });

  it('a disabled button is skipped by Tab', async () => {
    const { user } = renderApp({ book: BOOK });
    previous().focus();
    await user.tab();
    expect(document.activeElement).not.toBe(next());
  });
});

describe('MonthSwitcher: accessibility (axe)', () => {
  it('current month on /', async () => {
    renderApp({ book: BOOK, path: '/' });
    await expectNoAxeViolations();
  });
  it('past month on /', async () => {
    const { user } = renderApp({ book: BOOK, path: '/' });
    await user.click(previous());
    expect(screen.getByText(PAST_NOTE)).toBeInTheDocument();
    await expectNoAxeViolations();
  });
  it('new month on /', async () => {
    renderApp({ book: BOOK, today: '2026-12-02', path: '/' });
    expect(screen.getByText(NEW_NOTE)).toBeInTheDocument();
    await expectNoAxeViolations();
  });
  it('first run with both buttons disabled', async () => {
    renderApp({ storage: createMemoryStorage(), path: '/' });
    await expectNoAxeViolations();
  });
});
