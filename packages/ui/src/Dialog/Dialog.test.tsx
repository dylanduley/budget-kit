import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useRef, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "../Button/Button";
import { Dialog as DialogFromIndex, type DialogProps } from "../index";
import { Dialog } from "./Dialog";

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
  expect(document.querySelector("[data-bk-dialog-root]")).toBeNull();
  expect(document.querySelector("[inert]")).toBeNull();
  expect(document.body.style.overflow).toBe("");
}

beforeEach(() => {
  document.body.style.overflow = "";
});

afterEach(() => {
  document.body.style.overflow = "";
});

describe("Dialog: closed renders nothing", () => {
  it("has no dialog role and no [data-bk-dialog-root] with open={false}", () => {
    render(
      <Dialog open={false} onClose={() => {}} title="Hidden">
        Body
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("[data-bk-dialog-root]")).toBeNull();
    expect(screen.queryByText("Body")).toBeNull();
  });

  it("does not touch inert or overflow on body while closed", () => {
    const main = document.createElement("main");
    document.body.appendChild(main);
    render(
      <Dialog open={false} onClose={() => {}} title="Hidden">
        Body
      </Dialog>,
    );
    expect(main).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");
    main.remove();
  });
});

describe("Dialog: open structure", () => {
  it("finds the panel by role and title with aria-modal and a level-2 heading", () => {
    render(
      <Dialog open onClose={() => {}} title="Edit budget" actions={twoActions}>
        <p>Body text</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Edit budget" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("tabindex", "-1");
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Edit budget",
    });
    expect(dialog).toContainElement(heading);
    expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
  });

  it("renders body and actions inside the panel, inside the dialog root attached to body", () => {
    render(
      <Dialog open onClose={() => {}} title="Edit budget" actions={twoActions}>
        <p>Body text</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector('[data-part="body"]')).toHaveTextContent(
      "Body text",
    );
    const actions = dialog.querySelector('[data-part="actions"]');
    expect(actions).not.toBeNull();
    expect(actions).toContainElement(
      screen.getByRole("button", { name: "Save" }),
    );
    expect(actions).toContainElement(
      screen.getByRole("button", { name: "Cancel" }),
    );
    const root = document.querySelector("[data-bk-dialog-root]");
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
    expect(
      screen.getByRole("dialog").querySelector('[data-part="actions"]'),
    ).toBeNull();
  });

  it("puts header, body, actions in DOM order", () => {
    render(
      <Dialog open onClose={() => {}} title="Edit budget" actions={twoActions}>
        Body
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    const heading = screen.getByRole("heading", { level: 2 });
    const body = dialog.querySelector('[data-part="body"]') as Element;
    const actions = dialog.querySelector('[data-part="actions"]') as Element;
    expect(
      heading.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      body.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("appends className on the panel", () => {
    render(
      <Dialog open onClose={() => {}} title="T" className="extra">
        Body
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toHaveClass("extra");
  });

  it("is exported from the package index with its props type", () => {
    expect(DialogFromIndex).toBe(Dialog);
    const props: DialogProps = {
      open: false,
      onClose: () => {},
      title: "t",
      children: null,
    };
    expect(props.open).toBe(false);
  });
});

describe("Dialog: opens from a trigger and focus moves in", () => {
  it("makes the panel document.activeElement after clicking the trigger", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(screen.getByRole("dialog", { name: "Edit budget" })).toHaveFocus();
  });

  it("focuses initialFocusRef.current instead of the panel when set", async () => {
    const user = userEvent.setup();
    render(<Harness withInitialFocus />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveFocus();
    expect(screen.getByRole("dialog")).not.toHaveFocus();
  });

  it("opens with Enter on the trigger (keyboard only)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Open dialog" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Open dialog" })).toHaveFocus();
  });
});

describe("Dialog: focus is trapped", () => {
  async function openWithActions() {
    const user = userEvent.setup();
    render(<Harness actions={twoActions} />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    return user;
  }

  it("Tab from the panel visits close, first action, second action, then wraps to close", async () => {
    const user = await openWithActions();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("Shift+Tab from the close button goes to the last action", async () => {
    const user = await openWithActions();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("Shift+Tab from the panel itself goes to the last tabbable", async () => {
    const user = await openWithActions();
    expect(screen.getByRole("dialog")).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });

  it("keeps focus inside the panel after 10 consecutive Tabs and 10 Shift+Tabs", async () => {
    const user = await openWithActions();
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 10; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 10; i++) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("wraps with only the close button inside (it is the single tabbable)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    const close = screen.getByRole("button", { name: "Close" });
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
  });

  it("keeps focus on the panel when nothing inside is tabbable", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open onClose={() => {}} title="Bare" closeLabel="Close">
        Body
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    // The close button is always present, so remove it from the tab order to model an empty trap.
    screen
      .getByRole("button", { name: "Close" })
      .setAttribute("tabindex", "-1");
    await user.tab();
    expect(dialog).toHaveFocus();
    await user.tab({ shift: true });
    expect(dialog).toHaveFocus();
  });

  it("cycles through several focusable elements in DOM order", async () => {
    const user = userEvent.setup();
    render(
      <Harness actions={twoActions}>
        <a href="#x">Link</a>
        <input aria-label="Name" />
        <textarea aria-label="Notes" />
      </Harness>,
    );
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    const order = ["Close", "Link", "Name", "Notes", "Cancel", "Save", "Close"];
    for (const name of order) {
      await user.tab();
      const active = document.activeElement as HTMLElement;
      expect(active).toHaveAccessibleName(name);
    }
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });

  it("skips a disabled button when cycling forwards and backwards", async () => {
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
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("pulls focus back into the panel if something outside receives focus", () => {
    render(
      <>
        <button>Outside</button>
        <Dialog open onClose={() => {}} title="T">
          Body
        </Dialog>
      </>,
    );
    screen.getByText("Outside").focus();
    expect(screen.getByRole("dialog")).toContainElement(
      document.activeElement as HTMLElement,
    );
  });
});

describe("Dialog: focus returns to the trigger on close", () => {
  it("returns focus after Escape", async () => {
    const user = userEvent.setup();
    render(<Harness actions={twoActions} />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("returns focus after the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness actions={twoActions} />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("returns focus after the close button is activated by Enter", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("returns focus when the parent sets open={false} itself", async () => {
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
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);
    expect(trigger).toHaveFocus();
    rerender(<Controlled open />);
    expect(screen.getByRole("dialog")).toHaveFocus();
    rerender(<Controlled open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("returns focus to the trigger when the Dialog is unmounted while open", () => {
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
    const trigger = screen.getByRole("button", { name: "Trigger" });
    trigger.focus();
    rerender(<Page showDialog />);
    expect(screen.getByRole("dialog")).toHaveFocus();
    rerender(<Page showDialog={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("does not throw when the trigger is removed from the document before close", () => {
    function Page({
      open,
      showTrigger,
    }: {
      open: boolean;
      showTrigger: boolean;
    }) {
      return (
        <>
          {showTrigger ? <button>Trigger</button> : null}
          <Dialog open={open} onClose={() => {}} title="T">
            Body
          </Dialog>
        </>
      );
    }
    const { rerender } = render(<Page open={false} showTrigger />);
    const trigger = screen.getByRole("button", { name: "Trigger" });
    trigger.focus();
    rerender(<Page open showTrigger />);
    expect(screen.getByRole("dialog")).toHaveFocus();
    expect(() => {
      rerender(<Page open={false} showTrigger={false} />);
    }).not.toThrow();
    expect(trigger.isConnected).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("[inert]")).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });
});

describe("Dialog: Esc closes it", () => {
  it("calls onClose exactly once for Escape with focus on the panel", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} closeOnRequest={false} />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(screen.getByRole("dialog")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose exactly once for Escape with focus on a button inside", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Harness onClose={onClose} closeOnRequest={false} actions={twoActions} />,
    );
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open until the parent sets open to false (onClose only requests)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} closeOnRequest={false} />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("calls onClose once per Escape across repeated presses", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} closeOnRequest={false} />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("Dialog: the close button closes it", () => {
  it("has a button named Close by default", () => {
    render(
      <Dialog open onClose={() => {}} title="T">
        Body
      </Dialog>,
    );
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("hides the × glyph from assistive tech", () => {
    render(
      <Dialog open onClose={() => {}} title="T">
        Body
      </Dialog>,
    );
    const glyph = screen
      .getByRole("button", { name: "Close" })
      .querySelector('[aria-hidden="true"]');
    expect(glyph).toHaveTextContent("×");
  });

  it("calls onClose exactly once when clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose exactly once on Enter", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose exactly once on Space", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    await user.tab();
    await user.keyboard(" ");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses closeLabel as the accessible name", () => {
    render(
      <Dialog open onClose={() => {}} title="T" closeLabel="Dismiss">
        Body
      </Dialog>,
    );
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});

describe("Dialog: onClose is not called for the backdrop or when closed", () => {
  it("does not call onClose when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    const backdrop = document.querySelector(
      '[data-part="backdrop"]',
    ) as HTMLElement;
    expect(backdrop).not.toBeNull();
    await user.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not call onClose on Escape while open={false}", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open={false} onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call onClose on Escape after it has been closed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Dialog: background is inert", () => {
  let main: HTMLElement;
  let preInert: HTMLElement;

  beforeEach(() => {
    main = document.createElement("main");
    main.textContent = "Page";
    document.body.appendChild(main);
    preInert = document.createElement("aside");
    preInert.setAttribute("inert", "");
    document.body.appendChild(preInert);
  });

  afterEach(() => {
    main.remove();
    preInert.remove();
  });

  it("marks body children inert and locks scroll while open, never the dialog container", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    const root = document.querySelector("[data-bk-dialog-root]") as HTMLElement;
    expect(main).toHaveAttribute("inert");
    expect(container).toHaveAttribute("inert");
    expect(root).not.toHaveAttribute("inert");
    expect(root.closest("[inert]")).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    for (const child of Array.from(document.body.children)) {
      if (child === root) continue;
      expect(child).toHaveAttribute("inert");
    }
  });

  it("removes inert and the scroll lock after close, keeping inert that was there before", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.keyboard("{Escape}");
    expect(main).not.toHaveAttribute("inert");
    expect(container).not.toHaveAttribute("inert");
    expect(preInert).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");
    expect(document.querySelector("[data-bk-dialog-root]")).toBeNull();
  });

  it("restores the previous body overflow value exactly", async () => {
    const user = userEvent.setup();
    document.body.style.overflow = "scroll";
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("leaves inert attributes with their original (empty) value", async () => {
    const user = userEvent.setup();
    preInert.setAttribute("inert", "");
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.keyboard("{Escape}");
    expect(preInert.getAttribute("inert")).toBe("");
  });

  it("cleans up on unmount while open and stops listening for Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = render(
      <Dialog open onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    expect(main).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(main).not.toHaveAttribute("inert");
    expect(preInert).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");
    expect(document.querySelector("[data-bk-dialog-root]")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("removes its Tab and focus listeners on unmount", () => {
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(
      <Dialog open onClose={() => {}} title="T">
        Body
      </Dialog>,
    );
    const handlers = added.mock.calls.filter(
      ([type]) => type === "keydown" || type === "focusin",
    );
    expect(handlers.map(([type]) => type).sort()).toEqual([
      "focusin",
      "keydown",
    ]);
    unmount();
    for (const [type, handler] of handlers) {
      expect(
        removed.mock.calls.some(([t, h]) => t === type && h === handler),
      ).toBe(true);
    }
    added.mockRestore();
    removed.mockRestore();

    // Behavioural check: a leaked handler would swallow Tab and pull focus back.
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    expect(outside).toHaveFocus();
    const tab = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    outside.remove();
  });

  it("leaves the document unchanged after opening, closing and reopening several times", async () => {
    const user = userEvent.setup();
    document.body.style.overflow = "auto";
    const { container } = render(<Harness actions={twoActions} />);
    const snapshot = () =>
      JSON.stringify({
        children: Array.from(document.body.children).map((c) => [
          c.tagName,
          c.getAttribute("inert"),
          c.getAttribute("data-bk-dialog-root"),
        ]),
        overflow: document.body.style.overflow,
      });
    const before = snapshot();
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    for (let i = 0; i < 4; i++) {
      await user.click(trigger);
      expect(screen.getByRole("dialog")).toHaveFocus();
      expect(main).toHaveAttribute("inert");
      expect(document.querySelectorAll("[data-bk-dialog-root]")).toHaveLength(
        1,
      );
      if (i % 2 === 0) await user.keyboard("{Escape}");
      else await user.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(snapshot()).toBe(before);
      expect(trigger).toHaveFocus();
    }
    expect(container).not.toHaveAttribute("inert");
    expect(preInert).toHaveAttribute("inert");
  });

  it("does not leave inert behind when a pre-inert element is toggled across reopen", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole("button", { name: "Open dialog" }));
      await user.keyboard("{Escape}");
    }
    expect(preInert).toHaveAttribute("inert");
    expect(main).not.toHaveAttribute("inert");
  });
});

describe("Dialog: unmount cleanup in a clean document", () => {
  it("leaves nothing behind when the whole tree unmounts while open", () => {
    const { unmount } = render(
      <Dialog open onClose={() => {}} title="T">
        Body
      </Dialog>,
    );
    unmount();
    expectCleanDocument();
  });

  it("leaves nothing behind when closed through Harness and then unmounted", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.keyboard("{Escape}");
    unmount();
    expectCleanDocument();
  });
});

describe("Dialog: focus trap skips elements that cannot take focus", () => {
  const trickyActions = (
    <>
      <Button variant="secondary">Cancel</Button>
      <Button variant="primary">Save</Button>
      <button hidden>Hidden last</button>
      <fieldset disabled>
        <button>Fieldset disabled</button>
      </fieldset>
      <div inert>
        <button>Inert wrapped</button>
      </div>
    </>
  );
  const real = ["Close", "One", "Cancel", "Save"];

  function renderTricky() {
    render(
      <Harness actions={trickyActions}>
        <button>One</button>
      </Harness>,
    );
  }

  function expectRealFocus() {
    const dialog = screen.getByRole("dialog");
    const active = document.activeElement as HTMLElement;
    expect(dialog).toContainElement(active);
    expect(active).not.toBe(dialog);
    expect(active.matches(":disabled")).toBe(false);
    expect(active.closest("[hidden], [inert]")).toBeNull();
    expect(real).toContain(
      active.getAttribute("aria-label") ?? active.textContent?.trim(),
    );
  }

  it("Tab from the last real focusable wraps to close, never stopping on hidden, disabled or inert ones", async () => {
    const user = userEvent.setup();
    renderTricky();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    for (const name of ["Close", "One", "Cancel", "Save"]) {
      await user.tab();
      expect(screen.getByRole("button", { name })).toHaveFocus();
    }
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("Shift+Tab from close goes to the last real focusable", async () => {
    const user = userEvent.setup();
    renderTricky();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });

  it("Shift+Tab from the panel itself lands on the last real focusable", async () => {
    const user = userEvent.setup();
    renderTricky();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });

  it("always lands on an enabled, visible element inside the panel over 10 Tabs and 10 Shift+Tabs", async () => {
    const user = userEvent.setup();
    renderTricky();
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    for (let i = 0; i < 10; i++) {
      await user.tab();
      expectRealFocus();
    }
    for (let i = 0; i < 10; i++) {
      await user.tab({ shift: true });
      expectRealFocus();
    }
  });

  it("does not stop on a button inside an ancestor with inert", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <div inert>
          <button>Behind inert</button>
        </div>
        <button>Reachable</button>
      </Harness>,
    );
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      await user.tab();
      seen.push(
        (document.activeElement as HTMLElement).getAttribute("aria-label") ??
          document.activeElement?.textContent ??
          "",
      );
    }
    expect(seen).toEqual([
      "Close",
      "Reachable",
      "Close",
      "Reachable",
      "Close",
      "Reachable",
    ]);
  });

  it("falls back to the panel when every candidate is hidden or disabled", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open onClose={() => {}} title="T">
        <button hidden>H</button>
      </Dialog>,
    );
    // Make the close button unfocusable too so no candidate is left.
    screen.getByRole("button", { name: "Close" }).setAttribute("disabled", "");
    await user.tab();
    expect(screen.getByRole("dialog")).toHaveFocus();
  });
});

describe("Dialog: Esc guards", () => {
  it("a plain Escape calls onClose exactly once", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape during IME composition does not call onClose", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        Body
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: "Escape", isComposing: true });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Escape whose default was prevented by an earlier document listener does not call onClose", () => {
    const onClose = vi.fn();
    const earlier = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener("keydown", earlier);
    try {
      render(
        <Dialog open onClose={onClose} title="T">
          Body
        </Dialog>,
      );
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("keydown", earlier);
    }
  });

  it("Escape handled by a nested widget (default prevented on its element) does not close", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        <input
          aria-label="Combo"
          onKeyDown={(e) => e.key === "Escape" && e.preventDefault()}
        />
      </Dialog>,
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Combo" }), {
      key: "Escape",
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Dialog: scrolling body becomes keyboard focusable", () => {
  const sizes = { scrollHeight: 100, clientHeight: 200 };

  class FakeResizeObserver {
    static instances: FakeResizeObserver[] = [];
    disconnected = false;
    observed: Element[] = [];
    constructor(private readonly callback: ResizeObserverCallback) {
      FakeResizeObserver.instances.push(this);
    }
    observe(target: Element) {
      this.observed.push(target);
    }
    unobserve() {}
    disconnect() {
      this.disconnected = true;
    }
    trigger() {
      this.callback([], this as unknown as ResizeObserver);
    }
  }

  function define(prop: "scrollHeight" | "clientHeight") {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        return this.getAttribute("data-part") === "body" ? sizes[prop] : 0;
      },
    });
  }

  beforeEach(() => {
    sizes.scrollHeight = 100;
    sizes.clientHeight = 200;
    FakeResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    define("scrollHeight");
    define("clientHeight");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // jsdom defines these on Element.prototype, so deleting the shadow restores them.
    Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
    Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
  });

  const body = () =>
    screen
      .getByRole("dialog")
      .querySelector('[data-part="body"]') as HTMLElement;

  it("has no tabindex and no role when the body does not overflow", () => {
    render(
      <Dialog open onClose={() => {}} title="T">
        Short
      </Dialog>,
    );
    expect(body()).not.toHaveAttribute("tabindex");
    expect(body()).not.toHaveAttribute("role");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("is a named region with tabindex 0 when the body overflows", () => {
    sizes.scrollHeight = 500;
    sizes.clientHeight = 200;
    render(
      <Dialog open onClose={() => {}} title="Long one">
        Tall
      </Dialog>,
    );
    expect(body()).toHaveAttribute("tabindex", "0");
    expect(body()).toHaveAttribute("role", "region");
    expect(screen.getByRole("region", { name: "Long one" })).toBe(body());
  });

  it("tab order is close, body, actions, close when the body overflows", async () => {
    const user = userEvent.setup();
    sizes.scrollHeight = 500;
    render(<Harness actions={twoActions} />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("region", { name: "Edit budget" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("tab order skips the body when it does not overflow", async () => {
    const user = userEvent.setup();
    render(<Harness actions={twoActions} />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("becomes focusable when the observer fires after content grows, and stops when it shrinks", () => {
    render(
      <Dialog open onClose={() => {}} title="T">
        Body
      </Dialog>,
    );
    expect(body()).not.toHaveAttribute("tabindex");
    const [observer] = FakeResizeObserver.instances;
    expect(observer).toBeDefined();
    expect(observer?.observed).toContain(body());

    sizes.scrollHeight = 500;
    act(() => observer?.trigger());
    expect(body()).toHaveAttribute("tabindex", "0");
    expect(body()).toHaveAttribute("role", "region");

    sizes.scrollHeight = 100;
    act(() => observer?.trigger());
    expect(body()).not.toHaveAttribute("tabindex");
    expect(body()).not.toHaveAttribute("role");
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = render(
      <Dialog open onClose={() => {}} title="T">
        Body
      </Dialog>,
    );
    const observers = [...FakeResizeObserver.instances];
    expect(observers.length).toBeGreaterThan(0);
    expect(observers.every((o) => !o.disconnected)).toBe(true);
    unmount();
    expect(observers.every((o) => o.disconnected)).toBe(true);
  });

  it("disconnects the observer when the dialog closes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    const observers = [...FakeResizeObserver.instances];
    expect(observers.length).toBeGreaterThan(0);
    await user.keyboard("{Escape}");
    expect(observers.every((o) => o.disconnected)).toBe(true);
  });
});

describe("Dialog: required props and unknown props", () => {
  it("omitting open, onClose, title or children is a type error", () => {
    // @ts-expect-error open is required
    const noOpen: DialogProps = {
      onClose: () => {},
      title: "t",
      children: null,
    };
    // @ts-expect-error onClose is required
    const noOnClose: DialogProps = { open: true, title: "t", children: null };
    // @ts-expect-error title is required
    const noTitle: DialogProps = {
      open: true,
      onClose: () => {},
      children: null,
    };
    // @ts-expect-error children is required
    const noChildren: DialogProps = {
      open: true,
      onClose: () => {},
      title: "t",
    };
    expect([noOpen, noOnClose, noTitle, noChildren]).toHaveLength(4);
  });

  it("does not forward unknown native props to the panel", () => {
    const extra = {
      id: "custom-id",
      "data-testid": "leak",
      "aria-label": "Override",
      lang: "fr",
    };
    render(
      <Dialog open onClose={() => {}} title="Real title" {...extra}>
        Body
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Real title" });
    expect(dialog).not.toHaveAttribute("id", "custom-id");
    expect(dialog).not.toHaveAttribute("data-testid");
    expect(dialog).not.toHaveAttribute("aria-label");
    expect(dialog).not.toHaveAttribute("lang");
    expect(document.getElementById("custom-id")).toBeNull();
  });
});

describe("Dialog: StrictMode", () => {
  it("opens and closes cleanly with no inert, no leftover root, and overflow restored", async () => {
    const user = userEvent.setup();
    document.body.style.overflow = "auto";
    render(
      <StrictMode>
        <Harness actions={twoActions} />
      </StrictMode>,
    );
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    for (let i = 0; i < 2; i++) {
      await user.click(trigger);
      expect(screen.getByRole("dialog")).toHaveFocus();
      expect(document.querySelectorAll("[data-bk-dialog-root]")).toHaveLength(
        1,
      );
      expect(document.body.style.overflow).toBe("hidden");
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.querySelector("[data-bk-dialog-root]")).toBeNull();
      expect(document.querySelector("[inert]")).toBeNull();
      expect(document.body.style.overflow).toBe("auto");
      expect(trigger).toHaveFocus();
    }
  });

  it("calls onClose exactly once per Escape under StrictMode", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <StrictMode>
        <Harness onClose={onClose} closeOnRequest={false} />
      </StrictMode>,
    );
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Dialog: title row is not a banner landmark", () => {
  const LANDMARKS =
    'header, footer, nav, main, aside, form, [role="banner"], [role="contentinfo"], [role="navigation"], [role="main"], [role="complementary"], [role="search"], [role="form"]';

  it("the dialog contains no header element and no banner role", () => {
    render(
      <Dialog open onClose={() => {}} title="Edit budget" actions={twoActions}>
        Body
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelectorAll("header")).toHaveLength(0);
    expect(dialog.querySelectorAll('[role="banner"]')).toHaveLength(0);
    expect(screen.queryByRole("banner")).toBeNull();
  });

  it("the title row is a plain div holding the h2 first and the close button second", () => {
    render(
      <Dialog open onClose={() => {}} title="Edit budget">
        Body
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Edit budget" });
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Edit budget",
    });
    expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
    const row = heading.parentElement as HTMLElement;
    expect(row.tagName).toBe("DIV");
    expect(row.parentElement).toBe(dialog);
    expect(row.children).toHaveLength(2);
    expect(row.children[0]).toBe(heading);
    expect(row.children[1]).toBe(screen.getByRole("button", { name: "Close" }));
  });

  it("contains no landmark-mapping element other than the scrollable body region", () => {
    const sizes = { scrollHeight: 500, clientHeight: 200 };
    for (const prop of ["scrollHeight", "clientHeight"] as const) {
      Object.defineProperty(HTMLElement.prototype, prop, {
        configurable: true,
        get(this: HTMLElement) {
          return this.getAttribute("data-part") === "body" ? sizes[prop] : 0;
        },
      });
    }
    try {
      render(
        <Dialog
          open
          onClose={() => {}}
          title="Edit budget"
          actions={twoActions}
        >
          Body
        </Dialog>,
      );
      const dialog = screen.getByRole("dialog");
      expect(dialog.querySelectorAll(LANDMARKS)).toHaveLength(0);
      const body = dialog.querySelector('[data-part="body"]');
      expect(body).toHaveAttribute("role", "region");
      expect(screen.getAllByRole("region")).toEqual([body]);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
      Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    }
  });

  it("with a page banner and an open dialog, the only header is the page banner and none has the dialog as ancestor", () => {
    render(
      <>
        <header data-testid="page-banner">
          <a href="/">Budget Kit</a>
        </header>
        <main>
          <Dialog
            open
            onClose={() => {}}
            title="Edit budget"
            actions={twoActions}
          >
            Body
          </Dialog>
        </main>
      </>,
    );
    const dialog = screen.getByRole("dialog");
    const headers = Array.from(document.querySelectorAll("header"));
    expect(headers).toEqual([screen.getByTestId("page-banner")]);
    for (const h of headers) {
      expect(h.contains(dialog)).toBe(false);
      expect(dialog.contains(h)).toBe(false);
    }
    expect(dialog.closest("header")).toBeNull();
    expect(
      Array.from(document.querySelectorAll("header")).filter((h) =>
        dialog.contains(h),
      ),
    ).toHaveLength(0);
  });
});
