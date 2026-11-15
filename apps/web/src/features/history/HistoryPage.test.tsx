import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DeleteAllData } from "@/features/history/DeleteAllData";
import type { BudgetState } from "@/lib/budget";
import { STORAGE_KEY } from "@/state/storage";
import { expectNoAxeViolations } from "@/test/axe";
import { BOOK, OCTOBER, SCENARIO } from "@/test/fixtures";
import { createMemoryStorage } from "@/test/memoryStorage";
import { testRouter } from "@/test/nextNavigation";
import { renderApp } from "@/test/renderApp";
import { renderWithFakeBudget } from "@/test/renderWithFakeBudget";

const SEPTEMBER: BudgetState = {
  month: "2026-09",
  incomeCents: 0,
  categories: [{ id: "c-sep", name: "Misc", plannedCents: 0 }],
  expenses: [
    {
      id: "s1",
      categoryId: "c-sep",
      amountCents: 2000,
      note: "",
      date: "2026-09-10",
    },
  ],
};
const BOOK3 = { months: [SEPTEMBER, OCTOBER, SCENARIO] };

const BODY =
  "This deletes the income, categories and expenses of every month saved in this browser. You can't undo this.";
const CONFIRMATION =
  "All data deleted. You're starting fresh with November 2026.";
const EMPTY_STORED = '{"version":2,"book":{"months":[]}}';

beforeEach(() => {
  testRouter.push.mockClear();
});

function rowTexts(): string[][] {
  const table = screen.getByRole("table", { name: "Months" });
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => Array.from(row.children).map((c) => c.textContent ?? ""));
}

const NOV = [
  "November 2026 (this month)",
  "$3,200.00",
  "$1,694.82",
  "$1,505.18",
  "View",
];
const OCT = ["October 2026", "$3,000.00", "$3,494.82", "-$494.82", "View"];
const SEP = ["September 2026", "Not set", "$20.00", "Not set", "View"];
const EMPTY_ROW = [
  "November 2026 (this month)",
  "Not set",
  "$0.00",
  "Not set",
  "View",
];

