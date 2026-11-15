import { useState } from 'react';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import * as publicApi from '../index';
import { MoneyField, type MoneyFieldProps } from './MoneyField';
import * as stories from './MoneyField.stories';

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
