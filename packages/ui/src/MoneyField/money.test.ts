import { describe, expect, it } from 'vitest';

import { formatCents, parseMoney, type MoneyParseResult } from './money';

const ok = (cents: number | null): MoneyParseResult => ({ ok: true, cents });
const fail = (reason: 'invalid' | 'negative' | 'too-large'): MoneyParseResult => ({ ok: false, reason });

function expectSafeResult(input: string, result: MoneyParseResult): void {
  if (result.ok && result.cents !== null) {
    expect(Number.isSafeInteger(result.cents), `safe integer for ${JSON.stringify(input)}`).toBe(true);
    expect(Object.is(result.cents, -0), `not -0 for ${JSON.stringify(input)}`).toBe(false);
  }
}

describe('parseMoney: every row of the spec table', () => {
  const rows: [string, MoneyParseResult, { allowNegative?: boolean }?][] = [
    ['', ok(null)],
    ['   ', ok(null)],
    ['12', ok(1200)],
    ['12.5', ok(1250)],
    ['1,200.00', ok(120000)],
    ['.5', ok(50)],
    ['5.', ok(500)],
    ['0.07', ok(7)],
    ['0012', ok(1200)],
    [' 12 ', ok(1200)],
    ['$12', ok(1200)],
    ['12,345.6', ok(1234560)],
    ['1200', ok(120000)],
    ['1,200', ok(120000)],
    ['12.345', fail('invalid')],
    ['1,2,3', fail('invalid')],
    ['1,20', fail('invalid')],
    ['1,2345', fail('invalid')],
    [',123', fail('invalid')],
    ['.', fail('invalid')],
    ['-', fail('invalid')],
    ['$', fail('invalid')],
    ['abc', fail('invalid')],
    ['1e3', fail('invalid')],
    ['+5', fail('invalid')],
    ['1 200', fail('invalid')],
    ['12.5.1', fail('invalid')],
    ['$-5', fail('invalid')],
    ['１２', fail('invalid')],
    ['-5', fail('negative')],
    ['-5', ok(-500), { allowNegative: true }],
    ['-$1,200.5', ok(-120050), { allowNegative: true }],
    ['-0', ok(0)],
    ['-0.00', ok(0)],
    ['999999999999.99', ok(99999999999999)],
    ['1000000000000', fail('too-large')],
  ];

  it.each(rows)('parseMoney(%j, %j) returns the exact table result', (input, expected, options) => {
    const result = parseMoney(input, options);
    expect(result).toStrictEqual(expected);
    expectSafeResult(input, result);
  });

  it('"-0" and "-0.00" give 0 and never -0, with and without allowNegative', () => {
    for (const input of ['-0', '-0.00', '-$0', '-.0', '-0.', '-000']) {
      for (const allowNegative of [false, true]) {
        const result = parseMoney(input, { allowNegative });
        expect(result.ok, input).toBe(true);
        if (result.ok) expect(Object.is(result.cents, 0), `${input} allowNegative=${allowNegative}`).toBe(true);
      }
    }
  });
});

describe('formatCents', () => {
  it.each([
    [0, '0.00'],
    [5, '0.05'],
    [50, '0.50'],
    [1250, '12.50'],
    [120000, '1,200.00'],
    [123456789, '1,234,567.89'],
    [-500, '-5.00'],
    [-0, '0.00'],
  ])('formatCents(%j) is %j', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });

  it.each([12.5, NaN, Infinity, -Infinity, 0.1, Number.MAX_SAFE_INTEGER + 1, 1e21])(
    'formatCents(%j) throws RangeError',
    (cents) => {
      expect(() => formatCents(cents)).toThrow(RangeError);
    },
  );

  it('handles the extremes of the safe-integer range with exact digits', () => {
    expect(formatCents(Number.MAX_SAFE_INTEGER)).toBe('90,071,992,547,409.91');
    expect(formatCents(-Number.MAX_SAFE_INTEGER)).toBe('-90,071,992,547,409.91');
    expect(formatCents(99999999999999)).toBe('999,999,999,999.99');
    expect(formatCents(-1)).toBe('-0.01');
    expect(formatCents(100000)).toBe('1,000.00');
    expect(formatCents(99900)).toBe('999.00');
  });
});

