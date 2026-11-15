export type MoneyParseResult =
  | { ok: true; cents: number | null }
  | { ok: false; reason: 'invalid' | 'negative' | 'too-large' };

const AMOUNT_PATTERN = /^(\d+|\d{1,3}(,\d{3})+)?(\.\d{0,2})?$/;
const MAX_WHOLE_DIGITS = 12;

// Accumulates digit by digit so no user text is ever handed to a number parser.
function digitsToInteger(digits: string): number {
  let total = 0;
  for (const char of digits) {
    total = total * 10 + (char.charCodeAt(0) - 48);
  }
  return total;
}

export function parseMoney(input: string, options?: { allowNegative?: boolean }): MoneyParseResult {
  let rest = input.trim();
  if (rest === '') return { ok: true, cents: null };

  let negated = false;
  if (rest.startsWith('-')) {
    negated = true;
    rest = rest.slice(1);
  }
  if (rest.startsWith('$')) rest = rest.slice(1);

  if (!AMOUNT_PATTERN.test(rest) || !/[0-9]/.test(rest)) return { ok: false, reason: 'invalid' };

  const dot = rest.indexOf('.');
  const wholeText = dot === -1 ? rest : rest.slice(0, dot);
  const fractionText = dot === -1 ? '' : rest.slice(dot + 1);

  const whole = wholeText.replaceAll(',', '').replace(/^0+/, '');
  if (whole.length > MAX_WHOLE_DIGITS) return { ok: false, reason: 'too-large' };

  const cents = digitsToInteger(whole + fractionText.padEnd(2, '0'));

  if (negated && cents > 0) {
    return options?.allowNegative ? { ok: true, cents: -cents } : { ok: false, reason: 'negative' };
  }
  return { ok: true, cents };
}

/** Integer cents -> "1,200.00". Throws RangeError unless Number.isSafeInteger(cents). */
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError('formatCents expects a safe integer number of cents');
  }
  if (cents === 0) return '0.00';

  const abs = Math.abs(cents);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+$)/g, ',');
  const fraction = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${whole}.${fraction}`;
}
