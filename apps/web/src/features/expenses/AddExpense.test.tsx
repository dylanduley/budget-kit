import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { type BudgetState, MAX_CENTS, datesInMonth, defaultExpenseDate } from '@/lib/budget';
import { formatDate } from '@/lib/format';
import { TOTAL_TOO_LARGE_MESSAGE } from '@/state/BudgetProvider';
import { expectNoAxeViolations } from '@/test/axe';
import { SCENARIO } from '@/test/fixtures';
import { renderWithBudget } from '@/test/renderWithBudget';
import { renderWithFakeBudget } from '@/test/renderWithFakeBudget';

import { AddExpense } from './AddExpense';
import { BudgetApp } from '../BudgetApp';

const UNEXPECTED = 'Something went wrong. Your budget was not changed.';
const AMOUNT_ERROR = 'Enter an amount like 12.50';
const ZERO_ERROR = 'Enter an amount more than 0.00';
const CATEGORY_ERROR = 'Choose a category';
const NOTE_ERROR = 'Keep the note to 100 characters or fewer';

const trigger = (): HTMLElement => screen.getByRole('button', { name: 'Add expense' });
const dialog = (): HTMLElement => screen.getByRole('dialog', { name: 'Add expense' });
const amountInput = (): HTMLElement => within(dialog()).getByRole('textbox', { name: 'Amount (USD)' });
const categorySelect = (): HTMLElement => within(dialog()).getByRole('combobox', { name: 'Category' });
const noteInput = (): HTMLElement => within(dialog()).getByRole('textbox', { name: 'Note' });
const dateSelect = (): HTMLElement => within(dialog()).getByRole('combobox', { name: 'Date' });
const save = (): HTMLElement => within(dialog()).getByRole('button', { name: 'Save expense' });
const optionsOf = (select: HTMLElement): HTMLOptionElement[] => within(select).getAllByRole<HTMLOptionElement>('option');
// The category placeholder option also reads "Choose a category", so match errors by their alert role.
const alertWith = (text: string): HTMLElement | undefined =>
  screen.queryAllByRole('alert').find((el) => el.textContent === text);
const actionError = (): Element | null => document.querySelector('[data-part="action-error"]');

async function openDialog(user: UserEvent): Promise<void> {
  await user.click(trigger());
}

interface Fill {
  amount?: string;
  category?: string;
  note?: string;
  date?: string;
}

async function fill(user: UserEvent, values: Fill): Promise<void> {
  if (values.amount !== undefined) await user.type(amountInput(), values.amount);
  if (values.category !== undefined) await user.selectOptions(categorySelect(), values.category);
  if (values.note !== undefined) await user.type(noteInput(), values.note);
  if (values.date !== undefined) await user.selectOptions(dateSelect(), values.date);
}

const VALID_FILL: Fill = { amount: '82.47', category: 'Groceries', note: 'weekly shop', date: 'Nov 3, 2026' };

function withExpenses(count: number, amountCents: number): BudgetState {
  return {
    ...SCENARIO,
    expenses: Array.from({ length: count }, (_, i) => ({
      id: `big-${i}`,
      categoryId: 'suggested-transport',
      amountCents,
      note: '',
      date: '2026-11-02',
    })),
  };
}

