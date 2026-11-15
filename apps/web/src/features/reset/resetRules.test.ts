import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', '..');
const FILES = ['features/reset/ResetMonthDialog.tsx', 'features/reset/ResetMonth.tsx', 'features/reset/MonthNotice.tsx'];
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');

const ALLOWED_CLASS =
  /^(flex|flex-(row|col|wrap)|grid|grid-cols-\d+|gap(-[xy])?-\d+|p[xytblr]?-\d+|m[xytblr]?-\d+|max-w-\w+|w-full|items-\w+|justify-\w+|list-none|text-2xl|font-semibold|text-text|text-text-muted)$/;
const stripVariant = (token: string): string => token.replace(/^sm:/, '');

function parse(path: string): ts.SourceFile {
  return ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function visit(node: ts.Node, fn: (n: ts.Node) => void): void {
  fn(node);
  ts.forEachChild(node, (child) => visit(child, fn));
}

describe('forbidden constructs', () => {
  it.each(FILES)('%s has no native controls, style prop, any, or ts suppressions', (file) => {
    const sf = parse(file);
    visit(sf, (n) => {
      if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
        const tag = n.tagName.getText(sf);
        expect(['button', 'input', 'select', 'textarea', 'table', 'dialog']).not.toContain(tag);
        for (const attr of n.attributes.properties) {
          if (ts.isJsxAttribute(attr)) expect(attr.name.getText(sf)).not.toBe('style');
        }
      }
      expect(n.kind).not.toBe(ts.SyntaxKind.AnyKeyword);
    });
    expect(read(file)).not.toMatch(/@ts-ignore|@ts-expect-error|aria-live|role="status"/);
  });

  it.each(FILES)('%s imports only from @budget-kit/ui and @/ aliases or react', (file) => {
    const sf = parse(file);
    visit(sf, (n) => {
      if (ts.isImportDeclaration(n)) {
        const spec = (n.moduleSpecifier as ts.StringLiteral).text;
        expect(spec).toMatch(/^(react|@budget-kit\/ui|@\/.+)$/);
      }
    });
  });

  it.each(FILES)('%s starts with use client', (file) => {
    expect(read(file).startsWith("'use client';")).toBe(true);
  });

  it('role="alert" appears only as the single data-part="action-error" paragraph', () => {
    const all = FILES.map(read).join('\n');
    expect(all.match(/role="alert"/g)).toHaveLength(1);
    expect(all).toMatch(/<p role="alert" data-part="action-error">/);
  });
});

describe('Tailwind only for layout and typography on plain elements', () => {
  it.each(FILES)('%s', (file) => {
    const sf = parse(file);
    visit(sf, (n) => {
      if (!ts.isJsxAttribute(n) || n.name.getText(sf) !== 'className') return;
      const element = n.parent.parent as ts.JsxOpeningElement | ts.JsxSelfClosingElement;
      const tag = element.tagName.getText(sf);
      // Library components may only take w-full, self-*, justify-self-*, col-span-*.
      const isLibrary = /^[A-Z]/.test(tag);
      const init = n.initializer;
      const value = init !== undefined && ts.isStringLiteral(init) ? init.text : null;
      expect(value, `${tag} className must be a string literal`).not.toBeNull();
      for (const token of value!.split(/\s+/).filter(Boolean)) {
        if (isLibrary) expect(token, `${tag}`).toMatch(/^(w-full|self-\w+|justify-self-\w+|col-span-\w+)$/);
        else expect(stripVariant(token), `${tag}`).toMatch(ALLOWED_CLASS);
      }
    });
  });
});

describe('every actions.* call is inside try/catch', () => {
  it.each(FILES)('%s', (file) => {
    const sf = parse(file);
    let calls = 0;
    visit(sf, (n) => {
      if (!ts.isCallExpression(n)) return;
      const callee = n.expression.getText(sf);
      if (!/(^|\.)actions\.\w+$/.test(callee)) return;
      calls += 1;
      let inTry = false;
      for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
        if (ts.isTryStatement(p) && p.catchClause !== undefined && n.pos >= p.tryBlock.pos && n.end <= p.tryBlock.end) inTry = true;
      }
      expect(inTry, `${callee} in ${file}`).toBe(true);
    });
    if (file.endsWith('ResetMonthDialog.tsx')) expect(calls).toBe(1);
  });
});

describe('BudgetApp lines for task 07', () => {
  const app = read('features/BudgetApp.tsx');

  it('imports both components through the alias', () => {
    expect(app).toContain("import { MonthNotice } from '@/features/reset/MonthNotice';");
    expect(app).toContain("import { ResetMonth } from '@/features/reset/ResetMonth';");
  });

  it('keeps the README order, notice first below the heading block and ResetMonth last', () => {
    const order = ['<MonthNotice />', '<Dashboard />', '<AddExpense />', '<ExpenseList />', '<MonthSetup', '<ResetMonth />'];
    const positions = order.map((tag) => app.indexOf(tag)).filter((i) => i !== -1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(app.indexOf('<MonthNotice />')).toBeGreaterThan(app.indexOf('</div>'));
    const last = app.indexOf('<ResetMonth />');
    expect(last).toBeGreaterThan(-1);
    expect(app.slice(last).replace('<ResetMonth />', '').trim().startsWith('</main>')).toBe(true);
  });
});
