import { act, screen, waitFor, within } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { type Root, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { metadata } from '@/app/layout';
import { HistoryPage } from '@/features/history/HistoryPage';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { PlanPage } from '@/features/plan/PlanPage';
import { SpendingPage } from '@/features/spending/SpendingPage';
import type { BudgetState } from '@/lib/budget';
import { BudgetProvider } from '@/state/BudgetProvider';
import { STORAGE_KEY, serializeBook } from '@/state/storage';
import { expectNoAxeViolations } from '@/test/axe';
import { BOOK, SCENARIO, SCENARIO_TODAY } from '@/test/fixtures';
import { type MemoryStorage, createMemoryStorage } from '@/test/memoryStorage';
import { setTestPathname } from '@/test/nextNavigation';
import { type RenderAppOptions, type RenderAppResult, renderApp } from '@/test/renderApp';

import { AppShell } from './AppShell';

declare global {
  // React's flag for act() support outside Testing Library helpers.
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const PATHS = ['/', '/spending', '/plan', '/history'] as const;
type Path = (typeof PATHS)[number];
const H1: Record<Path, string> = { '/': 'Overview', '/spending': 'Spending', '/plan': 'Plan', '/history': 'History' };
const PAGES: Record<Path, () => ReactElement> = {
  '/': OverviewPage,
  '/spending': SpendingPage,
  '/plan': PlanPage,
  '/history': HistoryPage,
};
const NAV_LABELS = ['Overview', 'Spending', 'Plan', 'History'];

const OVER_BUDGET: BudgetState = {
  month: '2026-11',
  incomeCents: 100000,
  categories: [
    { id: 'rent', name: 'Rent', plannedCents: 90000 },
    { id: 'food', name: 'Food', plannedCents: 30000 },
  ],
  expenses: [{ id: 'e1', categoryId: 'rent', amountCents: 120000, note: 'Deposit', date: '2026-11-02' }],
};
const REMOVED_CATEGORY: BudgetState = {
  ...SCENARIO,
  expenses: [
    ...SCENARIO.expenses,
    { id: 'e4', categoryId: 'gone', amountCents: 2500, note: 'Orphan', date: '2026-11-06' },
  ],
};
const NO_CATEGORIES: BudgetState = { month: '2026-11', incomeCents: 100000, categories: [], expenses: [] };
const NO_EXPENSES: BudgetState = { ...SCENARIO, expenses: [] };

// ---------------------------------------------------------------- shared checks

function pageBanners(): HTMLElement[] {
  // A <header> inside a sectioning element is not a banner (HTML-AAM); Testing Library does not apply that rule.
  // The library Dialog's own <header> sits in a role="dialog" container, so it is left out here: it is
  // checked separately (the dialog is outside the page landmarks) and in a real browser by the manual axe pass.
  return Array.from(document.querySelectorAll<HTMLElement>('header')).filter(
    (el) => el.closest('article, aside, main, nav, section, [role="dialog"]') === null,
  );
}

function textOutsideLandmarks(): string[] {
  const stray: string[] = [];
  const header = pageBanners()[0];
  const main = document.querySelector('main');
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? '';
    const parent = node.parentElement;
    if (text === '' || parent === null) continue;
    if (parent.closest('script, style, template, noscript') !== null) continue;
    if (parent.closest('[role="dialog"], [data-bk-dialog-root]') !== null) continue;
    if ((header?.contains(parent) ?? false) || (main?.contains(parent) ?? false)) continue;
    stray.push(text);
  }
  return stray;
}

function expectLandmarks(path: Path): void {
  expect(pageBanners(), `${path} banners`).toHaveLength(1);
  expect(document.querySelectorAll('header').length).toBeGreaterThanOrEqual(1);
  const navs = screen.getAllByRole('navigation');
  expect(navs, `${path} navigations`).toHaveLength(1);
  expect(navs[0]).toHaveAccessibleName('Main');
  expect(screen.getAllByRole('main'), `${path} main`).toHaveLength(1);
  expect(document.querySelectorAll('main')).toHaveLength(1);
  expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent), `${path} h1`).toEqual([H1[path]]);
  expect(textOutsideLandmarks(), `${path} text outside banner and main`).toEqual([]);
  expect(pageBanners()[0]?.contains(screen.getByRole('main'))).toBe(false);
  expect(pageBanners()[0]?.contains(navs[0] ?? null)).toBe(true);
}

