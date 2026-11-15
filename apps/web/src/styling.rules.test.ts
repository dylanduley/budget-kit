import { screen } from '@testing-library/react';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SCENARIO } from '@/test/fixtures';
import { renderApp } from '@/test/renderApp';

const SRC = join(import.meta.dirname);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const allFiles = walk(SRC);
const isTest = (file: string): boolean => /\.test\.tsx?$/.test(file);
const rel = (file: string): string => relative(SRC, file).split('\\').join('/');
const codeFiles = allFiles.filter((f) => /\.tsx?$/.test(f) && !isTest(f));
const featureFiles = codeFiles.filter((f) => rel(f).startsWith('features/'));
const read = (file: string): string => readFileSync(file, 'utf8');
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

function lineOf(code: string, index: number): number {
  return code.slice(0, index).split('\n').length;
}

describe('the scan sees the app', () => {
  it('finds the screens, the shell and the state files', () => {
    const names = codeFiles.map(rel);
    for (const expected of [
      'features/shell/AppShell.tsx',
      'features/overview/OverviewPage.tsx',
      'features/spending/SpendingPage.tsx',
      'features/plan/PlanPage.tsx',
      'features/history/HistoryPage.tsx',
      'features/dashboard/Dashboard.tsx',
      'features/expenses/AddExpense.tsx',
      'features/expenses/ExpenseList.tsx',
      'features/setup/MonthSetup.tsx',
      'state/BudgetProvider.tsx',
      'app/layout.tsx',
    ]) {
      expect(names).toContain(expected);
    }
    expect(names.some((n) => n.endsWith('.test.tsx'))).toBe(false);
  });
});

