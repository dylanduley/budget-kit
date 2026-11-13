import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from '../TextField/TextField';
import { Select } from './Select';

const categories = [
  { value: 'housing', label: 'Housing' },
  { value: 'food', label: 'Food' },
  { value: 'transport', label: 'Transport' },
];

const meta = {
  title: 'Components/Select',
  component: Select,
  args: { label: 'Category', options: categories },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPlaceholder: Story = {
  args: { placeholder: 'Choose a category', defaultValue: '' },
};

export const WithHint: Story = { args: { hint: 'Used to group expenses' } };

export const WithError: Story = { args: { error: 'Pick one' } };

export const WithHintAndError: Story = {
  args: { hint: 'Used to group expenses', error: 'Pick one' },
};

export const Disabled: Story = { args: { disabled: true, defaultValue: 'food' } };

export const WithDisabledOption: Story = {
  args: {
    options: [
      { value: 'housing', label: 'Housing' },
      { value: 'food', label: 'Food', disabled: true },
      { value: 'transport', label: 'Transport' },
    ],
  },
};

export const BesideTextField: Story = {
  render: (args) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--bk-space-4)' }}>
      <TextField label="Expense name" />
      <Select {...args} />
    </div>
  ),
};
