import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'On track' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = { args: { variant: 'neutral', children: 'Not started' } };
export const Success: Story = { args: { variant: 'success', children: 'On track' } };
export const Warning: Story = { args: { variant: 'warning', children: 'Almost spent' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Over budget' } };

export const AllVariants: Story = {
  render: () => (
    <>
      <Badge variant="neutral">Not started</Badge>{' '}
      <Badge variant="success">On track</Badge>{' '}
      <Badge variant="warning">Almost spent</Badge>{' '}
      <Badge variant="danger">Over budget</Badge>
    </>
  ),
};
