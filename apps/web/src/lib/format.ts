import { formatCents } from '@budget-kit/ui';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function formatMoney(cents: number): string {
  // NaN fails `< 0` and non-integers reach formatCents, which throws RangeError.
  if (cents < 0) return `-$${formatCents(-cents)}`;
  return `$${formatCents(cents)}`;
}

export function formatDate(date: string): string {
  if (!ISO_DATE.test(date)) throw new RangeError(`Not an ISO date: ${date}`);
  const month = parseInt(date.slice(5, 7), 10);
  const day = parseInt(date.slice(8, 10), 10);
  const name = SHORT_MONTHS[month - 1];
  if (name === undefined || day < 1) throw new RangeError(`Not an ISO date: ${date}`);
  return `${name} ${day}, ${date.slice(0, 4)}`;
}
