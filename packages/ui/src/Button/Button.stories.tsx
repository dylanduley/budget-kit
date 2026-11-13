import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button, type ButtonSize, type ButtonVariant } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Save budget' },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

const variants: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger'];
const sizes: ButtonSize[] = ['md', 'sm'];

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Delete expense' } };
export const Small: Story = { args: { size: 'sm' } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true } };
export const LoadingSmall: Story = { args: { loading: true, size: 'sm' } };

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--bk-space-4)' }}>
      {variants.flatMap((variant) =>
        sizes.map((size) => (
          <div key={`${variant}-${size}`} style={{ display: 'flex', gap: 'var(--bk-space-3)', alignItems: 'center' }}>
            <Button variant={variant} size={size}>
              {`${variant} ${size}`}
            </Button>
            <Button variant={variant} size={size} disabled>
              {`${variant} ${size} disabled`}
            </Button>
            <Button variant={variant} size={size} loading>
              {`${variant} ${size} loading`}
            </Button>
          </div>
        )),
      )}
    </div>
  ),
};

export const LoadingWidth: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--bk-space-3)', justifyItems: 'start' }}>
      <Button>Save budget</Button>
      <Button loading>Save budget</Button>
    </div>
  ),
};

export const SubmitInForm: Story = {
  render: () => (
    <form
      onSubmit={(event) => event.preventDefault()}
      style={{ display: 'flex', gap: 'var(--bk-space-3)', alignItems: 'end' }}
    >
      <label style={{ display: 'grid', gap: 'var(--bk-space-1)', font: 'var(--bk-font-size-sm) var(--bk-font-sans)' }}>
        Category name
        <input type="text" name="category" style={{ font: 'inherit' }} />
      </label>
      <Button type="submit">Add category</Button>
    </form>
  ),
};
