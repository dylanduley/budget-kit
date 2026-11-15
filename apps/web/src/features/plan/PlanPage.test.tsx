import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SCENARIO } from '@/test/fixtures';
import { renderApp } from '@/test/renderApp';

describe('Plan page', () => {
  it('has the h1 Plan', () => {
    renderApp({ state: SCENARIO, path: '/plan' });
    expect(screen.getByRole('heading', { level: 1, name: 'Plan' })).toBeInTheDocument();
  });

  it('typing 3200 in Monthly income (USD) stores income 320000', async () => {
    const { user, readStored } = renderApp({ path: '/plan' });
    await user.type(screen.getByRole('textbox', { name: 'Monthly income (USD)' }), '3200');
    expect(readStored()?.incomeCents).toBe(320000);
    expect(Number.isInteger(readStored()?.incomeCents)).toBe(true);
  });
});
