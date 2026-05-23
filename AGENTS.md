# Agent Guide

This repository is the Eazo-deliverable Brainstorm thinking partner app. Keep it focused on the current product: a local-first Idea Tree workspace backed by a server-side OpenAI Agent route.

## Product Frame

- The app is a Brainstorm partner, not a PRD generator, pitch brief generator, or full EnvX judgment system.
- Idea Tree is the current primary interface. Nodes are short idea fragments, not fixed product fields like user, pain, solution, or rubric.
- The core user loop is: start from a fuzzy idea, grow branches, follow one direction, park directions, restore parked ideas, and generate a stage-level clear version after there is a real trace of choices.
- Parked ideas stay in the idea basket and should not be pulled back into active Agent context unless the user restores or explicitly names them.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Bun
- Dexie / IndexedDB for local-first Idea Tree persistence
- OpenAI Responses API from the server route only
- Playwright for browser verification

## Key Files

- `src/app/page.tsx` renders the Brainstorm workspace directly.
- `src/app/api/agent/run/route.ts` is the server-side OpenAI boundary.
- `src/features/idea-tree/idea-tree-workspace.tsx` coordinates the main workspace.
- `src/features/idea-tree/idea-tree-reducer.ts` owns the state model and all workspace actions.
- `src/features/idea-tree/idea-tree-storage.ts` persists local sessions in IndexedDB.
- `src/features/idea-tree/brainstorm-agent.ts` defines the System Prompt, request context, OpenAI params, and structured output handling.
- `src/features/idea-tree/agent-operations.ts` defines the whitelisted Agent operation schema.
- `src/features/idea-tree/apply-agent-operations.ts` applies Agent output through the reducer.
- `tests/idea-tree-main-path.e2e.ts` covers the main mocked browser path.
- `tests/idea-tree-real-openai.e2e.ts` is the opt-in real OpenAI UI smoke.

## Commands

```bash
bun install
bun dev -- --port 3024
bun run check
bun run test:e2e
bun run smoke:openai
bun run smoke:ui-openai
```

`bun run check` runs unit tests, lint, typecheck, and production build.

`bun run test:e2e` runs mocked Playwright tests and must not require a live OpenAI key.

`bun run smoke:openai` calls the real server-side Brainstorm Agent helper once. It requires `OPENAI_API_KEY`.

`bun run smoke:ui-openai` launches the production app, clicks the real UI, waits for `/api/agent/run`, verifies OpenAI returns a tree update, and reloads to prove IndexedDB persistence. It requires `OPENAI_API_KEY` and is intentionally not part of CI.

## Environment

The current MVP does not require a server database, notification cron, or authenticated Eazo user table.

Required for real Agent runs:

- `OPENAI_API_KEY`

Optional:

- `OPENAI_AGENT_MODEL`
- `EAZO_APP_ID`

Keep keys in `.env.local` for local work. Do not commit real secrets.

## Implementation Rules

- Keep the first screen as the usable Idea Tree workspace.
- Do not reintroduce iframe/static runtime-Babel BrainstormAssist assets.
- Do not add a landing page, product explainer, dashboard, or PRD-first flow.
- Do not add server Postgres/Drizzle, notification cron, or local-user-table setup unless a concrete product requirement needs it.
- Do not expose OpenAI keys to the browser. All real model calls stay behind `src/app/api/agent/run/route.ts`.
- Agent output must be validated and applied only through whitelisted structured operations.
- User-visible state changes should go through `ideaTreeReducer`.
- Node text changes from AI must be suggestions first, unless the user accepts them.
- Merge/delete-like AI behavior must be suggestion-first. Do not silently remove user ideas.

## Current Scope

In scope:

- Local-first Idea Tree
- IndexedDB persistence
- Structured OpenAI Agent actions
- Right-side context AI panel
- Idea basket
- Clear version after choice traces
- Focused tests and browser smoke checks
- Eazo/GitHub runnable delivery

Out of scope for this MVP:

- PRD generation as the default output
- Build prompt or pitch brief generation
- Full A2UI
- Full EnvX integration
- Multiplayer collaboration
- Cloud sync
- Template marketplace
- Long-term memory
- Multi-agent orchestration
