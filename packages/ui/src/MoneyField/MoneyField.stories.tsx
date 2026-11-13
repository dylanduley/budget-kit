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
