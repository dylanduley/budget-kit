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
- A hook typechecks after every edit, and the failure is fed back to the agent immediately.
- CI runs typecheck, lint, tests, accessibility checks, and the build on every push.
- The app can only use library components, which keeps the design system honest.

## Models
| Role | Model | Why |
|---|---|---|
| Lead + planner | Fable (main session) | Planning quality decides everything downstream |
| feature-builder, code-reviewer | Fable (inherit) | Harder logic and subtle bugs |
| component-builder, qa | Sonnet | Well-defined, fast tasks |
| a11y-reviewer, docs-writer | Haiku | Mechanical checks and summaries |
