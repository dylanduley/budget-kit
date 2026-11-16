import { useState } from 'react';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import * as publicApi from '../index';
import { MoneyField, type MoneyFieldProps } from './MoneyField';
import * as stories from './MoneyField.stories';
import { parseMoney, type MoneyParseResult } from './money';

function Controlled({
  initial = null,
  onValue,
  ...rest
}: Omit<MoneyFieldProps, 'value' | 'onChange'> & {
  initial?: number | null;
  onValue?: (cents: number | null) => void;
}): ReactElement {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <MoneyField
        {...rest}
        value={value}
        onChange={(cents) => {
          onValue?.(cents);
          setValue(cents);
        }}
      />
      <button type="button" onClick={() => setValue(500)}>
        set 500
      </button>
      <button type="button" onClick={() => setValue(null)}>
        set null
      </button>
      <button type="button" onClick={() => setValue(1200)}>
        set 1200
      </button>
      <output data-testid="parent-value">{value === null ? 'null' : String(value)}</output>
    </>
  );
}

const field = (): HTMLInputElement => screen.getByLabelText('Income');
const args = (fn: ReturnType<typeof vi.fn>): unknown[] => fn.mock.calls.map((call) => call[0]);
const ERR_INVALID = 'Enter an amount like 12.50';

describe('MoneyField: onChange gives cents', () => {
  it('typing 12.5 into an empty field calls onChange with 100, 1200, 1200, 1250 in order', async () => {
    const onChange = vi.fn();
    render(<MoneyField label="Income" value={null} onChange={onChange} />);
    await userEvent.type(field(), '12.5');
    expect(args(onChange)).toStrictEqual([100, 1200, 1200, 1250]);
  });

  it('typing 1,200.00 ends with a last call of 120000 and calls onChange once per keystroke', async () => {
    const onChange = vi.fn();
    render(<Controlled label="Income" onValue={onChange} />);
    await userEvent.type(field(), '1,200.00');
    expect(onChange).toHaveBeenCalledTimes('1,200.00'.length);
    expect(onChange).toHaveBeenLastCalledWith(120000);
  });

  it('clearing the field calls onChange with null', async () => {
    const onChange = vi.fn();
    render(<Controlled label="Income" initial={500} onValue={onChange} />);
    await userEvent.clear(field());
    expect(args(onChange)).toStrictEqual([null]);
  });
});

describe('MoneyField: never NaN', () => {
  it.each(['abc', '12.345', '1,2,3', '.', '-', '1e3', '-0', '-0.00', '$', '--5'])(
    'typing %j only ever calls onChange with null or a safe integer, never NaN or -0',
    async (text) => {
      const onChange = vi.fn();
      render(<Controlled label="Income" onValue={onChange} />);
      await userEvent.type(field(), text);
      await userEvent.tab();
      expect(onChange).toHaveBeenCalled();
      for (const arg of args(onChange)) {
        const valid = arg === null || (typeof arg === 'number' && Number.isSafeInteger(arg) && !Object.is(arg, -0));
        expect(valid, `${text}: ${String(arg)}`).toBe(true);
      }
    },
  );

  it('with allowNegative, typing -0 never reports -0', async () => {
    const onChange = vi.fn();
    render(<Controlled label="Income" allowNegative onValue={onChange} />);
    await userEvent.type(field(), '-0.00');
    for (const arg of args(onChange)) expect(Object.is(arg, -0)).toBe(false);
  });
});

