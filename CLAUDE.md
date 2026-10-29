# CLAUDE.md — OnePage

Read `SPEC.md` first. It says what this app is, what must stay true, and what we're not building.

## How to work with Riley
- Plan before coding. For anything bigger than a small fix, write a short plan and wait for a yes.
- If a change isn't in `SPEC.md`, say so and ask whether to update the spec first.
- Push back. If an idea is weak, risky or out of scope, say why. Don't just agree.
- Explain changes in plain language. Riley is a PM, not a full-time engineer.
- Show a task list for multi-step work.

## Commands
| Task | Command |
|---|---|
| Install | `npm install` |
| Dev server (port 5000) | `npm run dev` |
| Typecheck | `npm run check` |
| Tests | `npx vitest run` |
| Build | `npm run build` |
| Push DB schema | `npm run db:push` |

## Layout
- `client/` React app (Tailwind, shadcn/ui, dnd-kit, TanStack Query)
- `server/` Express API: `routes.ts`, `storage.ts` (all DB access), `ai.ts` (Claude reports); tests sit next to the code as `*.test.ts`
- `shared/` Drizzle schema and shared types

## Rules
- **Tests first:** write or update a test for every behaviour change. Done means `npm run check`, `npx vitest run` and `npm run build` all pass (the same steps CI runs).
- **User scoping:** every query filters by the signed-in user's ID. Never add one that doesn't.
- **AI spend:** keep the report cap in place; don't raise it without asking.
- **One screen:** don't add pages or modals for core task work without checking `SPEC.md`.
- **Secrets:** never commit `.env` or keys. This repo is public.
- **Schema changes:** say what `db:push` will change and ask before running it against a real database.

## Deploy
Railway deploys from `main` using `railway.json`. The service sleeps when idle, so the first request after a pause is slow; that's expected.