function expectAriaCurrent(path: Path): void {
  const links = within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link');
  expect(links.map((l) => l.textContent)).toEqual(NAV_LABELS);
  const current = links.filter((l) => l.hasAttribute('aria-current'));
  expect(current.map((l) => l.textContent), `${path} aria-current`).toEqual([H1[path]]);
  expect(current[0]).toHaveAttribute('aria-current', 'page');
}

const headingList = (): [number, string][] =>
  screen.getAllByRole('heading').map((h) => [Number(h.tagName.slice(1)), h.textContent ?? '']);

// ---------------------------------------------------------------- states

interface AppState {
  name: string;
  options: RenderAppOptions;
  /** Brings the view into the state on `path`; may click. */
  prepare?: (view: RenderAppResult, path: Path) => Promise<void>;
  /** Only meaningful on some paths (the control exists only there). */
  paths?: readonly Path[];
  /** Whether an open dialog is expected (its text sits outside banner and main). */
  dialog?: string;
}

async function openAddExpense(view: RenderAppResult): Promise<HTMLElement> {
  await view.user.click(screen.getByRole('button', { name: 'Add expense' }));
  return screen.findByRole('dialog', { name: 'Add expense' });
}

const STATES: AppState[] = [
  { name: 'first run', options: {} },
  { name: 'populated (SCENARIO)', options: { state: SCENARIO } },
  { name: 'over budget', options: { state: OVER_BUDGET } },
  { name: 'removed-category spending', options: { state: REMOVED_CATEGORY } },
  { name: 'no categories', options: { state: NO_CATEGORIES } },
  { name: 'empty expense list', options: { state: NO_EXPENSES } },
  {
    name: 'Add expense dialog open',
    options: { state: SCENARIO },
    dialog: 'Add expense',
    prepare: async (view) => {
      await openAddExpense(view);
    },
  },
  {
    name: 'Add expense dialog with errors',
    options: { state: SCENARIO },
    dialog: 'Add expense',
    prepare: async (view) => {
      const dialog = await openAddExpense(view);
      await view.user.click(within(dialog).getByRole('button', { name: 'Save expense' }));
      expect(await within(dialog).findAllByRole('alert')).not.toHaveLength(0);
    },
  },
  {
    name: 'Add category dialog open (Plan only: the button exists only there)',
    options: { state: SCENARIO },
    paths: ['/plan'],
    dialog: 'Add category',
    prepare: async (view) => {
      await view.user.click(screen.getByRole('button', { name: 'Add category' }));
      await screen.findByRole('dialog', { name: 'Add category' });
    },
  },
  {
    name: 'Add category dialog with errors (Plan only)',
    options: { state: SCENARIO },
    paths: ['/plan'],
    dialog: 'Add category',
    prepare: async (view) => {
      await view.user.click(screen.getByRole('button', { name: 'Add category' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add category' });
      await view.user.click(within(dialog).getByRole('button', { name: 'Save category' }));
      expect(await within(dialog).findByText('Enter a category name')).toBeInTheDocument();
    },
  },
  {
    name: 'past month (BOOK, October viewed)',
    options: { book: BOOK },
    prepare: async (view, path) => {
      view.goTo('/');
      await view.user.click(screen.getByRole('button', { name: 'Previous month' }));
      view.goTo(path);
    },
  },
  { name: 'new month (BOOK, today 2026-12-02)', options: { book: BOOK, today: '2026-12-02' } },
  { name: 'History with BOOK', options: { book: BOOK } },
  {
    name: 'Delete all data dialog open (History only: the button exists only there)',
    options: { book: BOOK },
    paths: ['/history'],
    dialog: 'Delete all data?',
    prepare: async (view) => {
      await view.user.click(screen.getByRole('button', { name: 'Delete all data' }));
      await screen.findByRole('dialog', { name: 'Delete all data?' });
    },
  },
  {
    name: 'after deleting all data',
    options: { book: BOOK },
    prepare: async (view, path) => {
      view.goTo('/history');
      await view.user.click(screen.getByRole('button', { name: 'Delete all data' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete all data?' });
      await view.user.click(within(dialog).getByRole('button', { name: 'Delete all data' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByText(/^All data deleted\./)).toBeInTheDocument();
      // Leave the confirmation on screen for History; other paths show the empty app.
      view.goTo(path);
    },
  },
  { name: 'invalid saved data, before replacement', options: { storage: createMemoryStorage({ [STORAGE_KEY]: 'not json' }) } },
  {
    name: 'invalid saved data, after replacement',
    options: { storage: createMemoryStorage({ [STORAGE_KEY]: 'not json' }) },
    prepare: async (view, path) => {
      view.goTo('/plan');
      await view.user.type(screen.getByLabelText('Monthly income (USD)'), '3200');
      expect(screen.getByText("Your saved budget couldn't be read and has been replaced.")).toBeInTheDocument();
      view.goTo(path);
    },
  },
  { name: 'storage unavailable', options: { storage: createMemoryStorage({}, { throwOnGet: true, throwOnSet: true }) } },
  {
    name: 'migrated version 1 data',
    options: { storage: createMemoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, state: SCENARIO }) }) },
  },
];

// Fresh storage per run: the shared objects above must not carry state between paths.
function freshOptions(state: AppState): RenderAppOptions {
  const { storage } = state.options;
  if (storage === undefined) return state.options;
  const copy = createMemoryStorage(
    (storage as MemoryStorage).dump(),
    state.name === 'storage unavailable' ? { throwOnGet: true, throwOnSet: true } : {},
  );
  return { ...state.options, storage: copy };
}

async function showState(state: AppState, path: Path): Promise<RenderAppResult> {
  const view = renderApp({ ...freshOptions(state), path });
  await screen.findByRole('heading', { level: 1, name: H1[path] });
  if (state.prepare !== undefined) await state.prepare(view, path);
  return view;
}

// ---------------------------------------------------------------- axe

describe('axe finds no violations in every state on every path', () => {
  describe.each(STATES)('$name', (state) => {
    const paths = state.paths ?? PATHS;
    it.each(paths)('%s', async (path) => {
      await showState(state, path);
      await expectNoAxeViolations();
    });
  });

  describe.each(PATHS)('loading (server markup) %s', (path) => {
    it('has a banner, the nav, main with aria-busy and one h1, and no axe violations', async () => {
      setTestPathname(path);
      const Page = PAGES[path];
      const container = document.createElement('div');
      container.innerHTML = renderToString(
        <BudgetProvider storage={createMemoryStorage()} getToday={() => SCENARIO_TODAY}>
          <AppShell>
            <Page />
          </AppShell>
        </BudgetProvider>,
      );
      document.body.appendChild(container);
      try {
        expect(container.querySelector('main')).toHaveAttribute('aria-busy', 'true');
        expect(container.querySelectorAll('h1')).toHaveLength(1);
        expect(container.querySelector('h1')?.textContent).toBe(H1[path]);
        expect(container.querySelector('header nav[aria-label="Main"]')).not.toBeNull();
        await expectNoAxeViolations();
      } finally {
        container.remove();
      }
    });
  });

  describe.each(PATHS)('ready after loading %s', (path) => {
    it('main is not aria-busy and there is no loading text', async () => {
      renderApp({ state: SCENARIO, path });
      await screen.findByRole('heading', { level: 1, name: H1[path] });
      expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy');
      expect(screen.queryByText('Loading your budget…')).not.toBeInTheDocument();
      await expectNoAxeViolations();
    });
  });

  it('the states really are what they claim (so the axe pass covers them)', async () => {
    renderApp({ state: OVER_BUDGET, path: '/' });
    expect(screen.getByText('Over budget')).toBeInTheDocument();
    expect(screen.getByText('Spent $200.00 more than your income')).toBeInTheDocument();
    document.body.innerHTML = '';
    const removed = renderApp({ state: REMOVED_CATEGORY, path: '/' });
    expect(screen.getByText(/The Spent total includes \$25\.00 from removed categories/)).toBeInTheDocument();
    removed.unmount();
    const none = renderApp({ state: NO_CATEGORIES, path: '/' });
    expect(screen.getByText('No categories yet. Add them on the Plan page.')).toBeInTheDocument();
    none.unmount();
    const empty = renderApp({ state: NO_EXPENSES, path: '/spending' });
    expect(screen.getByText('No expenses in November 2026.')).toBeInTheDocument();
    empty.unmount();
    renderApp({ book: BOOK, today: '2026-12-02', path: '/' });
    expect(screen.getByText(/^New month\./)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- landmarks

describe('landmarks on every path', () => {
  const landmarkStates = STATES.filter((s) => s.dialog === undefined);
  describe.each(landmarkStates)('$name', (state) => {
    it.each(state.paths ?? PATHS)('%s: one banner, one Main navigation, one main, one h1, no text outside them', async (path) => {
      await showState(state, path);
      expectLandmarks(path);
    });
  });

  it.each(PATHS)('%s with a dialog open: the dialog is outside the landmarks and the page text is still inside', async (path) => {
    const view = renderApp({ state: SCENARIO, path });
    const dialog = await openAddExpense(view);
    expect(dialog.closest('main')).toBeNull();
    expect(dialog.closest('header')).toBeNull();
    expectLandmarks(path);
  });

  it('Card headers inside main are not banners (the page has exactly one)', () => {
    renderApp({ state: SCENARIO, path: '/' });
    expect(document.querySelectorAll('main header').length).toBeGreaterThan(0);
    expect(pageBanners()).toHaveLength(1);
  });

  it('the stray-text check can fail', () => {
    renderApp({ state: SCENARIO, path: '/' });
    const stray = document.createElement('p');
    stray.textContent = 'stray';
    document.body.appendChild(stray);
    expect(textOutsideLandmarks()).toEqual(['stray']);
    stray.remove();
  });
});

// ---------------------------------------------------------------- headings

describe('headings (populated SCENARIO)', () => {
  it('/: h1 Overview, h2 Summary and Spending by category, nothing else', () => {
    renderApp({ state: SCENARIO, path: '/' });
    expect(headingList()).toEqual([
      [1, 'Overview'],
      [2, 'Summary'],
      [2, 'Spending by category'],
    ]);
  });

  it('/spending: h1 Spending, h2 Expenses in November 2026', () => {
    renderApp({ state: SCENARIO, path: '/spending' });
    expect(headingList()).toEqual([
      [1, 'Spending'],
      [2, 'Expenses in November 2026'],
    ]);
  });

  it('/plan: h1 Plan, h2 Income and Categories; no h3 Suggestions when every suggestion is used', () => {
    renderApp({ state: SCENARIO, path: '/plan' });
    expect(headingList()).toEqual([
      [1, 'Plan'],
      [2, 'Income'],
      [2, 'Categories'],
    ]);
  });

  it('/plan: h3 Suggestions appears (after Categories, inside it) only while a suggestion is unused', async () => {
    const { user } = renderApp({ state: { ...SCENARIO, categories: SCENARIO.categories.slice(0, 4), expenses: [] }, path: '/plan' });
    expect(headingList()).toEqual([
      [1, 'Plan'],
      [2, 'Income'],
      [2, 'Categories'],
      [3, 'Suggestions'],
    ]);
    expect(screen.getByRole('heading', { level: 3, name: 'Suggestions' }).closest('section')).toBe(
      screen.getByRole('region', { name: 'Categories' }),
    );
    await user.click(screen.getByRole('button', { name: 'Add Eating out' }));
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('/history: h1 History, h2 Months and Start over', () => {
    renderApp({ state: SCENARIO, path: '/history' });
    expect(headingList()).toEqual([
      [1, 'History'],
      [2, 'Months'],
      [2, 'Start over'],
    ]);
  });

  it.each(STATES.filter((s) => s.dialog === undefined).map((s) => [s.name, s] as const))(
    'no heading level is skipped and no h4 exists: %s',
    async (_name, state) => {
      for (const path of state.paths ?? PATHS) {
        const view = await showState(state, path);
        let previous = 0;
        for (const [level, name] of headingList()) {
          expect(level - previous, `${path} "${name}" level ${level} after ${previous}`).toBeLessThanOrEqual(1);
          expect(level).toBeLessThanOrEqual(3);
          previous = level;
        }
        view.unmount();
      }
    },
  );
});

describe('DOM order', () => {
  const before = (a: Element, b: Element): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

  it('the banner (name, Main nav, month switcher, Add expense) comes before main on every path', () => {
    for (const path of ['/', '/spending', '/plan'] as const) {
      const view = renderApp({ state: SCENARIO, path });
      const banner = pageBanners()[0] as HTMLElement;
      const links = within(banner).getAllByRole('link');
      const previous = within(banner).getByRole('button', { name: 'Previous month' });
      const add = within(banner).getByRole('button', { name: 'Add expense' });
      expect(before(links[3] as HTMLElement, previous), path).toBe(true);
      expect(before(previous, add), path).toBe(true);
      expect(before(banner, screen.getByRole('main')), path).toBe(true);
      view.unmount();
    }
  });

  it('/history has no month switcher in the banner (decision 15) but still has Add expense', () => {
    renderApp({ state: SCENARIO, path: '/history' });
    const banner = pageBanners()[0] as HTMLElement;
    expect(within(banner).queryByRole('button', { name: 'Previous month' })).not.toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Add expense' })).toBeInTheDocument();
  });

  it('main order: h1 first, then the saved-data message, then the page cards', () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: 'not json' });
    renderApp({ storage, path: '/' });
    const main = screen.getByRole('main');
    const message = screen.getByText(/couldn't be read, so a new one was started/);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(main).toContainElement(message);
    expect(before(message, h1)).toBe(true);
    expect(before(h1, screen.getByRole('region', { name: 'Summary' }))).toBe(true);
  });

  it('Overview: Summary before Spending by category; Plan: Income before Categories; History: Months before Start over', () => {
    renderApp({ state: SCENARIO, path: '/' });
    expect(before(screen.getByRole('region', { name: 'Summary' }), screen.getByRole('region', { name: 'Spending by category' }))).toBe(true);
    document.body.innerHTML = '';
    renderApp({ state: SCENARIO, path: '/plan' });
    expect(before(screen.getByRole('region', { name: 'Income' }), screen.getByRole('region', { name: 'Categories' }))).toBe(true);
    document.body.innerHTML = '';
    renderApp({ state: SCENARIO, path: '/history' });
    expect(before(screen.getByRole('table', { name: 'Months' }), screen.getByRole('region', { name: 'Start over' }))).toBe(true);
  });

  it('Plan: the new-month note and the switcher precede the page; Suggestions follow the category rows', () => {
    renderApp({ state: { ...SCENARIO, categories: SCENARIO.categories.slice(0, 2), expenses: [] }, path: '/plan' });
    const rows = screen.getByLabelText('Category 2 planned (USD)');
    expect(before(rows, screen.getByRole('heading', { level: 3, name: 'Suggestions' }))).toBe(true);
  });
});

// ---------------------------------------------------------------- aria-current

describe('aria-current on every path', () => {
  it.each(PATHS)('%s: exactly one nav link, the one for that path', (path) => {
    renderApp({ state: SCENARIO, path });
    expectAriaCurrent(path);
  });

  it('follows navigation by click without a stale link', async () => {
    const { user } = renderApp({ state: SCENARIO });
    for (const path of ['/spending', '/plan', '/history', '/'] as const) {
      await user.click(screen.getByRole('link', { name: H1[path] }));
      expectAriaCurrent(path);
      expect(screen.getByRole('heading', { level: 1, name: H1[path] })).toBeInTheDocument();
    }
  });

  it.each(STATES.filter((s) => s.dialog === undefined).map((s) => [s.name, s] as const))('one current link in state: %s', async (_name, state) => {
    for (const path of state.paths ?? PATHS) {
      const view = await showState(state, path);
      expectAriaCurrent(path);
      view.unmount();
    }
  });
});

// ---------------------------------------------------------------- hydration

describe('hydration on every route', () => {
  let previousActFlag: boolean | undefined;
  const roots: Root[] = [];
  beforeEach(() => {
    previousActFlag = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterEach(async () => {
    for (const root of roots.splice(0)) {
      await act(async () => {
        root.unmount();
      });
    }
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActFlag;
    document.body.innerHTML = '';
  });

  function app(storage: MemoryStorage, path: Path, today = SCENARIO_TODAY): ReactElement {
    const Page = PAGES[path];
    return (
      <BudgetProvider storage={storage} getToday={() => today}>
        <AppShell>
          <Page />
        </AppShell>
      </BudgetProvider>
    );
  }

  const SAVED: [string, () => MemoryStorage, string?][] = [
    ['a saved month', () => createMemoryStorage({ [STORAGE_KEY]: serializeBook({ months: [SCENARIO] }) })],
    ['a saved book (BOOK)', () => createMemoryStorage({ [STORAGE_KEY]: serializeBook(BOOK) })],
    ['a saved month in a new month', () => createMemoryStorage({ [STORAGE_KEY]: serializeBook({ months: [SCENARIO] }) }), '2026-12-02'],
    ['saved version 1 data', () => createMemoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, state: SCENARIO }) })],
  ];

  describe.each(PATHS)('%s', (path) => {
    it.each(SAVED)('hydrates %s with no recoverable error and no console.error', async (_name, make, today) => {
      setTestPathname(path);
      const storage = make();
      const html = renderToString(app(storage, path, today));
      expect(html).toContain('Loading your budget…');
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      const onRecoverableError = vi.fn();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      await act(async () => {
        roots.push(hydrateRoot(container, app(storage, path, today), { onRecoverableError }));
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(container).not.toHaveTextContent('Loading your budget…');
      expect(container.querySelector('h1')?.textContent).toBe(H1[path]);
      expect(storage.setItemCalls).toBe(0);
    });
  });
});

// ---------------------------------------------------------------- layout.tsx source

describe('layout.tsx and route files (source)', () => {
  const APP = join(import.meta.dirname, '..', '..', 'app');
  const layout = readFileSync(join(APP, 'layout.tsx'), 'utf8');

  it('metadata: default title Budget Kit with a page template, and a description', () => {
    expect(metadata.title).toEqual({ default: 'Budget Kit', template: '%s · Budget Kit' });
    expect(typeof metadata.description).toBe('string');
  });

  it('html has lang="en"', () => {
    expect(layout).toMatch(/<html\b[^>]*\blang="en"/);
  });

  it('the single provider and shell live in layout.tsx and nowhere in a page', () => {
    expect(layout.match(/<BudgetProvider\b/g)).toHaveLength(1);
    expect(layout.match(/<AppShell\b/g)).toHaveLength(1);
    expect(layout.indexOf('<BudgetProvider')).toBeLessThan(layout.indexOf('<AppShell'));
    expect(layout.indexOf('<AppShell')).toBeLessThan(layout.indexOf('{children}'));
    for (const route of ['page.tsx', 'spending/page.tsx', 'plan/page.tsx', 'history/page.tsx']) {
      const source = readFileSync(join(APP, route), 'utf8');
      expect(source, route).not.toMatch(/BudgetProvider|AppShell/);
      expect(source, route).not.toMatch(/^['"]use client['"]/m);
    }
  });

  it('layout.tsx is a server component and imports the library tokens once', () => {
    expect(layout).not.toMatch(/^['"]use client['"]/m);
    expect(layout.match(/@budget-kit\/ui\/tokens\.css/g)).toHaveLength(1);
  });

  it('there are exactly four routes', () => {
    const pages = readdirSync(APP, { recursive: true, encoding: 'utf8' }).filter((f) => /(^|[\\/])page\.tsx$/.test(f));
    expect(pages.sort()).toEqual(['history/page.tsx', 'page.tsx', 'plan/page.tsx', 'spending/page.tsx']);
  });
});
