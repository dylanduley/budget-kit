import { act, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { recordFocus, statusRegions, statusText } from '@/test/announcements';
import { expectNoAxeViolations } from '@/test/axe';
import { BOOK, SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import { renderApp } from '@/test/renderApp';
import { STORAGE_KEY } from '@/state/storage';

const INVALID =
  "Your saved budget couldn't be read, so a new one was started. Your first change will replace the saved data.";
const REPLACED = "Your saved budget couldn't be read and has been replaced.";
const UNAVAILABLE =
  "This browser isn't letting the app save, so your changes will be lost when you close the page.";
const WELCOME = 'Welcome. Start on the Plan page: enter your monthly income and add the categories you spend on.';

const PATHS = ['/', '/spending', '/plan', '/history'] as const;
const invalidStorage = () => createMemoryStorage({ [STORAGE_KEY]: 'not json' });
const shellRegion = (): HTMLElement =>
  screen.getByRole('main').querySelector<HTMLElement>('[data-part="status-message"]:not([data-visually-hidden])') as HTMLElement;
const addExpenseButton = (): HTMLElement => screen.getByRole('button', { name: 'Add expense' });
const headerRegion = (): HTMLElement => addExpenseButton().nextElementSibling as HTMLElement;

async function addExpenseViaHeader(user: UserEvent, amount: string, category: string): Promise<void> {
  await user.click(addExpenseButton());
  const dlg = screen.getByRole('dialog', { name: 'Add expense' });
  await user.type(within(dlg).getByRole('textbox', { name: 'Amount (USD)' }), amount);
  await user.selectOptions(within(dlg).getByRole('combobox', { name: 'Category' }), category);
  await user.click(within(dlg).getByRole('button', { name: 'Save expense' }));
}

describe('live regions on every page', () => {
  const counts = { '/': 1, '/spending': 2, '/plan': 2, '/history': 1 } as const;
  for (const [label, options] of [
    ['SCENARIO', () => ({ state: SCENARIO })],
    ['invalid storage', () => ({ storage: invalidStorage() })],
  ] as const) {
    for (const path of PATHS) {
      it(`${label} at ${path}: exactly ${counts[path]} status regions, hidden and empty (the invalid message is the visible one)`, () => {
        renderApp({ ...options(), path });
        const regions = statusRegions();
        expect(regions).toHaveLength(counts[path]);
        const visible = regions.filter((r) => !r.hasAttribute('data-visually-hidden'));
        if (label === 'SCENARIO') {
          expect(visible).toHaveLength(0);
        } else {
          expect(visible).toHaveLength(1);
          expect(visible[0]!.textContent).toBe(INVALID);
          expect(visible[0]!.closest('main')).not.toBeNull();
        }
        for (const r of regions.filter((x) => x.hasAttribute('data-visually-hidden'))) {
          expect(r).toHaveAttribute('data-visually-hidden', 'true');
          expect(r.textContent).toBe('');
        }
        const live = document.querySelectorAll(
          '[role="status"]:not([data-part="status-message"]), [aria-live]:not([data-part="status-message"])',
        );
        expect(live).toHaveLength(path === '/history' ? 0 : 1);
        expect(regions.every((r) => r.closest('[role="dialog"], [data-bk-dialog-root]') === null)).toBe(true);
      });
    }
  }
});

describe('expense added from the header', () => {
  it('on a past month (October via Previous month): Oct 1 default date and negative left to spend', async () => {
    const { user } = renderApp({ book: BOOK, path: '/' });
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await screen.findByText('October 2026');
    await addExpenseViaHeader(user, '10', 'Rent');
    await waitFor(() =>
      expect(headerRegion().textContent).toBe(
        'Expense added: $10.00 for Rent on Oct 1, 2026. Left to spend: -$504.82.',
      ),
    );
  });

  it('works from every page and the header region is outside inert while the dialog is open', async () => {
    const view = renderApp({ state: SCENARIO, path: '/history' });
    for (const path of ['/history', '/plan', '/spending', '/'] as const) {
      view.goTo(path);
      const el = headerRegion();
      expect(el.textContent === '' || el.textContent?.startsWith('Expense added')).toBe(true);
      await view.user.click(addExpenseButton());
      expect(el.closest('[inert]')).not.toBeNull();
      await view.user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    }
  });

  it('axe passes after an expense is added', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/spending' });
    await addExpenseViaHeader(user, '20', 'Groceries');
    await waitFor(() => expect(headerRegion().textContent).toContain('Expense added'));
    await expectNoAxeViolations();
  });

  it('axe passes after an expense is deleted', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/spending' });
    await user.click(screen.getByRole('button', { name: 'Delete $82.47 Groceries expense from Nov 3, 2026' }));
    await waitFor(() => expect(statusRegions().some((r) => r.textContent?.startsWith('Expense deleted'))).toBe(true));
    await expectNoAxeViolations();
  });

  it('axe passes after a category is added and removed', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/plan' });
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    const dlg = screen.getByRole('dialog', { name: 'Add category' });
    await user.type(within(dlg).getByRole('textbox', { name: 'Name' }), 'Pets');
    await user.click(within(dlg).getByRole('button', { name: 'Save category' }));
    await waitFor(() => expect(statusRegions().some((r) => r.textContent === 'Category added: Pets.')).toBe(true));
    await expectNoAxeViolations();
    await user.click(screen.getByRole('button', { name: 'Remove Pets' }));
    await waitFor(() => expect(statusRegions().some((r) => r.textContent === 'Category removed: Pets.')).toBe(true));
    await expectNoAxeViolations();
  });
});

