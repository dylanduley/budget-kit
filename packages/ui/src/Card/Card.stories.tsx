import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';

const meta = {
  title: 'Components/Card',
  component: Card,
  args: {
    title: 'Monthly budget',
    children: <p style={{ margin: 0 }}>You have planned $3,200.00 for this month.</p>,
  },
  parameters: {
    docs: {
      description: {
        component: [
          'A titled section that groups related content, such as one month\'s budget. Use it to put a heading around a group of content; use Stat for a single figure.',
          '',
          'The card is a `<section>` named by its title, so screen reader users can jump to it by name. The title is a heading, level 2 by default; set `headingLevel` so it fits the page outline. The `action` slot holds the consumer\'s own controls, which keep their own keyboard behaviour.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    title: {
      description: 'Heading text. It names the section. Required.',
    },
    description: {
      description: 'Short text shown under the title.',
    },
    action: {
      description: 'Controls shown at the top right, such as an Edit button.',
    },
    headingLevel: {
      description: 'Heading level of the title: `2` (default), `3` or `4`.',
    },
    children: {
      description: 'The content of the card.',
    },
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
