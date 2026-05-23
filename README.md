# Sprout Brainstorm Assistant 17:54 for Eazo

This is a separate Eazo Creator Next.js app that hosts the 17:54 version of the Sprout tree-shaped brainstorming prototype.

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

- `src/app/page.tsx` renders the Eazo app shell and loads the brainstorm workspace.
- `public/brainstorm/` contains the `BrainstormAssist17_54` static React prototype assets.
- `src/app/layout.tsx` defines app metadata and the root document shell.

## Eazo Environment

Copy `.env.example` to `.env` and set `EAZO_PRIVATE_KEY` if the app uses authenticated Eazo user APIs:

```bash
cp .env.example .env
```

The current prototype UI runs without server-side auth configuration and does not connect to OpenAI yet.