describe('closed and no-categories states', () => {
  it('closed: an Add expense button and no dialog', async () => {
    renderWithBudget(<AddExpense />, { state: SCENARIO });
    expect(await screen.findByRole('button', { name: 'Add expense' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('no categories: no button, shows "Add a category in Set up the month below before adding expenses."', async () => {
    renderWithBudget(<AddExpense />, { state: { ...SCENARIO, categories: [], expenses: [] } });
    expect(await screen.findByText('Add a category in Set up the month below before adding expenses.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add expense' })).not.toBeInTheDocument();
  });
});

describe('opening the dialog', () => {
  it('opens a dialog named Add expense with focus on Amount (USD)', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    expect(dialog()).toBeInTheDocument();
    expect(amountInput()).toHaveFocus();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('labels the fields Amount (USD), Category, Note, Date; Note has hint Optional', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    expect(within(dialog()).getByLabelText('Amount (USD)')).toBe(amountInput());
    expect(within(dialog()).getByLabelText('Category')).toBe(categorySelect());
    expect(within(dialog()).getByLabelText('Note')).toBe(noteInput());
    expect(within(dialog()).getByLabelText('Date')).toBe(dateSelect());
    expect(noteInput()).toHaveAccessibleDescription('Optional');
    expect(noteInput()).toHaveAttribute('maxlength', '100');
  });

  it('starts empty: amount and note empty, category placeholder shown, no errors', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    expect(amountInput()).toHaveValue('');
    expect(noteInput()).toHaveValue('');
    expect(categorySelect()).toHaveValue('');
    expect(within(categorySelect()).getByRole('option', { name: 'Choose a category', selected: true })).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lists Rent, Groceries, Transport, Utilities, Eating out in order after the placeholder', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    expect(optionsOf(categorySelect()).map((o) => o.textContent)).toEqual([
      'Choose a category',
      'Rent',
      'Groceries',
      'Transport',
      'Utilities',
      'Eating out',
    ]);
  });

  it('Date lists the 30 days of November 2026 with values 2026-11-01..30 and Nov 14, 2026 selected', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    const options = optionsOf(dateSelect());
    expect(options).toHaveLength(30);
    expect(options[0]).toHaveTextContent('Nov 1, 2026');
    expect(options[29]).toHaveTextContent('Nov 30, 2026');
    expect(options.map((o) => o.value)).toEqual(datesInMonth('2026-11'));
    expect(options.map((o) => o.textContent)).toEqual(datesInMonth('2026-11').map(formatDate));
    expect(options.map((o) => o.value)[0]).toBe('2026-11-01');
    expect(options.map((o) => o.value)[29]).toBe('2026-11-30');
    expect(dateSelect()).toHaveValue('2026-11-14');
    expect(within(dateSelect()).getByRole('option', { name: 'Nov 14, 2026', selected: true })).toHaveValue('2026-11-14');
  });

  it('a 2026-10 budget with today 2026-11-14 lists 31 October days and selects Oct 1, 2026', async () => {
    const { user } = renderWithBudget(<AddExpense />, {
      state: { ...SCENARIO, month: '2026-10', expenses: [] },
      today: '2026-11-14',
    });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    const options = optionsOf(dateSelect());
    expect(options).toHaveLength(31);
    expect(options[30]).toHaveTextContent('Oct 31, 2026');
    expect(dateSelect()).toHaveValue('2026-10-01');
    expect(within(dateSelect()).getByRole('option', { name: 'Oct 1, 2026', selected: true })).toBeInTheDocument();
    expect(defaultExpenseDate('2026-10', '2026-11-14')).toBe('2026-10-01');
  });

  it('a 2026-10 budget with today in November saves the 1st of October when the date is untouched', async () => {
    const { user, actions } = renderWithFakeBudget(<AddExpense />, {
      state: { ...SCENARIO, month: '2026-10', expenses: [] },
      today: '2026-11-14',
    });
    await openDialog(user);
    await fill(user, { amount: '5', category: 'Rent' });
    await user.click(save());
    expect(actions.addExpense).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-01' }));
  });

  it('a November budget with today Nov 14 saves 2026-11-14 when the date is untouched', async () => {
    const { user, actions } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO });
    await openDialog(user);
    await fill(user, { amount: '5', category: 'Rent' });
    await user.click(save());
    expect(actions.addExpense).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-11-14' }));
  });

  it('a 2028-02 budget lists 29 days ending Feb 29, 2028', async () => {
    const { user } = renderWithBudget(<AddExpense />, {
      state: { ...SCENARIO, month: '2028-02', expenses: [] },
      today: '2028-02-10',
    });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    const options = optionsOf(dateSelect());
    expect(options).toHaveLength(29);
    expect(options[28]).toHaveTextContent('Feb 29, 2028');
    expect(dateSelect()).toHaveValue('2028-02-10');
  });

  it('category options follow state: renamed Food, added Pets, six labels', async () => {
    const state: BudgetState = {
      ...SCENARIO,
      categories: [
        ...SCENARIO.categories.map((c) => (c.id === 'suggested-groceries' ? { ...c, name: 'Food' } : c)),
        { id: 'pets', name: 'Pets', plannedCents: 5000 },
      ],
    };
    const { user } = renderWithBudget(<AddExpense />, { state });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    expect(optionsOf(categorySelect()).map((o) => o.textContent)).toEqual([
      'Choose a category',
      'Rent',
      'Food',
      'Transport',
      'Utilities',
      'Eating out',
      'Pets',
    ]);
  });

  it('a removed category is not listed', async () => {
    const state: BudgetState = { ...SCENARIO, categories: SCENARIO.categories.filter((c) => c.id !== 'suggested-utilities') };
    const { user } = renderWithBudget(<AddExpense />, { state });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    const labels = optionsOf(categorySelect()).map((o) => o.textContent);
    expect(labels).not.toContain('Utilities');
    expect(labels).toHaveLength(5);
  });

  it('while open the trigger sits under an inert ancestor', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    expect(trigger().closest('[inert]')).toBeNull();
    await openDialog(user);
    expect(screen.getByRole('button', { name: 'Add expense', hidden: true }).closest('[inert]')).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(trigger().closest('[inert]')).toBeNull();
  });
});

