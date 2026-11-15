import { screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HistoryPage } from '@/features/history/HistoryPage';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { PlanPage } from '@/features/plan/PlanPage';
import { SpendingPage } from '@/features/spending/SpendingPage';
import { BudgetProvider } from '@/state/BudgetProvider';
import { STORAGE_KEY } from '@/state/storage';
import { expectNoAxeViolations } from '@/test/axe';
import { SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import { setTestPathname, testRouter } from '@/test/nextNavigation';
import { renderApp } from '@/test/renderApp';

import { AppShell } from './AppShell';
import { NAV_ITEMS } from './navItems';

afterEach(() => {
  document.body.innerHTML = '';
});

function pageFor(path: string): ReactElement {
  switch (path) {
    case '/spending':
      return <SpendingPage />;
    case '/plan':
      return <PlanPage />;
    case '/history':
      return <HistoryPage />;
    default:
      return <OverviewPage />;
  }
}

const PATHS = [
  ['/', 'Overview'],
  ['/spending', 'Spending'],
  ['/plan', 'Plan'],
  ['/history', 'History'],
] as const;
const PATH_LIST = PATHS.map(([path]) => path);

const INVALID_MESSAGE =
  "Your saved budget couldn't be read, so a new one was started. Your first change will replace the saved data.";
const REPLACED_MESSAGE = "Your saved budget couldn't be read and has been replaced.";
const UNAVAILABLE_MESSAGE =
  "This browser isn't letting the app save, so your changes will be lost when you close the page.";

// In a browser a <header> inside <section>/<article>/<main>/<nav>/<aside> is NOT a banner (HTML-AAM),
// so the Card headers do not add banners. Testing Library's role query ignores that rule, so find
// the page banner with the same rule a browser (and axe) applies.
function pageBanners(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('header')).filter(
    (el) => el.closest('article, aside, main, nav, section') === null,
  );
}
function banner(): HTMLElement {
  const found = pageBanners();
  expect(found).toHaveLength(1);
  return found[0] as HTMLElement;
}
const navLinks = (): HTMLElement[] => within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link');
const stat = (label: string): HTMLElement =>
  screen.getByText(label, { selector: '[data-part="label"]' }).parentElement as HTMLElement;

describe('shell structure on every route', () => {
  it.each(PATHS)('%s: one banner with the site name and the Main navigation, one main, one h1', (path, name) => {
    renderApp({ state: SCENARIO, path });
    const header = banner();
    expect(header).toHaveTextContent('Budget Kit');
    const nav = within(header).getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Overview',
      'Spending',
      'Plan',
      'History',
    ]);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([name]);
    // The page banner is not inside main, and main is not inside the banner.
    expect(within(screen.getByRole('main')).queryByRole('navigation')).not.toBeInTheDocument();
    expect(header.contains(screen.getByRole('main'))).toBe(false);
  });

  it('the site name is plain text, not a heading', () => {
    renderApp({ state: SCENARIO });
    expect(screen.queryByRole('heading', { name: 'Budget Kit' })).not.toBeInTheDocument();
  });

  it('link hrefs come from NAV_ITEMS: /, /spending, /plan, /history', () => {
    renderApp({ state: SCENARIO });
    expect(navLinks().map((l) => l.getAttribute('href'))).toEqual(['/', '/spending', '/plan', '/history']);
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(['/', '/spending', '/plan', '/history']);
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(['Overview', 'Spending', 'Plan', 'History']);
  });

  it.each(PATHS)('%s: exactly the link for that path has aria-current="page"', (path, name) => {
    renderApp({ state: SCENARIO, path });
    const current = navLinks().filter((l) => l.hasAttribute('aria-current'));
    expect(current.map((l) => l.textContent)).toEqual([name]);
    expect(current[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
  });

  it('an unknown path marks no link current', () => {
    renderApp({ state: SCENARIO, path: '/nowhere' });
    expect(navLinks().filter((l) => l.hasAttribute('aria-current'))).toEqual([]);
  });

  it('the Card headers inside main are not page banners', () => {
    renderApp({ state: SCENARIO, path: '/' });
    expect(pageBanners()).toHaveLength(1);
    expect(document.querySelectorAll('main header').length).toBeGreaterThan(0);
    for (const inner of document.querySelectorAll('main header')) expect(inner.closest('section')).not.toBeNull();
  });

  it('History shows its current placeholder line', () => {
    renderApp({ state: SCENARIO, path: '/history' });
    expect(screen.getByText('Your months will be listed here.')).toBeInTheDocument();
  });

  it('Plan shows the income field of the temporary setup form', () => {
    renderApp({ state: SCENARIO, path: '/plan' });
    expect(screen.getByRole('textbox', { name: 'Monthly income (USD)' })).toBeInTheDocument();
  });

  it('Tab order is the four links, then Add expense', async () => {
    const { user } = renderApp({ state: SCENARIO });
    await user.tab();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Spending' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Plan' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'History' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveFocus();
  });
});

