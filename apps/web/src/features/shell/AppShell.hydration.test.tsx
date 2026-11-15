import { act } from 'react';
import { type ReactElement } from 'react';
import { type Root, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HistoryPage } from '@/features/history/HistoryPage';
import { OverviewPage } from '@/features/overview/OverviewPage';
import { PlanPage } from '@/features/plan/PlanPage';
import { SpendingPage } from '@/features/spending/SpendingPage';
import { BudgetProvider } from '@/state/BudgetProvider';
import { STORAGE_KEY, serializeBook } from '@/state/storage';
import { SCENARIO, SCENARIO_TODAY } from '@/test/fixtures';
import { type MemoryStorage, createMemoryStorage } from '@/test/memoryStorage';
import { setTestPathname } from '@/test/nextNavigation';

import { AppShell } from './AppShell';

declare global {
  // React's flag for act() support outside Testing Library helpers.
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const CASES = [
  ['/', 'Overview', OverviewPage, 'Summary'],
  ['/spending', 'Spending', SpendingPage, 'Expenses in November 2026'],
  ['/plan', 'Plan', PlanPage, 'Monthly income (USD)'],
  ['/history', 'History', HistoryPage, 'Your months will be listed here.'],
] as const;

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

function seeded(): MemoryStorage {
  return createMemoryStorage({ [STORAGE_KEY]: serializeBook({ months: [SCENARIO] }) });
}

function app(storage: MemoryStorage, Page: () => ReactElement, getToday: () => string = () => SCENARIO_TODAY) {
  return (
    <BudgetProvider storage={storage} getToday={getToday}>
      <AppShell>
        <Page />
      </AppShell>
    </BudgetProvider>
  );
}

async function hydrate(serverUi: ReactElement, clientUi: ReactElement) {
  const html = renderToString(serverUi);
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const onRecoverableError = vi.fn();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => {
    roots.push(hydrateRoot(container, clientUi, { onRecoverableError }));
  });
  return { html, container, onRecoverableError, consoleError };
}

describe.each(CASES)('%s server render', (path, h1, Page) => {
  it('is the loading shell: Loading your budget…, four nav links and the h1, no month, no Add expense', () => {
    setTestPathname(path);
    const html = renderToString(app(seeded(), Page));
    expect(html).toContain('Loading your budget…');
    for (const name of ['Overview', 'Spending', 'Plan', 'History']) expect(html).toContain(`>${name}</a>`);
    expect(html).toContain(`>${h1}</h1>`);
    expect(html).not.toContain('November 2026');
    expect(html).not.toContain('Add expense');
    expect(html).toContain('aria-busy="true"');
  });

  it('reads nothing before mount: no storage read or write, no clock, no id or crypto', () => {
    setTestPathname(path);
    const storage = seeded();
    const getToday = vi.fn(() => SCENARIO_TODAY);
    const randomUUID = vi.spyOn(crypto, 'randomUUID');
    const getRandomValues = vi.spyOn(crypto, 'getRandomValues');
    const storageGet = vi.spyOn(Storage.prototype, 'getItem');
    const storageSet = vi.spyOn(Storage.prototype, 'setItem');
    renderToString(app(storage, Page, getToday));
    // And with the default provider (real localStorage and clock).
    renderToString(
      <BudgetProvider>
        <AppShell>
          <Page />
        </AppShell>
      </BudgetProvider>,
    );
    expect(storage.getItemCalls).toBe(0);
    expect(storage.setItemCalls).toBe(0);
    expect(getToday).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();
    expect(getRandomValues).not.toHaveBeenCalled();
    expect(storageGet).not.toHaveBeenCalled();
    expect(storageSet).not.toHaveBeenCalled();
  });

  it('is identical whatever storage holds', () => {
    setTestPathname(path);
    const reference = renderToString(app(seeded(), Page));
    expect(renderToString(app(createMemoryStorage(), Page))).toBe(reference);
    expect(renderToString(app(createMemoryStorage({ [STORAGE_KEY]: 'not json' }), Page))).toBe(reference);
    expect(renderToString(app(createMemoryStorage({}, { throwOnGet: true }), Page))).toBe(reference);
  });
});

describe.each(CASES)('%s hydration', (path, h1, Page, readyText) => {
  it('hydrates with no recoverable error and no console.error, then shows the ready content', async () => {
    setTestPathname(path);
    const storage = seeded();
    const ui = app(storage, Page);
    const { html, container, onRecoverableError, consoleError } = await hydrate(ui, ui);
    expect(html).toContain('Loading your budget…');
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(container).toHaveTextContent(readyText);
    expect(container).not.toHaveTextContent('Loading your budget…');
    expect(container.querySelector('main')?.hasAttribute('aria-busy')).toBe(false);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('h1')?.textContent).toBe(h1);
    expect(container.querySelector('header')?.textContent).toContain('Add expense');
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('loading never writes: no setItem while hydrating', async () => {
    setTestPathname(path);
    const storage = seeded();
    const ui = app(storage, Page);
    await hydrate(ui, ui);
    expect(storage.setItemCalls).toBe(0);
    expect(storage.getItemCalls).toBeGreaterThan(0);
  });

  it.each([
    ['empty storage', () => createMemoryStorage()],
    ['invalid data', () => createMemoryStorage({ [STORAGE_KEY]: 'not json' })],
    ['unavailable storage', () => createMemoryStorage({}, { throwOnGet: true })],
  ])('hydrates cleanly with %s', async (_name, make) => {
    setTestPathname(path);
    const ui = app(make(), Page);
    const { container, onRecoverableError, consoleError } = await hydrate(ui, ui);
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(container).not.toHaveTextContent('Loading your budget…');
  });
});

// The same hydrate helper must be able to fail, or the criteria above prove nothing.
describe('the hydration harness can fail', () => {
  it('reports an error when the first client render differs from the server HTML (nav current item)', async () => {
    setTestPathname('/');
    const serverUi = app(seeded(), OverviewPage);
    const html = renderToString(serverUi);
    setTestPathname('/plan');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      roots.push(hydrateRoot(container, app(seeded(), PlanPage), { onRecoverableError }));
    });
    expect(onRecoverableError.mock.calls.length + consoleError.mock.calls.length).toBeGreaterThan(0);
  });
});
