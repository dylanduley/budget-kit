import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// A rule whose outer size depends on the host's box-sizing reset must pin it itself.
const SIZE_PROPERTIES = ['width', 'min-width', 'max-width', 'height', 'min-height', 'max-height', 'flex-basis'];

// Rules that mix padding/border with a size but are the same in both modes. Key: "<file>:<selector>".
const ALLOWED = new Map<string, string>([
  ["Button/Button.module.css:.button[data-size='sm']", 'same element as .button, which sets box-sizing: border-box'],
]);

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

function isZero(value: string): boolean {
  return /^0(px|rem|em)?$/.test(value);
}

function addsBoxEdge(property: string, value: string): boolean {
  const isEdge = property === 'border' || property.startsWith('border-') || property.startsWith('padding');
  // Only widths and shorthands count here; colours, radii and styles do not add size.
  const isNonSize = /(color|radius|style|image|collapse|spacing)$/.test(property);
  if (!isEdge || isNonSize) return false;
  if (value === 'none') return false;
  // Shorthands such as "0 var(--x)" still add size on their non-zero side.
  return !value.split(/\s+/).every(isZero);
}

/** Selectors of rules that have padding or border plus a size, but no box-sizing. */
export function findUnpinnedRules(css: string): string[] {
  return parseRules(css)
    .filter(({ declarations }) => {
      const hasEdge = [...declarations].some(([property, value]) => addsBoxEdge(property, value));
      // A zero size (min-height: 0) is the same in both modes, so only non-zero sizes count.
      const hasSize = SIZE_PROPERTIES.some((property) => {
        const value = declarations.get(property);
        return value !== undefined && !isZero(value);
      });
      return hasEdge && hasSize && !declarations.has('box-sizing');
    })
    .map(({ selector }) => selector);
}

const srcDir = import.meta.dirname;
const moduleFiles = readdirSync(srcDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((dir) =>
    readdirSync(join(srcDir, dir.name))
      .filter((file) => file.endsWith('.module.css'))
      .map((file) => `${dir.name}/${file}`),
  );

describe('explicit box-sizing (task 11)', () => {
  it('finds the component CSS modules', () => {
    expect(moduleFiles.length).toBeGreaterThan(5);
  });

  it.each(moduleFiles)('%s: every rule with padding or border plus a size declares box-sizing', (file) => {
    const css = readFileSync(join(srcDir, file), 'utf8');
    const unpinned = findUnpinnedRules(css).filter((selector) => !ALLOWED.has(`${file}:${selector}`));
    expect(unpinned).toEqual([]);
  });

  it('the check flags the pre-fix TextField box, which had border, padding and min-height but no box-sizing', () => {
    const preFix = `.box { display: flex; min-height: var(--bk-space-10); padding: 0 var(--bk-space-3); border: 1px solid red; }`;
    expect(findUnpinnedRules(preFix)).toEqual(['.box']);
  });

  it('the check ignores zero padding and borders, comments and rules that pin box-sizing', () => {
    const css = `/* .a { width: 1px; padding: 4px; } */
      .b { width: 10px; padding: 0; border: 0; }
      .c { width: 10px; padding: 4px; box-sizing: border-box; }`;
    expect(findUnpinnedRules(css)).toEqual([]);
  });
});
