import type { Meta, StoryObj } from '@storybook/react-vite';

import { ProgressBar } from './ProgressBar';

const meta = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  args: { label: 'Groceries', value: 40, max: 100 },
  parameters: {
    docs: {
      description: {
        component: [
          'A bar showing how much of a limit or budget has been used, such as spending against a monthly category budget. Use it for a value measured against a maximum; use Stat for a single figure.',
          '',
          'The bar is a `progressbar` named by `label`. Its status text, such as "$450.00 of $400.00, over by $50.00", is read as the value. The fill changes colour above 80% of `max` (warning) and above `max` (danger). Going over is also stated in the status text, but the warning colour at 80% is not conveyed in text.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    label: {
      description: 'Name of what is being measured, such as "Groceries". Read as the progress bar\'s name.',
    },
    value: {
      description: 'The amount used. For money, pass integer cents. Negative and non-numeric values are treated as 0.',
    },
    max: {
      description: 'The limit, in the same unit as `value` (integer cents for money). The bar is full at `max`; a `value` above it shows as over budget.',
    },
    formatValue: {
      description: 'Turns an amount into text for the status line. For money, format the integer cents here, for example 45050 as "$450.50". Defaults to the plain number.',
    },
  },
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