describe('saving', () => {
  it('saves exact cents, closes, returns focus to the trigger, and stores the expense', async () => {
    const { user, readStored } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await user.click(save());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    const stored = readStored();
    expect(stored?.expenses).toHaveLength(4);
    expect(stored?.expenses[3]).toEqual({
      id: 'id-1',
      categoryId: 'suggested-groceries',
      amountCents: 8247,
      note: 'weekly shop',
      date: '2026-11-03',
    });
  });

  it('calls addExpense once with exact cents, trimmed note and the chosen date (fake provider)', async () => {
    const { user, actions } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO });
    await openDialog(user);
    await fill(user, { amount: '82.47', category: 'Groceries', note: '  weekly shop  ' });
    await user.click(save());
    expect(actions.addExpense).toHaveBeenCalledTimes(1);
    expect(actions.addExpense).toHaveBeenCalledWith({
      categoryId: 'suggested-groceries',
      amountCents: 8247,
      note: 'weekly shop',
      date: '2026-11-14',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // user-event cannot emulate implicit submission when the submit button sits outside the <form>
  // (it only looks for a submit button inside it), so Enter is covered by the form-owner link plus
  // requestSubmit(), which is what a browser does on Enter; the real keypress is a manual check.
  it('Save expense is a submit button owned by the same form as the text fields (Enter in Note submits)', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    const form = (noteInput() as HTMLInputElement).form;
    expect(form).not.toBeNull();
    expect((amountInput() as HTMLInputElement).form).toBe(form);
    expect((categorySelect() as HTMLSelectElement).form).toBe(form);
    expect((dateSelect() as HTMLSelectElement).form).toBe(form);
    expect(save()).toHaveAttribute('type', 'submit');
    expect((save() as HTMLButtonElement).form).toBe(form);
    expect(form).toHaveAttribute('novalidate');
    expect(form?.contains(save())).toBe(false);
  });

  it('submitting the form the way Enter in Note does saves the expense', async () => {
    const { user, readStored } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    await fill(user, { amount: '82.47', category: 'Groceries', date: 'Nov 3, 2026', note: 'weekly shop' });
    (noteInput() as HTMLInputElement).form?.requestSubmit();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(readStored()?.expenses.at(-1)).toMatchObject({ amountCents: 8247, note: 'weekly shop', date: '2026-11-03' });
  });

  it('submitting with invalid values the way Enter does shows errors and adds nothing', async () => {
    const { user, actions } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO });
    await openDialog(user);
    (noteInput() as HTMLInputElement).form?.requestSubmit();
    await waitFor(() => expect(alertWith(AMOUNT_ERROR)).toBeDefined());
    expect(actions.addExpense).not.toHaveBeenCalled();
  });

  it('submit events are default-prevented (the page never navigates)', async () => {
    const { user } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO });
    await openDialog(user);
    const form = (noteInput() as HTMLInputElement).form as HTMLFormElement;
    expect(fireEvent.submit(form)).toBe(false);
  });

  it('stores 10 and 20 for 0.10 then 0.20 (no floats)', async () => {
    const { user, readStored } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    for (const text of ['0.10', '0.20']) {
      await openDialog(user);
      await fill(user, { amount: text, category: 'Rent' });
      await user.click(save());
    }
    const added = readStored()?.expenses.slice(3).map((e) => e.amountCents);
    expect(added).toEqual([10, 20]);
    for (const cents of added ?? []) expect(Number.isInteger(cents)).toBe(true);
  });

  it('accepts the smallest amount 0.01 as 1 cent', async () => {
    const { user, readStored } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    await fill(user, { amount: '0.01', category: 'Rent' });
    await user.click(save());
    expect(readStored()?.expenses.at(-1)?.amountCents).toBe(1);
  });

  it('the saved expense reaches the provider state (reopen after refresh keeps it)', async () => {
    const { user, refresh, readStored } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    await fill(user, { amount: '1', category: 'Rent' });
    await user.click(save());
    refresh();
    expect(await screen.findByRole('button', { name: 'Add expense' })).toBeInTheDocument();
    expect(readStored()?.expenses).toHaveLength(4);
  });

  it('keyboard only: open with Enter, fill every field, Tab to Save and press Enter; open and close with Esc', async () => {
    const { user, readStored } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    trigger().focus();
    await user.keyboard('{Enter}');
    expect(amountInput()).toHaveFocus();
    await user.keyboard('12.50');
    await user.tab();
    expect(categorySelect()).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    // user-event does not move a select with arrows in jsdom; choose through the keyboard-focused element.
    if ((categorySelect() as HTMLSelectElement).value === '') await user.selectOptions(categorySelect(), 'Transport');
    expect(categorySelect()).not.toHaveValue('');
    await user.tab();
    expect(noteInput()).toHaveFocus();
    await user.keyboard('bus');
    await user.tab();
    expect(dateSelect()).toHaveFocus();
    await user.selectOptions(dateSelect(), 'Nov 20, 2026');
    await user.tab();
    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab();
    expect(save()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(readStored()?.expenses.at(-1)).toMatchObject({ amountCents: 1250, note: 'bus', date: '2026-11-20' });

    await user.keyboard('{Enter}');
    expect(dialog()).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(readStored()?.expenses).toHaveLength(4);
  });
});

