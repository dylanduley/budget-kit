import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { resetTestNavigation } from '@/test/nextNavigation';

vi.mock('next/navigation', async () => {
  const mock = await import('@/test/nextNavigation');
  return { usePathname: mock.usePathname, useRouter: mock.useRouter };
});
vi.mock('next/link', async () => {
  const mock = await import('@/test/nextNavigation');
  return { default: mock.MockLink };
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  resetTestNavigation();
});
