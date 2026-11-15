# App redesign: pages, months and history (apps/web)

Follows the lead's review of the one-page app (`docs/specs/app-brief.md`, built by `docs/tasks/app/01–08`). Goal: simple, easy to understand, hide detail until it is wanted, and let the person set and adjust things. Tasks: `docs/tasks/20-*.md`, `21-*.md` (library) and `docs/tasks/app/20-*.md` to `25-*.md`; order and risks in `docs/tasks/redesign-plan.md`.

The rules from `CLAUDE.md` and the brief still hold: money is integer cents everywhere; every control comes from `@budget-kit/ui`; accessible by default (labels, focus, keyboard, 4.5:1 contrast, over budget never shown by colour alone); works on a phone (single column below 640px); data stays in this browser's `localStorage`.

## What changes, in one paragraph
The single long page becomes four pages behind a top navigation: **Overview**, **Spending**, **Plan**, **History**. The app keeps every month instead of one: a new month starts as a copy of the last month's income and categories (no expenses), and nothing is ever wiped by a month change. A month switcher and an `Add expense` button sit in the page header on every page, so the month you are looking at is always visible and an expense can be added from anywhere. First run starts with no categories and offers five one-click suggestions instead of five pre-filled rows. `Remove` becomes a quiet (ghost) button the same height as the fields next to it.

## Pages

All four share one header (the banner landmark) and one `main`:

- **Header, every page**: the site name `Budget Kit` (plain text, not a heading); the navigation (`Overview`, `Spending`, `Plan`, `History`; the current page marked with `aria-current="page"`); then, once the budget has loaded, the **month switcher** (not on History, see below) and the **`Add expense`** button (only when the viewed month has at least one category).
- **`main`, every page**: the saved-data messages (unchanged wording, see Copy), then the page: an `h1` with the page name, then the page's sections (library `Card`s, `h2` titles).
- **Loading** (server render and first client render): header with site name and navigation only; `main` has `aria-busy="true"` and holds the page's `h1` and `Loading your budget…`.

