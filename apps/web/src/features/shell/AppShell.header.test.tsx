import { screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { BudgetBook } from '@/lib/months';
import { BudgetProvider } from '@/state/BudgetProvider';
import { BOOK, OCTOBER, SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import { setTestPathname } from '@/test/nextNavigation';
import { renderApp } from '@/test/renderApp';

import { AppShell } from './AppShell';

const SEPTEMBER = { ...OCTOBER, month: '2026-09', expenses: [] };
const THREE: BudgetBook = { months: [SEPTEMBER, OCTOBER, SCENARIO] };

function header(): HTMLElement {
  return document.querySelector('header') as HTMLElement;
}
const names = (els: Element[]): (string | null)[] => els.map((e) => e.textContent);

describe('compact header: DOM order and containment', () => {
  it.each(['/', '/spending', '/plan'])(
    '%s: the header has three rows: [name + Add expense], NavBar, switcher',
    (path) => {
      renderApp({ state: SCENARIO, path });
      const rows = Array.from(header().children);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveTextContent('Budget Kit');
      expect(
        within(rows[0] as HTMLElement).getByRole('button', {
          name: 'Add expense',
        }),
      ).toBeInTheDocument();
      expect(rows[1]?.tagName).toBe('NAV');
      expect(
        within(rows[2] as HTMLElement).getByRole('button', {
          name: 'Previous month',
        }),
      ).toBeInTheDocument();
      expect(
        within(rows[2] as HTMLElement).getByRole('button', {
          name: 'Next month',
        }),
      ).toBeInTheDocument();
    },
  );

  it('Add expense comes after the site name in row 1, before the NavBar, which is before the month switcher', () => {
    renderApp({ state: SCENARIO });
    const name = screen.getByText('Budget Kit');
    const add = screen.getByRole('button', { name: 'Add expense' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const prev = screen.getByRole('button', { name: 'Previous month' });
    const follows = (a: Node, b: Node): boolean =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(name.parentElement).toBe(add.parentElement);
    expect(follows(name, add)).toBe(true);
    expect(follows(add, nav)).toBe(true);
    expect(follows(nav, prev)).toBe(true);
    expect(nav.parentElement).toBe(header());
  });

  it('History: two rows only, no month switcher', () => {
    renderApp({ state: SCENARIO, path: '/history' });
    expect(header().children).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Previous month' })).not.toBeInTheDocument();
  });

  it('seeded BOOK: past-month note stays inside the switcher row, still three header children', () => {
    renderApp({ book: BOOK });
    expect(header().children).toHaveLength(3);
  });
});

describe('compact header: label in name', () => {
  it('visible text Previous / Next is contained in the accessible names Previous month / Next month', () => {
    renderApp({ state: SCENARIO });
    const previous = screen.getByRole('button', { name: 'Previous month' });
    const next = screen.getByRole('button', { name: 'Next month' });
    expect(previous.textContent).toBe('Previous');
    expect(next.textContent).toBe('Next');
    expect(previous.getAttribute('aria-label')).toMatch(new RegExp(`^${previous.textContent}`));
    expect(next.getAttribute('aria-label')).toMatch(new RegExp(`^${next.textContent}`));
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
  });

  it('exact accessible names are unchanged: "Previous month" and "Next month"', () => {
    renderApp({ state: SCENARIO });
    expect(screen.getByRole('button', { name: /^Previous month$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Next month$/ })).toBeInTheDocument();
  });
});

describe('compact header: Tab order', () => {
  it('from History link: Previous month, then Next month, then main content', async () => {
    const { user } = renderApp({ book: THREE });
    screen.getByRole('link', { name: 'History' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Previous month' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Next month' }));
    expect(document.activeElement?.closest('header')).toBeNull();
  });

  it('with both buttons enabled: History, Previous month, Next month (the month label is not a stop)', async () => {
    const { user } = renderApp({ book: THREE });
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    screen.getByRole('link', { name: 'History' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Previous month' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Next month' })).toHaveFocus();
  });

  it('full order: Add expense, four links, Previous month, Next month', async () => {
    const { user } = renderApp({ book: THREE });
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    (document.activeElement as HTMLElement).blur();
    const seen: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      await user.tab();
      const el = document.activeElement as HTMLElement;
      seen.push(el.getAttribute('aria-label') ?? el.textContent ?? '');
    }
    expect(seen).toEqual(['Add expense', 'Overview', 'Spending', 'Plan', 'History', 'Previous month', 'Next month']);
  });

  it('loading (server render): no Add expense and no switcher, name row and NavBar render', () => {
    setTestPathname('/');
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <BudgetProvider storage={createMemoryStorage()} getToday={() => '2026-11-14'}>
        <AppShell>
          <p>child</p>
        </AppShell>
      </BudgetProvider>,
    );
    const head = container.querySelector('header') as HTMLElement;
    const rows = Array.from(head.children);
    expect(names([rows[0] as Element])).toEqual(['Budget Kit']);
    expect(rows[1]?.tagName).toBe('NAV');
    expect(rows).toHaveLength(2);
    expect(container.textContent).not.toContain('Add expense');
    expect(container.querySelector('button')).toBeNull();
  });
});

describe('compact header: switcher behaviour unchanged', () => {
  it('current month: Previous enabled, Next natively disabled; first run both disabled', () => {
    const { unmount } = renderApp({ book: BOOK });
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next month' })).toHaveAttribute('disabled');
    unmount();
    renderApp({});
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
  });

  it('month label stays aria-live polite and shows the viewed month', () => {
    renderApp({ book: BOOK });
    const label = screen.getByText('November 2026');
    expect(label).toHaveAttribute('aria-live', 'polite');
  });

  it('pressing Previous to the oldest month moves focus to Next month; pressing Next back to the newest moves it to Previous month', async () => {
    const { user } = renderApp({ book: BOOK });
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('October 2026')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('button', { name: 'Next month' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('button', { name: 'Previous month' })).toHaveFocus();
  });

  it('keyboard: Enter on Previous month switches the month and shows the past-month note', async () => {
    const { user } = renderApp({ book: BOOK });
    screen.getByRole('button', { name: 'Previous month' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByText("You're looking at a past month. Changes are saved to October 2026.")).toBeInTheDocument();
  });
});