describe('saved data replaced', () => {
  it('axe passes in both invalid-data states', async () => {
    const { user } = renderApp({ storage: invalidStorage(), path: '/plan' });
    await expectNoAxeViolations();
    await user.type(screen.getByRole('textbox', { name: 'Monthly income (USD)' }), '3200');
    await waitFor(() => expect(shellRegion().textContent).toBe(REPLACED));
    await expectNoAxeViolations();
  });

  it('typing income swaps the text in the same element; after refresh() neither message shows', async () => {
    const view = renderApp({ storage: invalidStorage(), path: '/plan' });
    const el = shellRegion();
    expect(el).toHaveAttribute('role', 'status');
    expect(el.textContent).toBe(INVALID);
    await view.user.type(screen.getByRole('textbox', { name: 'Monthly income (USD)' }), '3200');
    await waitFor(() => expect(el.textContent).toBe(REPLACED));
    expect(shellRegion()).toBe(el);
    view.refresh();
    expect(screen.queryByText(INVALID)).not.toBeInTheDocument();
    expect(screen.queryByText(REPLACED)).not.toBeInTheDocument();
  });

  it('first change through the Add category dialog: INVALID text while focus returns, no inert, then REPLACED', async () => {
    const { user } = renderApp({ storage: invalidStorage(), path: '/plan' });
    const el = shellRegion();
    const { snapshots, stop } = recordFocus(el);
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    const dlg = screen.getByRole('dialog', { name: 'Add category' });
    await user.type(within(dlg).getByRole('textbox', { name: 'Name' }), 'Pets');
    await user.type(within(dlg).getByRole('textbox', { name: 'Planned (USD)' }), '25');
    await user.click(within(dlg).getByRole('button', { name: 'Save category' }));
    await waitFor(() => expect(el.textContent).toBe(REPLACED));
    stop();
    const back = snapshots.filter((s) => s.target === screen.getByRole('button', { name: 'Add category' }));
    expect(back.length).toBeGreaterThan(0);
    const last = back[back.length - 1]!;
    expect(last.text).toBe(INVALID);
    expect(last.inertPresent).toBe(false);
    expect(el.closest('[inert]')).toBeNull();
  });

  it('Delete all data from invalid storage: replaced text, focus on the confirmation, no region says All data deleted', async () => {
    const { user } = renderApp({ storage: invalidStorage(), path: '/history' });
    await user.click(screen.getByRole('button', { name: 'Delete all data' }));
    const dlg = screen.getByRole('dialog');
    await user.click(within(dlg).getByRole('button', { name: 'Delete all data' }));
    await waitFor(() => expect(shellRegion().textContent).toBe(REPLACED));
    const confirmation = screen.getByText("All data deleted. You're starting fresh with November 2026.");
    expect(confirmation).toHaveFocus();
    for (const r of statusRegions()) expect(r.textContent).not.toContain('All data deleted');
    expect(confirmation.closest('[data-part="status-message"]')).toBeNull();
  });
});

describe('nothing else is announced', () => {
  it('income, planned, rename, month change and navigation leave every region empty', async () => {
    const view = renderApp({ book: BOOK, path: '/plan' });
    const { user } = view;
    await user.type(screen.getByRole('textbox', { name: 'Monthly income (USD)' }), '5');
    await user.type(screen.getByRole('textbox', { name: 'Category 1 planned (USD)' }), '1');
    const name = screen.getByRole('textbox', { name: 'Category 2 name' });
    await user.clear(name);
    await user.type(name, 'Food');
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await screen.findByText('October 2026');
    view.goTo('/');
    view.goTo('/plan');
    for (const r of statusRegions()) expect(r.textContent).toBe('');
  });

  it('Delete all data from valid data announces nothing through any region', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/history' });
    await user.click(screen.getByRole('button', { name: 'Delete all data' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete all data' }));
    await screen.findByText("You're starting fresh with November 2026.", { exact: false });
    for (const r of statusRegions()) expect(r.textContent).toBe('');
  });

  it('unavailable-storage message and first-run line are plain paragraphs', () => {
    renderApp({ storage: createMemoryStorage({}, { throwOnGet: true, throwOnSet: true }), path: '/' });
    for (const text of [UNAVAILABLE, WELCOME]) {
      const el = screen.getByText(text);
      expect(el.tagName).toBe('P');
      expect(el).not.toHaveAttribute('role');
      expect(el).not.toHaveAttribute('aria-live');
      expect(el.closest('[data-part="status-message"]')).toBeNull();
    }
  });

  it('a status-text node is stable across unrelated re-renders (no re-announcement)', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/plan' });
    await user.click(screen.getByRole('button', { name: 'Remove Groceries' }));
    const el = statusRegions().find((r) => r.textContent === 'Category removed: Groceries.') as HTMLElement;
    expect(el).toBeDefined();
    const node = statusText(el);
    await user.type(screen.getByRole('textbox', { name: 'Monthly income (USD)' }), '1');
    expect(statusText(el)).toBe(node);
    await act(async () => undefined);
    expect(el.textContent).toBe('Category removed: Groceries.');
  });
});
