import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@budget-kit/ui/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Budget Kit',
  description: 'A calm, one-month budget planner.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
