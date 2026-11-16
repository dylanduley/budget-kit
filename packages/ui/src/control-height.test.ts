import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const srcDir = import.meta.dirname;

function read(file: string): string {
  return readFileSync(join(srcDir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Declarations of every rule whose selector list contains exactly `selector`. */
function declarationsFor(css: string, selector: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (match[1] ?? '').split(',').map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    for (const part of (match[2] ?? '').split(';')) {
      const colon = part.indexOf(':');
      if (colon === -1) continue;
      found.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim());
    }
  }
  return found;
}

const button = read('Button/Button.module.css');
const textField = read('TextField/TextField.module.css');
const select = read('Select/Select.module.css');
const tokens = read('tokens.css');

describe('control height contract (task 21)', () => {
  it("Button [data-size='md'] declares min-height: var(--bk-control-height)", () => {
    expect(declarationsFor(button, ".button[data-size='md']").get('min-height')).toBe('var(--bk-control-height)');
  });

  it('TextField .box declares min-height: var(--bk-control-height)', () => {
    expect(declarationsFor(textField, '.box').get('min-height')).toBe('var(--bk-control-height)');
  });

  it('Select .select declares min-height: var(--bk-control-height)', () => {
    expect(declarationsFor(select, '.select').get('min-height')).toBe('var(--bk-control-height)');
  });

  it("Button [data-size='sm'] declares min-height: var(--bk-control-height-sm)", () => {
    expect(declarationsFor(button, ".button[data-size='sm']").get('min-height')).toBe('var(--bk-control-height-sm)');
  });

  it.each([
    ['Button base .button (shared by md and sm)', button, '.button'],
    ['TextField .box', textField, '.box'],
    ['Select .select', select, '.select'],
  ])('%s declares box-sizing: border-box', (_name, css, selector) => {
    expect(declarationsFor(css, selector).get('box-sizing')).toBe('border-box');
  });

  it('no Button size rule switches box-sizing away from border-box', () => {
    for (const selector of [".button[data-size='md']", ".button[data-size='sm']"]) {
      const value = declarationsFor(button, selector).get('box-sizing');
      expect(value === undefined || value === 'border-box').toBe(true);
    }
  });

  it('tokens.css defines --bk-control-height as var(--bk-space-10)', () => {
    expect(declarationsFor(tokens, ':root').get('--bk-control-height')).toBe('var(--bk-space-10)');
  });

  it('tokens.css defines --bk-control-height-sm as var(--bk-space-8)', () => {
    expect(declarationsFor(tokens, ':root').get('--bk-control-height-sm')).toBe('var(--bk-space-8)');
  });

  it('the referenced spacing tokens are still 40px (2.5rem) and 32px (2rem)', () => {
    const root = declarationsFor(tokens, ':root');
    expect(root.get('--bk-space-10')).toBe('2.5rem');
    expect(root.get('--bk-space-8')).toBe('2rem');
  });
});
