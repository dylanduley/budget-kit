import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const firstStatement = (code: string): string => stripComments(code).trimStart().split('\n')[0] ?? '';

const PAGE_FILES = ['app/page.tsx', 'app/spending/page.tsx', 'app/plan/page.tsx', 'app/history/page.tsx'];
const SERVER_FILES = ['app/layout.tsx', ...PAGE_FILES];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('routes: the four routes exist', () => {
  it.each(PAGE_FILES)('%s exists', (file) => {
    expect(existsSync(join(SRC, file))).toBe(true);
  });

  it('app/ holds route files only: no dynamic segments, no route handlers, no extra pages', () => {
    const files = walk(join(SRC, 'app')).map((f) => f.slice(join(SRC, 'app').length + 1));
    const pages = files.filter((f) => /(^|\/)page\.tsx$/.test(f)).sort();
    expect(pages).toEqual(['history/page.tsx', 'page.tsx', 'plan/page.tsx', 'spending/page.tsx']);
    expect(files.filter((f) => /\[|route\.ts|not-found|loading\.tsx|error\.tsx/.test(f))).toEqual([]);
  });
});

describe('routes: server components', () => {
  it.each(SERVER_FILES)('%s has no use client directive', (file) => {
    expect(read(file), file).not.toMatch(/['"]use client['"]/);
  });
});

describe('routes: client components', () => {
  it.each([
    'features/shell/AppShell.tsx',
    'features/overview/OverviewPage.tsx',
    'features/spending/SpendingPage.tsx',
    'features/plan/PlanPage.tsx',
    'features/history/HistoryPage.tsx',
  ])('%s starts with use client', (file) => {
    expect(firstStatement(read(file)), file).toMatch(/^['"]use client['"];?$/);
  });

  it('navItems.ts has no directive', () => {
    expect(read('features/shell/navItems.ts')).not.toMatch(/['"]use client['"]/);
  });

  it('features/BudgetApp.tsx and its tests no longer exist', () => {
    for (const file of ['features/BudgetApp.tsx', 'features/BudgetApp.test.tsx', 'features/BudgetApp.hydration.test.tsx']) {
      expect(existsSync(join(SRC, file)), file).toBe(false);
    }
  });
});

describe('routes: metadata', () => {
  it('layout.tsx metadata', async () => {
    const mod = await import('./layout');
    expect(mod.metadata).toEqual({
      title: { default: 'Budget Kit', template: '%s · Budget Kit' },
      description: 'A calm monthly budget planner.',
    });
  });

  it.each([
    ['Overview', () => import('./page')],
    ['Spending', () => import('./spending/page')],
    ['Plan', () => import('./plan/page')],
    ['History', () => import('./history/page')],
  ] as const)('the %s page title', async (title, load) => {
    const mod = await load();
    expect(mod.metadata).toEqual({ title });
    expect(typeof mod.default).toBe('function');
  });

  it.each(PAGE_FILES)('%s exports only metadata and a default component', (file) => {
    const exported = [...stripComments(read(file)).matchAll(/^export\s+(?:default\s+)?(?:const|function)\s+(\w+)/gm)].map(
      (m) => m[1],
    );
    expect(exported.filter((name) => name !== 'metadata').length).toBe(1);
    expect(read(file)).toMatch(/export default function/);
  });
});

describe('routes: layout source', () => {
  const layout = (): string => stripComments(read('app/layout.tsx'));

  it('renders <html lang="en">', () => {
    expect(layout()).toMatch(/<html lang="en">/);
  });

  it('renders BudgetProvider around AppShell around children', () => {
    expect(layout()).toMatch(/<BudgetProvider>\s*<AppShell>\s*\{children\}\s*<\/AppShell>\s*<\/BudgetProvider>/);
  });

  it('the one BudgetProvider is in layout.tsx and in no page, shell or page component', () => {
    const offenders = walk(SRC)
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.includes(`${join(SRC, 'test')}/`))
      .filter((f) => /<BudgetProvider[\s>]/.test(stripComments(readFileSync(f, 'utf8'))))
      .map((f) => f.slice(SRC.length + 1));
    expect(offenders).toEqual(['app/layout.tsx']);
    expect(layout().match(/<BudgetProvider[\s>]/g)).toHaveLength(1);
  });

  it('pages render only their page component, with no provider or wrapper', () => {
    const expected: Record<string, string> = {
      'app/page.tsx': 'OverviewPage',
      'app/spending/page.tsx': 'SpendingPage',
      'app/plan/page.tsx': 'PlanPage',
      'app/history/page.tsx': 'HistoryPage',
    };
    for (const [file, component] of Object.entries(expected)) {
      expect(stripComments(read(file)), file).toMatch(
        new RegExp(`return\\s*<${component}\\s*/>;`),
      );
    }
  });
});

describe('routes: static rendering', () => {
  it.each(SERVER_FILES)('%s uses no dynamic API (so next build prerenders it)', (file) => {
    const code = stripComments(read(file));
    expect(code).not.toMatch(/searchParams|next\/headers|\bcookies\b|\bheaders\(|\bconnection\b|\bnoStore\b|unstable_noStore/);
    expect(code).not.toMatch(/export\s+const\s+(dynamic|revalidate|fetchCache|runtime)\b/);
    expect(code).not.toMatch(/\bparams\b|async function/);
  });
});
