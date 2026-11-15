import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'On track' },
  parameters: {
    docs: {
      description: {
        component: [
          'A short label for a status, such as "On track" or "Over budget". Use it next to the item it describes; use Button for anything the user can act on.',
          '',
          'The variant changes only the colour, so the text must say the status itself. The badge is a plain `<span>` with no keyboard behaviour.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    variant: {
      description: 'Colour for the status: `neutral` (default), `success`, `warning` or `danger`.',
    },
    children: {
      description: 'The label text. Required, and must say the status in words.',
    },
  },
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
