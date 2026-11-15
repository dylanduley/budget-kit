import { TOTAL_TOO_LARGE_MESSAGE } from '@/state/BudgetProvider';

export const GENERIC_ERROR = 'Something went wrong. Your budget was not changed.';

export function actionMessage(error: unknown): string {
  return error instanceof RangeError && error.message === TOTAL_TOO_LARGE_MESSAGE
    ? TOTAL_TOO_LARGE_MESSAGE
    : GENERIC_ERROR;
}

export function draftFromCents(cents: number): number | null {
  return cents === 0 ? null : cents;
}
