import { BudgetApp } from '@/features/BudgetApp';
import { BudgetProvider } from '@/state/BudgetProvider';

export default function HomePage() {
  return (
    <BudgetProvider>
      <BudgetApp />
    </BudgetProvider>
  );
}
