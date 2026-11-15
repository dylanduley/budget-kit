import { render, screen } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import { renderWithBudget } from '@/test/renderWithBudget';
import { expectNoAxeViolations } from '@/test/axe';
import { BudgetProvider } from '@/state/BudgetProvider';
import { STORAGE_KEY } from '@/state/storage';
import { BudgetApp } from './BudgetApp';

const SRC = join(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');

function sourceFiles(dir: string = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css)$/.test(name) ? [full] : [];
  });
}

const nonTestSources = sourceFiles().filter((f) => !/\.test\.tsx?$/.test(f));
const stripComments = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

describe('ready skeleton', () => {
  it('shows one h1, Budget Kit, and the month line, without aria-busy', async () => {
    const { container } = renderWithBudget(<BudgetApp />, { state: SCENARIO });
    expect(await screen.findByText('Budget for November 2026')).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Budget Kit' })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(main).not.toHaveAttribute('aria-busy');
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(screen.queryByText('Loading your budget…')).not.toBeInTheDocument();
  });

  it('formats the month of the stored state, not of the clock', async () => {
    renderWithBudget(<BudgetApp />, { state: SCENARIO, today: '2027-02-03' });
    expect(await screen.findByText('Budget for November 2026')).toBeInTheDocument();
  });

  it('shows the clock month for a fresh budget', async () => {
    renderWithBudget(<BudgetApp />, { today: '2027-02-03' });
    expect(await screen.findByText('Budget for February 2027')).toBeInTheDocument();
  });

  it('invalid stored data still reaches a working ready skeleton', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: 'garbage' });
    renderWithBudget(<BudgetApp />, { storage });
    expect(await screen.findByText('Budget for November 2026')).toBeInTheDocument();
    expect(storage.dump()[STORAGE_KEY]).toBe('garbage');
  });
});

describe('loading skeleton', () => {
  it('is a busy main with exactly one h1, Budget Kit', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <BudgetProvider storage={createMemoryStorage()} getToday={() => '2026-11-14'}>
        <BudgetApp />
      </BudgetProvider>,
    );
    expect(container.querySelector('main')?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('h1')?.textContent).toBe('Budget Kit');
    expect(container.textContent).toContain('Loading your budget…');
  });
});

describe('accessibility (axe)', () => {
  it('finds no violations in the loading state', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <BudgetProvider storage={createMemoryStorage()} getToday={() => '2026-11-14'}>
        <BudgetApp />
      </BudgetProvider>,
    );
    document.body.appendChild(container);
    try {
      await expectNoAxeViolations(container);
      await expectNoAxeViolations();
    } finally {
      container.remove();
    }
  });

  it('finds no violations in the ready state', async () => {
    renderWithBudget(<BudgetApp />, { state: SCENARIO });
    await screen.findByText('Budget for November 2026');
    await expectNoAxeViolations();
  });

  it('expectNoAxeViolations fails on an image without alt (the helper can fail)', async () => {
    const { container } = render(createElement('img', { src: '/x.png' }));
    await expect(expectNoAxeViolations(container)).rejects.toThrow(/image-alt/);
  });
});

describe('server and client boundary (source)', () => {
  const firstStatement = (code: string): string => stripComments(code).trimStart().split('\n')[0] ?? '';

  it('page.tsx and layout.tsx have no use client directive', () => {
    for (const file of ['app/page.tsx', 'app/layout.tsx']) {
      expect(read(file), file).not.toMatch(/['"]use client['"]/);
    }
  });

  it('BudgetProvider.tsx and BudgetApp.tsx start with use client', () => {
    for (const file of ['state/BudgetProvider.tsx', 'features/BudgetApp.tsx']) {
      expect(firstStatement(read(file)), file).toMatch(/^['"]use client['"];?$/);
    }
  });

  it('storage.ts, budgetReducer.ts, clock.ts and lib/* have no directive and do not import react', () => {
    for (const file of ['state/storage.ts', 'state/budgetReducer.ts', 'lib/clock.ts', 'lib/budget.ts', 'lib/format.ts']) {
      const code = stripComments(read(file));
      expect(code, file).not.toMatch(/['"]use client['"]/);
      expect(code, file).not.toMatch(/from\s+['"]react(-dom)?(\/[^'"]*)?['"]/);
      expect(code, file).not.toMatch(/require\(\s*['"]react/);
      expect(code, file).not.toMatch(/import\(\s*['"]react/);
    }
  });

  it('page.tsx renders the provider around BudgetApp', () => {
    const page = read('app/page.tsx');
    expect(page).toMatch(/<BudgetProvider>\s*<BudgetApp\s*\/>\s*<\/BudgetProvider>/);
  });

  it('pure modules do not touch window, document, localStorage or crypto', () => {
    for (const file of ['state/storage.ts', 'state/budgetReducer.ts', 'lib/clock.ts']) {
      expect(stripComments(read(file)), file).not.toMatch(/\b(window|document|localStorage|crypto)\b/);
    }
  });
});

describe('code hygiene (source grep)', () => {
  const NATIVE = /<(button|input|select|textarea|table|dialog)\b/;

  it('has non-test sources to check', () => {
    expect(nonTestSources.length).toBeGreaterThan(8);
  });

  it('has no any, ts-ignore or ts-expect-error in non-test files', () => {
    for (const file of nonTestSources) {
      const code = stripComments(readFileSync(file, 'utf8'));
      const name = relative(SRC, file);
      expect(code, name).not.toMatch(/@ts-(ignore|expect-error|nocheck)/);
      expect(code, name).not.toMatch(/:\s*any\b|<any>|\bas any\b|any\[\]|Array<any>|\bany\s*[,>)|=]/);
    }
  });

  it('has no native controls, style props or CSS files other than globals.css in src', () => {
    for (const file of nonTestSources) {
      const name = relative(SRC, file);
      if (name.endsWith('.css')) {
        expect(name).toBe('app/globals.css');
        continue;
      }
      const code = stripComments(readFileSync(file, 'utf8'));
      expect(code, name).not.toMatch(NATIVE);
      expect(code, name).not.toMatch(/\bstyle=/);
    }
  });

  it('has no float-money patterns in app source', () => {
    for (const file of nonTestSources) {
      const code = stripComments(readFileSync(file, 'utf8'));
      const name = relative(SRC, file);
      expect(code, name).not.toMatch(/parseFloat|toFixed|\*\s*100\b|\/\s*100\b/);
    }
  });

  it('never parses dates with new Date(string) and only clock.ts reads the current time', () => {
    for (const file of nonTestSources) {
      const code = stripComments(readFileSync(file, 'utf8'));
      const name = relative(SRC, file);
      expect(code, name).not.toMatch(/new Date\(\s*['"`a-zA-Z]/);
      if (name !== 'lib/clock.ts') expect(code, name).not.toMatch(/Date\.now\(|new Date\(\s*\)/);
    }
  });

  it('only reads crypto in the provider default id generator', () => {
    for (const file of nonTestSources) {
      const name = relative(SRC, file);
      if (name === 'state/BudgetProvider.tsx') continue;
      expect(stripComments(readFileSync(file, 'utf8')), name).not.toMatch(/crypto\./);
    }
  });
});
