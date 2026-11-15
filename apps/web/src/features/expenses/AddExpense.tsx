'use client';

import { type FormEvent, type ReactElement, type RefObject, useId, useRef, useState } from 'react';

import { Button, Dialog, MoneyField, Select, TextField } from '@budget-kit/ui';

import { type BudgetState, categoryLabel, datesInMonth, defaultExpenseDate } from '@/lib/budget';
import { formatDate } from '@/lib/format';
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
  onDone: () => void;
}

function ExpenseDialogForm({ formId, state, today, actions, amountRef, onDone }: ExpenseDialogFormProps): ReactElement {
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
    onDone();
  }

  return (
    <form id={formId} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <MoneyField
        label="Amount (USD)"
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
  const amountRef = useRef<HTMLInputElement | null>(null);
  const formId = useId();

  if (budget.status !== 'ready') return null;
  const { state, today, actions } = budget;

  if (state.categories.length === 0) return <p>Add a category before adding expenses.</p>;

  const close = (): void => setOpen(false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Add expense</Button>
      <Dialog
        open={open}
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
          onDone={close}
        />
      </Dialog>
    </div>
  );
}