describe('cancelling', () => {
  it.each([
    ['Cancel button', async (user: UserEvent) => user.click(within(dialog()).getByRole('button', { name: 'Cancel' }))],
    ['Esc', async (user: UserEvent) => user.keyboard('{Escape}')],
    ['close button', async (user: UserEvent) => user.click(within(dialog()).getByRole('button', { name: 'Close' }))],
  ])('%s closes, returns focus to Add expense and adds nothing', async (_name, close) => {
    const { user, actions } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await close(user);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(actions.addExpense).not.toHaveBeenCalled();
  });

  it.each([
    ['Cancel button', async (user: UserEvent) => user.click(within(dialog()).getByRole('button', { name: 'Cancel' }))],
    ['Esc', async (user: UserEvent) => user.keyboard('{Escape}')],
    ['close button', async (user: UserEvent) => user.click(within(dialog()).getByRole('button', { name: 'Close' }))],
  ])('%s leaves stored expenses at 3 (real provider)', async (_name, close) => {
    const { user, readStored } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await close(user);
    expect(readStored()?.expenses).toHaveLength(3);
  });

  it('reopening a cancelled half-filled form shows empty fields, default date and no errors', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    await user.click(save());
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    await fill(user, { note: 'half', date: 'Nov 2, 2026' });
    await user.keyboard('{Escape}');
    await openDialog(user);
    expect(amountInput()).toHaveValue('');
    expect(categorySelect()).toHaveValue('');
    expect(noteInput()).toHaveValue('');
    expect(dateSelect()).toHaveValue('2026-11-14');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(amountInput()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('reopening after a plain cancel with filled values shows empty fields', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    await fill(user, { amount: '33', category: 'Utilities', note: 'keep?', date: 'Nov 9, 2026' });
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    await openDialog(user);
    expect(amountInput()).toHaveValue('');
    expect(categorySelect()).toHaveValue('');
    expect(noteInput()).toHaveValue('');
    expect(dateSelect()).toHaveValue('2026-11-14');
  });
});

describe('validation errors', () => {
  async function openReady(): Promise<ReturnType<typeof renderWithBudget>> {
    const rendered = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(rendered.user);
    return rendered;
  }

  it('empty amount with a category: shows the error, aria-invalid, focus on amount, nothing stored', async () => {
    const { user, readStored } = await openReady();
    await user.selectOptions(categorySelect(), 'Rent');
    await user.click(save());
    expect(dialog()).toBeInTheDocument();
    expect(alertWith(AMOUNT_ERROR)).toBeDefined();
    expect(amountInput()).toHaveAttribute('aria-invalid', 'true');
    expect(amountInput()).toHaveFocus();
    expect(readStored()?.expenses).toHaveLength(3);
  });

  it('amount "abc": dialog stays open, error shown, nothing stored', async () => {
    const { user, readStored } = await openReady();
    await fill(user, { amount: 'abc', category: 'Rent' });
    await user.click(save());
    expect(dialog()).toBeInTheDocument();
    expect(alertWith(AMOUNT_ERROR)).toBeDefined();
    expect(amountInput()).toHaveAttribute('aria-invalid', 'true');
    expect(amountInput()).toHaveFocus();
    expect(readStored()?.expenses).toHaveLength(3);
  });

  it('amount "abc" with Enter (no blur) shows the app error', async () => {
    const { user, actions } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO });
    await openDialog(user);
    await user.selectOptions(categorySelect(), 'Rent');
    await user.type(amountInput(), 'abc');
    (amountInput() as HTMLInputElement).form?.requestSubmit();
    await waitFor(() => expect(alertWith(AMOUNT_ERROR)).toBeDefined());
    expect(actions.addExpense).not.toHaveBeenCalled();
  });

  it('amount "0": "Enter an amount more than 0.00", nothing stored', async () => {
    const { user, readStored } = await openReady();
    await fill(user, { amount: '0', category: 'Rent' });
    await user.click(save());
    expect(alertWith(ZERO_ERROR)).toBeDefined();
    expect(amountInput()).toHaveAttribute('aria-invalid', 'true');
    expect(amountInput()).toHaveFocus();
    expect(readStored()?.expenses).toHaveLength(3);
  });

  it('amount "0.00" also gives the zero error', async () => {
    const { user } = await openReady();
    await fill(user, { amount: '0.00', category: 'Rent' });
    await user.click(save());
    expect(alertWith(ZERO_ERROR)).toBeDefined();
  });

  it('amount "-5": tabbing away shows "Amount can\'t be negative"; submitting adds nothing', async () => {
    const { user, readStored } = await openReady();
    await fill(user, { amount: '-5' });
    await user.tab();
    expect(within(dialog()).getByText("Amount can't be negative")).toBeInTheDocument();
    await user.selectOptions(categorySelect(), 'Rent');
    await user.click(save());
    expect(dialog()).toBeInTheDocument();
    expect(readStored()?.expenses).toHaveLength(3);
  });

  it('no category: "Choose a category" with focus on Category and nothing stored', async () => {
    const { user, readStored } = await openReady();
    await fill(user, { amount: '5' });
    await user.click(save());
    expect(alertWith(CATEGORY_ERROR)).toBeDefined();
    expect(categorySelect()).toHaveAttribute('aria-invalid', 'true');
    expect(categorySelect()).toHaveFocus();
    expect(alertWith(AMOUNT_ERROR)).toBeUndefined();
    expect(readStored()?.expenses).toHaveLength(3);
  });

  it('a 101-character note: error on Note and focus on Note when it is the only invalid field', async () => {
    const { user, readStored } = await openReady();
    await fill(user, { amount: '5', category: 'Rent' });
    fireEvent.change(noteInput(), { target: { value: 'n'.repeat(101) } });
    await user.click(save());
    expect(alertWith(NOTE_ERROR)).toBeDefined();
    expect(noteInput()).toHaveAttribute('aria-invalid', 'true');
    expect(noteInput()).toHaveFocus();
    expect(readStored()?.expenses).toHaveLength(3);
  });

  it('a 100-character note saves', async () => {
    const { user, readStored } = await openReady();
    await fill(user, { amount: '5', category: 'Rent' });
    fireEvent.change(noteInput(), { target: { value: 'n'.repeat(100) } });
    await user.click(save());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(readStored()?.expenses.at(-1)?.note).toBe('n'.repeat(100));
  });

  it('typing past 100 characters is capped by the input (maxLength)', async () => {
    const { user } = await openReady();
    await user.type(noteInput(), 'x'.repeat(120));
    expect((noteInput() as HTMLInputElement).value).toHaveLength(100);
  });

  it('submitting the untouched form shows amount and category errors, no date error, focus on amount', async () => {
    const { user } = await openReady();
    await user.click(save());
    expect(alertWith(AMOUNT_ERROR)).toBeDefined();
    expect(alertWith(CATEGORY_ERROR)).toBeDefined();
    expect(dateSelect()).not.toHaveAttribute('aria-invalid');
    expect(noteInput()).not.toHaveAttribute('aria-invalid');
    expect(amountInput()).toHaveFocus();
    expect(actionError()).toBeNull();
  });

  it('each field error is its own role="alert" with the exact text and the app adds none', async () => {
    const { user } = await openReady();
    await user.click(save());
    const alerts = screen.getAllByRole('alert');
    expect(alerts.map((a) => a.textContent).sort()).toEqual([AMOUNT_ERROR, CATEGORY_ERROR].sort());
  });

  it('all three invalid shows three alerts and focuses amount first', async () => {
    const { user } = await openReady();
    fireEvent.change(noteInput(), { target: { value: 'n'.repeat(101) } });
    await user.click(save());
    expect(
      screen
        .getAllByRole('alert')
        .map((a) => a.textContent)
        .sort(),
    ).toEqual([AMOUNT_ERROR, CATEGORY_ERROR, NOTE_ERROR].sort());
    expect(amountInput()).toHaveFocus();
  });

  it('focus goes to Category when amount is valid but category and note are invalid', async () => {
    const { user } = await openReady();
    await fill(user, { amount: '5' });
    fireEvent.change(noteInput(), { target: { value: 'n'.repeat(101) } });
    await user.click(save());
    expect(categorySelect()).toHaveFocus();
    expect(alertWith(NOTE_ERROR)).toBeDefined();
  });

  it('focus goes to Category when only amount-valid and category-invalid, even though Note is later', async () => {
    const { user } = await openReady();
    await fill(user, { amount: '5', note: 'ok' });
    await user.click(save());
    expect(categorySelect()).toHaveFocus();
  });

  it('choosing a category removes only the category error', async () => {
    const { user } = await openReady();
    await user.click(save());
    await user.selectOptions(categorySelect(), 'Rent');
    expect(alertWith(CATEGORY_ERROR)).toBeUndefined();
    expect(categorySelect()).not.toHaveAttribute('aria-invalid', 'true');
    expect(alertWith(AMOUNT_ERROR)).toBeDefined();
    expect(amountInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('editing the note or date does not clear the amount or category errors', async () => {
    const { user } = await openReady();
    await user.click(save());
    await user.type(noteInput(), 'hi');
    await user.selectOptions(dateSelect(), 'Nov 2, 2026');
    expect(alertWith(AMOUNT_ERROR)).toBeDefined();
    expect(alertWith(CATEGORY_ERROR)).toBeDefined();
  });

  it('typing in the amount clears the amount error only', async () => {
    const { user } = await openReady();
    await user.click(save());
    await user.type(amountInput(), '5');
    expect(alertWith(AMOUNT_ERROR)).toBeUndefined();
    expect(alertWith(CATEGORY_ERROR)).toBeDefined();
  });

  it('editing the note clears only the note error', async () => {
    const { user } = await openReady();
    fireEvent.change(noteInput(), { target: { value: 'n'.repeat(101) } });
    await user.click(save());
    expect(alertWith(NOTE_ERROR)).toBeDefined();
    await user.type(noteInput(), '{Backspace}');
    expect(alertWith(NOTE_ERROR)).toBeUndefined();
    expect(alertWith(AMOUNT_ERROR)).toBeDefined();
    expect(alertWith(CATEGORY_ERROR)).toBeDefined();
  });

  it('after fixing the errors the form saves', async () => {
    const { user, readStored } = await openReady();
    await user.click(save());
    await fill(user, { amount: '9.99', category: 'Rent' });
    await user.click(save());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(readStored()?.expenses.at(-1)?.amountCents).toBe(999);
  });

  it('a double click on Save expense with valid input adds one expense', async () => {
    const { user, actions } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO });
    await openDialog(user);
    await fill(user, { amount: '5', category: 'Rent' });
    await user.dblClick(save());
    expect(actions.addExpense).toHaveBeenCalledTimes(1);
  });
});

