import type { Meta, StoryObj } from '@storybook/react-vite';

import { Stat } from './Stat';

const meta = {
  title: 'Components/Stat',
  component: Stat,
  args: { label: 'Groceries spent', value: '$1,200.00' },
  parameters: {
    docs: {
      description: {
        component: [
          'A single headline figure with a label, a value and an optional change against a plan or a previous period. Use it for one number; use Table for a list of numbers.',
          '',
          'The label, value and change are read in that order. A `good` or `bad` tone is also written as text ("Good:" or "Bad:"), and the mark beside it is hidden from assistive technology, so the tone is not conveyed by colour alone. Stat is static text with no keyboard behaviour.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    label: {
      description: 'What the figure measures, such as "Groceries spent". Required.',
    },
    value: {
      description: 'The figure, already formatted as text, such as "$1,200.00".',
    },
    change: {
      description: 'The change shown under the value, such as "$50.00 under plan".',
    },
    tone: {
      description: 'Whether the change is good (`good`), bad (`bad`) or neutral (`neutral`, the default).',
    },
  },
} satisfies Meta<typeof Stat>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const GoodChange: Story = {
  args: { change: '$50.00 under plan', tone: 'good' },
};

export const BadChange: Story = {
  args: { change: '$50.00 over plan', tone: 'bad' },
};

export const NeutralChange: Story = {
  args: { change: 'Same as last month', tone: 'neutral' },
};

export const AllTones: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--bk-space-8)' }}>
      <Stat label="Groceries" value="$1,200.00" change="$50.00 under plan" tone="good" />
      <Stat label="Dining out" value="$450.00" change="$75.00 over plan" tone="bad" />
      <Stat label="Transport" value="$180.00" change="Same as last month" tone="neutral" />
    </div>
  ),
};

export const LongValue: Story = {
  args: { label: 'Total saved', value: '$123,456,789,012,345', change: '$1,000.00 under plan', tone: 'good' },
  render: (args) => (
    <div style={{ width: '160px' }}>
      <Stat {...args} />
    </div>
  ),
};

export const InsideSurface: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        gap: 'var(--bk-space-8)',
        padding: 'var(--bk-space-6)',
        background: 'var(--bk-color-surface)',
      }}
    >
      <Stat label="Groceries" value="$1,200.00" change="$50.00 under plan" tone="good" />
      <Stat label="Dining out" value="$450.00" change="$75.00 over plan" tone="bad" />
      <Stat label="Transport" value="$180.00" change="Same as last month" tone="neutral" />
    </div>
  ),
};
