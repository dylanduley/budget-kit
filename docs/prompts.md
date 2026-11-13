# Prompts I used to run the team

Paste these into Claude Code (main session on Fable), one step at a time. Review the result before moving on.

## Step 0: Scaffold (lead session, no agents)
> Set up this repo as described in CLAUDE.md: an npm workspaces monorepo with `packages/ui` (React + TypeScript, Storybook with the react-vite framework, Vitest + Testing Library, an axe accessibility test that renders every story) and `apps/web` (Next.js App Router + TypeScript + Tailwind, importing `@budget-kit/ui`). Add root scripts: `dev`, `storybook`, `build`, `typecheck`, `lint`, `test`, `test:a11y`, and `check` (typecheck + lint + test). Add `tokens.css` with a calm, accessible palette. Don't build any components yet. Make sure `npm run check` passes.

## Step 1: Plan the library
> Use the planner agent to turn docs/specs/components.md into tasks in docs/tasks/. Mark which can run in parallel.

_(Review the tasks. Edit any vague acceptance criteria.)_

## Step 2: Build the library
> Follow the parallel groups in docs/tasks/README.md. Start with task 00 on its own. Then, for group A (tasks 01, 02, 05, 06, 07, 08, 10), use the component-builder agent on each one, in parallel. After each one finishes, run the qa agent on it, then the a11y-reviewer, then the code-reviewer. If any of them fail, send the exact failure back to the component-builder and repeat. Stop and show me a summary when group A is approved.

_(Review in Storybook. Then repeat for group B: tasks 03, 04, 09.)_

> Use the docs-writer agent to document the components and update docs/build-log.md.

## Step 3: Plan the app
> Use the planner agent to turn docs/specs/app-brief.md into tasks. Budget math goes in apps/web/src/lib/budget.ts as its own first task.

## Step 4: Build the app
> Work through the app tasks in order with the feature-builder agent. After each: qa, then a11y-reviewer (for screens), then code-reviewer, looping back on failures. If the feature-builder needs a component the library doesn't have, stop and tell me.

## Step 5: Wrap up
> Use the docs-writer agent to update the README and build log. Then summarize: tasks completed, tests written, issues QA/a11y/review caught, and any places I stepped in.
