import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { contrastPairs } from '../tokens.pairs';

const css = readFileSync(join(import.meta.dirname, 'NavBar.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function rule(selector: string): Map<string, string> {
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if ((match[1] ?? '').trim() !== selector) continue;
    const declarations = new Map<string, string>();
    for (const part of (match[2] ?? '').split(';')) {
      const colon = part.indexOf(':');
      if (colon !== -1) declarations.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim());
    }
    return declarations;
  }
  return new Map();
}

const NAMED_COLOURS = ['red', 'green', 'blue', 'black', 'white', 'gray', 'grey', 'orange', 'yellow', 'purple', 'pink', 'teal', 'navy', 'currentcolor'];

describe('NavBar.module.css current-page marking is not colour alone', () => {
  const current = rule(".link[data-current='true']");
  const link = rule('.link');

  it("the [data-current='true'] rule exists", () => {
    expect(current.size).toBeGreaterThan(0);
  });

  it('the current rule sets a border-bottom colour from a token', () => {
    expect(current.get('border-bottom-color') ?? current.get('border-bottom')).toMatch(/var\(--bk-color-primary\)/);
  });

  it('the current rule sets a font-weight from a token', () => {
    expect(current.get('font-weight')).toMatch(/^var\(--bk-font-weight-/);
  });

  it('the current rule also changes the colour', () => {
    expect(current.get('color')).toMatch(/^var\(--bk-color-/);
  });

  it('non-current links have a transparent 2px border-bottom, the same width as the current one', () => {
    expect(link.get('border-bottom')).toMatch(/^2px solid transparent$/);
    // The current rule only recolours the border, so the width cannot differ.
    expect(current.get('border-bottom-width') ?? '').toBe('');
    const shorthand = current.get('border-bottom');
    if (shorthand !== undefined) expect(shorthand).toMatch(/^2px /);
  });
});

describe('NavBar.module.css uses tokens only', () => {
  it('has no hex, rgb(, hsl( or other colour functions', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i);
  });

  it('has no named colours in colour-bearing declarations', () => {
    const offenders: string[] = [];
    for (const match of css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)) {
      const [, prop = '', value = ''] = match;
      if (!/color|background|border|outline|shadow/.test(prop)) continue;
      const bare = value.replace(/var\([^)]*\)/g, '');
      for (const word of bare.split(/[\s,]+/)) {
        if (NAMED_COLOURS.includes(word.toLowerCase())) offenders.push(`${prop}: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every colour, spacing, radius, font and shadow value is a var(--bk-*)', () => {
    const props = /^(color|background|border-bottom-color|border-radius|font-size|font-weight|line-height|padding|gap|min-height|box-shadow)$/;
    const offenders: string[] = [];
    for (const match of css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)) {
      const [, prop = '', value = ''] = match;
      if (props.test(prop) && !/^(0|(var\(--bk-[a-z0-9-]+\)\s*)+)$/.test(value.trim())) offenders.push(`${prop}: ${value}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('tokens.pairs.ts covers the current-link border at 3:1', () => {
  it.each(['--bk-color-primary-subtle', '--bk-color-bg'])('--bk-color-primary on %s has min 3', (background) => {
    const pair = contrastPairs.find((p) => p.text === '--bk-color-primary' && p.background === background);
    expect(pair).toBeDefined();
    expect(pair?.min).toBe(3);
  });
});
