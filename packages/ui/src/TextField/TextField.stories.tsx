import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from './TextField';

const meta = {
  title: 'Components/TextField',
  component: TextField,
  args: { label: 'Expense name' },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = { args: { hint: 'Shown on your dashboard' } };

export const WithError: Story = { args: { error: 'Required' } };

export const WithHintAndError: Story = {
  args: { hint: 'Shown on your dashboard', error: 'Required' },
};

export const WithPrefix: Story = { args: { label: 'Amount', prefix: '$' } };

export const NumberType: Story = { args: { label: 'Day of month', type: 'number' } };

export const Disabled: Story = { args: { disabled: true, defaultValue: 'Rent' } };

export const Required: Story = { args: { required: true } };

export const OnSurface: Story = {
  render: (args) => (
    <div style={{ background: 'var(--bk-color-surface)', padding: 'var(--bk-space-6)' }}>
      <TextField {...args} />
    </div>
  ),
  args: { hint: 'On a surface panel' },
};