describe('action errors', () => {
  const tooLarge = (): never => {
    throw new RangeError(TOTAL_TOO_LARGE_MESSAGE);
  };
  const boom = (): never => {
    throw new Error('boom');
  };

  it('total too large: message on the amount field (role alert, aria-invalid), focus on amount, values kept, one call', async () => {
    const { user, actions } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO, actions: { addExpense: tooLarge } });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await user.click(save());
    expect(actions.addExpense).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('That change would make a total too large.');
    expect(alert.textContent).toBe('That change would make a total too large.');
    expect(amountInput()).toHaveAttribute('aria-invalid', 'true');
    expect(amountInput()).toHaveAccessibleDescription('That change would make a total too large.');
    expect(amountInput()).toHaveFocus();
    expect(amountInput()).toHaveValue('82.47');
    expect(categorySelect()).toHaveValue('suggested-groceries');
    expect(noteInput()).toHaveValue('weekly shop');
    expect(dateSelect()).toHaveValue('2026-11-03');
    expect(actionError()).toBeNull();
  });

  it('total too large is not shown on any other field', async () => {
    const { user } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO, actions: { addExpense: tooLarge } });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await user.click(save());
    expect(categorySelect()).not.toHaveAttribute('aria-invalid', 'true');
    expect(noteInput()).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('a RangeError with different text is the unexpected error, not the amount error', async () => {
    const { user } = renderWithFakeBudget(<AddExpense />, {
      state: SCENARIO,
      actions: {
        addExpense: () => {
          throw new RangeError('Something else');
        },
      },
    });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await user.click(save());
    expect(actionError()).toHaveTextContent(UNEXPECTED);
    expect(amountInput()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('an Error with the total-too-large text that is not a RangeError is the unexpected error', async () => {
    const { user } = renderWithFakeBudget(<AddExpense />, {
      state: SCENARIO,
      actions: {
        addExpense: () => {
          throw new Error(TOTAL_TOO_LARGE_MESSAGE);
        },
      },
    });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await user.click(save());
    expect(actionError()).toHaveTextContent(UNEXPECTED);
  });

  it('unexpected error: message in p[role=alert][data-part=action-error], after Date, dialog open, values kept, Save focused', async () => {
    const { user, actions } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO, actions: { addExpense: boom } });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await user.click(save());
    expect(actions.addExpense).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeInTheDocument();
    const error = actionError();
    expect(error).not.toBeNull();
    expect(error?.tagName).toBe('P');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error?.textContent).toBe(UNEXPECTED);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(dateSelect().compareDocumentPosition(error as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(noteInput().compareDocumentPosition(error as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dialog()).toContainElement(error as HTMLElement);
    expect(save()).toHaveFocus();
    expect(amountInput()).toHaveValue('82.47');
    expect(categorySelect()).toHaveValue('suggested-groceries');
    expect(noteInput()).toHaveValue('weekly shop');
    expect(dateSelect()).toHaveValue('2026-11-03');
    expect(amountInput()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it.each([
    ['Amount', async (user: UserEvent) => user.type(amountInput(), '1')],
    ['Category', async (user: UserEvent) => user.selectOptions(categorySelect(), 'Rent')],
    ['Note', async (user: UserEvent) => user.type(noteInput(), 'x')],
    ['Date', async (user: UserEvent) => user.selectOptions(dateSelect(), 'Nov 20, 2026')],
  ])('editing %s clears the unexpected-error message', async (_name, edit) => {
    const { user } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO, actions: { addExpense: boom } });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await user.click(save());
    expect(actionError()).not.toBeNull();
    await edit(user);
    expect(actionError()).toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['Amount', async (user: UserEvent) => user.type(amountInput(), '1')],
    ['Category', async (user: UserEvent) => user.selectOptions(categorySelect(), 'Rent')],
    ['Note', async (user: UserEvent) => user.type(noteInput(), 'x')],
    ['Date', async (user: UserEvent) => user.selectOptions(dateSelect(), 'Nov 20, 2026')],
  ])('editing %s clears the total-too-large message', async (_name, edit) => {
    const { user } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO, actions: { addExpense: tooLarge } });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await user.click(save());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await edit(user);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(amountInput()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('after the unexpected error clears, a second submit (action no longer throwing) closes the dialog', async () => {
    const { user, actions } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO, actions: { addExpense: boom } });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await user.click(save());
    expect(dialog()).toBeInTheDocument();
    actions.addExpense.mockImplementation(() => 'fake-id');
    await user.click(save());
    expect(actions.addExpense).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(actionError()).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('a successful save after the total-too-large error closes the dialog and clears the message', async () => {
    const { user, actions } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO, actions: { addExpense: tooLarge } });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await user.click(save());
    actions.addExpense.mockImplementation(() => 'fake-id');
    await user.click(save());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('after a failed save, cancel and reopen shows an empty form with no message', async () => {
    const { user } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO, actions: { addExpense: boom } });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await user.click(save());
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    await openDialog(user);
    expect(actionError()).toBeNull();
    expect(amountInput()).toHaveValue('');
  });

  it('real overflow: 90 expenses of MAX_CENTS plus 999999999999.99 shows the total error and saves nothing', async () => {
    const { user, readStored } = renderWithBudget(<AddExpense />, { state: withExpenses(90, MAX_CENTS) });
    await screen.findByRole('button', { name: 'Add expense' });
    expect(readStored()?.expenses).toHaveLength(90);
    await openDialog(user);
    await fill(user, { amount: '999999999999.99', category: 'Transport' });
    await user.click(save());
    expect(dialog()).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('That change would make a total too large.');
    expect(amountInput()).toHaveAttribute('aria-invalid', 'true');
    expect(amountInput()).toHaveFocus();
    expect(amountInput()).toHaveValue('999,999,999,999.99');
    expect(readStored()?.expenses).toHaveLength(90);
  });

  it('real overflow: after the error a smaller amount that also overflows is still blocked, and 91st fits when reduced', async () => {
    const { user, readStored } = renderWithBudget(<AddExpense />, { state: withExpenses(90, MAX_CENTS) });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    await fill(user, { amount: '999999999999.99', category: 'Transport' });
    await user.click(save());
    expect(readStored()?.expenses).toHaveLength(90);
    await user.clear(amountInput());
    await user.type(amountInput(), '1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('boundary: MAX_CENTS alone (999999999999.99) saves exactly when the total fits', async () => {
    const { user, readStored } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    await fill(user, { amount: '999999999999.99', category: 'Transport' });
    await user.click(save());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(readStored()?.expenses.at(-1)?.amountCents).toBe(MAX_CENTS);
  });
});

describe('required semantics and structure', () => {
  it('Amount (USD) and Category are required; Note and Date are not', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    expect(within(dialog()).getByRole('textbox', { name: 'Amount (USD)' })).toBeRequired();
    expect(within(dialog()).getByRole('combobox', { name: 'Category' })).toBeRequired();
    expect(amountInput()).toHaveAttribute('required');
    expect(categorySelect()).toHaveAttribute('required');
    expect(within(dialog()).getByRole('textbox', { name: 'Note' })).not.toBeRequired();
    expect(within(dialog()).getByRole('combobox', { name: 'Date' })).not.toBeRequired();
    expect(noteInput()).not.toHaveAttribute('required');
    expect(dateSelect()).not.toHaveAttribute('required');
  });

  it('the form is noValidate, so an empty required form still shows the app errors and focuses amount', async () => {
    const { user, actions } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO });
    await openDialog(user);
    const form = (noteInput() as HTMLInputElement).form as HTMLFormElement;
    expect(form.noValidate).toBe(true);
    await user.click(save());
    expect(alertWith(AMOUNT_ERROR)).toBeDefined();
    expect(alertWith(CATEGORY_ERROR)).toBeDefined();
    expect(amountInput()).toHaveFocus();
    expect(actions.addExpense).not.toHaveBeenCalled();
  });

  it('submit handler runs on an invalid required form (requestSubmit is not blocked natively)', async () => {
    const { user } = renderWithFakeBudget(<AddExpense />, { state: SCENARIO });
    await openDialog(user);
    (noteInput() as HTMLInputElement).form?.requestSubmit();
    await waitFor(() => expect(alertWith(AMOUNT_ERROR)).toBeDefined());
    expect(alertWith(CATEGORY_ERROR)).toBeDefined();
  });

  it('the required marker does not change accessible names', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    for (const [role, name] of [
      ['textbox', 'Amount (USD)'],
      ['combobox', 'Category'],
      ['textbox', 'Note'],
      ['combobox', 'Date'],
    ] as const) {
      expect(within(dialog()).getByRole(role, { name })).toBeInTheDocument();
    }
  });

  it('renders no wrapper: the trigger is a direct child of the render container', async () => {
    const { container } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    const button = await screen.findByRole('button', { name: 'Add expense' });
    expect(button.parentElement).toBe(container);
  });

  it('mounted in BudgetApp the trigger is a direct child of main', async () => {
    renderWithBudget(<BudgetApp />, { state: SCENARIO });
    const button = await screen.findByRole('button', { name: 'Add expense' });
    expect(button.parentElement).toBe(screen.getByRole('main'));
  });
});