describe('MoneyField: invalid input shows an error', () => {
  it('after typing abc and tabbing away the error is visible, aria-invalid and described, text kept, last onChange null', async () => {
    const onChange = vi.fn();
    render(<Controlled label="Income" onValue={onChange} />);
    await userEvent.type(field(), 'abc');
    expect(screen.queryByText(ERR_INVALID)).not.toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByText(ERR_INVALID)).toBeVisible();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field()).toHaveAccessibleDescription(expect.stringContaining(ERR_INVALID));
    expect(field()).toHaveValue('abc');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('the error clears while typing: clear then type 5 removes error text and aria-invalid', async () => {
    render(<Controlled label="Income" />);
    await userEvent.type(field(), 'abc');
    await userEvent.tab();
    expect(screen.getByText(ERR_INVALID)).toBeInTheDocument();
    await userEvent.clear(field());
    expect(screen.queryByText(ERR_INVALID)).not.toBeInTheDocument();
    await userEvent.type(field(), '5');
    expect(screen.queryByText(ERR_INVALID)).not.toBeInTheDocument();
    expect(field()).not.toHaveAttribute('aria-invalid');
  });

  it('the error stays while the text is still invalid after more typing', async () => {
    render(<Controlled label="Income" />);
    await userEvent.type(field(), 'abc');
    await userEvent.tab();
    await userEvent.type(field(), 'd');
    expect(screen.getByText(ERR_INVALID)).toBeInTheDocument();
  });

  it('clearing to empty removes the error (empty is ok)', async () => {
    render(<Controlled label="Income" />);
    await userEvent.type(field(), 'abc');
    await userEvent.tab();
    await userEvent.clear(field());
    expect(screen.queryByText(ERR_INVALID)).not.toBeInTheDocument();
    expect(field()).not.toHaveAttribute('aria-invalid');
  });

  it.each(['12.345', '1,2,3', '.', '-', '1e3'])('%j shows the invalid message after blur', async (text) => {
    render(<Controlled label="Income" />);
    await userEvent.type(field(), text);
    await userEvent.tab();
    expect(screen.getByText(ERR_INVALID)).toBeInTheDocument();
    expect(field()).toHaveValue(text);
  });
});

describe('MoneyField: shows formatted value on blur', () => {
  it.each([
    ['12.5', '12.50'],
    ['1200', '1,200.00'],
    ['.5', '0.50'],
    ['$12', '12.00'],
    ['0012', '12.00'],
  ])('typing %j then tabbing away shows %j', async (typed, shown) => {
    const onChange = vi.fn();
    render(<Controlled label="Income" onValue={onChange} />);
    await userEvent.type(field(), typed);
    const callsBefore = onChange.mock.calls.length;
    await userEvent.tab();
    expect(field()).toHaveValue(shown);
    expect(onChange).toHaveBeenCalledTimes(callsBefore);
  });

  it('an empty field stays empty on blur and blur does not call onChange', async () => {
    const onChange = vi.fn();
    render(<Controlled label="Income" onValue={onChange} />);
    await userEvent.click(field());
    await userEvent.tab();
    expect(field()).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
    expect(field()).not.toHaveAttribute('aria-invalid');
  });

  it("the consumer's onBlur still fires, once, and blur on invalid text does not call onChange", async () => {
    const onBlur = vi.fn();
    const onChange = vi.fn();
    render(<Controlled label="Income" onBlur={onBlur} onValue={onChange} />);
    await userEvent.type(field(), 'abc');
    const callsBefore = onChange.mock.calls.length;
    await userEvent.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(callsBefore);
  });

  it('refocusing and retyping after blur formatting works', async () => {
    const onChange = vi.fn();
    render(<Controlled label="Income" onValue={onChange} />);
    await userEvent.type(field(), '12.5');
    await userEvent.tab();
    await userEvent.clear(field());
    await userEvent.type(field(), '7');
    await userEvent.tab();
    expect(field()).toHaveValue('7.00');
    expect(onChange).toHaveBeenLastCalledWith(700);
  });
});

