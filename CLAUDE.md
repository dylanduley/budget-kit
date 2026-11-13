# Budget Kit

A small design system (`packages/ui`, documented in Storybook) and a budget planning app built on it (`apps/web`, Next.js). Both are built by an agent team that I lead. See `docs/workflow.md`.

## Stack
- npm workspaces monorepo
- `packages/ui`: React + TypeScript components, Storybook (react-vite), Vitest + Testing Library, axe accessibility checks
- `apps/web`: Next.js (App Router) + TypeScript, imports components only from `@budget-kit/ui`
- Styling: CSS variables (design tokens) in `packages/ui/src/tokens.css` + Tailwind in the app

## Rules for every agent
- Work only on the task you were given. If something else looks wrong, note it in your report instead of fixing it.
- Every task has acceptance criteria in `docs/specs/`. A task is done only when all of them pass.
- The app never styles its own buttons, inputs, etc. If the app needs a component that doesn't exist, report it; don't build a one-off.
- Components: accessible by default (labels, focus states, keyboard support, 4.5:1 contrast), typed props, no `any`.
- Money is stored in integer cents. Never use floats for money.
- Run `npm run check` (typecheck + lint + tests) before reporting a task done.
- Keep comments rare and short: only explain *why*, never *what*.

## Commands
- `npm run storybook`: component library at localhost:6006
- `npm run dev`: the app at localhost:3000
- `npm run check`: typecheck, lint, tests (the same checks CI runs)
