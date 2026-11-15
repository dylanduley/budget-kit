import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BudgetApp } from '@/features/BudgetApp';
import { createInitialState } from '@/lib/budget';
import { TOTAL_TOO_LARGE_MESSAGE } from '@/state/BudgetProvider';
import { STORAGE_KEY } from '@/state/storage';
import { expectNoAxeViolations } from '@/test/axe';
import { SCENARIO } from '@/test/fixtures';
import { renderWithBudget } from '@/test/renderWithBudget';
import { renderWithFakeBudget } from '@/test/renderWithFakeBudget';
import { MonthNotice } from './MonthNotice';
import { ResetMonth } from './ResetMonth';

const GENERIC = 'Something went wrong. Your budget was not changed.';
const START = 'Start December 2026 budget';
const DONE = 'New budget started for December 2026.';

async function openNotice(user: { click: (el: Element) => Promise<void> }): Promise<HTMLElement> {
  const button = await screen.findByRole('button', { name: START });
  await user.click(button);
  return screen.findByRole('dialog', { name: 'Reset month?' });
}

describe('notice visibility', () => {
  it('same month: nothing is rendered', async () => {
    const { container, storage } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-11-14' });
    await Promise.resolve();
    expect(screen.queryByRole('heading', { name: 'New month' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
    expect(storage.setItemCalls).toBe(0);
  });

  it('same month, last day of the month: still nothing', () => {
    const { container } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-11-30' });
    expect(container).toBeEmptyDOMElement();
  });

  it('later month: heading, both sentences and the button; nothing changed on load', async () => {
    const { storage } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
    const before = JSON.stringify(storage.dump());
    expect(await screen.findByRole('heading', { level: 2, name: 'New month' })).toBeInTheDocument();
    expect(screen.getByText('This budget is for November 2026. It is now December 2026.')).toBeInTheDocument();
    expect(screen.getByText('Your figures are kept until you start a new budget.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: START })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'New month' })).toBeInTheDocument();
    expect(JSON.stringify(storage.dump())).toBe(before);
    expect(storage.setItemCalls).toBe(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a different year', async () => {
    renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2027-01-03' });
    expect(await screen.findByText('This budget is for November 2026. It is now January 2027.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start January 2027 budget' })).toBeInTheDocument();
  });

  it('the clock moved back to an earlier month still shows the notice', async () => {
    renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-10-15' });
    expect(await screen.findByText('This budget is for November 2026. It is now October 2026.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start October 2026 budget' })).toBeInTheDocument();
  });

  it('a first-run budget (current month) shows no notice', () => {
    const { container } = renderWithBudget(<MonthNotice />, { today: '2026-12-02' });
    expect(container).toBeEmptyDOMElement();
  });
});

describe('the notice dialog', () => {
  it('opens the shared dialog with the other-month text, focused on Cancel', async () => {
    const { user } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
    const dialog = await openNotice(user);
    expect(
      within(dialog).getByText(
        "This deletes your income, your categories and 3 expenses for November 2026, and starts a new budget for December 2026. You can't undo this.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Reset month' })).toHaveAttribute('data-variant', 'danger');
  });

  it.each([
    ['Cancel', async (u: ReturnType<typeof renderWithBudget>['user']) => u.click(screen.getByRole('button', { name: 'Cancel' }))],
    ['Esc', async (u: ReturnType<typeof renderWithBudget>['user']) => u.keyboard('{Escape}')],
    ['the close button', async (u: ReturnType<typeof renderWithBudget>['user']) => u.click(screen.getByRole('button', { name: 'Close' }))],
  ])('%s closes, returns focus to the notice button and changes nothing', async (_name, dismiss) => {
    const { user, storage } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
    const before = storage.dump()[STORAGE_KEY];
    const button = await screen.findByRole('button', { name: START });
    await openNotice(user);
    await dismiss(user);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
    expect(storage.dump()[STORAGE_KEY]).toBe(before);
    expect(storage.setItemCalls).toBe(0);
    expect(screen.getByRole('heading', { name: 'New month' })).toBeInTheDocument();
    expect(screen.queryByText(DONE)).not.toBeInTheDocument();
  });

  it('a backdrop click does not close it', async () => {
    const { user } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
    await openNotice(user);
    await user.click(document.querySelector('[data-part="backdrop"]')!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Enter right after opening activates Cancel, not reset', async () => {
    const { user, storage } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
    await openNotice(user);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(storage.setItemCalls).toBe(0);
    expect(screen.getByRole('button', { name: START })).toBeInTheDocument();
  });
});

describe('confirming from the notice', () => {
  it('stores the new month, removes the button and notice, shows and focuses the confirmation', async () => {
    const { user, readStored } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
    const dialog = await openNotice(user);
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    const done = await screen.findByText(DONE);
    expect(readStored()).toEqual(createInitialState('2026-12'));
    expect(screen.queryByRole('button', { name: START })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'New month' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(done.tagName).toBe('P');
    expect(done).toHaveAttribute('tabindex', '-1');
    await waitFor(() => expect(done).toHaveFocus());
    expect(document.activeElement).not.toBe(document.body);
  });

  it('never focuses the confirmation while it is under an inert ancestor', async () => {
    const focused: { text: string | null; inert: boolean }[] = [];
    const original = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
      if (this.tagName === 'P') focused.push({ text: this.textContent, inert: this.closest('[inert]') !== null });
      original.call(this, options);
    });
    const { user } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
    const dialog = await openNotice(user);
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    const done = await screen.findByText(DONE);
    await waitFor(() => expect(done).toHaveFocus());
    expect(focused.length).toBeGreaterThan(0);
    expect(focused.every((f) => !f.inert)).toBe(true);
  });

  it('the confirmation stays after the dialog is gone, and the page is no longer inert', async () => {
    const { user } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
    const dialog = await openNotice(user);
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    const done = await screen.findByText(DONE);
    await waitFor(() => expect(done).toHaveFocus());
    expect(done.closest('[inert]')).toBeNull();
    expect(document.querySelector('[data-bk-dialog-root]')).toBeNull();
    expect(screen.getByText(DONE)).toBeInTheDocument();
  });

  it('survives a refresh as a reset budget with no notice', async () => {
    const { user, refresh } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
    await user.click(within(await openNotice(user)).getByRole('button', { name: 'Reset month' }));
    await screen.findByText(DONE);
    const { container } = refresh();
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it('works for the clock moved back', async () => {
    const { user, readStored } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-10-15' });
    await user.click(await screen.findByRole('button', { name: 'Start October 2026 budget' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset month' }));
    expect(await screen.findByText('New budget started for October 2026.')).toBeInTheDocument();
    expect(readStored()).toEqual(createInitialState('2026-10'));
  });

  it('a second reset from the Card keeps the confirmation and returns focus to the Card trigger', async () => {
    const { user, readStored, storage } = renderWithBudget(
      <>
        <MonthNotice />
        <ResetMonth />
      </>,
      { state: SCENARIO, today: '2026-12-02' },
    );
    await user.click(within(await openNotice(user)).getByRole('button', { name: 'Reset month' }));
    const done = await screen.findByText(DONE);
    await waitFor(() => expect(done).toHaveFocus());
    const trigger = screen.getByRole('button', { name: 'Reset month' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('0 expenses for December 2026. You can');
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(storage.setItemCalls).toBe(2);
    expect(readStored()).toEqual(createInitialState('2026-12'));
    expect(screen.getByText(DONE)).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe('confirmation focus without timers', () => {
  it('the paragraph is the active element synchronously after the confirming click, with no timers pending', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { user } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
      const dialog = await openNotice(user);
      await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
      const done = screen.getByText(DONE);
      expect(done).toHaveFocus();
      expect(document.activeElement).toBe(done);
      vi.useRealTimers();
    } finally {
      vi.useRealTimers();
    }
  });

  it('is focused with fake timers never advanced (so no timer can have done it)', () => {
    vi.useFakeTimers();
    try {
      renderWithFakeBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
      fireEvent.click(screen.getByRole('button', { name: START }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset month' }));
      expect(screen.getByText(DONE)).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it('in StrictMode the paragraph is focused and no inert is left on any body child', async () => {
    const { user } = renderWithBudget(
      <StrictMode>
        <MonthNotice />
      </StrictMode>,
      { state: SCENARIO, today: '2026-12-02' },
    );
    const dialog = await openNotice(user);
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    expect(screen.getByText(DONE)).toHaveFocus();
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    for (const child of Array.from(document.body.children)) expect(child).not.toHaveAttribute('inert');
  });

  it('MonthNotice.tsx contains no setTimeout and no MAX_FOCUS_ATTEMPTS', () => {
    const source = readFileSync(join(import.meta.dirname, 'MonthNotice.tsx'), 'utf8');
    expect(source).not.toMatch(/setTimeout|MAX_FOCUS_ATTEMPTS|requestAnimationFrame|queueMicrotask/);
  });
});

describe('the dialog is mounted only while open', () => {
  const dialogRoots = (): number => document.querySelectorAll('[data-bk-dialog-root]').length;

  it('no dialog or dialog root before opening, after Cancel, and after confirming', async () => {
    const { user } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
    await screen.findByRole('button', { name: START });
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(dialogRoots()).toBe(0);
    await openNotice(user);
    expect(dialogRoots()).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(dialogRoots()).toBe(0);
    await user.click(within(await openNotice(user)).getByRole('button', { name: 'Reset month' }));
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(dialogRoots()).toBe(0);
  });

  it('reopening after a failed reset shows no stale error', async () => {
    const { user } = renderWithFakeBudget(<MonthNotice />, {
      state: SCENARIO,
      today: '2026-12-02',
      actions: {
        resetMonth: () => {
          throw new Error('boom');
        },
      },
    });
    const dialog = await openNotice(user);
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    await screen.findByRole('alert');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await openNotice(user);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('the Card reopening after a failed reset shows no stale error', async () => {
    const { user } = renderWithFakeBudget(<ResetMonth />, {
      state: SCENARIO,
      actions: {
        resetMonth: () => {
          throw new Error('boom');
        },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Reset month' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset month' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Reset month' }));
    await screen.findByRole('dialog');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Cancel is described by the consequence', () => {
  function expectDescribed(dialog: HTMLElement, sentence: string): void {
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    const id = cancel.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    const target = document.getElementById(id!);
    expect(target).not.toBeNull();
    expect(target!.tagName).toBe('P');
    expect(target!.textContent).toBe(sentence);
    expect(cancel).toHaveAccessibleDescription(sentence);
    expect(cancel).toHaveFocus();
    // The accessible name stays plain.
    expect(cancel).toHaveAccessibleName('Cancel');
  }

  it('from the notice (other-month copy, 3 expenses)', async () => {
    const { user } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
    expectDescribed(
      await openNotice(user),
      "This deletes your income, your categories and 3 expenses for November 2026, and starts a new budget for December 2026. You can't undo this.",
    );
  });

  it('from the Card (normal copy; 3, 1 and 0 expenses)', async () => {
    const cases: [typeof SCENARIO, string][] = [
      [SCENARIO, '3 expenses'],
      [{ ...SCENARIO, expenses: [SCENARIO.expenses[0]!] }, '1 expense'],
      [{ ...SCENARIO, expenses: [] }, '0 expenses'],
    ];
    for (const [state, count] of cases) {
      const { user, unmount } = renderWithBudget(<ResetMonth />, { state });
      await user.click(await screen.findByRole('button', { name: 'Reset month' }));
      expectDescribed(
        await screen.findByRole('dialog'),
        `This deletes your income, your categories and ${count} for November 2026. You can't undo this.`,
      );
      unmount();
    }
  });

  it('the description follows the explanation when an error alert is added', async () => {
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
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveAccessibleDescription(
      "This deletes your income, your categories and 3 expenses for November 2026. You can't undo this.",
    );
  });
});

describe('one dialog at a time', () => {
  it('opening the notice dialog makes the Card trigger inert', async () => {
    const { user } = renderWithBudget(
      <>
        <MonthNotice />
        <ResetMonth />
      </>,
      { state: SCENARIO, today: '2026-12-02' },
    );
    const noticeButton = await screen.findByRole('button', { name: START });
    const cardTrigger = screen.getByRole('button', { name: 'Reset month' });
    await user.click(noticeButton);
    await screen.findByRole('dialog');
    expect(cardTrigger.closest('[inert]')).not.toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(cardTrigger.closest('[inert]')).toBeNull();
  });

  it('opening the Card dialog makes the notice button inert', async () => {
    const { user } = renderWithBudget(
      <>
        <MonthNotice />
        <ResetMonth />
      </>,
      { state: SCENARIO, today: '2026-12-02' },
    );
    const noticeButton = await screen.findByRole('button', { name: START });
    await user.click(screen.getByRole('button', { name: 'Reset month' }));
    await screen.findByRole('dialog');
    expect(noticeButton.closest('[inert]')).not.toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Reset month' })).toHaveFocus();
  });
});

describe('action errors from the notice', () => {
  function throwing(error: Error): { resetMonth: () => void } {
    return {
      resetMonth: () => {
        throw error;
      },
    };
  }

  it('a plain Error: alert in the dialog, dialog open, button stays, no confirmation', async () => {
    const { user, actions } = renderWithFakeBudget(<MonthNotice />, {
      state: SCENARIO,
      today: '2026-12-02',
      actions: throwing(new Error('boom')),
    });
    const dialog = await openNotice(user);
    const confirm = within(dialog).getByRole('button', { name: 'Reset month' });
    await user.click(confirm);
    expect(actions.resetMonth).toHaveBeenCalledTimes(1);
    const alert = within(dialog).getByRole('alert');
    expect(alert.textContent).toBe(GENERIC);
    expect(alert).toHaveAttribute('data-part', 'action-error');
    expect(alert.previousElementSibling?.textContent).toMatch(/^This deletes your income/);
    expect(screen.getByRole('dialog', { name: 'Reset month?' })).toBeInTheDocument();
    expect(confirm).toHaveFocus();
    expect(screen.queryByText(DONE)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: START })).toHaveFocus();
    expect(screen.queryByText(DONE)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a total-too-large RangeError shows its own message', async () => {
    const { user } = renderWithFakeBudget(<MonthNotice />, {
      state: SCENARIO,
      today: '2026-12-02',
      actions: throwing(new RangeError(TOTAL_TOO_LARGE_MESSAGE)),
    });
    const dialog = await openNotice(user);
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    expect(within(dialog).getByRole('alert').textContent).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(screen.queryByText(DONE)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: START })).toBeInTheDocument();
  });

  it('a second attempt after an error that now succeeds clears the alert and confirms', async () => {
    let calls = 0;
    const { user, actions } = renderWithFakeBudget(<MonthNotice />, {
      state: SCENARIO,
      today: '2026-12-02',
      actions: {
        resetMonth: () => {
          calls += 1;
          if (calls === 1) throw new Error('boom');
        },
      },
    });
    const dialog = await openNotice(user);
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    await screen.findByRole('alert');
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    expect(actions.resetMonth).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(await screen.findByText(DONE)).toBeInTheDocument();
  });
});

describe('page order and headings in the full app', () => {
  it('the notice follows the heading block and the Reset month Card is last', async () => {
    const { container } = renderWithBudget(<BudgetApp />, { state: SCENARIO, today: '2026-12-02' });
    const notice = await screen.findByRole('region', { name: 'New month' });
    const main = screen.getByRole('main');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(notice.previousElementSibling).toBe(h1.parentElement);
    const resetHeading = screen.getByRole('heading', { level: 2, name: 'Reset month' });
    expect(main.lastElementChild).toContainElement(resetHeading);
    expect(notice.compareDocumentPosition(resetHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('heading levels are h1 then h2s only (no skipped level)', async () => {
    renderWithBudget(<BudgetApp />, { state: SCENARIO, today: '2026-12-02' });
    await screen.findByRole('region', { name: 'New month' });
    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    for (let i = 1; i < levels.length; i += 1) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
  });

  it('the full app adds no live regions when closed', async () => {
    renderWithBudget(<BudgetApp />, { state: SCENARIO, today: '2026-12-02' });
    await screen.findByRole('region', { name: 'New month' });
    expect(document.querySelectorAll('[role="alert"], [role="status"], [aria-live]')).toHaveLength(0);
  });

  it('no notice and the Card in the full app for the current month', async () => {
    renderWithBudget(<BudgetApp />, { state: SCENARIO, today: '2026-11-14' });
    await screen.findByRole('heading', { level: 2, name: 'Reset month' });
    expect(screen.queryByRole('heading', { name: 'New month' })).not.toBeInTheDocument();
  });

  it('a full-app reset from the notice ends with the confirmation focused and the Card present', async () => {
    const { user } = renderWithBudget(<BudgetApp />, { state: SCENARIO, today: '2026-12-02' });
    await user.click(await screen.findByRole('button', { name: START }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset month' }));
    const done = await screen.findByText(DONE);
    await waitFor(() => expect(done).toHaveFocus());
    expect(screen.getByRole('heading', { level: 2, name: 'Reset month' })).toBeInTheDocument();
  });
});

describe('accessibility (colour contrast is disabled in jsdom; check it in a browser)', () => {
  it('the notice has no axe violations', async () => {
    renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
    await screen.findByRole('button', { name: START });
    await expectNoAxeViolations();
  });

  it('the notice dialog has no axe violations', async () => {
    const { user } = renderWithBudget(<MonthNotice />, { state: SCENARIO, today: '2026-12-02' });
    await openNotice(user);
    await expectNoAxeViolations();
  });

  it('the notice dialog error state has no axe violations', async () => {
    const { user } = renderWithFakeBudget(<MonthNotice />, {
      state: SCENARIO,
      today: '2026-12-02',
      actions: {
        resetMonth: () => {
          throw new Error('boom');
        },
      },
    });
    const dialog = await openNotice(user);
    await user.click(within(dialog).getByRole('button', { name: 'Reset month' }));
    await screen.findByRole('alert');
    await expectNoAxeViolations();
  });

  it('the post-reset confirmation has no axe violations', async () => {
    const { user } = renderWithBudget(<BudgetApp />, { state: SCENARIO, today: '2026-12-02' });
    await user.click(await screen.findByRole('button', { name: START }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset month' }));
    await waitFor(() => expect(screen.getByText(DONE)).toHaveFocus());
    await expectNoAxeViolations();
  });

  it('the full app with the notice has no axe violations', async () => {
    renderWithBudget(<BudgetApp />, { state: SCENARIO, today: '2026-12-02' });
    await screen.findByRole('region', { name: 'New month' });
    await expectNoAxeViolations();
  });
});