| Page | Route | `h1` | Sections, in order |
|---|---|---|---|
| Overview | `/` | `Overview` | first-run line (first run only); `Summary` card (Income, Planned, Spent, Left to spend, Unplanned money: today's dashboard stats); `Spending by category` card (today's progress bars, `Over budget` and `No plan set` badges, removed-categories line) |
| Spending | `/spending` | `Spending` | `Expenses in {Month YYYY}` card: the expense table, newest first, with Delete (today's list) |
| Plan | `/plan` | `Plan` | `Income` card (`Monthly income (USD)`); `Categories` card (one row per category: name, planned amount, Remove; `Add category` button in the card header; suggestions) |
| History | `/history` | `History` | `Months` card: a table, one row per month, newest first: Month, Income, Spent, Left, `View`; `Start over` card: `Delete all data` |

Page titles (browser tab, and what Next.js's route announcer reads on navigation): `Overview · Budget Kit`, `Spending · Budget Kit`, `Plan · Budget Kit`, `History · Budget Kit`.

### Overview
Answers "how much do I have left this month?" with no controls of its own. Identical to today's `Summary` and `Spending by category` cards, with prompts that point to the Plan page instead of "below".

### Spending
The expense list for the viewed month. Adding happens through the header's `Add expense` (same dialog as today: Amount, Category, Note, Date; the Date options are the viewed month's days). If the month has no categories, the card also says `Add a category on the Plan page before adding expenses.`

### Plan
Where the person sets and adjusts the month.
- `Income` card: `Monthly income (USD)`, saved as typed (as today).
- `Categories` card: description `What you plan to spend in each category.`; each row has `Category {n} name`, `Category {n} planned (USD)` and a ghost `Remove` button the same height as the fields (rename saves on blur, planned saves as typed, Remove has no confirmation: all as today).
- `Add category` (card header button) opens a dialog `Add category` with `Name` and `Planned (USD)` (optional, empty means $0.00) and `Cancel` / `Save category`. This replaces the always-visible add-category form.
- **Suggestions**: under the rows, `Suggestions` (`h3`) and one button per suggested name that the month does not already have (case-insensitive, trimmed): `Add Rent`, `Add Groceries`, `Add Transport`, `Add Utilities`, `Add Eating out`. A click adds that category at $0.00 and moves focus to its planned field. Hidden once all five names exist.
- With no categories: `No categories yet. Add your own, or start from a suggestion below.`

### History
- Intro: `Every month you have used, newest first. Choose View to see a month's details.`
- Table caption `Months` (hidden; the card title says it), columns `Month` (row header), `Income`, `Spent`, `Left`, `Actions`. One row per month in the month list (below), newest first. The current month's cell reads `November 2026 (this month)`. Income and Left show `Not set` when the month's income is 0 (as the dashboard does). Left is income minus spent; a negative value shows with a minus sign (`-$494.82`) so it is not colour-only.
- `View` (aria-label `View {Month YYYY}`) makes that month the viewed month and goes to Overview, which shows its full details (stats and spending by category). That is how past details are viewed; there is no separate history detail page.
- `Start over` card: description `Delete every month saved in this browser and begin again.`, button `Delete all data` (secondary). It opens `Delete all data?`: `This deletes the income, categories and expenses of every month saved in this browser. You can't undo this.` with `Cancel` (initial focus) and `Delete all data` (danger). After confirming, the data is gone, the viewed month is the current month in its first-run state, and focus moves to `All data deleted. You're starting fresh with {Month YYYY}.` (a focusable paragraph in the card).

Examples (integer cents in, text out):

| Stored month | incomeCents | spent (sum of the month's expenses) | Row |
|---|---|---|---|
| 2026-11 (SCENARIO) | 320000 | 169482 | `November 2026 (this month)`, `$3,200.00`, `$1,694.82`, `$1,505.18` |
| 2026-10 | 300000 | 349482 | `October 2026`, `$3,000.00`, `$3,494.82`, `-$494.82` |
| 2026-09 | 0 | 2000 | `September 2026`, `Not set`, `$20.00`, `Not set` |

## Month model

- **Storage holds every month** the person has changed, each a full month budget (`month`, `incomeCents`, `categories`, `expenses`, the same shape as today's state). Months are independent: renaming a category in December does not rename it in November.
- **Current month** = the calendar month of today's date (read once per page load, as today).
- **The month list** = every stored month plus the current month, ascending, without duplicates. The switcher and History use it. There are no future months beyond the current one and no gaps are invented: if nothing was stored for December, January's Previous goes to November.
- **Viewed month**: the month every page shows and every change applies to. It starts as the current month on every page load and after `Delete all data`; the switcher and History's `View` change it. It is not saved and not in the URL.
- **Starting a month**: when the viewed month is not stored (only ever the current month), the app shows it as a copy of the latest stored month **before** it: same income, same categories (same ids, names and planned amounts), no expenses. If there is no earlier stored month, it is empty: income 0, no categories, no expenses. Nothing is written until the person changes something in it; the first change stores it. Example: stored October has income 300000 and categories Rent 150000, Groceries 40000; on 2026-11-02 November shows income 300000, Rent 150000, Groceries 40000, no expenses, and `setItem` has not been called.
- **New-month note** (header, under the switcher): while the viewed month is not stored and was copied from a month, `New month. Your income and categories were copied from {Month YYYY}. Change them on the Plan page.` It goes away once the month is stored.
- **Past months are editable**, exactly like the current month (add or delete expenses, change income and plans). While viewing a month before the current one the header says `You're looking at a past month. Changes are saved to {Month YYYY}.`
- **Today's "Reset month" and the rollover notice are removed.** A new month needs no confirmation because nothing is lost. "Clear everything" survives as History's `Delete all data`.

### Storage v1 → v2
- Key stays `budget-kit:budget`. Version 2 value: `{ "version": 2, "book": { "months": [ <month>, … ] } }`, months sorted ascending, unique by `month`. Every month is validated with today's rules (integer cents, ISO dates, unique ids within the month, safe to total); any failure makes the whole value unreadable, handled as today (start fresh, keep the raw value until the first change, tell the person).
- A version 1 value that is valid today loads as a book with that one month. **Loading never writes**: the stored text stays version 1 until the first change, which writes version 2. Nothing is lost: the old month appears in History and, if it is an earlier month, the current month starts as a copy of it.
- Any other version (0, 3, …) is unsupported, as today.

## First run
No stored data: the viewed month is the current month, empty. Overview shows `Welcome. Start on the Plan page: enter your monthly income and add the categories you spend on.` above the cards (only while nothing is stored at all), and the existing `Not set` stats and `No categories yet. Add them on the Plan page.` The header has no `Add expense` until a category exists. The Plan page shows the income field, the empty categories text, `Add category` and the five suggestion buttons.

## Copy (new or changed strings; all others unchanged)
- Navigation label `Main`; items `Overview`, `Spending`, `Plan`, `History`.
- Switcher buttons `Previous month`, `Next month`; month label `{Month YYYY}`.
- `New month. Your income and categories were copied from {Month YYYY}. Change them on the Plan page.`
- `You're looking at a past month. Changes are saved to {Month YYYY}.`
- `Welcome. Start on the Plan page: enter your monthly income and add the categories you spend on.` (replaces `Start by entering your monthly income and what you plan to spend in each category.`)
- Dashboard prompts: `Enter your monthly income on the Plan page` (replaces `…in Set up the month below`); `No categories yet. Add them on the Plan page.`
- Spending: card title `Expenses in {Month YYYY}`, description `Newest first.`; empty table `No expenses in {Month YYYY}.`; `Add a category on the Plan page before adding expenses.`
- Plan: card titles `Income`, `Categories`; `What you plan to spend in each category.`; `No categories yet. Add your own, or start from a suggestion below.`; `Add category` (button and dialog title); `Name`; `Planned (USD)` with hint `Optional. Leave empty for $0.00.`; `Save category`; `Suggestions`; `Add {name}`.
- History: as written in the History section above.
- Unchanged: saved-data messages (`Your saved budget couldn't be read, so a new one was started. Your first change will replace the saved data.` / `…and has been replaced.` / `This browser isn't letting the app save…`), every dashboard, expense dialog, expense list and category validation string.

## Decided by the planner (lead may revise later)
Each with the alternative rejected and why.

1. **Four pages with a top navigation** (Overview, Spending, Plan, History). Rejected: one structured page with tabs or anchors. Pages give each job its own screen and short page on a phone, and Next.js routes give real URLs and back-button behaviour for free.
2. **Tab names Spending and Plan** (instead of the lead's starting names Expenses and Budget), taken from the YNAB inspiration: they say what you do there. "Budget" also named the whole app. Overview stays the home page because the brief's core question is "how much do I have left?".
3. **Month switcher and Add expense live in the header, on every page except that History has no switcher.** Rejected: a switcher inside each page (four copies, and the month would scroll away) and a switcher on History (History already lists every month; its `View` buttons do the switching).
4. **Persistent `Add expense` in the header** (YNAB's quick-add idea). Rejected: a floating button (the app may not position or style its own controls, and it covers content on a phone) and keeping Add expense only on the Spending page (adding an expense is the most frequent task).
5. **Viewed month is in memory, not in the URL**, and resets to the current month on load. Rejected: `?month=2026-10`. It needs a Suspense boundary for `useSearchParams` on statically rendered pages, invalid-value handling, and every nav link to carry the parameter.
6. **No wipe; a new month copies the latest earlier month's income and categories.** Copying income too (the lead said categories and plans) because income is usually the same and starting at $0 would show `Not set` until noticed. Rejected: start each month empty (re-entering everything monthly) and copying expenses (they belong to the month they happened in).
7. **The new month is shown, not stored, until the first change.** Keeps the existing rule that loading never writes, so opening the app cannot change or grow saved data.
8. **Past months are editable.** Rejected: read-only past months. Late receipts are common (an October 31 purchase entered on November 2); read-only would need a second display mode on every page and still block fixing mistakes. The past-month line makes the target month explicit.
9. **No future months.** Next stops at the current month. Rejected: planning ahead, a new feature with its own questions (what does it copy, what happens when it arrives).
10. **Month list skips gaps.** Months nobody used are not invented; History has one row per used month.
11. **Reset month and the rollover notice are removed; `Delete all data` on History replaces Reset.** Rejected: a per-month reset (unclear what it resets to once months copy each other) and keeping no reset at all (the brief's "Reset clears everything after confirming" would be lost).
12. **First run starts with no categories and offers suggestions as buttons.** Rejected: five pre-filled $0 rows (the lead's feedback: they look like data the person entered) and no suggestions (a blank list gives no idea what a category is). Suggestions stay visible while any suggested name is unused, including after the person removed one on purpose (simple rule; lead may prefer "first month only").
13. **Add category moves into a dialog**, the same pattern as Add expense, and the planned amount becomes optional. Rejected: the inline form, whose fields looked like one more category row.
14. **Remove is a `ghost` `md` Button.** The cause of the lead's observation is in the app, not the library: Remove used `size="sm"` (32px) beside 40px fields, and the `secondary` variant (white with a grey border) looks like a field. Library Button `md`, TextField and Select are all 40px already (task 11); library task 21 makes that a tested contract so it cannot drift.
15. **The month switcher is composed in the app** from two library Buttons and text; only the navigation is a new library component (a nav landmark and current-page marking are reusable and need their own styling). Rejected: a library MonthSwitcher (month logic belongs to the app; layout is plain flex).
16. **One app-level live region**: the switcher's month label is `aria-live="polite"`, so a screen reader hears the new month after Previous/Next. This is the only exception to "no `aria-live` in app code".
17. **History shows Income, Spent and Left only.** Details, including the spending breakdown by category, come from `View` → Overview. Rejected: a per-category breakdown inside History (YNAB-style reports), which would duplicate Overview.
18. **Delete all data lives on History** (it is about every month); after it, focus goes to a confirmation paragraph, as today's rollover reset does.

### Taken from the YNAB inspiration, and what was not
- Taken: plain tab names matching what you do (Spending, Plan, History); a quick Add expense reachable from every page; month-by-month planning with a look back (History); a plain name for money not yet given a job (we keep `Unplanned money`, already plain).
- Rejected for simplicity: Reflect reports and net-worth charts, Accounts, bank import, per-category goals, credit cards, sharing (all out of scope by the lead); "cover overspending" as an action (the person can raise a plan on the Plan page); card-style one-at-a-time transaction review (the table is enough); a category filter on the spending list (open question); a floating add button (decision 4).

## Not in scope
Planning future months; deleting a single month; export/import; syncing tabs; renaming categories across months; goals; charts; a link component (open question in the plan).
