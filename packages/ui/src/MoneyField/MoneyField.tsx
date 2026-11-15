'use client';

import { useState } from 'react';
import type { ChangeEvent, FocusEvent, ReactElement } from 'react';
import { TextField, type TextFieldProps } from '../TextField/TextField';
import { formatCents, parseMoney } from './money';

export interface MoneyFieldProps
  extends Omit<TextFieldProps, 'type' | 'value' | 'defaultValue' | 'onChange' | 'prefix' | 'inputMode'> {
  value: number | null;
  onChange: (cents: number | null) => void;
  allowNegative?: boolean;
  currencySymbol?: string;
}

type ParseErrorReason = 'invalid' | 'negative' | 'too-large';

const ERROR_MESSAGES: Record<ParseErrorReason, string> = {
  invalid: 'Enter an amount like 12.50',
  negative: "Amount can't be negative",
  'too-large': 'Amount is too large',
};

function textFor(value: number | null): string {
  return value === null ? '' : formatCents(value);
}

export function MoneyField({
  value,
  onChange,
  allowNegative = false,
  currencySymbol = '$',
  error,
  onBlur,
  ...textFieldProps
}: MoneyFieldProps): ReactElement {
  const [text, setText] = useState(() => textFor(value));
  const [parseError, setParseError] = useState<ParseErrorReason | null>(null);
  const [previousValue, setPreviousValue] = useState(value);
  const [lastEmitted, setLastEmitted] = useState(value);

  // Adjusting state during render: an outside change replaces the text, our own echo does not.
  if (value !== previousValue) {
    setPreviousValue(value);
    if (value !== lastEmitted) {
      setText(textFor(value));
      setParseError(null);
      setLastEmitted(value);
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextText = event.target.value;
    const result = parseMoney(nextText, { allowNegative });
    const cents = result.ok ? result.cents : null;
    setText(nextText);
    if (result.ok) setParseError(null);
    setLastEmitted(cents);
    onChange(cents);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>): void {
    const result = parseMoney(text, { allowNegative });
    if (!result.ok) {
      setParseError(result.reason);
    } else if (result.cents !== null) {
      setText(formatCents(result.cents));
    }
    onBlur?.(event);
  }

  return (
    <TextField
      {...textFieldProps}
      type="text"
      inputMode="decimal"
      prefix={currencySymbol}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      error={parseError ? ERROR_MESSAGES[parseError] : error}
    />
  );
}