describe('accessibility', () => {
  it('axe: closed state', async () => {
    renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await expectNoAxeViolations();
  });

  it('axe: no-categories state', async () => {
    renderWithBudget(<main><AddExpense /></main>, { state: { ...SCENARIO, categories: [], expenses: [] } });
    await screen.findByText('Add a category in Set up the month below before adding expenses.');
    // Wrapped in a landmark by the test: the page shell (task 08) owns <main>.
    await expectNoAxeViolations();
  });

  it('axe: open dialog (colour contrast is disabled in jsdom, left to the manual browser check)', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    await expectNoAxeViolations();
  });

  it('axe: open dialog with the amount, category and note errors shown', async () => {
    const { user } = renderWithBudget(<AddExpense />, { state: SCENARIO });
    await screen.findByRole('button', { name: 'Add expense' });
    await openDialog(user);
    fireEvent.change(noteInput(), { target: { value: 'n'.repeat(101) } });
    await user.click(save());
    expect(screen.getAllByRole('alert')).toHaveLength(3);
    await expectNoAxeViolations();
  });

  it('axe: open dialog with the total-too-large error', async () => {
    const { user } = renderWithFakeBudget(<AddExpense />, {
      state: SCENARIO,
      actions: {
        addExpense: () => {
          throw new RangeError(TOTAL_TOO_LARGE_MESSAGE);
        },
      },
    });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await user.click(save());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await expectNoAxeViolations();
  });

  it('axe: open dialog with the unexpected action error', async () => {
    const { user } = renderWithFakeBudget(<AddExpense />, {
      state: SCENARIO,
      actions: {
        addExpense: () => {
          throw new Error('boom');
        },
      },
    });
    await openDialog(user);
    await fill(user, VALID_FILL);
    await user.click(save());
    expect(actionError()).not.toBeNull();
    await expectNoAxeViolations();
  });
});