describe('every MoneyField has a label ending in (USD)', () => {
  it('source: each <MoneyField> has a label ending " (USD)"', () => {
    let found = 0;
    for (const file of codeFiles) {
      const code = stripComments(read(file));
      for (const match of code.matchAll(/<MoneyField\b/g)) {
        found += 1;
        const start = match.index ?? 0;
        // Every MoneyField here closes with "/>" after its props.
        const end = code.indexOf('/>', start);
        const tag = code.slice(start, end);
        expect(tag, `${rel(file)}:${lineOf(code, start)}`).toMatch(/\blabel=(?:"[^"]* \(USD\)"|\{`[^`]* \(USD\)`\})/);
      }
    }
    expect(found).toBeGreaterThanOrEqual(4);
  });

  it('populated state: every money textbox is named "... (USD)" and the others are name/note fields', () => {
    renderApp({ state: SCENARIO, path: '/plan' });
    const boxes = screen.getAllByRole('textbox');
    const money = boxes.filter((b) => b.getAttribute('inputmode') === 'decimal');
    expect(money.length).toBe(1 + SCENARIO.categories.length + 1);
    for (const box of money) expect(box).toHaveAccessibleName(/ \(USD\)$/);
    for (const box of boxes.filter((b) => !money.includes(b))) {
      expect(box.getAttribute('aria-label') ?? (box as HTMLInputElement).labels?.[0]?.textContent ?? '').not.toMatch(/USD/);
    }
    expect(money.map((b) => (b as HTMLInputElement).labels?.[0]?.textContent)).toEqual([
      'Monthly income (USD)',
      'Category 1 planned (USD)',
      'Category 2 planned (USD)',
      'Category 3 planned (USD)',
      'Category 4 planned (USD)',
      'Category 5 planned (USD)',
      'New category planned (USD)',
    ]);
  });
});

describe('alerts and live regions', () => {
  it('the only role="alert" is <p role="alert" data-part="action-error">', () => {
    let found = 0;
    for (const file of codeFiles) {
      const code = stripComments(read(file));
      for (const match of code.matchAll(/role\s*[=:]\s*\{?\s*['"]alert['"]/g)) {
        found += 1;
        const at = match.index ?? 0;
        const open = code.lastIndexOf('<', at);
        const close = code.indexOf('>', at);
        const tag = code.slice(open, close + 1);
        const where = `${rel(file)}:${lineOf(code, at)}`;
        expect(tag.startsWith('<p\n') || tag.startsWith('<p '), `${where} must be on a <p>`).toBe(true);
        expect(tag, where).toMatch(/data-part="action-error"/);
      }
    }
    expect(found).toBeGreaterThanOrEqual(4);
  });

  it('there is no role="status" and no aria-live', () => {
    for (const file of codeFiles) {
      const code = stripComments(read(file));
      expect(code, rel(file)).not.toMatch(/role\s*[=:]\s*\{?\s*['"]status['"]/);
      expect(code, rel(file)).not.toMatch(/aria-live|ariaLive/);
    }
  });
});

function matchingBrace(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '{') depth += 1;
    else if (code[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

describe('every action call is in a try whose catch shows a message', () => {
  it('each actions.<name>( call in features/ is inside a try block followed by a catch that sets or returns a message', () => {
    let calls = 0;
    for (const file of featureFiles) {
      const code = stripComments(read(file));
      const tries = Array.from(code.matchAll(/\btry\s*\{/g)).map((m) => {
        const open = code.indexOf('{', m.index ?? 0);
        const close = matchingBrace(code, open);
        const rest = code.slice(close + 1);
        const catchMatch = /^\s*catch\s*(?:\(\s*\w+(?:\s*:\s*\w+)?\s*\))?\s*\{/.exec(rest);
        const catchOpen = catchMatch === null ? -1 : close + 1 + catchMatch[0].length - 1;
        const catchClose = catchOpen < 0 ? -1 : matchingBrace(code, catchOpen);
        return { open, close, catchBody: catchOpen < 0 ? null : code.slice(catchOpen, catchClose + 1) };
      });
      for (const match of code.matchAll(/\bactions\.(\w+)\(/g)) {
        calls += 1;
        const at = match.index ?? 0;
        const where = `${rel(file)}:${lineOf(code, at)} actions.${match[1]}`;
        const enclosing = tries.find((t) => at > t.open && at < t.close);
        expect(enclosing, `${where} is not inside a try block`).toBeDefined();
        expect(enclosing?.catchBody, `${where}: try has no catch`).not.toBeNull();
        expect(enclosing?.catchBody ?? '', `${where}: catch shows no message`).toMatch(/\bset[A-Z]\w*\(|\breturn\b/);
      }
    }
    // setIncome, updateCategory x2, removeCategory, addCategory, addExpense, deleteExpense.
    expect(calls).toBeGreaterThanOrEqual(7);
  });

  it('actions are never destructured or aliased (which would hide a call from the check)', () => {
    for (const file of featureFiles) {
      const code = stripComments(read(file));
      expect(code, rel(file)).not.toMatch(/\{[^{}]*\b(setIncome|addCategory|updateCategory|removeCategory|addExpense|deleteExpense|deleteAllData)\b[^{}]*\}\s*=\s*(?:\w+\.)?actions\b/);
      expect(code, rel(file)).not.toMatch(/=\s*(?:\w+\.)?actions\.\w+\s*[;,)]/);
    }
  });
});

describe('no native controls, style props or style tooling', () => {
  const FORBIDDEN: [string, RegExp][] = [
    ['<button', /<button/],
    ['<input', /<input/],
    ['<select', /<select/],
    ['<textarea', /<textarea/],
    ['<table', /<table/],
    ['<dialog', /<dialog/],
    ['<a', /<a[\s>]/],
    ['style=', /style=/],
    ['styled(', /styled\(/],
    ['.module.css', /\.module\.css/],
    ['@apply', /@apply/],
  ];

  it.each(FORBIDDEN)('no match for %s in any non-test file under src', (_label, pattern) => {
    for (const file of allFiles.filter((f) => !isTest(f) && /\.(tsx?|css|mdx?)$/.test(f))) {
      const code = read(file);
      expect(pattern.test(code), `${rel(file)} contains ${pattern}`).toBe(false);
    }
  });

  it('the rules do see markup (a sample with a native button matches)', () => {
    expect(FORBIDDEN.some(([, p]) => p.test('<button type="button">x</button>'))).toBe(true);
    expect(FORBIDDEN.some(([, p]) => p.test('<p style={{ color: "red" }}>x</p>'))).toBe(true);
  });
});

describe('css files', () => {
  it('no .css under src except app/globals.css', () => {
    expect(allFiles.filter((f) => f.endsWith('.css')).map(rel)).toEqual(['app/globals.css']);
  });

  it('globals.css is byte-identical to the scaffold commit (no new rules)', () => {
    // a06b838 is the only commit that ever touched the file, and main still has that version.
    const committed = execFileSync('git', ['show', 'a06b838:apps/web/src/app/globals.css'], {
      cwd: SRC,
      encoding: 'utf8',
    });
    expect(read(join(SRC, 'app', 'globals.css'))).toBe(committed);
  });
});

describe('className values', () => {
  const LAYOUT =
    /^(?:sm:)?(?:flex(?:-[a-z0-9]+)?|inline-flex|grid(?:-[a-z0-9]+)*|gap(?:-[xy])?-[\w.]+|p[xytblr]?-[\w.]+|m[xytblr]?-[\w.]+|max-w-\w+|w-full|items-[\w-]+|justify-[\w-]+|list-none)$/;
  const TYPOGRAPHY = /^(?:text-2xl|font-semibold|text-text|text-text-muted)$/;
  const LIBRARY = /^(?:w-full|self-[\w-]+|justify-self-[\w-]+|col-span-[\w-]+)$/;
  const TEXT_TAGS = new Set(['h1', 'h3', 'p']);

  function allowed(tag: string, cls: string): boolean {
    if (/^[A-Z]/.test(tag)) return LIBRARY.test(cls);
    if (LAYOUT.test(cls)) return true;
    return TEXT_TAGS.has(tag) && TYPOGRAPHY.test(cls);
  }

  function elementNameAt(code: string, at: number): string {
    const open = code.lastIndexOf('<', at);
    return /^<([A-Za-z][\w.]*)/.exec(code.slice(open))?.[1] ?? '';
  }

  it('every className is a literal (or a top-level string constant) made only of allowed classes', () => {
    let seen = 0;
    for (const file of codeFiles) {
      const code = stripComments(read(file));
      const constants = new Map<string, string>();
      for (const m of code.matchAll(/^const (\w+)\s*=\s*'([^']*)';/gm)) constants.set(m[1] ?? '', m[2] ?? '');
      for (const match of code.matchAll(/\bclassName\s*=\s*(?:"([^"]*)"|\{\s*(\w+)\s*\}|(\{[^}]*\}))/g)) {
        seen += 1;
        const at = match.index ?? 0;
        const where = `${rel(file)}:${lineOf(code, at)}`;
        let value = match[1];
        if (value === undefined && match[2] !== undefined) value = constants.get(match[2]);
        expect(value, `${where}: className must be a string literal or a top-level string constant`).toBeDefined();
        const tag = elementNameAt(code, at);
        for (const cls of (value ?? '').split(/\s+/).filter(Boolean)) {
          expect(allowed(tag, cls), `${where}: "${cls}" is not allowed on <${tag}>`).toBe(true);
        }
      }
      expect(code, rel(file)).not.toMatch(/\bclass=|\bclassName\s*=\s*\{\s*`|\bclsx\(|\bcx\(/);
    }
    expect(seen).toBeGreaterThan(15);
  });

  it('the className classifier rejects what the conventions forbid', () => {
    expect(allowed('Button', 'self-start')).toBe(true);
    expect(allowed('Button', 'bg-red-500')).toBe(false);
    expect(allowed('Button', 'p-4')).toBe(false);
    expect(allowed('div', 'text-2xl')).toBe(false);
    expect(allowed('div', 'bg-red-500')).toBe(false);
    expect(allowed('div', 'self-start')).toBe(false);
    expect(allowed('p', 'text-text-muted')).toBe(true);
    expect(allowed('ul', 'grid-cols-1')).toBe(true);
    expect(allowed('ul', 'sm:grid-cols-2')).toBe(true);
    expect(allowed('li', 'rounded')).toBe(false);
  });
});

describe('money and dates', () => {
  const PATTERNS: [string, RegExp][] = [
    ['parseFloat', /parseFloat/],
    ['toFixed', /toFixed/],
    ['* 100', /\*\s*100\b/],
    ['/ 100', /\/\s*100\b/],
    ['Math.round', /Math\.round/],
    ['new Date(', /new Date\(/],
  ];

  it.each(PATTERNS)('no %s outside lib/clock.ts', (_label, pattern) => {
    for (const file of codeFiles) {
      if (rel(file) === 'lib/clock.ts') continue;
      expect(pattern.test(read(file)), `${rel(file)} contains ${pattern}`).toBe(false);
    }
  });
});

describe('blanket: no any or suppression comments', () => {
  it('no @ts-ignore, @ts-expect-error, @ts-nocheck or any in non-test files', () => {
    for (const file of codeFiles) {
      const raw = read(file);
      expect(raw, rel(file)).not.toMatch(/@ts-(ignore|expect-error|nocheck)/);
      expect(stripComments(raw), rel(file)).not.toMatch(/:\s*any\b|<any\b|\bas any\b|\bany\[\]|Array<any>|\bunknown as\b.*\bany\b/);
    }
  });
});
