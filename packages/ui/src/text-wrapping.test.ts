import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Rule {
  selector: string;
  declarations: Map<string, string>;
}

function parseRules(css: string): Rule[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = new Map<string, string>();
    for (const part of (match[2] ?? '').split(';')) {
      const colon = part.indexOf(':');
      if (colon === -1) continue;
      declarations.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim());
    }
    rules.push({ selector: (match[1] ?? '').trim(), declarations });
  }
  return rules;
}

/** Declarations of every rule whose selector list contains `selector` (so ".hint, .error" matches ".hint"). */
function declarationsFor(css: string, selector: string): Map<string, string>[] {
  return parseRules(css)
    .filter((rule) => rule.selector.split(',').some((part) => part.trim() === selector))
    .map((rule) => rule.declarations);
}

function wraps(declarations: Map<string, string>): boolean {
  return declarations.get('overflow-wrap') === 'anywhere' || declarations.get('word-break') === 'break-word';
}

function hasMinWidthZero(declarations: Map<string, string>): boolean {
  return declarations.get('min-width') === '0';
}

/** Returns "<selector>" for each listed selector that is missing or no rule for it passes `test`. */
export function findFailures(
  css: string,
  selectors: string[],
  test: (declarations: Map<string, string>) => boolean,
): string[] {
  return selectors.filter((selector) => !declarationsFor(css, selector).some(test));
}

// Every rule that renders caller-supplied text. Table scrolls in its own region and is left out on purpose;
// Select and the TextField input are controls whose text the browser clips by design.
const MUST_WRAP: Array<[file: string, selectors: string[]]> = [
  ['Badge/Badge.module.css', ['.badge']],
  ['Button/Button.module.css', ['.label']],
  ['Card/Card.module.css', ['.title', '.description', '.body']],
  ['Dialog/Dialog.module.css', ['.title', '.body']],
  ['Field/Field.module.css', ['.label', '.hint', '.error']],
  ['NavBar/NavBar.module.css', ['.link']],
  ['ProgressBar/ProgressBar.module.css', ['.label', '.status']],
  ['Stat/Stat.module.css', ['.stat']],
  ['TextField/TextField.module.css', ['.prefix']],
];

// Flex or grid items that would otherwise refuse to shrink below their longest word.
const MUST_SHRINK: Array<[file: string, selectors: string[]]> = [
  ['Button/Button.module.css', ['.label']],
  ['Card/Card.module.css', ['.body', '.heading']],
  ['Dialog/Dialog.module.css', ['.title']],
  ['Field/Field.module.css', ['.field']],
  ['ProgressBar/ProgressBar.module.css', ['.label', '.status']],
  ['TextField/TextField.module.css', ['.prefix', '.input']],
];

const srcDir = import.meta.dirname;
const read = (file: string) => readFileSync(join(srcDir, file), 'utf8');

describe('long unbroken text wraps (task 13)', () => {
  it.each(MUST_WRAP)('%s: these rules declare overflow-wrap: anywhere %j', (file, selectors) => {
    const css = read(file);
    const missing = selectors.filter((selector) => declarationsFor(css, selector).length === 0);
    expect(missing, 'selector no longer exists: update the list').toEqual([]);
    expect(findFailures(css, selectors, wraps)).toEqual([]);
  });

  it.each(MUST_SHRINK)('%s: these flex or grid items declare min-width: 0 %j', (file, selectors) => {
    const css = read(file);
    const missing = selectors.filter((selector) => declarationsFor(css, selector).length === 0);
    expect(missing, 'selector no longer exists: update the list').toEqual([]);
    expect(findFailures(css, selectors, hasMinWidthZero)).toEqual([]);
  });

  it('the Stat visually hidden text keeps white-space: nowrap on purpose', () => {
    const [rule] = declarationsFor(read('Stat/Stat.module.css'), '.toneText');
    expect(rule?.get('white-space')).toBe('nowrap');
  });

  it('the check flags a rule without overflow-wrap and accepts a grouped selector', () => {
    const css = `/* .a { overflow-wrap: anywhere; } */ .a { color: red; } .b, .c { overflow-wrap: anywhere; }`;
    expect(findFailures(css, ['.a', '.b', '.c', '.gone'], wraps)).toEqual(['.a', '.gone']);
  });
});
