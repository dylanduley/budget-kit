# How the agent team works

I'm the lead: I write the specs, approve plans, review every task's results, and make product calls. The agents do the work in between.

## Flow for each task
1. **planner** turns a spec into small tasks with acceptance criteria (`docs/tasks/`). I review the plan before any code is written.
2. **component-builder** or **feature-builder** builds the task. Independent tasks run in parallel (separate git worktrees).
3. **qa** writes and runs tests against the acceptance criteria, without the builder's reasoning, so the work isn't grading itself.
4. **a11y-reviewer** checks accessibility (UI tasks).
5. **code-reviewer** reviews the diff: APPROVE or CHANGES NEEDED.
6. If anything fails, the task goes back to the builder with the exact failure. I merge only after QA, a11y, and review pass.
7. **docs-writer** updates Storybook docs and `docs/build-log.md` after each batch.

## Guardrails
- Every agent runs `npm run check` (typecheck, lint, tests) before reporting a task done, and the lead re-runs it before merging. There is no edit hook yet.
- There is no CI yet. `npm run test:a11y` and `npm run build` are run by hand before a release; wiring `check`, the a11y tests and the build into CI on every push is still to do.
- The app can only use library components, which keeps the design system honest.

## Models
| Role | Model | Why |
|---|---|---|
| Lead | Your choice (main session) | Orchestration and decisions; you review the plan and every merge |
| planner | Opus | Runs once per spec, and everything downstream depends on it |
| component-builder, feature-builder, qa, code-reviewer | Sonnet | Well-defined tasks with explicit acceptance criteria |
| code-reviewer on hard tasks (Dialog, MoneyField, `budget.ts`, persistence) | Opus | Subtle logic: focus management, money parsing, state |
| a11y-reviewer, docs-writer | Haiku | Mechanical checks and summaries; Sonnet for Dialog's a11y review |

Fable is not used by default. Pass the model explicitly when starting an agent, and move a task up a tier only after it has failed review twice.
