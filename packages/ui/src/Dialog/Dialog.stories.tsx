import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../Button/Button';
import { Dialog } from './Dialog';

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  args: {
    open: true,
    onClose: () => {},
    title: 'Edit budget',
    children: <p style={{ margin: 0 }}>Changes apply to the current month only.</p>,
  },
  parameters: {
    docs: {
      description: {
        component: [
          'A modal dialog for a short task that needs the user\'s full attention, such as confirming a destructive action or editing one item. Use it sparingly; use a page for longer tasks.',
          '',
          'While open, focus moves into the dialog, Tab and Shift+Tab stay inside it, Esc closes it, and the page behind is made inert and its scroll locked. The title is the accessible name; the dialog never closes itself, so the parent sets `open` to `false` in `onClose`.',
          '',
          '**Known limitations**',
          '- One dialog at a time. Nested or simultaneous dialogs are not supported: closing them out of order can leave the page behind permanently scroll-locked.',
          '- Focus returns to whichever element had focus when the dialog opened. In Safari, a mouse click does not focus a button, so after a pointer-initiated open there is no element to return to and focus ends on the page body; keyboard-initiated opens work. The same applies if the trigger is removed before the dialog closes.',
          '- If a consumer moves focus inside `onClose` (for example to a new row after saving), the dialog\'s cleanup then moves focus back to the trigger.',
          '- Radio buttons are each a separate tab stop inside the dialog (native behaviour is one stop per group).',
          '- Page elements added to `<body>` while the dialog is open (toasts, other portals) are not made inert.',
          '- The scroll lock sets `overflow: hidden` on `body`; it does not hold if the app makes `html` the scroll container, it does not compensate for a classic scrollbar disappearing (the page can shift sideways), and older iOS Safari ignores it.',
          '- Esc is ignored while an IME is composing and when an earlier handler already called `preventDefault()` on the event. Consumer code must not call `preventDefault()` on Esc in a document-level keydown handler unless it means to block closing.',
          '- A body taller than the panel becomes a keyboard-focusable, named scroll region (it joins the tab order only while it overflows).',
          '- Backdrop clicks do not close the dialog.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    open: {
      description: 'Shows the dialog when `true`. The parent owns this state.',
    },
    onClose: {
      description: 'Called on Esc and when the close button is clicked. The parent should set `open` to `false`.',
    },
    title: {
      description: 'Heading of the dialog. It is the accessible name.',
    },
    children: {
      description: 'The body content. It scrolls when taller than the panel.',
    },
    actions: {
      description: 'Buttons shown in the footer, usually a cancel button and a primary or danger button.',
    },
    closeLabel: {
      description: 'Accessible name of the close (×) button. Defaults to `Close`.',
    },
    initialFocusRef: {
      description: 'Ref to the element that receives focus when the dialog opens. Defaults to the dialog panel.',
    },
    className: {
      description: 'Extra class name added to the dialog panel.',
    },
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// An open dialog makes the rest of the Docs page inert, so it renders in an iframe.
const openDocs = { docs: { story: { inline: false, height: '400px' } } };

export const Default: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Dialog {...args} open={open} onClose={() => setOpen(false)} />
      </>
    );
  },
  args: { open: false },
};

export const OpenByDefault: Story = { parameters: openDocs };

export const WithActions: Story = {
  parameters: openDocs,
  args: {
    actions: (
      <>
        <Button variant="secondary">Cancel</Button>
        <Button variant="primary">Save</Button>
      </>
    ),
  },
};

export const ConfirmDestructive: Story = {
  parameters: openDocs,
  args: {
    title: 'Reset month?',
    children: <p style={{ margin: 0 }}>All planned amounts for this month will be cleared.</p>,
    actions: (
      <>
        <Button variant="secondary">Cancel</Button>
        <Button variant="danger">Reset month</Button>
      </>
    ),
  },
};

export const InitialFocus: Story = {
  parameters: openDocs,
  render: (args) => {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
      <Dialog {...args} initialFocusRef={inputRef} title="Rename category">
        <label style={{ display: 'grid', gap: 'var(--bk-space-1)' }}>
          Category name
          <input ref={inputRef} type="text" defaultValue="Groceries" />
        </label>
      </Dialog>
    );
  },
};

export const LongContent: Story = {
  parameters: openDocs,
  args: {
    title: 'Terms of use',
    children: (
      <>
        {Array.from({ length: 20 }, (_, i) => (
          <p key={i} style={{ margin: '0 0 var(--bk-space-4)' }}>
            Paragraph {i + 1}. Budget Kit stores every amount in cents, so totals never drift by a
            fraction of a cent, and every month is planned separately from the others.
          </p>
        ))}
      </>
    ),
    actions: <Button variant="primary">Accept</Button>,
  },
};
