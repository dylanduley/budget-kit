import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../Button/Button';
import { Dialog as DialogFromIndex, type DialogProps } from '../index';
import { Dialog } from './Dialog';

interface HarnessProps {
  onClose?: () => void;
  actions?: ReactNode;
  children?: ReactNode;
  closeLabel?: string;
  withInitialFocus?: boolean;
  closeOnRequest?: boolean;
}

// A controlled consumer: owns `open`, renders the trigger, and exposes a parent-side close button outside the dialog.
function Harness({
  onClose,
  actions,
  children = <p>Body text</p>,
  closeLabel,
  withInitialFocus = false,
  closeOnRequest = true,
}: HarnessProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Button onClick={() => setOpen(false)}>Parent close</Button>
      <Dialog
        open={open}
        title="Edit budget"
        closeLabel={closeLabel}
        initialFocusRef={withInitialFocus ? inputRef : undefined}
        actions={actions}
        onClose={() => {
          onClose?.();
          if (closeOnRequest) setOpen(false);
        }}
      >
        {children}
        {withInitialFocus ? (
          <label>
            Amount
            <input ref={inputRef} type="text" />
          </label>
        ) : null}
      </Dialog>
    </div>
  );
}

const twoActions = (
  <>
    <Button variant="secondary">Cancel</Button>
    <Button variant="primary">Save</Button>
  </>
);

function expectCleanDocument() {
  expect(document.querySelector('[data-bk-dialog-root]')).toBeNull();
  expect(document.querySelector('[inert]')).toBeNull();
  expect(document.body.style.overflow).toBe('');
}

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  document.body.style.overflow = '';
});