describe('round trip: parseMoney(formatCents(cents)) returns the same cents', () => {
  const okInputs: [string, { allowNegative?: boolean }?][] = [
    ['12'],
    ['12.5'],
    ['1,200.00'],
    ['.5'],
    ['5.'],
    ['0.07'],
    ['0012'],
    [' 12 '],
    ['$12'],
    ['12,345.6'],
    ['1200'],
    ['1,200'],
    ['-5', { allowNegative: true }],
    ['-$1,200.5', { allowNegative: true }],
    ['-0'],
    ['999999999999.99'],
  ];

  it.each(okInputs)('%j survives format then parse', (input, options) => {
    const first = parseMoney(input, options);
    expect(first.ok).toBe(true);
    if (!first.ok || first.cents === null) throw new Error('expected non-empty ok result');
    const again = parseMoney(formatCents(first.cents), { allowNegative: true });
    expect(again).toStrictEqual(ok(first.cents));
  });

  it('holds for boundary cents values', () => {
    for (const cents of [0, 1, 9, 10, 99, 100, 101, 99999, 100000, 100001, 99999999999999, -1, -99999999999999]) {
      expect(parseMoney(formatCents(cents), { allowNegative: true }), String(cents)).toStrictEqual(ok(cents));
    }
  });
});

describe('parseMoney beyond the table: malformed input', () => {
  it.each([
    '--5',
    '-$-5',
    '$$5',
    '-$$5',
    '$-5',
    '$ 5',
    '- 5',
    '-\t5',
    '5-',
    '5$',
    '$5$',
    '+$5',
    '1\t200',
    '1\n200',
    '1\r\n2',
    '12\n.5',
    '1 2',
    '1 200',
    '1.2 3',
    '12 .5',
    '12. 5',
    '٣',
    '١٢',
    '１２.５',
    '12，5',
    '12．5',
    '1،200',
    '1,200,00',
    '1,200,',
    '1,',
    '1,.5',
    '12.5,0',
    '12.50,0',
    '1.000,00',
    '1.2,3',
    '.,5',
    ',.5',
    '1,2,3.00',
    '1,234,56',
    '12,34',
    '1234,567',
    '0x10',
    '1_000',
    '1e3',
    'Infinity',
    'NaN',
    '..5',
    '5..',
    '.5.',
    '$.',
    '-.',
    '-$',
    '-$.',
    '12.345',
    '0.001',
    '0.000',
    '1.999',
  ])('rejects %j as invalid', (input) => {
    for (const allowNegative of [false, true]) {
      expect(parseMoney(input, { allowNegative }), `${JSON.stringify(input)} allowNegative=${allowNegative}`).toStrictEqual(
        fail('invalid'),
      );
    }
  });

  it('never rounds or truncates a third decimal', () => {
    expect(parseMoney('0.995')).toStrictEqual(fail('invalid'));
    expect(parseMoney('0.994')).toStrictEqual(fail('invalid'));
    expect(parseMoney('12.000')).toStrictEqual(fail('invalid'));
  });

  it('trims surrounding tabs, newlines and spaces, but not inner ones', () => {
    expect(parseMoney('\t12\n')).toStrictEqual(ok(1200));
    expect(parseMoney(' \n\t ')).toStrictEqual(ok(null));
    expect(parseMoney('  -5  ')).toStrictEqual(fail('negative'));
    expect(parseMoney('  $ 5')).toStrictEqual(fail('invalid'));
  });
});

