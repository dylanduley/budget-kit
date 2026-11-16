'use client';

import { type FormEvent, type ReactElement, type RefObject, useEffect, useId, useRef, useState } from 'react';

import { Button, Dialog, MoneyField, Select, StatusMessage, TextField } from '@budget-kit/ui';

import {
  type BudgetState,
  type NewExpense,
  categoryLabel,
  datesInMonth,
  defaultExpenseDate,
  getTotals,
} from '@/lib/budget';
import { formatDate, formatMoney } from '@/lib/format';
import { type BudgetActions, TOTAL_TOO_LARGE_MESSAGE, useBudget } from '@/state/BudgetProvider';

import { type ExpenseField, NOTE_MAX_LENGTH, validateExpenseForm } from './expenseForm';

const UNEXPECTED_MESSAGE = 'Something went wrong. Your budget was not changed.';

type FieldErrors = Partial<Record<ExpenseField, string>>;

interface ExpenseDialogFormProps {
  formId: string;
  state: BudgetState;
  today: string;
  actions: BudgetActions;
  amountRef: RefObject<HTMLInputElement | null>;
  onSaved: (expense: NewExpense) => void;
}

function ExpenseDialogForm({ formId, state, today, actions, amountRef, onSaved }: ExpenseDialogFormProps): ReactElement {
  const categoryRef = useRef<HTMLSelectElement | null>(null);
  const noteRef = useRef<HTMLInputElement | null>(null);
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => defaultExpenseDate(state.month, today));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [totalError, setTotalError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function clearActionErrors(): void {
    setTotalError(null);
    setActionError(null);
  }

  function clearField(field: ExpenseField): void {
    setErrors((current) => ({ ...current, [field]: undefined }));
    clearActionErrors();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clearActionErrors();
    const result = validateExpenseForm({ amountCents, categoryId, note, date }, state);
    if (!result.ok) {
      setErrors(result.errors);
      if (result.errors.amount !== undefined) amountRef.current?.focus();
      else if (result.errors.category !== undefined) categoryRef.current?.focus();
      else if (result.errors.note !== undefined) noteRef.current?.focus();
      return;
    }
    setErrors({});
    try {
      actions.addExpense(result.expense);
    } catch (error) {
      if (error instanceof RangeError && error.message === TOTAL_TOO_LARGE_MESSAGE) {
        setTotalError(TOTAL_TOO_LARGE_MESSAGE);
        amountRef.current?.focus();
      } else {
        setActionError(UNEXPECTED_MESSAGE);
      }
      return;
    }
    onSaved(result.expense);
  }

  return (
    <form id={formId} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <MoneyField
        label="Amount (USD)"
        required
        ref={amountRef}
        value={amountCents}
        error={errors.amount ?? totalError ?? undefined}
        onChange={(cents) => {
          setAmountCents(cents);
          clearField('amount');
        }}
      />
      <Select
        label="Category"
        required
        placeholder="Choose a category"
        ref={categoryRef}
        value={categoryId}
        error={errors.category}
        options={state.categories.map((category) => ({
          value: category.id,
          label: categoryLabel(state, category.id),
        }))}
        onChange={(event) => {
          setCategoryId(event.target.value);
          clearField('category');
        }}
      />
      <TextField
        label="Note"
        hint="Optional"
        maxLength={NOTE_MAX_LENGTH}
        ref={noteRef}
        value={note}
        error={errors.note}
        onChange={(event) => {
          setNote(event.target.value);
          clearField('note');
        }}
      />
      <Select
        label="Date"
        value={date}
        options={datesInMonth(state.month).map((d) => ({ value: d, label: formatDate(d) }))}
        onChange={(event) => {
          setDate(event.target.value);
          clearActionErrors();
        }}
      />
      {actionError !== null ? (
        <p role="alert" data-part="action-error">
          {actionError}
        </p>
      ) : null}
    </form>
  );
}

export function AddExpense(): ReactElement | null {
  const budget = useBudget();
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState({ message: '', key: 0 });
  const amountRef = useRef<HTMLInputElement | null>(null);
  const pendingAnnouncement = useRef<NewExpense | null>(null);
  const formId = useId();
  const readyState = budget.status === 'ready' ? budget.state : null;

  useEffect(() => {
    const expense = pendingAnnouncement.current;
    if (expense === null || open || readyState === null) return;
    pendingAnnouncement.current = null;
    const left = getTotals(readyState);
    const message =
      `Expense added: ${formatMoney(expense.amountCents)} for ${categoryLabel(readyState, expense.categoryId)} on ${formatDate(expense.date)}.` +
      (left.hasIncome ? ` Left to spend: ${formatMoney(left.leftToSpendCents)}.` : '');
    // Announce only after focus has moved and any dialog has gone.
    setAnnouncement((current) => ({ message, key: current.key + 1 }));
  }, [open, readyState]);

  if (budget.status !== 'ready') return null;
  const { state, today, actions } = budget;

  if (state.categories.length === 0) return null;

  const close = (): void => setOpen(false);

  return (
    <>
      <Button className="self-start" onClick={() => setOpen(true)}>
        Add expense
      </Button>
      <StatusMessage visuallyHidden message={announcement.message} announceKey={announcement.key} />
      {open ? (
        <Dialog
          open
          onClose={close}
          title="Add expense"
          initialFocusRef={amountRef}
          actions={
            <>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" form={formId}>
                Save expense
              </Button>
            </>
          }
        >
          <ExpenseDialogForm
            formId={formId}
            state={state}
            today={today}
            actions={actions}
            amountRef={amountRef}
            onSaved={(expense) => {
              pendingAnnouncement.current = expense;
              setOpen(false);
            }}
          />
        </Dialog>
      ) : null}
    </>
  );
}
