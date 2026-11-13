# App brief: budget planner (apps/web)

A one-month budget planner. No accounts; data saved in the browser (localStorage). Built only with `@budget-kit/ui` components.

## Who it's for
Someone who wants a quick, calm view of "how much do I have left this month?" without connecting a bank.

## Features (in build order)
1. **Set up the month**: monthly income (MoneyField), and categories with a planned amount (e.g. Rent, Groceries, Transport). Start with 5 suggested categories that can be edited or removed.
2. **Add expenses**: amount, category, note, date. Opened from a button in a Dialog.
3. **Dashboard**:
   - Stats: income, planned, spent, left to spend
   - Each category: ProgressBar (spent vs planned), Badge when over budget
   - "Unplanned money": income minus planned (warn if negative)
4. **Expense list**: Table of this month's expenses, newest first, with delete. Empty state when none.
5. **Persistence**: everything survives a refresh; a "Reset month" action with confirmation Dialog.

## Rules
- All money in integer cents; all budget math in `src/lib/budget.ts` as pure functions.
- Works on a phone (single column below 640px).
- Accessible: everything keyboard-usable, over-budget never shown by color alone.

## Acceptance (whole app)
- [ ] A new user can set income and categories, add 3 expenses, and see correct totals without reading instructions
- [ ] Totals are correct to the cent, including overspending and deleting an expense
- [ ] Refreshing keeps everything; Reset clears everything after confirming
- [ ] No component in apps/web is styled from scratch: every control comes from @budget-kit/ui
- [ ] axe finds no violations on any screen