describe('parseMoney beyond the table: valid shapes', () => {
  it.each<[string, MoneyParseResult]>([
    ['0', ok(0)],
    ['0.0', ok(0)],
    ['0.00', ok(0)],
    ['.0', ok(0)],
    ['.00', ok(0)],
    ['0.', ok(0)],
    ['.07', ok(7)],
    ['.5', ok(50)],
    ['5.5', ok(550)],
    ['5.05', ok(505)],
    ['$.5', ok(50)],
    ['$5.', ok(500)],
    ['$0', ok(0)],
    ['$1,000', ok(100000)],
    ['999,999,999,999.99', ok(99999999999999)],
    ['999,999,999,999', ok(99999999999900)],
    ['1,000,000,000,000', fail('too-large')],
    ['999999999999', ok(99999999999900)],
    ['000000000000', ok(0)],
    ['0000000000000', ok(0)],
    ['0000000000012', ok(1200)],
    ['0001000000000000', fail('too-large')],
    ['0,001', ok(100)],
    ['00,001', ok(100)],
    ['000,001.50', ok(150)],
    ['0,000', ok(0)],
    ['012,345', ok(1234500)],
    ['1,000,000', ok(100000000)],
    ['0.01', ok(1)],
    ['0.10', ok(10)],
    ['0.1', ok(10)],
    ['00000.05', ok(5)],
  ])('parseMoney(%j)', (input, expected) => {
    const result = parseMoney(input);
    expect(result).toStrictEqual(expected);
    expectSafeResult(input, result);
  });
});

describe('parseMoney: exactly 12 and exactly 13 whole digits', () => {
  it('accepts 12 whole digits, with and without fraction and commas', () => {
    expect(parseMoney('123456789012')).toStrictEqual(ok(12345678901200));
    expect(parseMoney('123456789012.34')).toStrictEqual(ok(12345678901234));
    expect(parseMoney('123,456,789,012.3')).toStrictEqual(ok(12345678901230));
    expect(parseMoney('100000000000')).toStrictEqual(ok(10000000000000));
  });

  it('rejects 13 whole digits as too-large, with and without fraction and commas', () => {
    expect(parseMoney('1234567890123')).toStrictEqual(fail('too-large'));
    expect(parseMoney('1234567890123.45')).toStrictEqual(fail('too-large'));
    expect(parseMoney('1,234,567,890,123')).toStrictEqual(fail('too-large'));
    expect(parseMoney('1000000000000.00')).toStrictEqual(fail('too-large'));
    expect(parseMoney('$1000000000000')).toStrictEqual(fail('too-large'));
  });

  it('13 digits with a negative sign is too-large, not negative, in both modes', () => {
    expect(parseMoney('-1000000000000')).toStrictEqual(fail('too-large'));
    expect(parseMoney('-1000000000000', { allowNegative: true })).toStrictEqual(fail('too-large'));
  });

  it('12 whole digits negative: negative when disallowed, exact negation when allowed', () => {
    expect(parseMoney('-999999999999.99')).toStrictEqual(fail('negative'));
    expect(parseMoney('-999999999999.99', { allowNegative: true })).toStrictEqual(ok(-99999999999999));
  });

  it('very long digit strings are too-large and never reach NaN or Infinity', () => {
    const long = '9'.repeat(5000);
    expect(parseMoney(long)).toStrictEqual(fail('too-large'));
    expect(parseMoney(`${long}.99`)).toStrictEqual(fail('too-large'));
    expect(parseMoney(`-${long}`, { allowNegative: true })).toStrictEqual(fail('too-large'));
    expect(parseMoney(`$${long}`)).toStrictEqual(fail('too-large'));
  });

  it('very long runs of leading zeros still parse to the exact value', () => {
    expect(parseMoney(`${'0'.repeat(5000)}12`)).toStrictEqual(ok(1200));
    expect(parseMoney('0'.repeat(5000))).toStrictEqual(ok(0));
    expect(parseMoney(`${'0'.repeat(5000)}.5`)).toStrictEqual(ok(50));
  });

  it('very long invalid strings are invalid', () => {
    expect(parseMoney(`${'1'.repeat(5000)}x`)).toStrictEqual(fail('invalid'));
    expect(parseMoney(`1.${'0'.repeat(5000)}`)).toStrictEqual(fail('invalid'));
  });
});

