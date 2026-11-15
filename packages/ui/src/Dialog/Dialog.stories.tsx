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
