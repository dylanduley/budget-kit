import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { contrastPairs } from './tokens.pairs';

const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');
const tokens = new Map(Array.from(css.matchAll(/(--bk-[\w-]+):\s*([^;]+);/g), ([, name, value]) => [name, value]));

function resolveHex(name: string): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`Unknown token ${name}`);
  const reference = /^var\((--bk-[\w-]+)\)$/.exec(value);
  if (reference?.[1]) return resolveHex(reference[1]);
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} is not a 6-digit hex color: ${value}`);
  return value;
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [lighter = 0, darker = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('design tokens', () => {
  it.each(contrastPairs)('$text on $background meets $min:1', ({ text, background, min }) => {
    expect(contrast(resolveHex(text), resolveHex(background))).toBeGreaterThanOrEqual(min);
  });
});
