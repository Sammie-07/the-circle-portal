@AGENTS.md

# The Circle Portal — working guide

Member portal for **The Circle** (Gogo Bethke's coaching program). See `README.md` for the
stack and `PROGRESS.md` for canonical status + a per-change changelog. **Read `PROGRESS.md`
before starting, and log every code change in its §11 Changelog.**

## Golden rules

- **Two Supabase clients, pick deliberately.**
  - `@/lib/supabase/server` (`createClient`) — RLS-bound cookie client. Use when acting *as
    the logged-in user* (member pages, their own data).
  - `@/lib/supabase/admin` (`createAdminClient`) — service-role, **bypasses RLS,
    server-only**. Use for token-gated public routes (`/b`, `/r`, `/checkin`) and for admin
    writes *after* you've checked the caller's role in the route. Never import it into a
    client component.
- **Public token routes have no public RLS policy.** The token is the access credential, so
  they MUST use `createAdminClient()` or anonymous visitors get a 404. (`members` and
  `reports` have no anon-read policy.)
- **Schema source of truth is `supabase-schema.sql`.** It's applied to the live DB. Any
  schema change goes there *and* gets applied; don't let them drift.
- **Canonical names.** Gogo's first hire / Director of Operations is **Kristy Waker** —
  never "Christie/Christy". Brain text is normalized in `src/lib/brain-search.ts`.
- **AI providers.** Anthropic = text generation, OpenAI = embeddings only. Go through
  `src/lib/ai.ts` (`getAnthropic`/`getOpenAI`), never construct clients at module scope.

## Deployment — single path (do NOT double-deploy)

Production deploys happen **one way: push to `main`** and Vercel's Git integration builds
and promotes it. This is the canonical, sole deploy trigger.

**Do not also run `vercel --prod` (or the Vercel CLI) by hand.** Doing both fires two
deploys for one change (the historical "double-deploy" problem). Git push is enough.

```bash
git add -A
git commit -m "…"
git push            # ← this deploys. Nothing else.
```

## Before you push

- `npx tsc --noEmit` — must exit 0.
- `npm run lint` — must pass.
- Update `PROGRESS.md` §11 with what changed and why.

## Heads-up: this is a modified Next.js

Per `AGENTS.md`, APIs/conventions may differ from what you know. Check
`node_modules/next/dist/docs/` before relying on Next.js behavior from memory.
</content>