describe('MoneyField: negatives', () => {
  it("typing -5 then tabbing away shows Amount can't be negative with last onChange null", async () => {
    const onChange = vi.fn();
    render(<Controlled label="Income" onValue={onChange} />);
    await userEvent.type(field(), '-5');
    await userEvent.tab();
    expect(screen.getByText("Amount can't be negative")).toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field()).toHaveValue('-5');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('with allowNegative the last onChange is -500, no error, and the input shows -5.00 after blur', async () => {
    const onChange = vi.fn();
    render(<Controlled label="Income" allowNegative onValue={onChange} />);
    await userEvent.type(field(), '-5');
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith(-500);
    expect(screen.queryByText("Amount can't be negative")).not.toBeInTheDocument();
    expect(field()).not.toHaveAttribute('aria-invalid');
    expect(field()).toHaveValue('-5.00');
  });

  it('typing 1000000000000 and tabbing away shows Amount is too large', async () => {
    const onChange = vi.fn();
    render(<Controlled label="Income" onValue={onChange} />);
    await userEvent.type(field(), '1000000000000');
    await userEvent.tab();
    expect(screen.getByText('Amount is too large')).toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe('MoneyField: controlled value (rerender)', () => {
  it('value 120000 shows 1,200.00; rerender null shows empty; rerender 500 shows 5.00', () => {
    const onChange = vi.fn();
    const { rerender } = render(<MoneyField label="Income" value={120000} onChange={onChange} />);
    expect(field()).toHaveValue('1,200.00');
    rerender(<MoneyField label="Income" value={null} onChange={onChange} />);
    expect(field()).toHaveValue('');
    rerender(<MoneyField label="Income" value={500} onChange={onChange} />);
    expect(field()).toHaveValue('5.00');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('initial value null renders empty and 0 renders 0.00 (0 is not empty)', () => {
    const { unmount } = render(<MoneyField label="Income" value={null} onChange={() => undefined} />);
    expect(field()).toHaveValue('');
    unmount();
    render(<MoneyField label="Income" value={0} onChange={() => undefined} />);
    expect(field()).toHaveValue('0.00');
  });

  it('an external change clears a shown parse error and resets the text', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<MoneyField label="Income" value={null} onChange={onChange} />);
    await userEvent.type(field(), 'abc');
    await userEvent.tab();
    expect(screen.getByText(ERR_INVALID)).toBeInTheDocument();
    rerender(<MoneyField label="Income" value={500} onChange={onChange} />);
    expect(field()).toHaveValue('5.00');
    expect(screen.queryByText(ERR_INVALID)).not.toBeInTheDocument();
    expect(field()).not.toHaveAttribute('aria-invalid');
  });
});

describe('MoneyField: controlled value (real wrapper)', () => {
  it('while the user types 12.5 the input shows exactly 12.5 at each step until blur', async () => {
    render(<Controlled label="Income" />);
    await userEvent.type(field(), '1');
    expect(field()).toHaveValue('1');
    await userEvent.type(field(), '2');
    expect(field()).toHaveValue('12');
    await userEvent.type(field(), '.');
    expect(field()).toHaveValue('12.');
    await userEvent.type(field(), '5');
    expect(field()).toHaveValue('12.5');
    expect(screen.getByTestId('parent-value')).toHaveTextContent('1250');
    await userEvent.tab();
    expect(field()).toHaveValue('12.50');
  });

  it('typing 1200 does not insert commas mid-typing', async () => {
    render(<Controlled label="Income" />);
    await userEvent.type(field(), '1200');
    expect(field()).toHaveValue('1200');
  });

  it('parent sets the same value the field just reported: text is not reformatted', async () => {
    render(<Controlled label="Income" />);
    await userEvent.type(field(), '12.5');
    expect(screen.getByTestId('parent-value')).toHaveTextContent('1250');
    expect(field()).toHaveValue('12.5');
  });

  it('parent changes value while the field holds invalid text: text resets and the error clears', async () => {
    render(<Controlled label="Income" />);
    await userEvent.type(field(), 'abc');
    await userEvent.tab();
    expect(screen.getByText(ERR_INVALID)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'set 500' }));
    expect(field()).toHaveValue('5.00');
    expect(screen.queryByText(ERR_INVALID)).not.toBeInTheDocument();
    expect(field()).not.toHaveAttribute('aria-invalid');
  });

  it('switching null -> number -> null -> number follows the parent each time', async () => {
    render(<Controlled label="Income" />);
    await userEvent.click(screen.getByRole('button', { name: 'set 500' }));
    expect(field()).toHaveValue('5.00');
    await userEvent.click(screen.getByRole('button', { name: 'set null' }));
    expect(field()).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'set 1200' }));
    expect(field()).toHaveValue('12.00');
  });

  it('after the user types a value and the parent replaces it with another, then sets the typed value again, the field follows the parent', async () => {
    render(<Controlled label="Income" />);
    await userEvent.type(field(), '12');
    expect(screen.getByTestId('parent-value')).toHaveTextContent('1200');
    await userEvent.click(screen.getByRole('button', { name: 'set 500' }));
    expect(field()).toHaveValue('5.00');
    await userEvent.click(screen.getByRole('button', { name: 'set 1200' }));
    expect(field()).toHaveValue('12.00');
  });

  it('after invalid text (reported null) and an external change to a number, the parent setting null again empties the field', async () => {
    render(<Controlled label="Income" />);
    await userEvent.type(field(), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'set 500' }));
    expect(field()).toHaveValue('5.00');
    await userEvent.click(screen.getByRole('button', { name: 'set null' }));
    expect(field()).toHaveValue('');
  });

  it('parent clearing to null while the field shows a typed value empties the field', async () => {
    render(<Controlled label="Income" />);
    await userEvent.type(field(), '12.5');
    await userEvent.click(screen.getByRole('button', { name: 'set null' }));
    expect(field()).toHaveValue('');
  });
});