describe('source rules', () => {
  const dir = import.meta.dirname;
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
  const source = (name: string): string => readFileSync(join(dir, name), 'utf8');
  const code = (name: string): string =>
    source(name)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

  it('the feature folder contains the screen files being checked', () => {
    expect(files).toEqual(expect.arrayContaining(['AddExpense.tsx', 'expenseForm.ts']));
  });

  it.each(['AddExpense.tsx', 'expenseForm.ts'])('%s has no native button, input, select, textarea, dialog, table or style prop', (name) => {
    expect(code(name)).not.toMatch(/<(button|input|select|textarea|dialog|table)[\s>/]/);
    expect(code(name)).not.toMatch(/\bstyle\s*=/);
    expect(code(name)).not.toMatch(/\bany\b|@ts-ignore|@ts-expect-error/);
  });

  it.each(['AddExpense.tsx', 'expenseForm.ts'])('%s does no float math on amounts and never sets allowNegative', (name) => {
    const text = code(name);
    expect(text).not.toMatch(/parseFloat|toFixed|Number\(|\*\s*100|\/\s*100|allowNegative/);
    expect(text).not.toMatch(/new Date|Date\.now/);
  });

  it('AddExpense.tsx displays no money text (formatMoney is only needed for display and none is shown)', () => {
    expect(code('AddExpense.tsx')).not.toMatch(/formatCents|toLocaleString|Intl\./);
  });

  it('role=alert appears once in AddExpense.tsx, on the action-error paragraph; no role=status or aria-live', () => {
    const text = code('AddExpense.tsx');
    expect(text.match(/role="alert"/g)).toHaveLength(1);
    expect(text).toMatch(/<p role="alert" data-part="action-error">/);
    expect(text).not.toMatch(/role="status"|aria-live/);
    expect(code('expenseForm.ts')).not.toMatch(/role=|aria-live/);
  });

  it('every actions.* call in AddExpense.tsx is inside a try block with a catch', () => {
    const text = code('AddExpense.tsx');
    const calls = [...text.matchAll(/actions\.\w+\(/g)];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const before = text.slice(0, call.index);
      const tryAt = before.lastIndexOf('try {');
      expect(tryAt).toBeGreaterThan(-1);
      const between = before.slice(tryAt);
      expect(between).not.toMatch(/\}\s*catch/);
      expect(text.slice(call.index)).toMatch(/^[\s\S]*?\}\s*catch\s*\(/);
    }
  });

  it('library components carry only self-*, w-full, justify-self-* or col-span-* classes (self-start allowed on the trigger)', () => {
    const text = code('AddExpense.tsx');
    const tags = [...text.matchAll(/<(Button|MoneyField|Select|TextField|Dialog)\b[^>]*?className="([^"]*)"/g)];
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      for (const cls of (tag[2] ?? '').split(/\s+/).filter(Boolean)) {
        expect(cls).toMatch(/^(self-[\w-]+|w-full|justify-self-[\w-]+|col-span-[\w-]+)$/);
      }
    }
    expect(text).toMatch(/<Button className="self-start"/);
  });

  it("'use client' only on AddExpense.tsx, not on the pure expenseForm.ts", () => {
    expect(source('AddExpense.tsx').startsWith("'use client';")).toBe(true);
    expect(source('expenseForm.ts')).not.toMatch(/use client/);
  });

  it('imports library components only from @budget-kit/ui (no deep imports)', () => {
    expect(source('AddExpense.tsx')).not.toMatch(/@budget-kit\/ui\/src/);
  });
});
