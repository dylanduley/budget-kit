import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useEffect, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createInitialState } from '@/lib/budget';
import { TOTAL_TOO_LARGE_MESSAGE, useBudget } from '@/state/BudgetProvider';
import { STORAGE_KEY } from '@/state/storage';
import { expectNoAxeViolations } from '@/test/axe';
import { SCENARIO } from '@/test/fixtures';
import { type RenderWithBudgetResult, renderWithBudget } from '@/test/renderWithBudget';
import { renderWithFakeBudget } from '@/test/renderWithFakeBudget';
import { ResetMonth } from './ResetMonth';
import { ResetMonthDialog } from './ResetMonthDialog';

const TEXT_3 = "This deletes your income, your categories and 3 expenses for November 2026. You can't undo this.";
const GENERIC = 'Something went wrong. Your budget was not changed.';

const oneExpense = { ...SCENARIO, expenses: [SCENARIO.expenses[0]!] };
const noExpenses = { ...SCENARIO, expenses: [] };

async function ready(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: 'Reset month' });
}

describe('closed Card', () => {
  it('has a Reset month button, a level 2 Reset month heading and no dialog', async () => {
    renderWithBudget(<ResetMonth />, { state: SCENARIO, today: '2026-11-14' });
    const trigger = await ready();
    expect(trigger).toHaveAttribute('data-variant', 'secondary');
    expect(screen.getByRole('heading', { level: 2, name: 'Reset month' })).toBeInTheDocument();
    expect(screen.getByText('Clear your income, categories and expenses and start again.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('still renders the button in the first-run state', async () => {
    renderWithBudget(<ResetMonth />, { today: '2026-11-14' });
    expect(await ready()).toBeInTheDocument();
  });
});

describe('opening the dialog', () => {
  it('shows the exact text for 3 expenses and focuses Cancel', async () => {
    const { user, storage } = renderWithBudget(<ResetMonth />, { state: SCENARIO, today: '2026-11-14' });
    const before = storage.dump()[STORAGE_KEY];
    await user.click(await ready());
    const dialog = await screen.findByRole('dialog', { name: 'Reset month?' });
    expect(within(dialog).getByText(TEXT_3)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(storage.dump()[STORAGE_KEY]).toBe(before);
    expect(storage.setItemCalls).toBe(0);
  });

  it('says 1 expense for one expense', async () => {
    const { user } = renderWithBudget(<ResetMonth />, { state: oneExpense });
    await user.click(await ready());
    expect(
      await screen.findByText("This deletes your income, your categories and 1 expense for November 2026. You can't undo this."),
    ).toBeInTheDocument();
  });

  it('says 0 expenses for none', async () => {
    const { user } = renderWithBudget(<ResetMonth />, { state: noExpenses });
    await user.click(await ready());
    expect(
      await screen.findByText("This deletes your income, your categories and 0 expenses for November 2026. You can't undo this."),
    ).toBeInTheDocument();
  });

  it('uses the other-month copy when the stored month differs from today', async () => {
    const { user } = renderWithBudget(<ResetMonth />, { state: SCENARIO, today: '2026-12-02' });
    await user.click(await ready());
    expect(
      await screen.findByText(
        "This deletes your income, your categories and 3 expenses for November 2026, and starts a new budget for December 2026. You can't undo this.",
      ),
    ).toBeInTheDocument();
  });

  it('uses the other-month copy across years and when the clock is earlier', async () => {
    const a = renderWithBudget(<ResetMonth />, { state: SCENARIO, today: '2027-01-03' });
    await a.user.click(await ready());
    expect(await screen.findByText(/for November 2026, and starts a new budget for January 2027\. You can't undo this\.$/)).toBeInTheDocument();
    a.unmount();
    const b = renderWithBudget(<ResetMonth />, { state: SCENARIO, today: '2026-10-15' });
    await b.user.click(await ready());
    expect(await screen.findByText(/for November 2026, and starts a new budget for October 2026\. You can't undo this\.$/)).toBeInTheDocument();
  });

  it('the normal copy has no "starts a new budget" when months are equal', async () => {
    const { user } = renderWithBudget(<ResetMonth />, { state: SCENARIO, today: '2026-11-30' });
    await user.click(await ready());
    const dialog = await screen.findByRole('dialog');
    expect(dialog).not.toHaveTextContent('starts a new budget');
  });

  it('Enter right after opening activates Cancel, not reset', async () => {
    const { user, storage } = renderWithBudget(<ResetMonth />, { state: SCENARIO });
    const before = storage.dump()[STORAGE_KEY];
    await user.click(await ready());
    await screen.findByRole('dialog');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(storage.dump()[STORAGE_KEY]).toBe(before);
    expect(storage.setItemCalls).toBe(0);
  });

  it('the dialog Reset month is danger and the trigger is not', async () => {
    const { user } = renderWithBudget(<ResetMonth />, { state: SCENARIO });
    const trigger = await ready();
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Reset month' })).toHaveAttribute('data-variant', 'danger');
    expect(trigger).not.toHaveAttribute('data-variant', 'danger');
  });

  it('makes the trigger inert while open', async () => {
    const { user } = renderWithBudget(<ResetMonth />, { state: SCENARIO });
    const trigger = await ready();
    expect(trigger.closest('[inert]')).toBeNull();
    await user.click(trigger);
    await screen.findByRole('dialog');
    expect(trigger.closest('[inert]')).not.toBeNull();
  });
});

describe('dismissing changes nothing', () => {
  async function openFresh(): Promise<RenderWithBudgetResult & { trigger: HTMLElement; before: string | undefined }> {
    const r = renderWithBudget(<ResetMonth />, { state: SCENARIO });
    const trigger = await ready();
    const before = r.storage.dump()[STORAGE_KEY];
    await r.user.click(trigger);
    await screen.findByRole('dialog');
    return { ...r, trigger, before };
  }

  it('Cancel closes, returns focus to the trigger and leaves storage byte-identical', async () => {
    const { user, trigger, before, storage } = await openFresh();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(storage.dump()[STORAGE_KEY]).toBe(before);
    expect(storage.setItemCalls).toBe(0);
  });

  it('Esc closes, returns focus to the trigger and leaves storage byte-identical', async () => {
    const { user, trigger, before, storage } = await openFresh();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(storage.dump()[STORAGE_KEY]).toBe(before);
    expect(storage.setItemCalls).toBe(0);
  });

  it('the close button closes, returns focus to the trigger and leaves storage byte-identical', async () => {
    const { user, trigger, before, storage } = await openFresh();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(storage.dump()[STORAGE_KEY]).toBe(before);
    expect(storage.setItemCalls).toBe(0);
  });

  it('a backdrop click does not close the dialog', async () => {
    const { user } = await openFresh();
    const backdrop = document.querySelector('[data-part="backdrop"]');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop!);
    expect(screen.getByRole('dialog', { name: 'Reset month?' })).toBeInTheDocument();
  });

  it('never calls resetMonth or onConfirmed when dismissed (fake budget)', async () => {
    const { user, actions } = renderWithFakeBudget(<ResetMonth />, { state: SCENARIO });
    await user.click(screen.getByRole('button', { name: 'Reset month' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Reset month' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Reset month' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(actions.resetMonth).not.toHaveBeenCalled();
  });
});

describe('confirming', () => {
  it('clears everything to createInitialState for the month, closes, and focuses the trigger', async () => {
    const { user, readStored, storage } = renderWithBudget(<ResetMonth />, { state: SCENARIO, today: '2026-11-14' });
    const trigger = await ready();
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const stored = readStored();
    expect(stored).toEqual(createInitialState('2026-11'));
    expect(stored?.incomeCents).toBe(0);
    expect(stored?.expenses).toEqual([]);
    expect(stored?.categories).toHaveLength(5);
    expect(stored?.categories.every((c) => c.plannedCents === 0)).toBe(true);
    expect(storage.setItemCalls).toBe(1);
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('starts the current month when today is in another month', async () => {
    const { user, readStored } = renderWithBudget(<ResetMonth />, { state: SCENARIO, today: '2026-12-02' });
    await user.click(await ready());
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(readStored()).toEqual(createInitialState('2026-12'));
  });

  it('survives a refresh', async () => {
    const { user, refresh } = renderWithBudget(<ResetMonth />, { state: SCENARIO });
    await user.click(await ready());
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    refresh();
    const trigger = await ready();
    await user.click(trigger);
    expect(await screen.findByText(/and 0 expenses for November 2026\./)).toBeInTheDocument();
  });

  it('calls resetMonth once, then onConfirmed once', async () => {
    const onConfirmed = vi.fn();
    const onClose = vi.fn();
    const { user, actions } = renderWithFakeBudget(
      <ResetMonthDialog open onClose={onClose} onConfirmed={onConfirmed} />,
      { state: SCENARIO },
    );
    await user.click(await screen.findByRole('button', { name: 'Reset month' }));
    expect(actions.resetMonth).toHaveBeenCalledTimes(1);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(actions.resetMonth.mock.invocationCallOrder[0]!).toBeLessThan(onConfirmed.mock.invocationCallOrder[0]!);
  });

  it('Cancel on the controlled dialog calls onClose only', async () => {
    const onConfirmed = vi.fn();
    const onClose = vi.fn();
    const { user, actions } = renderWithFakeBudget(
      <ResetMonthDialog open onClose={onClose} onConfirmed={onConfirmed} />,
      { state: SCENARIO },
    );
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(actions.resetMonth).not.toHaveBeenCalled();
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it('renders nothing when open is false', () => {
    renderWithFakeBudget(<ResetMonthDialog open={false} onClose={vi.fn()} onConfirmed={vi.fn()} />, { state: SCENARIO });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('bumps generation so a key={generation} child remounts', async () => {
    const mounts = vi.fn();
    function Child(): null {
      useEffect(() => {
        mounts();
      }, []);
      return null;
    }
    function Keyed(): ReactElement | null {
      const b = useBudget();
      return b.status === 'ready' ? <Child key={b.generation} /> : null;
    }
    const { user } = renderWithBudget(
      <>
        <Keyed />
        <ResetMonth />
      </>,
      { state: SCENARIO },
    );
    await ready();
    await waitFor(() => expect(mounts).toHaveBeenCalledTimes(1));
    await user.click(await ready());
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset month' }));
    await waitFor(() => expect(mounts).toHaveBeenCalledTimes(2));
  });
});

describe('keyboard only', () => {
  it('Enter opens, Tab cycles Cancel, Reset month, close, Cancel, and Enter on Reset month resets', async () => {
    const { user, readStored } = renderWithBudget(<ResetMonth />, { state: SCENARIO });
    const trigger = await ready();
    trigger.focus();
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Reset month' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Reset month' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(readStored()).toEqual(createInitialState('2026-11'));
    expect(trigger).toHaveFocus();
  });
});

describe('action errors from the Card', () => {
  it('a plain Error shows the generic message after the explanation, keeps the dialog open and focus on Reset month', async () => {
    const onConfirmed = vi.fn();
    const { user, actions } = renderWithFakeBudget(<ResetMonth />, {
      state: SCENARIO,
      actions: {
        resetMonth: () => {
          throw new Error('boom');
        },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Reset month' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset month?' });
    const confirm = within(dialog).getByRole('button', { name: 'Reset month' });
    await user.click(confirm);
    expect(actions.resetMonth).toHaveBeenCalledTimes(1);
    expect(onConfirmed).not.toHaveBeenCalled();
    const alert = within(dialog).getByRole('alert');
    expect(alert).toHaveTextContent(GENERIC);
    expect(alert.textContent).toBe(GENERIC);
    expect(alert).toHaveAttribute('data-part', 'action-error');
    expect(alert.previousElementSibling).toHaveTextContent(TEXT_3);
    expect(screen.getByRole('dialog', { name: 'Reset month?' })).toBeInTheDocument();
    expect(confirm).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Reset month' })).toHaveFocus();
  });

  it('a total-too-large RangeError shows its own message', async () => {
    const { user } = renderWithFakeBudget(<ResetMonth />, {
      state: SCENARIO,
      actions: {
        resetMonth: () => {
          throw new RangeError(TOTAL_TOO_LARGE_MESSAGE);
        },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Reset month' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('That change would make a total too large.');
  });

  it('a RangeError with another message shows the generic message', async () => {
    const { user } = renderWithFakeBudget(<ResetMonth />, {
      state: SCENARIO,
      actions: {
        resetMonth: () => {
          throw new RangeError('something else');
        },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Reset month' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    expect(within(dialog).getByRole('alert').textContent).toBe(GENERIC);
  });

  it('onConfirmed is not called on error (controlled dialog) and only one alert exists', async () => {
    const onConfirmed = vi.fn();
    const { user, actions } = renderWithFakeBudget(
      <ResetMonthDialog open onClose={vi.fn()} onConfirmed={onConfirmed} />,
      {
        state: SCENARIO,
        actions: {
          resetMonth: () => {
            throw new Error('boom');
          },
        },
      },
    );
    await user.click(await screen.findByRole('button', { name: 'Reset month' }));
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(actions.resetMonth).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('has no alert before an error', async () => {
    const { user } = renderWithFakeBudget(<ResetMonth />, { state: SCENARIO });
    await user.click(screen.getByRole('button', { name: 'Reset month' }));
    await screen.findByRole('dialog');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('accessibility (colour contrast is disabled in jsdom; check it in a browser)', () => {
  it('the closed Card has no axe violations', async () => {
    renderWithBudget(<ResetMonth />, { state: SCENARIO });
    await ready();
    await expectNoAxeViolations();
  });

  it('the open dialog has no axe violations', async () => {
    const { user } = renderWithBudget(<ResetMonth />, { state: SCENARIO });
    await user.click(await ready());
    await screen.findByRole('dialog');
    await expectNoAxeViolations();
  });

  it('the error state has no axe violations', async () => {
    const { user } = renderWithFakeBudget(<ResetMonth />, {
      state: SCENARIO,
      actions: {
        resetMonth: () => {
          throw new Error('boom');
        },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Reset month' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    await screen.findByRole('alert');
    await expectNoAxeViolations();
  });

  it('adds no live regions while closed or open', async () => {
    const { user } = renderWithBudget(<ResetMonth />, { state: SCENARIO });
    await user.click(await ready());
    await screen.findByRole('dialog');
    expect(document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')).toHaveLength(0);
  });

  it('opening twice in a row via act does not leave two dialogs', async () => {
    const { user } = renderWithBudget(<ResetMonth />, { state: SCENARIO });
    const trigger = await ready();
    await user.click(trigger);
    await screen.findByRole('dialog');
    act(() => {
      fireEvent.click(trigger);
    });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});