describe('MoneyField: error prop', () => {
  it('the error prop is shown when there is no parse error', () => {
    render(<MoneyField label="Income" value={null} onChange={() => undefined} error="Income is required" />);
    expect(screen.getByText('Income is required')).toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
  });

  it('a parse error replaces the error prop while present and the prop returns when it clears', async () => {
    render(<Controlled label="Income" error="Income is required" />);
    await userEvent.type(field(), 'abc');
    await userEvent.tab();
    expect(screen.getByText(ERR_INVALID)).toBeInTheDocument();
    expect(screen.queryByText('Income is required')).not.toBeInTheDocument();
    await userEvent.clear(field());
    expect(screen.queryByText(ERR_INVALID)).not.toBeInTheDocument();
    expect(screen.getByText('Income is required')).toBeInTheDocument();
  });
});

describe('MoneyField: attributes and pass-through', () => {
  it('the input has type="text" and inputmode="decimal"', () => {
    render(<MoneyField label="Income" value={null} onChange={() => undefined} />);
    expect(field()).toHaveAttribute('type', 'text');
    expect(field()).toHaveAttribute('inputmode', 'decimal');
  });

  it('the prefix shows $ by default and currencySymbol="€" shows €', () => {
    const { container, rerender } = render(<MoneyField label="Income" value={null} onChange={() => undefined} />);
    expect(container.querySelector('[data-part="prefix"]')).toHaveTextContent('$');
    rerender(<MoneyField label="Income" value={null} onChange={() => undefined} currencySymbol="€" />);
    expect(container.querySelector('[data-part="prefix"]')).toHaveTextContent('€');
    expect(container.querySelector('[data-part="prefix"]')).not.toHaveTextContent('$');
  });

  it('label, hint, id, name, disabled and placeholder pass through to the input', () => {
    render(
      <MoneyField
        label="Income"
        hint="Before tax"
        id="inc"
        name="income"
        disabled
        placeholder="0.00"
        value={null}
        onChange={() => undefined}
      />,
    );
    expect(field()).toHaveAttribute('id', 'inc');
    expect(field()).toHaveAttribute('name', 'income');
    expect(field()).toBeDisabled();
    expect(field()).toHaveAttribute('placeholder', '0.00');
    expect(field()).toHaveAccessibleDescription('Before tax');
  });

  it('a hint and a parse error are both in the accessible description', async () => {
    render(<Controlled label="Income" hint="Before tax" />);
    await userEvent.type(field(), 'abc');
    await userEvent.tab();
    expect(field()).toHaveAccessibleDescription(expect.stringContaining(ERR_INVALID));
    expect(field()).toHaveAccessibleDescription(expect.stringContaining('Before tax'));
  });

  it('a ref passed as a prop reaches the input', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<MoneyField label="Income" value={null} onChange={() => undefined} ref={ref} />);
    expect(ref.current).toBe(field());
  });
});

describe('MoneyField: keyboard only', () => {
  it('an amount can be typed, corrected and left with Tab without a pointer', async () => {
    const onChange = vi.fn();
    render(
      <>
        <Controlled label="Income" onValue={onChange} />
      </>,
    );
    await userEvent.tab();
    expect(field()).toHaveFocus();
    await userEvent.keyboard('12.55');
    await userEvent.keyboard('{Backspace}{Backspace}');
    await userEvent.keyboard('0');
    expect(onChange).toHaveBeenLastCalledWith(1200);
    await userEvent.tab();
    expect(field()).not.toHaveFocus();
    expect(field()).toHaveValue('12.00');
  });
});

