import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button as ButtonFromIndex, type ButtonProps } from '../index';
import { Button } from './Button';

const spinnerSelector = '[data-part="spinner"][aria-hidden="true"]';

describe('Button: loading button cannot be clicked twice', () => {
  it('calls onClick zero times when clicked twice while loading', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    await user.click(button);
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(0);
  });

  it('calls onClick zero times for Enter and Space while loading and focused', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(0);
  });
});

describe('Button: works as a submit button in a form', () => {
  function Form({ onSubmit, loading }: { onSubmit: () => void; loading?: boolean }) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label>
          Name
          <input type="text" />
        </label>
        <Button type="submit" loading={loading}>
          Add
        </Button>
      </form>
    );
  }

  it('calls onSubmit once when the submit button is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Form onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmit once when Enter is pressed in the text input', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Form onSubmit={onSubmit} />);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Rent{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('keyboard only: tab to the submit button and activate with Enter and with Space', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Form onSubmit={onSubmit} />);
    await user.tab();
    await user.keyboard('Food');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Food');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('calls onSubmit zero times when a loading submit button is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Form onSubmit={onSubmit} loading />);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSubmit).toHaveBeenCalledTimes(0);
  });

  it('calls onSubmit zero times when Enter or Space activates a loading submit button', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Form onSubmit={onSubmit} loading />);
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onSubmit).toHaveBeenCalledTimes(0);
  });
});

describe('Button: default type is button', () => {
  it('renders type="button" without a type prop', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button');
  });

  it('calls form onSubmit zero times when a default-type button is clicked in a form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Go</Button>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onSubmit).toHaveBeenCalledTimes(0);
  });

  it('passes through type="reset" and type="submit"', () => {
    render(
      <>
        <Button type="reset">Reset</Button>
        <Button type="submit">Submit</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Reset' })).toHaveAttribute('type', 'reset');
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit');
  });
});

describe('Button: variant and size are reflected in data attributes', () => {
  it('defaults to data-variant="primary" and data-size="md"', () => {
    render(<Button>Go</Button>);
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toHaveAttribute('data-variant', 'primary');
    expect(button).toHaveAttribute('data-size', 'md');
  });

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)('reflects variant %s', (variant) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('data-variant', variant);
  });

  it.each(['sm', 'md'] as const)('reflects size %s', (size) => {
    render(<Button size={size}>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('data-size', size);
  });
});

describe('Button: disabled', () => {
  it('has the disabled attribute and calls onClick zero times when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toHaveAttribute('disabled');
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(0);
  });

  it('is not focusable by keyboard and ignores Enter and Space', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(0);
  });

  it('is not marked busy or showing a spinner', () => {
    render(<Button disabled>Go</Button>);
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button.querySelector('[data-part="spinner"]')).toBeNull();
  });
});

describe('Button: loading', () => {
  it('has aria-busy, aria-disabled, no disabled, one hidden spinner, and keeps its accessible name', () => {
    render(<Button loading>Save budget</Button>);
    const button = screen.getByRole('button', { name: 'Save budget' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toHaveAttribute('disabled');
    expect(button).toHaveAttribute('data-loading', 'true');
    expect(button.querySelectorAll(spinnerSelector)).toHaveLength(1);
    expect(button.querySelectorAll('[data-part="spinner"]')).toHaveLength(1);
  });

  it('without loading has no aria-busy, aria-disabled, data-loading or spinner', () => {
    render(<Button>Save budget</Button>);
    const button = screen.getByRole('button', { name: 'Save budget' });
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button).not.toHaveAttribute('data-loading');
    expect(button.querySelector('[data-part="spinner"]')).toBeNull();
  });

  it('keeps the label in the DOM while loading', () => {
    render(<Button loading>Save budget</Button>);
    expect(screen.getByText('Save budget')).toBeInTheDocument();
  });

  it('keeps variant and size attributes while loading', () => {
    render(
      <Button loading variant="danger" size="sm">
        Delete
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveAttribute('data-variant', 'danger');
    expect(button).toHaveAttribute('data-size', 'sm');
  });

  it('loading with disabled: native disabled, aria-busy and spinner', () => {
    render(
      <Button loading disabled>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelectorAll(spinnerSelector)).toHaveLength(1);
  });

  it('does not call onClick on a loading button but does once loading ends', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(0);
    rerender(<Button onClick={onClick}>Save</Button>);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls preventDefault on clicks while loading', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('Button: focus is kept when loading starts', () => {
  function Harness() {
    const [loading, setLoading] = useState(false);
    return (
      <Button type="submit" loading={loading} onClick={() => setLoading(true)}>
        Save
      </Button>
    );
  }

  it('a focused button that becomes loading is still document.activeElement', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Save' });
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(document.activeElement).toBe(button);
  });

  it('keeps focus when loading is set through rerender', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Button>Save</Button>);
    await user.tab();
    rerender(<Button loading>Save</Button>);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save' }));
  });
});

describe('Button: props pass-through', () => {
  it('appends className, forwards ref and native props to the button', () => {
    let node: HTMLButtonElement | null = null;
    render(
      <Button
        className="custom"
        ref={(el) => {
          node = el;
        }}
        aria-label="Custom label"
        data-testid="btn"
      >
        Go
      </Button>,
    );
    const button = screen.getByTestId('btn');
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveClass('custom');
    expect(node).toBe(button);
    expect(button).toHaveAccessibleName('Custom label');
  });

  it('calls onClick once with the event for a normal click and for Enter and Space', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
  });
});

describe('Button: importable from the package index', () => {
  it('exports Button and its prop types from the index', () => {
    expect(ButtonFromIndex).toBe(Button);
    const props: ButtonProps = { children: 'x', variant: 'ghost', size: 'sm', loading: false, type: 'reset' };
    expect(props.variant).toBe('ghost');
  });
});
