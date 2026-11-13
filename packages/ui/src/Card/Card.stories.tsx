import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';

const meta = {
  title: 'Components/Card',
  component: Card,
  args: {
    title: 'Monthly budget',
    children: <p style={{ margin: 0 }}>You have planned $3,200.00 for this month.</p>,
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

const editButton = <button type="button">Edit</button>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: { description: 'Planned spending across all categories.' },
};

export const WithAction: Story = {
  args: { action: editButton },
};

export const WithDescriptionAndAction: Story = {
  args: { description: 'Planned spending across all categories.', action: editButton },
};

export const HeadingLevel3: Story = {
  args: { headingLevel: 3, description: 'Rendered as an h3.' },
};

export const NarrowWidth: Story = {
  args: {
    description: 'Planned spending across all categories.',
    action: editButton,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
};