describe('MoneyField: public API and stories', () => {
  it('MoneyField, parseMoney and formatCents are exported from the package index', () => {
    expect(publicApi.MoneyField).toBe(MoneyField);
    expect(typeof publicApi.parseMoney).toBe('function');
    expect(typeof publicApi.formatCents).toBe('function');
  });

  it('every required story exists under Components/MoneyField', () => {
    const required = [
      'Empty',
      'WithValue',
      'WithHint',
      'InvalidInput',
      'NegativeRejected',
      'AllowNegative',
      'ExternalError',
      'Disabled',
      'OtherCurrencySymbol',
    ];
    for (const name of required) expect(stories, name).toHaveProperty(name);
    expect(stories.default.title).toBe('Components/MoneyField');
  });
});

describe('MoneyField: error is announced (role="alert")', () => {
  it('error prop: the alert has exactly that text and is the element aria-describedby points at', () => {
    render(<MoneyField label="Income" id="m" value={null} onChange={() => {}} error="Too much" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/^Too much$/);
    expect(alert.children).toHaveLength(0);
    expect(alert).toHaveAttribute('id', 'm-error');
    expect(field()).toHaveAttribute('aria-describedby', 'm-error');
  });

  it.each([undefined, ''])('with error=%j there is no alert and no aria-invalid or aria-describedby', (error) => {
    render(<MoneyField label="Income" value={null} onChange={() => {}} error={error} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(field()).not.toHaveAttribute('aria-invalid');
    expect(field()).not.toHaveAttribute('aria-describedby');
  });

  it('typing abc and tabbing away makes the alert appear (absent before the blur); clearing and typing 5 removes it', async () => {
    const user = userEvent.setup();
    render(<Controlled label="Income" id="m" />);
    await user.type(field(), 'abc');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.tab();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/^Enter an amount like 12\.50$/);
    expect(alert).toHaveAttribute('id', 'm-error');
    expect(field()).toHaveAttribute('aria-describedby', 'm-error');
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    await user.clear(field());
    await user.type(field(), '5');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(field()).not.toHaveAttribute('aria-invalid');
  });

  it("typing -5 and tabbing away shows \"Amount can't be negative\" as the alert", async () => {
    const user = userEvent.setup();
    render(<Controlled label="Income" />);
    await user.type(field(), '-5');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent(/^Amount can't be negative$/);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('the hint has no role, and with a hint and a parse error there is exactly one alert', async () => {
    const user = userEvent.setup();
    const { container } = render(<Controlled label="Income" id="m" hint="Monthly" />);
    expect(container.querySelector('#m-hint')).not.toHaveAttribute('role');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.type(field(), 'abc');
    await user.tab();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(container.querySelector('#m-hint')).not.toHaveAttribute('role');
    expect(field()).toHaveAttribute('aria-describedby', 'm-error m-hint');
  });
});

type Mode = 'blur' | 'change';
const okR = (cents: number | null): MoneyParseResult => ({ ok: true, cents });
const bad = (reason: 'invalid' | 'negative' | 'too-large'): MoneyParseResult => ({ ok: false, reason });
const lastCall = (fn: ReturnType<typeof vi.fn>): unknown[] => fn.mock.calls[fn.mock.calls.length - 1] as unknown[];

function Parent({
  onCall,
  initial = null,
  ...rest
}: Omit<MoneyFieldProps, 'value' | 'onChange'> & {
  initial?: number | null;
  onCall?: (cents: number | null, result: MoneyParseResult) => void;
}): ReactElement {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <MoneyField
        {...rest}
        value={value}
        onChange={(cents, result) => {
          onCall?.(cents, result);
          if (result.ok) setValue(result.cents);
        }}
      />
      <output data-testid="kept">{value === null ? 'null' : String(value)}</output>
    </>
  );
}