describe('Dialog: closed renders nothing', () => {
  it('has no dialog role and no [data-bk-dialog-root] with open={false}', () => {
    render(
      <Dialog open={false} onClose={() => {}} title="Hidden">
        Body
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[data-bk-dialog-root]')).toBeNull();
    expect(screen.queryByText('Body')).toBeNull();
  });

  it('does not touch inert or overflow on body while closed', () => {
    const main = document.createElement('main');
    document.body.appendChild(main);
    render(
      <Dialog open={false} onClose={() => {}} title="Hidden">
        Body
      </Dialog>,
    );
    expect(main).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
    main.remove();
  });
});

describe('Dialog: open structure', () => {
  it('finds the panel by role and title with aria-modal and a level-2 heading', () => {
    render(
      <Dialog open onClose={() => {}} title="Edit budget" actions={twoActions}>
        <p>Body text</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit budget' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('tabindex', '-1');
    const heading = screen.getByRole('heading', { level: 2, name: 'Edit budget' });
    expect(dialog).toContainElement(heading);
    expect(dialog).toHaveAttribute('aria-labelledby', heading.id);
  });

  it('renders body and actions inside the panel, inside the dialog root attached to body', () => {
    render(
      <Dialog open onClose={() => {}} title="Edit budget" actions={twoActions}>
        <p>Body text</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('[data-part="body"]')).toHaveTextContent('Body text');
    const actions = dialog.querySelector('[data-part="actions"]');
    expect(actions).not.toBeNull();
    expect(actions).toContainElement(screen.getByRole('button', { name: 'Save' }));
    expect(actions).toContainElement(screen.getByRole('button', { name: 'Cancel' }));
    const root = document.querySelector('[data-bk-dialog-root]');
    expect(root?.parentElement).toBe(document.body);
    expect(root).toContainElement(dialog);
    expect(root?.querySelector('[data-part="backdrop"]')).not.toBeNull();
  });

  it('renders no [data-part="actions"] without actions', () => {
    render(
      <Dialog open onClose={() => {}} title="Edit budget">
        Body
      </Dialog>,
    );
    expect(screen.getByRole('dialog').querySelector('[data-part="actions"]')).toBeNull();
  });

  it('puts header, body, actions in DOM order', () => {
    render(
      <Dialog open onClose={() => {}} title="Edit budget" actions={twoActions}>
        Body
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    const heading = screen.getByRole('heading', { level: 2 });
    const body = dialog.querySelector('[data-part="body"]') as Element;
    const actions = dialog.querySelector('[data-part="actions"]') as Element;
    expect(heading.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(body.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('appends className on the panel', () => {
    render(
      <Dialog open onClose={() => {}} title="T" className="extra">
        Body
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('extra');
  });

  it('is exported from the package index with its props type', () => {
    expect(DialogFromIndex).toBe(Dialog);
    const props: DialogProps = { open: false, onClose: () => {}, title: 't', children: null };
    expect(props.open).toBe(false);
  });
});

describe('Dialog: opens from a trigger and focus moves in', () => {
  it('makes the panel document.activeElement after clicking the trigger', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(screen.getByRole('dialog', { name: 'Edit budget' })).toHaveFocus();
  });

  it('focuses initialFocusRef.current instead of the panel when set', async () => {
    const user = userEvent.setup();
    render(<Harness withInitialFocus />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveFocus();
    expect(screen.getByRole('dialog')).not.toHaveFocus();
  });

  it('opens with Enter on the trigger (keyboard only)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Open dialog' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open dialog' })).toHaveFocus();
  });
});

describe('Dialog: focus is trapped', () => {
  async function openWithActions() {
    const user = userEvent.setup();
    render(<Harness actions={twoActions} />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    return user;
  }

  it('Tab from the panel visits close, first action, second action, then wraps to close', async () => {
    const user = await openWithActions();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('Shift+Tab from the close button goes to the last action', async () => {
    const user = await openWithActions();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('Shift+Tab from the panel itself goes to the last tabbable', async () => {
    const user = await openWithActions();
    expect(screen.getByRole('dialog')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('keeps focus inside the panel after 10 consecutive Tabs and 10 Shift+Tabs', async () => {
    const user = await openWithActions();
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 10; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 10; i++) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('wraps with only the close button inside (it is the single tabbable)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    const close = screen.getByRole('button', { name: 'Close' });
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
  });

  it('keeps focus on the panel when nothing inside is tabbable', async () => {
    const user = userEvent.setup();
    render(
      <Dialog open onClose={() => {}} title="Bare" closeLabel="Close">
        Body
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    // The close button is always present, so remove it from the tab order to model an empty trap.
    screen.getByRole('button', { name: 'Close' }).setAttribute('tabindex', '-1');
    await user.tab();
    expect(dialog).toHaveFocus();
    await user.tab({ shift: true });
    expect(dialog).toHaveFocus();
  });

  it('cycles through several focusable elements in DOM order', async () => {
    const user = userEvent.setup();
    render(
      <Harness actions={twoActions}>
        <a href="#x">Link</a>
        <input aria-label="Name" />
        <textarea aria-label="Notes" />
      </Harness>,
    );
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    const order = ['Close', 'Link', 'Name', 'Notes', 'Cancel', 'Save', 'Close'];
    for (const name of order) {
      await user.tab();
      const active = document.activeElement as HTMLElement;
      expect(active).toHaveAccessibleName(name);
    }
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('skips a disabled button when cycling forwards and backwards', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        actions={
          <>
            <Button variant="secondary">Cancel</Button>
            <Button variant="primary" disabled>
              Save
            </Button>
          </>
        }
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('pulls focus back into the panel if something outside receives focus', () => {
    render(
      <>
        <button>Outside</button>
        <Dialog open onClose={() => {}} title="T">
          Body
        </Dialog>
      </>,
    );
    screen.getByText('Outside').focus();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });
});

describe('Dialog: focus returns to the trigger on close', () => {
  it('returns focus after Escape', async () => {
    const user = userEvent.setup();
    render(<Harness actions={twoActions} />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('returns focus after the close button is clicked', async () => {
    const user = userEvent.setup();
    render(<Harness actions={twoActions} />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('returns focus after the close button is activated by Enter', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('returns focus when the parent sets open={false} itself', async () => {
    const user = userEvent.setup();
    function Controlled({ open }: { open: boolean }) {
      return (
        <div>
          <Button>Open dialog</Button>
          <Dialog open={open} onClose={() => {}} title="T">
            Body
          </Dialog>
        </div>
      );
    }
    const { rerender } = render(<Controlled open={false} />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    expect(trigger).toHaveFocus();
    rerender(<Controlled open />);
    expect(screen.getByRole('dialog')).toHaveFocus();
    rerender(<Controlled open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('returns focus to the trigger when the Dialog is unmounted while open', () => {
    function Page({ showDialog }: { showDialog: boolean }) {
      return (
        <div>
          <button>Trigger</button>
          {showDialog ? (
            <Dialog open onClose={() => {}} title="T">
              Body
            </Dialog>
          ) : null}
        </div>
      );
    }
    const { rerender } = render(<Page showDialog={false} />);
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    trigger.focus();
    rerender(<Page showDialog />);
    expect(screen.getByRole('dialog')).toHaveFocus();
    rerender(<Page showDialog={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('does not throw when the trigger is removed from the document before close', () => {
    const { rerender } = render(
      <>
        <button>Trigger</button>
        <Dialog open={false} onClose={() => {}} title="T">
          Body
        </Dialog>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    trigger.focus();
    rerender(
      <>
        <button>Trigger</button>
        <Dialog open onClose={() => {}} title="T">
          Body
        </Dialog>
      </>,
    );
    expect(() => {
      rerender(<Dialog open={false} onClose={() => {}} title="T">Body</Dialog>);
    }).not.toThrow();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[inert]')).toBeNull();
  });
});

describe('Dialog: Esc closes it', () => {
  it('calls onClose exactly once for Escape with focus on the panel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} closeOnRequest={false} />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(screen.getByRole('dialog')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose exactly once for Escape with focus on a button inside', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} closeOnRequest={false} actions={twoActions} />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open until the parent sets open to false (onClose only requests)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} closeOnRequest={false} />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onClose once per Escape across repeated presses', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} closeOnRequest={false} />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.keyboard('{Escape}');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('Dialog: the close button closes it', () => {
  it('has a button named Close by default', () => {
    render(
      <Dialog open onClose={() => {}} title="T">
        Body
      </Dialog>,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('hides the × glyph from assistive tech', () => {
    render(
      <Dialog open onClose={() => {}} title="T">
        Body
      </Dialog>,
    );
    const glyph = screen.getByRole('button', { name: 'Close' }).querySelector('[aria-hidden="true"]');
    expect(glyph).toHaveTextContent('×');
  });

  it('calls onClose exactly once when clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose exactly once on Enter', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose exactly once on Space', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    await user.tab();
    await user.keyboard(' ');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses closeLabel as the accessible name', () => {
    render(
      <Dialog open onClose={() => {}} title="T" closeLabel="Dismiss">
        Body
      </Dialog>,
    );
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });
});

describe('Dialog: onClose is not called for the backdrop or when closed', () => {
  it('does not call onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    const backdrop = document.querySelector('[data-part="backdrop"]') as HTMLElement;
    expect(backdrop).not.toBeNull();
    await user.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not call onClose on Escape while open={false}', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open={false} onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not call onClose on Escape after it has been closed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Dialog: background is inert', () => {
  let main: HTMLElement;
  let preInert: HTMLElement;

  beforeEach(() => {
    main = document.createElement('main');
    main.textContent = 'Page';
    document.body.appendChild(main);
    preInert = document.createElement('aside');
    preInert.setAttribute('inert', '');
    document.body.appendChild(preInert);
  });

  afterEach(() => {
    main.remove();
    preInert.remove();
  });

  it('marks body children inert and locks scroll while open, never the dialog container', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    const root = document.querySelector('[data-bk-dialog-root]') as HTMLElement;
    expect(main).toHaveAttribute('inert');
    expect(container).toHaveAttribute('inert');
    expect(root).not.toHaveAttribute('inert');
    expect(root.closest('[inert]')).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    for (const child of Array.from(document.body.children)) {
      if (child === root) continue;
      expect(child).toHaveAttribute('inert');
    }
  });

  it('removes inert and the scroll lock after close, keeping inert that was there before', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.keyboard('{Escape}');
    expect(main).not.toHaveAttribute('inert');
    expect(container).not.toHaveAttribute('inert');
    expect(preInert).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
    expect(document.querySelector('[data-bk-dialog-root]')).toBeNull();
  });

  it('restores the previous body overflow value exactly', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'scroll';
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('leaves inert attributes with their original (empty) value', async () => {
    const user = userEvent.setup();
    preInert.setAttribute('inert', '');
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.keyboard('{Escape}');
    expect(preInert.getAttribute('inert')).toBe('');
  });

  it('cleans up on unmount while open and stops listening for Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = render(
      <Dialog open onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    expect(main).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(main).not.toHaveAttribute('inert');
    expect(preInert).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
    expect(document.querySelector('[data-bk-dialog-root]')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes its Tab and focus listeners on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <>
        <button>A</button>
        <button>B</button>
        <Dialog open onClose={() => {}} title="T">
          Body
        </Dialog>
      </>,
    );
    unmount();
    document.body.innerHTML = '<button id="a">A</button><button id="b">B</button>';
    (document.getElementById('a') as HTMLElement).focus();
    await user.tab();
    expect(document.getElementById('b')).toHaveFocus();
    document.body.innerHTML = '';
  });

  it('leaves the document unchanged after opening, closing and reopening several times', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'auto';
    const { container } = render(<Harness actions={twoActions} />);
    const snapshot = () =>
      JSON.stringify({
        children: Array.from(document.body.children).map((c) => [
          c.tagName,
          c.getAttribute('inert'),
          c.getAttribute('data-bk-dialog-root'),
        ]),
        overflow: document.body.style.overflow,
      });
    const before = snapshot();
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    for (let i = 0; i < 4; i++) {
      await user.click(trigger);
      expect(screen.getByRole('dialog')).toHaveFocus();
      expect(main).toHaveAttribute('inert');
      expect(document.querySelectorAll('[data-bk-dialog-root]')).toHaveLength(1);
      if (i % 2 === 0) await user.keyboard('{Escape}');
      else await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(snapshot()).toBe(before);
      expect(trigger).toHaveFocus();
    }
    expect(container).not.toHaveAttribute('inert');
    expect(preInert).toHaveAttribute('inert');
  });

  it('does not leave inert behind when a pre-inert element is toggled across reopen', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: 'Open dialog' }));
      await user.keyboard('{Escape}');
    }
    expect(preInert).toHaveAttribute('inert');
    expect(main).not.toHaveAttribute('inert');
  });
});

describe('Dialog: unmount cleanup in a clean document', () => {
  it('leaves nothing behind when the whole tree unmounts while open', () => {
    const { unmount } = render(
      <Dialog open onClose={() => {}} title="T">
        Body
      </Dialog>,
    );
    unmount();
    expectCleanDocument();
  });

  it('leaves nothing behind when closed through Harness and then unmounted', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.keyboard('{Escape}');
    unmount();
    expectCleanDocument();
  });
});
