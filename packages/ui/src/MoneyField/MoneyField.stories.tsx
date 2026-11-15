import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent } from 'storybook/test';
import { MoneyField, type MoneyFieldProps } from './MoneyField';

function Controlled(props: Omit<MoneyFieldProps, 'value' | 'onChange'> & { initial?: number | null }) {
  const { initial = null, ...rest } = props;
  const [value, setValue] = useState<number | null>(initial);
  return <MoneyField {...rest} value={value} onChange={setValue} />;
}

const meta = {
  title: 'Components/MoneyField',
  component: MoneyField,
  args: { label: 'Monthly income', value: null, onChange: () => undefined },
  parameters: {
    docs: {
      description: {
        component: [
          'A text input for an amount of money, such as 1,200.50. Use it wherever the user enters money, and pass the amount as integer cents (`12050` is 120.50), never as a float.',
          '',
          'It formats the amount when it loses focus. `onChange(cents, result)` receives integer cents, or `null` when the text is empty or invalid; the second argument is the `parseMoney` result, so `result.ok === false` tells invalid text from empty. Errors show on blur by default; set `validateOn="change"` to show them while typing. The currency symbol is hidden from assistive technology, so name the currency in the label.',
          '',
          '**Known limitations**',
          '- It is controlled only: `value` is integer cents or `null`, and `onChange` receives integer cents or `null` (empty or invalid text reports `null`; check the second argument to tell them apart).',
          '- By default errors appear when the field loses focus. With `validateOn="change"` they appear on each keystroke, so a half-typed amount such as `1,` shows an error until it is complete. A parse error replaces the `error` prop while it is showing. Because errors are announced as alerts, `change` can interrupt screen-reader users mid-entry. Use `blur` for general forms. Use `change` only where the app needs to know about invalid text immediately, for example to avoid saving it, and where a half-typed amount is rare.',
          '- If the parent applies `onChange` slowly (debounced or asynchronous state), typing can outrun the echoed value and the field may reformat text mid-typing. Synchronous React state is fine.',
          '- A parent calling `setValue(null)` while the field holds invalid text (already reported as `null`) does not clear the text, because the value did not change.',
          '- The currency symbol is decorative: it is hidden from assistive technology, so say the currency in the label or hint.',
          '- On iOS the decimal keypad has no minus key, so negative amounts are hard to enter when `allowNegative` is on.',
          '- A `value` that is not a safe integer (a float or NaN) throws a `RangeError` while rendering.',
          '- The largest amount is 999,999,999,999.99.',
          '- Errors are announced when they appear (`role="alert"`) and are also linked with `aria-describedby` and `aria-invalid`, so they are read again when the control is focused.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    label: {
      description: 'Visible label, linked to the input. Name the currency here, since the symbol is hidden from assistive technology.',
    },
    value: {
      description: 'The amount in integer cents, or `null` for empty. Example: `12050` shows 120.50.',
    },
    onChange: {
      description: 'Called with the new amount in integer cents (or `null` when the text is empty or invalid) and the `parseMoney` result for the typed text.',
    },
    validateOn: {
      description: 'When the parse error appears: `blur` (default) or `change` (while typing).',
    },
    allowNegative: {
      description: 'Accepts a leading minus sign. Off by default, so negative amounts are rejected with an error.',
    },
    currencySymbol: {
      description: 'Symbol shown before the input. Decorative and hidden from assistive technology. Defaults to `$`.',
    },
    hint: {
      description: 'Helper text shown under the field, read with the input.',
    },
    error: {
      description: 'Error message from the parent, shown under the field. A parse error replaces it while it is showing.',
    },
    disabled: {
      description: 'Disables the input.',
    },
  },
  render: (args) => {
    const { value, onChange, ...rest } = args;
    void onChange;
    return <Controlled {...rest} initial={value} />;
  },
} satisfies Meta<typeof MoneyField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithValue: Story = { args: { value: 120000 } };

export const WithHint: Story = { args: { hint: 'Before tax' } };

export const InvalidInput: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Monthly income'), 'abc');
    await userEvent.tab();
  },
};

export const NegativeRejected: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Monthly income'), '-5');
    await userEvent.tab();
  },
};

export const AllowNegative: Story = { args: { value: -500, allowNegative: true } };

export const ExternalError: Story = { args: { error: 'Income is required' } };

export const Disabled: Story = { args: { disabled: true, value: 120000 } };

export const OtherCurrencySymbol: Story = { args: { currencySymbol: '€', value: 120000 } };

export const ValidateWhileTyping: Story = {
  args: { validateOn: 'change' },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Monthly income'), 'abc');
  },
};
