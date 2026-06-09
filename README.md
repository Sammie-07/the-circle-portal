# The Circle Portal

A member portal for **The Circle**, Gogo Bethke's real-estate coaching program. Staff
(Gogo, Adriana, Kristy) run cohorts of members; members get AI-generated blueprints and
reports, weekly check-ins, homework, coaching-call replays, documents, and an "Ask Gogo"
AI chat grounded in her knowledge base.

Live: https://the-circle-portal.vercel.app

> **Canonical status doc:** [`PROGRESS.md`](./PROGRESS.md) tracks what's built, what's in
> flight, and a per-change changelog. Read it before starting work.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS v4, shadcn, `@base-ui/react`, lucide-react |
| Backend | Supabase (Postgres + Auth + Storage) with Row Level Security |
| AI | Anthropic SDK (text generation, `claude-opus-4-5`) + OpenAI (embeddings only) |
| Email | SendGrid |
| Hosting | Vercel (push-to-deploy from `main`) |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

`dev` runs `env -u ANTHROPIC_API_KEY next dev` — it **deliberately unsets
`ANTHROPIC_API_KEY` in local dev** so generation code fails fast/loud locally instead of
silently spending tokens. Set it in Vercel for production.

### Environment variables (`.env.example`)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App Supabase project (RLS-bound client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service-role client (bypasses RLS) |
| `ANTHROPIC_API_KEY` | Claude text generation (blueprints, reports, homework, chat) |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | Outbound email |
| `BRAIN_SUPABASE_URL` / `BRAIN_SUPABASE_ANON_KEY` | Separate "Brain" project (Gogo's embedded wiki) used to ground chat/blueprints |
| `CRON_SECRET` | Bearer secret Vercel Cron sends to `/api/cron/friday-reminders` |
| `GHL_WEBHOOK_SECRET` | Shared secret gating the GHL application webhook |

## Architecture

- **Roles.** Staff (`owner`/`admin`/`manager`/`support`/`tech`) and `member`. The
  `is_admin()` SECURITY DEFINER helper drives the "admins can do all" RLS policies; granular
  writes are additionally gated in API routes. Promote staff once via SQL (see
  `supabase-schema.sql`).
- **Two Supabase clients.** `src/lib/supabase/server.ts` is the RLS-bound cookie client
  (use for anything acting *as the logged-in user*). `src/lib/supabase/admin.ts`
  (`createAdminClient`) is the service-role client that bypasses RLS — **server-only**, used
  for token-gated public routes and access-checked admin writes.
- **Public token routes.** `/b/[token]` (blueprint), `/r/[token]` (report),
  `/checkin/[token]` (check-in) render with no login. The unguessable token *is* the access
  credential, so they look it up with the service-role client. `middleware`
  (`src/proxy.ts`) exempts these plus self-authenticating API routes (`/api/ghl`,
  `/api/cron`, `/api/checkin`) from the login redirect.
- **AI.** Clients are centralized in `src/lib/ai.ts` (lazy, guarded `getAnthropic()` /
  `getOpenAI()`). Anthropic = generation; OpenAI = embeddings. Chat/blueprints/reports are
  grounded against the Brain via `src/lib/brain-search.ts`, which also normalizes canonical
  names (e.g. "Christie/Christy" → **Kristy Waker**).
- **Schema.** `supabase-schema.sql` is the source of truth (tables, RLS, triggers, storage
  buckets). It's applied to the live DB; keep it in sync with any migration.

## Routes (high level)

- **Member** (`/dashboard`): blueprint, calls, documents, notes, profile, reports.
- **Admin** (`/admin`): members + detail, team, reports, bulk reports, payments, office
  hours, log. Staff can "Access Member's View" (impersonation) for presentations.
- **API** (`src/app/api`, ~40 routes): invites/auth, AI generation + send, CRUD, chat,
  check-ins, GHL webhook, cron.

## Deployment

Deploys are driven by **Vercel's Git integration**: push to `main` → Vercel builds and
promotes to production. Do **not** also run `vercel --prod` by hand — that double-deploys.
See `CLAUDE.md` for the canonical workflow.

## Conventions

`npm run lint` and `npx tsc --noEmit` must pass before pushing. Log every code change in
`PROGRESS.md` §11. This is a fork of Next.js with breaking changes from what you may know —
see `AGENTS.md`.
</content>
