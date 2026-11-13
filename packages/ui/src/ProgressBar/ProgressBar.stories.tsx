import type { Meta, StoryObj } from '@storybook/react-vite';

import { ProgressBar } from './ProgressBar';

const meta = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  args: { label: 'Groceries', value: 40, max: 100 },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '24rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ok: Story = { args: { value: 40, max: 100 } };
export const AtOkThreshold: Story = { args: { value: 80, max: 100 } };
export const Warning: Story = { args: { value: 90, max: 100 } };
export const AtMax: Story = { args: { value: 100, max: 100 } };
export const Over: Story = { args: { value: 125, max: 100 } };
export const Empty: Story = { args: { value: 0, max: 100 } };
export const ZeroMax: Story = { args: { value: 0, max: 0 } };
export const ZeroMaxOver: Story = { args: { value: 10, max: 0 } };

function formatDollars(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return `$${whole}.${rest < 10 ? '0' : ''}${rest}`;
}

export const MoneyFormatted: Story = {
  args: { label: 'Dining out', value: 45050, max: 40000, formatValue: formatDollars },
};

export const AllTones: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bk-space-4)' }}>
      <ProgressBar label="Groceries" value={40} max={100} />
      <ProgressBar label="Transport" value={90} max={100} />
      <ProgressBar label="Dining out" value={125} max={100} />
    </div>
  ),
};