describe('MoneyField task 14: second argument of onChange', () => {
  it('typing 12.5 calls onChange four times with (cents, result) pairs', async () => {
    const onChange = vi.fn();
    render(<MoneyField label="Income" value={null} onChange={onChange} />);
    await userEvent.type(field(), '12.5');
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(onChange).toHaveBeenNthCalledWith(1, 100, { ok: true, cents: 100 });
    expect(onChange).toHaveBeenNthCalledWith(2, 1200, { ok: true, cents: 1200 });
    expect(onChange).toHaveBeenNthCalledWith(3, 1200, { ok: true, cents: 1200 });
    expect(onChange).toHaveBeenNthCalledWith(4, 1250, { ok: true, cents: 1250 });
  });

  it('invalid is distinguishable from empty: a then clear', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Parent label="Income" onCall={onChange} />);
    await user.type(field(), 'a');
    expect(onChange).toHaveBeenLastCalledWith(null, { ok: false, reason: 'invalid' });
    await user.clear(field());
    expect(onChange).toHaveBeenLastCalledWith(null, { ok: true, cents: null });
  });

  it('reason is passed through: negative, too-large, and allowNegative', async () => {
    const user = userEvent.setup();
    const a = vi.fn();
    const { unmount } = render(<Parent label="Income" onCall={a} />);
    await user.type(field(), '-5');
    expect(a).toHaveBeenLastCalledWith(null, { ok: false, reason: 'negative' });
    unmount();
    const b = vi.fn();
    const r2 = render(<Parent label="Income" onCall={b} />);
    await user.type(field(), '1000000000000');
    expect(b).toHaveBeenLastCalledWith(null, { ok: false, reason: 'too-large' });
    r2.unmount();
    const c = vi.fn();
    render(<Parent label="Income" allowNegative onCall={c} />);
    await user.type(field(), '-5');
    expect(c).toHaveBeenLastCalledWith(-500, { ok: true, cents: -500 });
  });

  const rows: Array<[string, number | null, MoneyParseResult]> = [
    ['1', 100, okR(100)],
    ['1,', null, bad('invalid')],
    ['1,2', null, bad('invalid')],
    ['1,20', null, bad('invalid')],
    ['1,200', 120000, okR(120000)],
    ['a', null, bad('invalid')],
    ['-', null, bad('invalid')],
    ['-5', null, bad('negative')],
    ['111111111111', 11111111111100, okR(11111111111100)],
    ['1111111111111', null, bad('too-large')],
  ];
  it.each(rows)('examples table: typing %s ends with the listed cents and result', async (text, cents, result) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Parent label="Income" onCall={onChange} />);
    await user.type(field(), text);
    expect(lastCall(onChange)).toStrictEqual([cents, result]);
  });

  it('examples table: clearing a field ends with (null, ok empty)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Parent label="Income" initial={500} onCall={onChange} />);
    await user.clear(field());
    expect(lastCall(onChange)).toStrictEqual([null, { ok: true, cents: null }]);
  });

  it.each<Mode>(['blur', 'change'])('never NaN or -0, and result equals parseMoney of the text (%s)', async (mode) => {
    const user = userEvent.setup();
    for (const text of ['abc', '12.345', '1,2,3', '.', '-', '1e3']) {
      const onChange = vi.fn();
      const { unmount } = render(<Parent label="Income" validateOn={mode} onCall={onChange} />);
      await user.type(field(), text);
      expect(onChange).toHaveBeenCalledTimes(text.length);
      onChange.mock.calls.forEach((call: unknown[], i: number) => {
        const [cents, result] = call as [number | null, MoneyParseResult];
        expect(cents === null || Number.isSafeInteger(cents)).toBe(true);
        expect(Object.is(cents, -0)).toBe(false);
        expect(result).toStrictEqual(parseMoney(text.slice(0, i + 1)));
      });
      unmount();
    }
  });

  it('a one-argument onChange (a useState setter) still works and Empty story behaviour holds', async () => {
    const user = userEvent.setup();
    function Setter(): ReactElement {
      const [v, setV] = useState<number | null>(null);
      return <MoneyField label="Income" value={v} onChange={setV} />;
    }
    render(<Setter />);
    await user.type(field(), '12.5');
    await user.tab();
    expect(field()).toHaveValue('12.50');
  });
});

