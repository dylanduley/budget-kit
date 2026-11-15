# Budget Kit

A design system and a budget planning app, built by an **AI agent team** that I set up and led.

- **Component library** (`packages/ui`): 10 accessible React components, documented in Storybook. → _Storybook link_
- **Budget planner** (`apps/web`): a Next.js app built only from those components. It plans one month at a time: income, planned spending per category, expenses, and a notice when the saved budget is for an earlier month. Data is saved in the browser's `localStorage`. → _App link_

## Structure

- `packages/ui`: the component library. One folder per component in `src/<Name>/`, design tokens in `src/tokens.css`.
- `apps/web`: the budget planner. `src/lib` (budget math and formatting), `src/state` (storage and app state), `src/features` (screens), `src/app` (Next.js routes).
- `docs/`: specs, task files, `workflow.md` and `build-log.md`.
- `.claude/agents/`: the agent definitions.

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