describe('navigation inside one provider', () => {
  it('clicking Plan from / shows h1 Plan and marks Plan current, reading the clock once in total', async () => {
    const getToday = vi.fn(() => '2026-11-14');
    const { user } = renderApp({ state: SCENARIO, path: '/', getToday });
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Plan' }));
    expect(testRouter.push).toHaveBeenCalledWith('/plan');
    expect(screen.getByRole('heading', { level: 1, name: 'Plan' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    await user.click(screen.getByRole('link', { name: 'History' }));
    await user.click(screen.getByRole('link', { name: 'Spending' }));
    expect(getToday).toHaveBeenCalledTimes(1);
  });

  it('navigating by keyboard (Enter on a focused link) works too', async () => {
    const { user } = renderApp({ state: SCENARIO });
    screen.getByRole('link', { name: 'Spending' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { level: 1, name: 'Spending' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Spending' })).toHaveAttribute('aria-current', 'page');
  });

  it('an unsaved change survives navigation: income typed on /plan shows on Overview', async () => {
    const storage = createMemoryStorage({}, { throwOnSet: true });
    const { user } = renderApp({ storage, path: '/plan' });
    await user.type(screen.getByRole('textbox', { name: 'Monthly income (USD)' }), '3200');
    await user.click(screen.getByRole('link', { name: 'Overview' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(stat('Income')).toHaveTextContent('$3,200.00');
    expect(storage.dump()).toEqual({});
  });

  it('every page change is a router push, never a reload (the links are the only way)', async () => {
    const { user } = renderApp({ state: SCENARIO });
    for (const name of ['Spending', 'Plan', 'History', 'Overview']) {
      await user.click(screen.getByRole('link', { name }));
    }
    expect(testRouter.push.mock.calls.map((c) => c[0])).toEqual(['/spending', '/plan', '/history', '/']);
  });

  it('a full page load (refresh) keeps the path and reloads the saved data', async () => {
    const { user, refresh } = renderApp({ state: SCENARIO, path: '/' });
    await user.click(screen.getByRole('link', { name: 'Plan' }));
    refresh();
    expect(await screen.findByRole('heading', { level: 1, name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('Add expense in the header', () => {
  it.each(PATHS)('%s: Add expense is in the banner', (path) => {
    renderApp({ state: SCENARIO, path });
    expect(within(banner()).getByRole('button', { name: 'Add expense' })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByRole('button', { name: 'Add expense' })).not.toBeInTheDocument();
  });

  it('adding 20 / Groceries from /history, then clicking Overview, shows Spent $1,714.82', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/history' });
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = screen.getByRole('dialog', { name: 'Add expense' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Amount (USD)' }), '20');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Category' }), 'Groceries');
    await user.click(within(dialog).getByRole('button', { name: 'Save expense' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add expense' })).toHaveFocus();
    await user.click(screen.getByRole('link', { name: 'Overview' }));
    expect(stat('Spent')).toHaveTextContent('$1,714.82');
  });

  it('Cancel and Escape close without saving and return focus to the trigger', async () => {
    const { user, storage } = renderApp({ state: SCENARIO, path: '/plan' });
    const before = storage.dump();
    const trigger = screen.getByRole('button', { name: 'Add expense' });
    await user.click(trigger);
    await user.type(screen.getByRole('textbox', { name: 'Amount (USD)' }), '5');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(storage.dump()).toEqual(before);
  });

  it.each(PATH_LIST)('%s: with empty storage (no categories) there is no Add expense button', (path) => {
    renderApp({ path });
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy');
    expect(screen.queryByRole('button', { name: 'Add expense' })).not.toBeInTheDocument();
  });

  it('Add expense appears once a category exists, without a reload', async () => {
    const { user } = renderApp({ path: '/plan' });
    expect(screen.queryByRole('button', { name: 'Add expense' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Fun');
    await user.type(screen.getByRole('textbox', { name: 'Planned (USD)' }), '10');
    await user.click(screen.getByRole('button', { name: 'Save category' }));
    expect(await screen.findByRole('button', { name: 'Add expense' })).toBeInTheDocument();
  });
});

describe('saved-data messages', () => {
  it.each(PATH_LIST)('%s: invalid data shows the invalid message inside main', (path) => {
    renderApp({ storage: createMemoryStorage({ [STORAGE_KEY]: 'not json' }), path });
    expect(within(screen.getByRole('main')).getByText(INVALID_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(REPLACED_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByText(UNAVAILABLE_MESSAGE)).not.toBeInTheDocument();
  });

  it.each(PATH_LIST)('%s: unavailable storage shows the unavailable message inside main', (path) => {
    renderApp({ storage: createMemoryStorage({}, { throwOnGet: true }), path });
    expect(within(screen.getByRole('main')).getByText(UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(INVALID_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByText(REPLACED_MESSAGE)).not.toBeInTheDocument();
  });

  it.each(PATH_LIST)('%s: valid data and empty storage show no saved-data message', (path) => {
    const { unmount } = renderApp({ state: SCENARIO, path });
    for (const text of [INVALID_MESSAGE, REPLACED_MESSAGE, UNAVAILABLE_MESSAGE]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
    unmount();
    renderApp({ path });
    for (const text of [INVALID_MESSAGE, REPLACED_MESSAGE, UNAVAILABLE_MESSAGE]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
  });

  it('the invalid message becomes the replaced message after the first change, and the raw data is kept until then', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: 'not json' });
    const { user } = renderApp({ storage, path: '/plan' });
    expect(screen.getByText(INVALID_MESSAGE)).toBeInTheDocument();
    expect(storage.dump()[STORAGE_KEY]).toBe('not json');
    expect(storage.setItemCalls).toBe(0);
    await user.type(screen.getByRole('textbox', { name: 'Monthly income (USD)' }), '1');
    expect(screen.getByText(REPLACED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(INVALID_MESSAGE)).not.toBeInTheDocument();
    expect(storage.dump()[STORAGE_KEY]).not.toBe('not json');
  });

  it('the messages follow navigation (still shown on another page)', async () => {
    const { user } = renderApp({ storage: createMemoryStorage({}, { throwOnGet: true }), path: '/' });
    await user.click(screen.getByRole('link', { name: 'History' }));
    expect(within(screen.getByRole('main')).getByText(UNAVAILABLE_MESSAGE)).toBeInTheDocument();
  });

  it('unavailable storage still works in memory (changes show, nothing throws)', async () => {
    const { user } = renderApp({ storage: createMemoryStorage({}, { throwOnGet: true }), path: '/plan' });
    await user.type(screen.getByRole('textbox', { name: 'Monthly income (USD)' }), '10');
    await user.click(screen.getByRole('link', { name: 'Overview' }));
    expect(stat('Income')).toHaveTextContent('$10.00');
    expect(screen.getByText(UNAVAILABLE_MESSAGE)).toBeInTheDocument();
  });
});

describe('loading shell', () => {
  function loadingShell(path: string, storage = createMemoryStorage()): HTMLElement {
    setTestPathname(path);
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <BudgetProvider storage={storage} getToday={() => '2026-11-14'}>
        <AppShell>
          <p>child</p>
        </AppShell>
      </BudgetProvider>,
    );
    return container;
  }

  it.each(PATH_LIST)('%s: a busy main, the banner has the nav and no Add expense', (path) => {
    const container = loadingShell(path, createMemoryStorage({ [STORAGE_KEY]: 'not json' }));
    expect(container.querySelector('main')?.getAttribute('aria-busy')).toBe('true');
    const header = container.querySelector('header');
    expect(header?.textContent).toContain('Budget Kit');
    expect(Array.from(header?.querySelectorAll('nav a') ?? []).map((a) => a.textContent)).toEqual([
      'Overview',
      'Spending',
      'Plan',
      'History',
    ]);
    expect(container.textContent).not.toContain('Add expense');
    expect(container.textContent).not.toContain(INVALID_MESSAGE);
    expect(container.textContent).not.toContain(UNAVAILABLE_MESSAGE);
  });

  it.each(PATHS)('%s: the current nav item comes from the pathname even while loading', (path, name) => {
    const container = loadingShell(path);
    const current = Array.from(container.querySelectorAll('a[aria-current]'));
    expect(current.map((a) => a.textContent)).toEqual([name]);
  });

  it('ready: main has no aria-busy', async () => {
    renderApp({ state: SCENARIO });
    await waitFor(() => expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy'));
  });
});

describe('accessibility (axe)', () => {
  it.each(PATH_LIST)('%s: no violations, loading', async (path) => {
    setTestPathname(path);
    const html = renderToString(
      <BudgetProvider storage={createMemoryStorage()} getToday={() => '2026-11-14'}>
        <AppShell>{pageFor(path)}</AppShell>
      </BudgetProvider>,
    );
    document.body.innerHTML = html;
    expect(document.body).toHaveTextContent('Loading your budget…');
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    await expectNoAxeViolations();
  });

  it.each(PATH_LIST)('%s: no violations, populated (over budget)', async (path) => {
    renderApp({ state: SCENARIO, path });
    await expectNoAxeViolations();
  });

  it.each(PATH_LIST)('%s: no violations, first run (empty storage)', async (path) => {
    renderApp({ path });
    await expectNoAxeViolations();
  });

  it.each(PATH_LIST)('%s: no violations, invalid saved data', async (path) => {
    renderApp({ storage: createMemoryStorage({ [STORAGE_KEY]: 'not json' }), path });
    await expectNoAxeViolations();
  });

  it.each(PATH_LIST)('%s: no violations, invalid then replaced', async (path) => {
    const { user } = renderApp({ storage: createMemoryStorage({ [STORAGE_KEY]: 'not json' }), path: '/plan' });
    await user.type(screen.getByRole('textbox', { name: 'Monthly income (USD)' }), '5');
    await user.click(screen.getByRole('link', { name: NAV_ITEMS.find((i) => i.href === path)?.label ?? 'Overview' }));
    expect(screen.getByText(REPLACED_MESSAGE)).toBeInTheDocument();
    await expectNoAxeViolations();
  });

  it.each(PATH_LIST)('%s: no violations, storage unavailable', async (path) => {
    renderApp({ storage: createMemoryStorage({}, { throwOnGet: true }), path });
    await expectNoAxeViolations();
  });

  it('/: no violations with the Add expense dialog open', async () => {
    const { user } = renderApp({ state: SCENARIO, path: '/' });
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(screen.getByRole('dialog', { name: 'Add expense' })).toBeInTheDocument();
    await expectNoAxeViolations();
  });

  it('/: no violations when income is overspent (negative left to spend)', async () => {
    renderApp({ state: { ...SCENARIO, incomeCents: 100000 }, path: '/' });
    expect(screen.getByText('Spent $694.82 more than your income')).toBeInTheDocument();
    await expectNoAxeViolations();
  });
});
