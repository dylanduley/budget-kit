import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@budget-kit/ui/tokens.css';
import './globals.css';

import { AppShell } from '@/features/shell/AppShell';
import { BudgetProvider } from '@/state/BudgetProvider';

export const metadata: Metadata = {
  title: { default: 'Budget Kit', template: '%s · Budget Kit' },
  description: 'A calm monthly budget planner.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BudgetProvider>
          <AppShell>{children}</AppShell>
        </BudgetProvider>
      </body>
    </html>
  );
}
