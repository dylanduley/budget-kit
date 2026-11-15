import type { Metadata } from 'next';

import { OverviewPage } from '@/features/overview/OverviewPage';

export const metadata: Metadata = { title: { absolute: 'Overview · Budget Kit' } };

export default function OverviewRoute() {
  return <OverviewPage />;
}
