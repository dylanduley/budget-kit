import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../Button/Button';
import { StatusMessage } from './StatusMessage';

const meta = {
  title: 'Components/StatusMessage',
  component: StatusMessage,
  args: { message: 'Your changes were saved.' },
  parameters: {
    docs: {
      description: {
        component: [
          'A polite live region for status messages that are not errors ("Expense added", "Category removed"), so screen-reader users hear about changes they cannot see. The region stays in the DOM and only its text changes, which is what makes screen readers announce it.',
          '',
          '**Usage rules**',
          '',
          '- Render the region before the message changes, and keep it rendered: put it in the page with `message=""` and set the text later. Text that is present when the region first appears is usually not announced.',
          '- Do not put it inside a container that is `inert`, `hidden` or `aria-hidden` when the text changes (for example behind an open Dialog); change the text after the Dialog has closed.',
          '- It is polite: the announcement waits until the screen reader is idle and can be dropped if several messages arrive at once. Use one region per area of the page and one short sentence per change.',
          '- Not for errors. Field errors already announce through the field\'s `error` prop.',
          '- To announce the same text again, change `announceKey`.',
          '',
          '**Known limitations**',
          '',
          '- jsdom tests can check the region and its text, not that a screen reader speaks it; check announcements by hand with VoiceOver or NVDA.',
          '- Polite messages can be delayed or dropped if many arrive together.',
          '- Text present when the region first renders is usually not announced.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    message: {
      description: 'The text to announce. An empty string renders the region with nothing in it.',
    },
    announceKey: {
      description: 'Change this (for example a counter) to announce the same text again.',
    },
    visuallyHidden: {
      description: 'Hide the text visually but keep it for assistive technology. Default false.',
    },
  },
} satisfies Meta<typeof StatusMessage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Visible: Story = {
  args: { message: 'Your changes were saved.' },
};

export const Empty: Story = {
  args: { message: '' },
};

export const VisuallyHidden: Story = {
  render: function VisuallyHiddenStory() {
    const [count, setCount] = useState(0);
    const [message, setMessage] = useState('');

    return (
      <div>
        <Button
          onClick={() => {
            const next = count + 1;
            setCount(next);
            setMessage(`Item ${next} added.`);
          }}
        >
          Add item
        </Button>
        <p>Items: {count}</p>
        <StatusMessage message={message} visuallyHidden />
      </div>
    );
  },
};

export const RepeatedMessage: Story = {
  render: function RepeatedMessageStory() {
    const [message, setMessage] = useState('');
    const [key, setKey] = useState(0);

    return (
      <div>
        <Button
          onClick={() => {
            setMessage('Saved.');
            setKey((k) => k + 1);
          }}
        >
          Save
        </Button>
        <StatusMessage message={message} announceKey={key} />
      </div>
    );
  },
};
