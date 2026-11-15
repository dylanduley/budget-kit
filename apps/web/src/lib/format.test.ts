import { describe, expect, it } from 'vitest';
import { MAX_CENTS } from './budget';
import { formatDate, formatMoney } from './format';

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('formatMoney', () => {
  it.each([
    [0, '$0.00'],
    [-0, '$0.00'],
    [7, '$0.07'],
    [150518, '$1,505.18'],
    [-27000, '-$270.00'],
    [99999999999999, '$999,999,999,999.99'],
  ])('formats %s as %s', (cents, text) => {
    expect(formatMoney(cents)).toBe(text);
  });

  it('puts the minus before the dollar sign for every negative, including one cent', () => {
    expect(formatMoney(-1)).toBe('-$0.01');
    expect(formatMoney(-99)).toBe('-$0.99');
    expect(formatMoney(-100)).toBe('-$1.00');
    expect(formatMoney(-150518)).toBe('-$1,505.18');
    expect(formatMoney(-MAX_CENTS)).toBe('-$999,999,999,999.99');
  });

  it('groups thousands and keeps two fraction digits at boundaries', () => {
    expect(formatMoney(99)).toBe('$0.99');
    expect(formatMoney(100)).toBe('$1.00');
    expect(formatMoney(100000)).toBe('$1,000.00');
    expect(formatMoney(99999999)).toBe('$999,999.99');
    expect(formatMoney(100000000)).toBe('$1,000,000.00');
    expect(formatMoney(MAX_CENTS)).toBe('$999,999,999,999.99');
  });

  it.each([12.5, -12.5, 0.1, NaN, Infinity, -Infinity])('throws RangeError for %s', (value) => {
    expect(thrown(() => formatMoney(value))).toBeInstanceOf(RangeError);
  });
});

describe('formatDate', () => {
  it.each([
    ['2026-11-05', 'Nov 5, 2026'],
    ['2026-01-31', 'Jan 31, 2026'],
    ['2026-12-01', 'Dec 1, 2026'],
  ])('formats %s as %s', (date, text) => {
    expect(formatDate(date)).toBe(text);
  });

  it('uses the fixed English short name for each of the twelve months and no leading zero on the day', () => {
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    names.forEach((name, index) => {
      const month = String(index + 1).padStart(2, '0');
      expect(formatDate(`2027-${month}-01`)).toBe(`${name} 1, 2027`);
      expect(formatDate(`2027-${month}-09`)).toBe(`${name} 9, 2027`);
      expect(formatDate(`2027-${month}-10`)).toBe(`${name} 10, 2027`);
    });
  });

  it('keeps the four-digit year as given', () => {
    expect(formatDate('1900-02-28')).toBe('Feb 28, 1900');
    expect(formatDate('2000-02-29')).toBe('Feb 29, 2000');
  });
});

describe('behaviour the task does not specify', () => {
  it.each(['', '2026-1-5', ' 2026-11-14', '2026-11-14T00:00', '2026-13-01', '2026-00-10', '2026-11-00', '２０２６-11-14', '2026-11-14\n'])(
    'formatDate throws RangeError for %j (shape, month 1-12 and day >= 1 are checked)',
    (value) => {
      expect(thrown(() => formatDate(value))).toBeInstanceOf(RangeError);
    },
  );

  it('formatDate does not check that the day exists in that month', () => {
    expect(formatDate('2026-02-30')).toBe('Feb 30, 2026');
    expect(formatDate('2026-04-31')).toBe('Apr 31, 2026');
    expect(formatDate('2026-11-99')).toBe('Nov 99, 2026');
  });
});