describe('MoneyField task 14: validateOn', () => {
  it.each<[string, Mode | undefined]>([['default', undefined], ['blur', 'blur']])(
    'validateOn %s: no alert while focused, alert after Tab, onChange not called by blur',
    async (_name, mode) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Parent label="Income" validateOn={mode} onCall={onChange} />);
      await user.type(field(), 'abc');
      expect(screen.queryByRole('alert')).toBeNull();
      expect(field()).not.toHaveAttribute('aria-invalid');
      const calls = onChange.mock.calls.length;
      await user.tab();
      expect(screen.getByRole('alert')).toHaveTextContent(ERR_INVALID);
      expect(onChange).toHaveBeenCalledTimes(calls);
    },
  );

  it('validateOn change: a shows the alert before blur with aria-invalid and description', async () => {
    const user = userEvent.setup();
    render(<Parent label="Income" validateOn="change" />);
    await user.type(field(), 'a');
    expect(field()).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent(/^Enter an amount like 12\.50$/);
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field()).toHaveAccessibleDescription(expect.stringContaining(ERR_INVALID));
  });

  it('validateOn change: -5 shows the negative message and a pasted 13 digits shows too large, before blur', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Parent label="Income" validateOn="change" />);
    await user.type(field(), '-5');
    expect(screen.getByRole('alert')).toHaveTextContent(/^Amount can't be negative$/);
    unmount();
    render(<Parent label="Income" validateOn="change" />);
    await user.click(field());
    await user.paste('1000000000000');
    expect(field()).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent(/^Amount is too large$/);
  });

  it('validateOn change: from a, select all and type 5 clears the alert without blur', async () => {
    const user = userEvent.setup();
    render(<Parent label="Income" validateOn="change" />);
    await user.type(field(), 'a');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.keyboard('{Control>}a{/Control}5');
    expect(field()).toHaveValue('5');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(field()).not.toHaveAttribute('aria-invalid');
    expect(field()).toHaveFocus();
  });

  it('validateOn change: 1, shows the alert and 1,200 removes it', async () => {
    const user = userEvent.setup();
    render(<Parent label="Income" validateOn="change" />);
    await user.type(field(), '1,');
    expect(screen.getByRole('alert')).toHaveTextContent(ERR_INVALID);
    await user.type(field(), '200');
    expect(field()).toHaveValue('1,200');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('validateOn change: clearing the field removes the error', async () => {
    const user = userEvent.setup();
    render(<Parent label="Income" validateOn="change" />);
    await user.type(field(), 'a');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.clear(field());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(field()).not.toHaveAttribute('aria-invalid');
  });

  it('validateOn blur (default): the error disappears as soon as the text parses ok, including empty', async () => {
    const user = userEvent.setup();
    render(<Parent label="Income" />);
    await user.type(field(), 'a');
    await user.tab();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.clear(field());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('validateOn change blur: 12.5 then Tab shows 12.50', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Parent label="Income" validateOn="change" onCall={onChange} />);
    await user.type(field(), '12.5');
    const calls = onChange.mock.calls.length;
    await user.tab();
    expect(field()).toHaveValue('12.50');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(calls);
  });

  it('validateOn change blur: abc then Tab leaves abc and the error, onChange not called by blur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Parent label="Income" validateOn="change" onCall={onChange} />);
    await user.type(field(), 'abc');
    const calls = onChange.mock.calls.length;
    await user.tab();
    expect(field()).toHaveValue('abc');
    expect(screen.getByRole('alert')).toHaveTextContent(ERR_INVALID);
    expect(onChange).toHaveBeenCalledTimes(calls);
  });

  it('parent that keeps its old value on invalid input keeps typed text and error', async () => {
    const user = userEvent.setup();
    render(<Parent label="Income" initial={120000} validateOn="change" />);
    expect(field()).toHaveValue('1,200.00');
    await user.click(field());
    await user.keyboard('{End}x');
    expect(field()).toHaveValue('1,200.00x');
    expect(screen.getByRole('alert')).toHaveTextContent(ERR_INVALID);
    expect(screen.getByTestId('kept')).toHaveTextContent('120000');
    await user.keyboard('{Backspace}');
    expect(field()).toHaveValue('1,200.00');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('kept')).toHaveTextContent('120000');
    await user.tab();
    expect(field()).toHaveValue('1,200.00');
  });

  it.each<Mode>(['blur', 'change'])('parse error takes precedence over the error prop, one alert (%s)', async (mode) => {
    const user = userEvent.setup();
    render(<Parent label="Income" error="Income is required" validateOn={mode} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Income is required');
    await user.type(field(), 'a');
    if (mode === 'blur') await user.tab();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(/^Enter an amount like 12\.50$/);
    expect(screen.queryByText('Income is required')).toBeNull();
    await user.clear(field());
    expect(screen.getByRole('alert')).toHaveTextContent('Income is required');
  });
});
