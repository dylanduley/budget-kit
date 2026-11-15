import { act } from 'react';
import { type ReactElement, useEffect, useState } from 'react';
import { type Root, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SCENARIO, SCENARIO_TODAY } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import { BudgetProvider } from '@/state/BudgetProvider';
import { STORAGE_KEY, type StorageLike, loadBudget, serializeBook } from '@/state/storage';
import { BudgetApp } from './BudgetApp';

declare global {
  // React's flag for act() support outside Testing Library helpers.
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let previousActFlag: boolean | undefined;
const roots: Root[] = [];
beforeEach(() => {
  previousActFlag = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  // Every hydrated root is unmounted, so no root (or its effects) leaks into the next test.
  for (const root of roots.splice(0)) {
    await act(async () => {
      root.unmount();
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = previousActFlag;
  document.body.innerHTML = '';
});

function seeded(): StorageLike {
  return createMemoryStorage({ [STORAGE_KEY]: serializeBook({ months: [SCENARIO] }) });
}

function app(storage: StorageLike): ReactElement {
  return (
    <BudgetProvider storage={storage} getToday={() => SCENARIO_TODAY}>
      <BudgetApp />
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

describe('hydration roots', () => {
  it('are unmounted after each test (the container is emptied by unmount)', async () => {
    const ui = app(seeded());
    const { container } = await hydrate(ui, ui);
    expect(roots).toHaveLength(1);
    const root = roots[0];
    await act(async () => {
      root?.unmount();
    });
    roots.length = 0;
    expect(container.querySelector('main')).toBeNull();
  });
});

describe('server render (loading state)', () => {
  it('contains the loading text and heading, and nothing from storage or the clock', () => {
    const html = renderToString(app(seeded()));
    expect(html).toContain('Loading your budget…');
    expect(html).toContain('Budget Kit');
    expect(html).not.toContain('November 2026');
    expect(html).not.toContain('Budget for');
    expect(html).not.toContain('2026');
    expect(html).toContain('aria-busy="true"');
  });

  it('is identical whatever storage holds (it cannot depend on storage)', () => {
    expect(renderToString(app(seeded()))).toBe(renderToString(app(createMemoryStorage())));
  });

  it('has exactly one h1, Budget Kit, in a busy main', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(app(seeded()));
    const main = container.querySelector('main');
    expect(main?.getAttribute('aria-busy')).toBe('true');
    const headings = container.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toBe('Budget Kit');
  });
});

describe('hydration', () => {
  it('hydrates the server markup with no recoverable error and no console.error, then shows the stored month', async () => {
    const storage = seeded();
    const ui = app(storage);
    const { container, html, onRecoverableError, consoleError } = await hydrate(ui, ui);
    expect(html).toContain('Loading your budget…');
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(container).toHaveTextContent('Budget for November 2026');
    expect(container).not.toHaveTextContent('Loading your budget…');
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('does not write while hydrating', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeBook({ months: [SCENARIO] }) });
    const ui = app(storage);
    await hydrate(ui, ui);
    expect(storage.setItemCalls).toBe(0);
  });

  it('hydrates with empty storage and shows the clock month', async () => {
    const ui = app(createMemoryStorage());
    const { container, onRecoverableError, consoleError } = await hydrate(ui, ui);
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(container).toHaveTextContent('Budget for November 2026');
  });

  it('hydrates cleanly when storage is unavailable', async () => {
    const ui = app(createMemoryStorage({}, { throwOnGet: true }));
    const { container, onRecoverableError, consoleError } = await hydrate(ui, ui);
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(container).toHaveTextContent('Budget for November 2026');
  });

  it('the ready main has no aria-busy and exactly one h1, Budget Kit', async () => {
    const ui = app(seeded());
    const { container } = await hydrate(ui, ui);
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main?.hasAttribute('aria-busy')).toBe(false);
    const headings = container.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toBe('Budget Kit');
  });
});

// A deliberately broken provider proves the harness above can fail: it decides its first render
// from storage (which the server cannot see), so server and client markup differ.
describe('the hydration harness can fail', () => {
  let serverPass = false;
  function BrokenProvider({ storage }: { storage: StorageLike | null }): ReactElement {
    const [loaded] = useState(() => {
      const result = serverPass ? { status: 'empty' as const } : loadBudget(storage);
      return result.status === 'loaded' ? (result.book.months[0] ?? null) : null;
    });
    const [, force] = useState(0);
    useEffect(() => force(1), []);
    return loaded === null ? (
      <main aria-busy="true">
        <h1>Budget Kit</h1>
        <p>Loading your budget…</p>
      </main>
    ) : (
      <main>
        <h1>Budget Kit</h1>
        <p>Budget for {loaded.month}</p>
      </main>
    );
  }

  it('reports a recoverable error or console.error for a provider that reads storage during render', async () => {
    const storage = seeded();
    serverPass = true;
    const html = renderToString(<BrokenProvider storage={storage} />);
    serverPass = false;
    expect(html).toContain('Loading your budget…');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      roots.push(hydrateRoot(container, <BrokenProvider storage={storage} />, { onRecoverableError }));
    });
    expect(onRecoverableError.mock.calls.length + consoleError.mock.calls.length).toBeGreaterThan(0);
  });
});
