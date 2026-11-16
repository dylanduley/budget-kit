# Budget Kit

A design system and a budget planning app, built by an **AI agent team** that I set up and led.

- **Component library** (`packages/ui`): 12 accessible React components, documented in Storybook. → _Storybook link_
- **Budget planner** (`apps/web`): a Next.js app built only from those components. It has four pages (Overview, Spending, Plan, History) and keeps every month you use: income, planned spending per category, and expenses, with a month switcher to move between months. Data is saved in the browser's `localStorage`. → _App link_

## Structure

- `packages/ui`: the component library. One folder per component in `src/<Name>/`, design tokens in `src/tokens.css`.
- `apps/web`: the budget planner. `src/lib` (budget math and formatting), `src/state` (storage and app state), `src/features` (screens), `src/app` (Next.js routes).
- `docs/`: specs, task files, `workflow.md` and `build-log.md`.
- `.claude/agents/`: the agent definitions.

## The budget planner

**Pages.** Overview shows the viewed month's summary (income, planned, spent, left to spend, unplanned money) and spending by category. Spending lists the month's expenses, newest first, and deletes them. Plan sets the month's income and categories; five suggested category names can be added with one click. History lists every month you have used, newest first, with a `View` button that opens that month on Overview, and a `Delete all data` button.

The header on every page has the site name, an `Add expense` button (once the month has a category), the navigation and, on every page except History, the month switcher.

**Months.** Each month is kept separately. `Previous` and `Next` move between the months you have used and the current month. A month you have not changed yet starts as a copy of the latest earlier month's income and categories, with no expenses; nothing is saved until you change something. Past months can be edited. Changing the month deletes nothing.

**Saved data.** The data is kept in this browser's `localStorage` under the key `budget-kit:budget`, as a list of months (storage version 2). Data saved by the earlier one-month version (version 1) loads as one month and is written in the new format on your first change; loading alone never writes. If the saved data cannot be read, the app starts a new budget and says so. Before the first change overwrites unreadable or version 1 data, its original text is copied once to `budget-kit:budget:backup`. `Delete all data` also removes that backup. If the browser will not save, the app keeps working in memory and says so.

**Money and errors.** Money is stored as whole cents. An amount that is not valid (for example `3,200.00x`) is not saved: its error shows as you type, and the last valid amount stays saved. An empty amount saves as 0. The Add category dialog does not add a category while its planned amount is invalid.

**Announcements.** Added and deleted expenses, added and removed categories, and the saved-data message are announced to screen readers through polite status messages. The month name after `Previous` or `Next` is also announced.

### App tasks

The redesign and its follow-ups. The spec is [`docs/specs/app-redesign.md`](docs/specs/app-redesign.md); the task index is [`docs/tasks/app/README.md`](docs/tasks/app/README.md).

| Task | What it did | Status |
|---|---|---|
| [20](docs/tasks/app/20-months-and-storage-v2.md) | Months, storage version 2 with the version 1 migration, the provider | Merged to `redesign/pages` |
| [21](docs/tasks/app/21-routes-and-shell.md) | Four routes, shared layout and header | Merged to `redesign/pages` |
| [22](docs/tasks/app/22-month-switcher.md) | Month switcher and month notes | Merged to `redesign/pages` |
| [23](docs/tasks/app/23-plan-page.md) | Plan page: income, categories, Add category dialog, suggestions | Merged to `redesign/pages` |
| [24](docs/tasks/app/24-history-page.md) | History page and Delete all data | Merged to `redesign/pages` |
| [25](docs/tasks/app/25-whole-app-acceptance.md) | Whole-app acceptance tests (replace the one-page end-to-end and accessibility suites) | Merged to `redesign/pages` |
| [26](docs/tasks/app/26-invalid-money-not-saved.md) | Invalid money text is not saved (replaces task 09) | Merged to `redesign/pages` |
| [27](docs/tasks/app/27-status-announcements.md) | Status announcements (replaces task 10) | Merged to `redesign/pages` |
| [28](docs/tasks/app/28-saved-data-backup.md) | Backup of old or unreadable saved data before it is overwritten | Merged to `redesign/pages` |
| [29](docs/tasks/app/29-compact-header.md) | Compact three-row header on phones | Merged to `redesign/pages` |

## The agent team

Seven specialized agents (`.claude/agents/`) in Claude Code, each with a narrow job:

| Agent | Job | Model |
|---|---|---|
| planner | Turns specs into small tasks with acceptance criteria | Opus |
| component-builder | Builds components and their stories | Sonnet |
| feature-builder | Builds app features from library components | Sonnet |
| qa | Writes and runs tests against acceptance criteria | Sonnet |
| a11y-reviewer | Accessibility checks (axe + code review) | Haiku |
| code-reviewer | Reviews each diff before merge | Sonnet (Opus on hard tasks) |
| docs-writer | Storybook docs and the build log | Haiku |

How work flows between them: [`docs/workflow.md`](docs/workflow.md).

## How this was built

_Fill in at the end of the day:_
- **My role as lead:** what I wrote (specs, briefs), what I approved, where I stepped in and why
- **An example task:** how one component went from spec → build → QA → a11y → review (link the task file and commits)
- **What the checks caught:** bugs QA found that the builder missed, accessibility issues, review feedback
- **Numbers:** tasks completed, tests written, a11y issues found/fixed, time, approximate cost
- **What I'd change:** what worked, what didn't (e.g. where subagents beat agent teams)

The agent definitions, `CLAUDE.md`, specs, and workflow were drafted with AI help and then refined by me. Full details in [`docs/build-log.md`](docs/build-log.md).

## Run it

```
npm install
npm run storybook   # component library at localhost:6006
npm run dev         # app at localhost:3000
npm run check       # typecheck, lint, tests
npm run test:a11y   # accessibility checks for every library story
npm run build       # builds Storybook and the app
```