describe('parseMoney: signs and negatives', () => {
  it('negative sign with each valid shape, not allowed', () => {
    for (const input of ['-5', '-$5', '-5.5', '-.5', '-5.', '-1,200', '-0.01', ' -5 ']) {
      expect(parseMoney(input), input).toStrictEqual(fail('negative'));
    }
  });

  it('negative sign with each valid shape, allowed', () => {
    const opts = { allowNegative: true };
    expect(parseMoney('-5', opts)).toStrictEqual(ok(-500));
    expect(parseMoney('-$5', opts)).toStrictEqual(ok(-500));
    expect(parseMoney('-.5', opts)).toStrictEqual(ok(-50));
    expect(parseMoney('-5.', opts)).toStrictEqual(ok(-500));
    expect(parseMoney('-1,200', opts)).toStrictEqual(ok(-120000));
    expect(parseMoney('-0.01', opts)).toStrictEqual(ok(-1));
    expect(parseMoney(' -5 ', opts)).toStrictEqual(ok(-500));
  });

  it('allowNegative: false and undefined options behave the same', () => {
    expect(parseMoney('-5', { allowNegative: false })).toStrictEqual(fail('negative'));
    expect(parseMoney('-5', {})).toStrictEqual(fail('negative'));
    expect(parseMoney('-5', undefined)).toStrictEqual(fail('negative'));
  });

  it('allowNegative does not make positives negative or change invalid results', () => {
    expect(parseMoney('5', { allowNegative: true })).toStrictEqual(ok(500));
    expect(parseMoney('abc', { allowNegative: true })).toStrictEqual(fail('invalid'));
    expect(parseMoney('-', { allowNegative: true })).toStrictEqual(fail('invalid'));
    expect(parseMoney('--5', { allowNegative: true })).toStrictEqual(fail('invalid'));
  });
});

describe('parseMoney: exhaustive small alphabet never yields an unsafe, NaN or -0 cents', () => {
  const alphabet = ['0', '1', '9', ',', '.', '-', '$', ' ', '\t', 'a'];

  function* strings(maxLength: number): Generator<string> {
    yield '';
    let layer = [''];
    for (let length = 1; length <= maxLength; length += 1) {
      const next: string[] = [];
      for (const prefix of layer) for (const char of alphabet) next.push(prefix + char);
      for (const value of next) yield value;
      layer = next;
    }
  }

  it.each([false, true])('invariants hold for every string up to length 5 (allowNegative=%j)', (allowNegative) => {
    let okCount = 0;
    for (const input of strings(5)) {
      const result = parseMoney(input, { allowNegative });
      if (result.ok) {
        if (result.cents === null) {
          expect(input.trim(), JSON.stringify(input)).toBe('');
        } else {
          okCount += 1;
          expect(Number.isSafeInteger(result.cents), JSON.stringify(input)).toBe(true);
          expect(Object.is(result.cents, -0), JSON.stringify(input)).toBe(false);
          if (!allowNegative) expect(result.cents, JSON.stringify(input)).toBeGreaterThanOrEqual(0);
          expect(parseMoney(formatCents(result.cents), { allowNegative: true }), JSON.stringify(input)).toStrictEqual(
            ok(result.cents),
          );
        }
      } else {
        expect(['invalid', 'negative', 'too-large']).toContain(result.reason);
      }
    }
    expect(okCount).toBeGreaterThan(100);
  });
});

describe('source rule: no float parsing of user text', () => {
  it('money.ts and MoneyField.tsx contain no parseFloat, toFixed or Number( calls', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    for (const file of ['money.ts', 'MoneyField.tsx']) {
      const source = readFileSync(join(import.meta.dirname, file), 'utf8');
      expect(source, file).not.toMatch(/parseFloat|toFixed|\bNumber\(/);
    }
  });
});
