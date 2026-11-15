import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from './TextField';

const meta = {
  title: 'Components/TextField',
  component: TextField,
  args: { label: 'Expense name' },
  parameters: {
    docs: {
      description: {
        component: [
          'A single-line text input with a visible label, an optional hint and an optional error message. Use it for free text, and for numbers with `type="number"`.',
          '',
          'The label is linked to the input, the hint and error are linked with `aria-describedby`, and the input is marked `aria-invalid` while an error shows. Keyboard behaviour is the browser\'s native text input behaviour.',
          '',
          '**Known limitations**',
          '- Errors are announced when they appear (`role="alert"`) and are also linked with `aria-describedby` and `aria-invalid`, so they are read again when the control is focused.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    label: {
      description: 'Visible label, linked to the input. Required.',
    },
    hint: {
      description: 'Helper text shown under the field, read with the input.',
    },
    error: {
      description: 'Error message shown under the field. Setting it marks the input as invalid.',
    },
    prefix: {
      description: 'Text shown before the input, such as `$`. It is hidden from assistive technology, so put the unit in the label.',
    },
    type: {
      description: 'Native input type: `text` (default) or `number`.',
    },
    required: {
      description: 'Marks the input as required with the native attribute.',
    },
    disabled: {
      description: 'Disables the input.',
    },
    defaultValue: {
      description: 'Initial value for an uncontrolled input.',
    },
  },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = { args: { hint: 'Shown on your dashboard' } };

export const WithError: Story = { args: { error: 'Required' } };

export const WithHintAndError: Story = {
  args: { hint: 'Shown on your dashboard', error: 'Required' },
};

export const WithPrefix: Story = { args: { label: 'Amount', prefix: '$' } };

export const NumberType: Story = { args: { label: 'Day of month', type: 'number' } };

export const Disabled: Story = { args: { disabled: true, defaultValue: 'Rent' } };

export const Required: Story = { args: { required: true } };

export const OnSurface: Story = {
  render: (args) => (
    <div style={{ background: 'var(--bk-color-surface)', padding: 'var(--bk-space-6)' }}>
      <TextField {...args} />
    </div>
  ),
  args: { hint: 'On a surface panel' },
};