describe("Months table rows", () => {
  it("seeded BOOK, today 2026-11-14: two body rows, newest first, matching the examples", () => {
    renderApp({ book: BOOK, path: "/history" });
    expect(rowTexts()).toEqual([NOV, OCT]);
  });

  it("Month is the row header and the columns are Month, Income, Spent, Left, Actions", () => {
    renderApp({ book: BOOK, path: "/history" });
    const table = screen.getByRole("table", { name: "Months" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Month", "Income", "Spent", "Left", "Actions"]);
    expect(
      within(table).getByRole("rowheader", { name: "October 2026" }),
    ).toBeInTheDocument();
    expect(within(table).getAllByRole("rowheader")).toHaveLength(2);
  });

  it('the card region is named "Your months" and the table is named "Months"', () => {
    renderApp({ book: BOOK, path: "/history" });
    const region = screen.getByRole("region", { name: "Your months" });
    expect(
      within(region).getByRole("table", { name: "Months" }),
    ).toBeInTheDocument();
    // The library's scroll region around the table carries the table name, so each name is unique.
    expect(screen.getAllByRole("region", { name: "Your months" })).toHaveLength(
      1,
    );
    expect(screen.getAllByRole("region", { name: "Months" })).toHaveLength(1);
  });

  it("adding a September month with income 0 and one 2000 expense gives a third row", () => {
    renderApp({ book: BOOK3, path: "/history" });
    expect(rowTexts()).toEqual([NOV, OCT, SEP]);
  });

  it("rows are newest first even when the stored order is oldest first", () => {
    renderApp({
      book: { months: [SEPTEMBER, SCENARIO, OCTOBER] },
      path: "/history",
    });
    expect(rowTexts().map((r) => r[0])).toEqual([
      "November 2026 (this month)",
      "October 2026",
      "September 2026",
    ]);
  });

  it("only the current month is marked (this month)", () => {
    renderApp({ book: BOOK3, path: "/history" });
    expect(screen.getAllByText(/\(this month\)/)).toHaveLength(1);
  });

  it("today 2026-12-02: three rows, first is the unsaved current month copied from November, storage untouched", () => {
    const { storage } = renderApp({
      book: BOOK,
      today: "2026-12-02",
      path: "/history",
    });
    expect(rowTexts()).toEqual([
      ["December 2026 (this month)", "$3,200.00", "$0.00", "$3,200.00", "View"],
      ["November 2026", "$3,200.00", "$1,694.82", "$1,505.18", "View"],
      OCT,
    ]);
    expect(storage.setItemCalls).toBe(0);
  });

  it("empty storage: one row for the current month with Not set, $0.00, Not set", () => {
    renderApp({ path: "/history" });
    expect(rowTexts()).toEqual([EMPTY_ROW]);
  });

  it("a stored book with no months also shows the single current-month row", () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: EMPTY_STORED });
    renderApp({ storage, path: "/history" });
    expect(rowTexts()).toEqual([EMPTY_ROW]);
  });

  it("has one h1 History and shows no Not-set text for months that have income", () => {
    renderApp({ book: BOOK, path: "/history" });
    expect(
      screen.getByRole("heading", { level: 1, name: "History" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Not set")).not.toBeInTheDocument();
  });
});

describe("View buttons", () => {
  it("each View button is named View {Month YYYY}", () => {
    renderApp({ book: BOOK3, path: "/history" });
    expect(
      screen.getByRole("button", { name: "View November 2026" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View October 2026" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View September 2026" }),
    ).toBeInTheDocument();
  });

  it('View October 2026: pushes "/" once, shows October on Overview, writes nothing', async () => {
    const { user, storage } = renderApp({ book: BOOK, path: "/history" });
    const before = storage.setItemCalls;
    const dump = storage.dump();
    await user.click(screen.getByRole("button", { name: "View October 2026" }));
    expect(testRouter.push).toHaveBeenCalledTimes(1);
    expect(testRouter.push).toHaveBeenCalledWith("/");
    expect(
      screen.getByRole("heading", { level: 1, name: "Overview" }),
    ).toBeInTheDocument();
    const stat = (label: string): HTMLElement =>
      screen.getByText(label, { selector: '[data-part="label"]' })
        .parentElement as HTMLElement;
    expect(stat("Income")).toHaveTextContent("$3,000.00");
    expect(stat("Left to spend")).toHaveTextContent("-$494.82");
    const card = screen.getByRole("region", { name: "Spending by category" });
    const groceries = within(card)
      .getByText("Groceries")
      .closest("li") as HTMLElement;
    expect(groceries).toHaveTextContent(
      "$1,994.82 of $400.00, over by $1,594.82",
    );
    expect(within(groceries).getByText("Over budget")).toBeInTheDocument();
    expect(storage.setItemCalls).toBe(before);
    expect(storage.dump()).toEqual(dump);
  });

  it("View on the current month still navigates to Overview", async () => {
    const { user } = renderApp({ book: BOOK, path: "/history" });
    await user.click(
      screen.getByRole("button", { name: "View November 2026" }),
    );
    expect(testRouter.push).toHaveBeenCalledExactlyOnceWith("/");
    expect(
      screen.getByRole("heading", { level: 1, name: "Overview" }),
    ).toBeInTheDocument();
  });

  it("keyboard: Tab reaches each View button then Delete all data; Enter on View September 2026 works", async () => {
    const { user } = renderApp({ book: BOOK3, path: "/history" });
    const region = screen.getByRole("region", { name: "Your months" });
    const tabbed: string[] = [];
    for (let i = 0; i < 40 && tabbed.length < 5; i += 1) {
      await user.tab();
      const el = document.activeElement as HTMLElement;
      if (el.matches("button"))
        tabbed.push(el.getAttribute("aria-label") ?? el.textContent ?? "");
    }
    expect(tabbed).toEqual([
      "Add expense",
      "View November 2026",
      "View October 2026",
      "View September 2026",
      "Delete all data",
    ]);
    expect(region).toBeInTheDocument();
    screen.getByRole("button", { name: "View September 2026" }).focus();
    await user.keyboard("{Enter}");
    expect(testRouter.push).toHaveBeenCalledExactlyOnceWith("/");
    expect(
      screen.getByRole("heading", { level: 1, name: "Overview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Spent", { selector: '[data-part="label"]' })
        .parentElement,
    ).toHaveTextContent("$20.00");
  });

  it("keyboard: the table region is focusable (scrollable region) before the View buttons", async () => {
    const { user } = renderApp({ book: BOOK, path: "/history" });
    const seen: HTMLElement[] = [];
    for (let i = 0; i < 40; i += 1) {
      await user.tab();
      seen.push(document.activeElement as HTMLElement);
      if (
        document.activeElement ===
        screen.getByRole("button", { name: "View November 2026" })
      )
        break;
    }
    const table = screen.getByRole("table", { name: "Months" });
    expect(
      seen.some(
        (el) =>
          el.contains(table) && el !== document.body && el.tagName !== "BUTTON",
      ),
    ).toBe(true);
  });
});

describe("Delete all data: opening and cancelling", () => {
  it("the trigger is always present, even with no months", () => {
    renderApp({ path: "/history" });
    expect(
      screen.getByRole("region", { name: "Start over" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete all data" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Delete every month saved in this browser and begin again.",
      ),
    ).toBeInTheDocument();
  });

  it("opens the dialog Delete all data? with the exact body, focus on Cancel, order Cancel then Delete", async () => {
    const { user } = renderApp({ book: BOOK, path: "/history" });
    await user.click(screen.getByRole("button", { name: "Delete all data" }));
    const dialog = screen.getByRole("dialog", { name: "Delete all data?" });
    expect(within(dialog).getByText(BODY)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    const buttons = within(dialog)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(buttons.slice(-2)).toEqual(["Cancel", "Delete all data"]);
  });

  it("the dialog Delete all data is danger, the trigger is not; one dialog; header Add expense is inert", async () => {
    const { user } = renderApp({ book: BOOK, path: "/history" });
    const trigger = screen.getByRole("button", { name: "Delete all data" });
    expect(trigger).not.toHaveAttribute("data-variant", "danger");
    await user.click(trigger);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: "Delete all data" }),
    ).toHaveAttribute("data-variant", "danger");
    const add = document.querySelector(
      "header [aria-haspopup], header button",
    ) as HTMLElement | null;
    const addButtons = Array.from(document.querySelectorAll("button")).filter(
      (b) => b.textContent === "Add expense",
    );
    expect(addButtons.length).toBeGreaterThan(0);
    for (const b of addButtons) expect(b.closest("[inert]")).not.toBeNull();
    expect(add).not.toBeNull();
  });

  it.each([
    [
      "Cancel",
      async (u: ReturnType<typeof renderApp>["user"]) =>
        u.click(screen.getByRole("button", { name: "Cancel" })),
    ],
    [
      "Esc",
      async (u: ReturnType<typeof renderApp>["user"]) => u.keyboard("{Escape}"),
    ],
    [
      "the close button",
      async (u: ReturnType<typeof renderApp>["user"]) =>
        u.click(
          within(screen.getByRole("dialog")).getByRole("button", {
            name: /close/i,
          }),
        ),
    ],
  ])(
    "%s closes the dialog, storage is byte-identical, focus returns to the trigger",
    async (_name, dismiss) => {
      const { user, storage } = renderApp({ book: BOOK, path: "/history" });
      const dump = storage.dump();
      const calls = storage.setItemCalls;
      const trigger = screen.getByRole("button", { name: "Delete all data" });
      await user.click(trigger);
      await dismiss(user);
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(storage.dump()).toEqual(dump);
      expect(storage.setItemCalls).toBe(calls);
      expect(trigger).toHaveFocus();
      expect(screen.queryByText(CONFIRMATION)).not.toBeInTheDocument();
      expect(rowTexts()).toEqual([NOV, OCT]);
    },
  );

  it("each dismissal works from a fresh open (reopen after Cancel starts on Cancel again)", async () => {
    const { user } = renderApp({ book: BOOK, path: "/history" });
    await user.click(screen.getByRole("button", { name: "Delete all data" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Delete all data" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });
});

describe("Delete all data: confirming", () => {
  async function confirm(
    user: ReturnType<typeof renderApp>["user"],
  ): Promise<void> {
    await user.click(screen.getByRole("button", { name: "Delete all data" }));
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete all data" }),
    );
  }

  it('writes exactly {"version":2,"book":{"months":[]}} and readStoredBook() is { months: [] }', async () => {
    const { user, storage, readStoredBook } = renderApp({
      book: BOOK3,
      path: "/history",
    });
    await confirm(user);
    expect(storage.dump()[STORAGE_KEY]).toBe(EMPTY_STORED);
    expect(readStoredBook()).toEqual({ months: [] });
  });

  it("closes the dialog, shows the single current-month row, and focuses the confirmation paragraph", async () => {
    const { user } = renderApp({ book: BOOK, path: "/history" });
    await confirm(user);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const confirmation = screen.getByText(CONFIRMATION);
    expect(confirmation).toHaveFocus();
    expect(document.activeElement).toBe(confirmation);
    expect(rowTexts()).toEqual([EMPTY_ROW]);
  });

  it("focus stays on the confirmation paragraph after further renders flush (a late Dialog focus return cannot steal it)", async () => {
    const { user } = renderApp({ book: BOOK, path: "/history" });
    await confirm(user);
    const confirmation = screen.getByText(CONFIRMATION);
    expect(document.activeElement).toBe(confirmation);
    await act(async () => undefined);
    await act(async () => undefined);
    expect(document.activeElement).toBe(confirmation);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.querySelector("[data-bk-dialog-root]")).toBeNull();
  });

  it("the confirmation is plain (not an alert or status) and stays until leaving the page", async () => {
    const { user } = renderApp({ book: BOOK, path: "/history" });
    await confirm(user);
    const confirmation = screen.getByText(CONFIRMATION);
    expect(confirmation).not.toHaveAttribute("role");
    expect(
      document.querySelectorAll('[role="alert"], [role="status"], [aria-live]'),
    ).toHaveLength(0);
    await user.click(
      screen.getByRole("button", { name: "View November 2026" }),
    );
    expect(screen.queryByText(CONFIRMATION)).not.toBeInTheDocument();
  });

  it("afterwards / shows the welcome line, /plan is the empty first-run form, and refresh() is still empty", async () => {
    const { user, goTo, refresh, readStoredBook } = renderApp({
      book: BOOK,
      path: "/history",
    });
    await confirm(user);
    goTo("/");
    expect(
      screen.getByText(/^Welcome\. Start on the Plan page/),
    ).toBeInTheDocument();
    goTo("/plan");
    // The first-run suggestions arrive with task 23; here Plan must be the empty first-run form.
    expect(
      screen.getByRole("textbox", { name: "Monthly income (USD)" }),
    ).toHaveValue("");
    refresh();
    expect(readStoredBook()).toEqual({ months: [] });
    expect(
      screen.getByRole("heading", { level: 1, name: "Plan" }),
    ).toBeInTheDocument();
    // The first-run suggestions arrive with task 23; here Plan must be the empty first-run form.
    expect(
      screen.getByRole("textbox", { name: "Monthly income (USD)" }),
    ).toHaveValue("");
  });

  it("after refresh() History still shows the single empty row", async () => {
    const { user, refresh } = renderApp({ book: BOOK, path: "/history" });
    await confirm(user);
    refresh();
    expect(rowTexts()).toEqual([EMPTY_ROW]);
  });

  it("confirming while viewing October leaves the viewed month as November", async () => {
    const { user, goTo } = renderApp({ book: BOOK, path: "/history" });
    await user.click(screen.getByRole("button", { name: "View October 2026" }));
    goTo("/history");
    await confirm(user);
    expect(screen.getByText(CONFIRMATION)).toBeInTheDocument();
    goTo("/spending");
    expect(screen.getByText("Expenses in November 2026")).toBeInTheDocument();
    expect(screen.queryByText(/October 2026/)).not.toBeInTheDocument();
  });

  it("Enter on the focused dialog Delete all data confirms (keyboard only)", async () => {
    const { user, storage } = renderApp({ book: BOOK, path: "/history" });
    await user.click(screen.getByRole("button", { name: "Delete all data" }));
    await user.tab();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete all data",
      }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(storage.dump()[STORAGE_KEY]).toBe(EMPTY_STORED);
    expect(screen.getByText(CONFIRMATION)).toHaveFocus();
  });

  it("repeated opening and cancelling never deletes; only confirm does", async () => {
    const { user, storage } = renderApp({ book: BOOK, path: "/history" });
    const before = storage.dump()[STORAGE_KEY];
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole("button", { name: "Delete all data" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));
    }
    expect(storage.dump()[STORAGE_KEY]).toBe(before);
    expect(rowTexts()).toEqual([NOV, OCT]);
  });
});

describe("Delete all data: action error", () => {
  it("a throwing deleteAllData keeps the dialog open with the single alert and no confirmation", async () => {
    const { user, actions } = renderWithFakeBudget(<DeleteAllData />, {
      state: SCENARIO,
      book: BOOK,
      actions: {
        deleteAllData: () => {
          throw new Error("boom");
        },
      },
    });
    await user.click(screen.getByRole("button", { name: "Delete all data" }));
    const dialog = screen.getByRole("dialog", { name: "Delete all data?" });
    await user.click(
      within(dialog).getByRole("button", { name: "Delete all data" }),
    );
    expect(actions.deleteAllData).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("dialog", { name: "Delete all data?" }),
    ).toBeInTheDocument();
    const alerts = document.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(1);
    const alert = alerts[0] as HTMLElement;
    expect(alert.tagName).toBe("P");
    expect(alert).toHaveAttribute("data-part", "action-error");
    expect(alert).toHaveTextContent(
      "Something went wrong. Your budget was not changed.",
    );
    expect(dialog.contains(alert)).toBe(true);
    expect(screen.queryByText(CONFIRMATION)).not.toBeInTheDocument();
  });

  it("the error clears when the dialog is cancelled and reopened", async () => {
    const { user } = renderWithFakeBudget(<DeleteAllData />, {
      state: SCENARIO,
      actions: {
        deleteAllData: () => {
          throw new Error("boom");
        },
      },
    });
    await user.click(screen.getByRole("button", { name: "Delete all data" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete all data",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Delete all data" }));
    expect(document.querySelector('[data-part="action-error"]')).toBeNull();
  });

  it("a successful fake action shows the confirmation naming the current month", async () => {
    const { user, actions } = renderWithFakeBudget(<DeleteAllData />, {
      state: SCENARIO,
      book: BOOK,
    });
    await user.click(screen.getByRole("button", { name: "Delete all data" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete all data",
      }),
    );
    expect(actions.deleteAllData).toHaveBeenCalledTimes(1);
    expect(screen.getByText(CONFIRMATION)).toHaveFocus();
  });
});

describe("History accessibility", () => {
  it("axe: seeded BOOK", async () => {
    renderApp({ book: BOOK, path: "/history" });
    await expectNoAxeViolations();
  });

  it("axe: three months", async () => {
    renderApp({ book: BOOK3, path: "/history" });
    await expectNoAxeViolations();
  });

  it("axe: empty", async () => {
    renderApp({ path: "/history" });
    await expectNoAxeViolations();
  });

  it("axe: dialog open", async () => {
    const { user } = renderApp({ book: BOOK, path: "/history" });
    await user.click(screen.getByRole("button", { name: "Delete all data" }));
    await expectNoAxeViolations();
  });

  it("axe: dialog open with an action error", async () => {
    const { user } = renderWithFakeBudget(<DeleteAllData />, {
      state: SCENARIO,
      actions: {
        deleteAllData: () => {
          throw new Error("boom");
        },
      },
    });
    await user.click(screen.getByRole("button", { name: "Delete all data" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete all data",
      }),
    );
    await expectNoAxeViolations();
  });

  it("axe: after deleting", async () => {
    const { user } = renderApp({ book: BOOK, path: "/history" });
    await user.click(screen.getByRole("button", { name: "Delete all data" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete all data",
      }),
    );
    await act(async () => undefined);
    await expectNoAxeViolations();
  });
});
