# eazo-brainstorm-agent

This is a separate Eazo Creator Next.js app for a local-first Brainstorm thinking partner.
The current interface is an Idea Tree workspace: users start from a fuzzy idea, grow branches,
follow one direction, park ideas in a basket, and generate a stage-level clear version.

## Local Development

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun dev -- --port 3024
```

Open [http://localhost:3024](http://localhost:3024).

## Project Layout

- `src/app/page.tsx` renders the Idea Tree workspace as a real Next/React surface.
- `src/features/idea-tree/idea-tree-reducer.ts` owns the tree state model and reducer actions.
- `src/features/idea-tree/idea-tree-storage.ts` persists sessions to IndexedDB/Dexie.
- `src/features/idea-tree/brainstorm-agent.ts` builds the OpenAI Agent prompt, context, and structured output request.
- `src/features/idea-tree/apply-agent-operations.ts` executes only whitelisted Agent operations against the reducer.
- `src/app/api/agent/run/route.ts` is the server-side OpenAI boundary.
- `public/brainstorm/` keeps the original static prototype assets for reference only.
- `src/app/layout.tsx` defines app metadata and the root document shell.

## Eazo Environment

Copy `.env.example` to `.env` and set `EAZO_PRIVATE_KEY` if the app uses authenticated Eazo user APIs:

```bash
cp .env.example .env
```

The Brainstorm Agent uses OpenAI only from the server route. Keep secrets in `.env.local`; it is ignored by Git:

```bash
OPENAI_API_KEY=...
OPENAI_AGENT_MODEL=gpt-5.2
```

`OPENAI_AGENT_MODEL` is optional. The default is `gpt-5.2`.

OpenAI web search is available through the Responses API tool and is only enabled when the client asks for external material, such as cases, research, facts, market references, or trends.

For Eazo import, configure the same variables in the Eazo environment:

- `OPENAI_API_KEY`: required for real Agent runs.
- `OPENAI_AGENT_MODEL`: optional model override.
- `EAZO_APP_ID`: required by the app shell.
- `EAZO_PRIVATE_KEY`: only needed when authenticated Eazo user APIs are used.

The brainstorm session data is local-first and stored in browser IndexedDB. There is no required server database for the Idea Tree workspace itself.

## Checks

```bash
bun run check
bun run test:e2e
```

`bun run check` expands to:

```bash
bun test
bun run lint
bunx tsc --noEmit
bun run build
```

`bun run test:e2e` runs Playwright against a production build and mocks the Agent route, so it does not require a live OpenAI key.
