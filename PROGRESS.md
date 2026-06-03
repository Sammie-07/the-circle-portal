# Circle Portal — Progress

> Status snapshot last updated 2026-06-03 from project structure, schema, package.json,
> and entry points. Most completion claims are **inferred from file/route structure, not
> verified against running code** — see "Open Questions." This file is the canonical status
> doc for the project (README is still create-next-app boilerplate).
>
> **This file is kept in sync automatically — every code change is logged in §11 Changelog.**

---

## 1. What it is

A member portal for "The Circle" (Gogo Bethke's coaching program). Two roles —
**admin** (Gogo & Adriana) and **member**. Features: authentication + invites,
AI-generated blueprints and reports, weekly check-ins, homework, member notes,
a team page, and an AI chat feature. Deployed on Vercel.

Root entry (`src/app/page.tsx`) does nothing but `redirect('/login')`.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js **16.2.6** (App Router) |
| UI runtime | React **19.2.4** / react-dom 19.2.4 |
| Styling | Tailwind CSS **v4**, `@tailwindcss/postcss`, `tw-animate-css` |
| Components | shadcn (`shadcn` ^4.8.2, `components.json` present), `@base-ui/react` ^1.5.0, `lucide-react` ^1.17.0 |
| Style utils | `class-variance-authority`, `clsx`, `tailwind-merge` |
| Backend / DB | Supabase — `@supabase/supabase-js` ^2.106.2, `@supabase/ssr` ^0.10.3, with Row Level Security |
| AI | `@anthropic-ai/sdk` ^0.100.0 (text generation, `claude-opus-4-5`) **and** `openai` ^6.41.0 (embeddings only). Both clients centralized in `src/lib/ai.ts` (lazy, guarded `getAnthropic()`/`getOpenAI()` + `CLAUDE_MODEL`). |
| Markdown render | `react-markdown` ^10.1.0 |
| Language | TypeScript 5 |
| Lint | ESLint 9 + `eslint-config-next` 16.2.6 |
| Hosting | Vercel (`.vercel/`, `vercel.json`) |

**Scripts** (`package.json`):
- `dev`: `env -u ANTHROPIC_API_KEY next dev` — deliberately **unsets `ANTHROPIC_API_KEY` in dev** (important quirk; likely forces OpenAI path or a local key in dev).
- `build`: `next build`  •  `start`: `next start`  •  `lint`: `eslint`

**Config files present:** `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`,
`postcss.config.mjs`, `components.json`, `.env.example`, `.env.local`,
`AGENTS.md`, `CLAUDE.md` (~11 bytes, effectively empty), `supabase-schema.sql`.

---

## 3. Data model (`supabase-schema.sql`)

Fully defined with RLS policies and an `is_admin()` SECURITY DEFINER helper.

- **`profiles`** — extends `auth.users` (`id` FK, cascade). `role` text default `member`,
  check in (`admin`,`member`); `full_name`; `created_at`.
  Auto-created on signup via `handle_new_user()` trigger (`on_auth_user_created`),
  pulling `full_name` from `raw_user_meta_data`.
- **`members`** — `id` uuid PK; `user_id` FK (set null on delete); `name`; `email` (unique);
  `join_date` (default today); `cohort`; `status` check in (`active`,`inactive`,`graduated`);
  `blueprint_data` **jsonb**; `created_at`.
- **`weekly_logs`** — `member_id` FK (cascade); `week_of` date; `showed_up` bool; `homework_done` bool;
  `questions_asked` int; `notes`; `logged_by` FK; **unique (member_id, week_of)**.
- **`reports`** — `member_id` FK (cascade); `period_type` check in (`monthly`,`quarterly`,`yearly`);
  `period_label`; `content_html`; `generated_at`; `sent_at`; `sent_by` FK.

**RLS summary:** All four tables have RLS enabled.
- Profiles: users read/update only their own.
- Members: admins all; members read only their own record (matched by email).
- Weekly logs: admins all; members read only their own.
- Reports: admins all; members read only their **sent** reports (`sent_at is not null`).

**Manual seed step:** after Gogo and Adriana first log in, promote them via SQL:
`update profiles set role = 'admin' where id = '<user-id>';`

---

## 4. File structure (`src/`)

```
src/
├── app/          ← App Router routes (see §5)
├── components/
├── lib/
├── types/        (index.ts)
└── proxy.ts
```

(`components/`, `lib/`, `types/`, and `proxy.ts` contents not yet inspected.)

---

## 5. Routes

### API routes (20) — `src/app/api/`

- **Auth / invites:** `invite/`, `invite/signin-link/`, `admin-invite/`  (+ page route `app/auth/callback/`)
- **AI generation:** `blueprints/generate/`, `blueprints/send/`, `reports/generate/`, `reports/send/`, `homework/generate-from-blueprint/`
- **CRUD:** `members/`, `profile/`, `team/[profileId]/`, `member-notes/`, `homework/`, `homework/[id]/`
- **Chat:** `chat/sessions/`, `chat/sessions/[sessionId]/`, `chat/[sessionId]/messages/`
- **Check-ins:** `checkin/generate/`, `checkin/[token]/submit/`
- **Automation:** `cron/friday-reminders/`

### Page routes — flat directories

- **Root:** `app/page.tsx` → redirect to `/login`
- **Admin:** `admin/` → `members/`, `member/[id]/`, `team/`, `reports/`, `bulk-reports/`, `log/`
- **Member:** `dashboard/` → `blueprint/`, `notes/`, `profile/`, `reports/`, `reports/[id]/`
- **Auth:** `login/`, `auth/callback/`
- **Public token (share) routes:** `b/[token]/` (blueprint), `r/[token]/` (report), `checkin/[token]/`

### Route groups (REMOVED 2026-06-03)

The `(admin)`, `(auth)`, `(member)` route groups were empty scaffolding (zero files, abandoned
mid-migration) and have been deleted. The flat directories above are the sole, canonical route set.

---

## 6. What's built (inferred)

- ✅ Complete Supabase schema with auth trigger, RLS, role helper, manual admin seed.
- ✅ Auth flow scaffolding: login page, OAuth/magic-link callback, invite + admin-invite + signin-link APIs.
- ✅ Full admin surface: members list, member detail, team management, reports, bulk reports, activity log.
- ✅ Full member surface: dashboard with blueprint, notes, profile, reports (list + detail).
- ✅ AI generation endpoints for blueprints, reports, and homework-from-blueprint.
- ✅ Public, tokenized share/access routes for blueprints, reports, and check-ins (no-login access).
- ✅ AI chat feature (sessions + messages endpoints).
- ✅ Weekly check-in generation + token-based submission.
- ✅ Friday-reminders cron endpoint.

---

## 7. In progress / needs attention

1. ✅ **RESOLVED — Duplicate route structures.** The `(admin)`/`(auth)`/`(member)` route groups
   were empty (zero files) and have been deleted. Flat dirs are canonical. `tsc` clean.
2. **Docs were placeholders.** README is create-next-app boilerplate; `CLAUDE.md` ~11 bytes;
   `AGENTS.md` not yet read. This PROGRESS.md is the first real status doc.
3. ✅ **RESOLVED — AI provider ambiguity.** Anthropic = text generation (all 4 AI routes),
   OpenAI = embeddings only (Brain search). Clients centralized in `src/lib/ai.ts` with lazy,
   guarded init (no more module-scope `process.env.X!` clients that crashed on missing keys).
4. ✅ **RESOLVED — Cron.** `cron/friday-reminders` is scheduled in `vercel.json` (`0 13 * * 5`,
   Fri 13:00 UTC) and now hardened with a strict `Bearer ${CRON_SECRET}` → 401 guard
   (previously open when the secret was unset). `CRON_SECRET` documented in `.env.example`.

---

## 8. What's next (suggested, pending user direction)

- [ ] Resolve duplicate route groups vs flat dirs — pick one, remove the other, retest routing.
- [ ] Audit env/key wiring: read `.env.example` / `.env.local` and the generation/chat routes to
      confirm provider usage and that prod keys are set in Vercel.
- [ ] Verify `vercel.json` cron config for `friday-reminders` and its auth guard.
- [ ] Inspect `src/lib/`, `src/components/`, `src/types/index.ts`, `proxy.ts` to document the
      Supabase client setup, shared components, and the `proxy.ts` role.
- [ ] Replace boilerplate README and fill in `CLAUDE.md` / `AGENTS.md`.
- [ ] Confirm per-page completion state (structure alone can't prove pages are finished).

---

## 9. Decisions & session context

- **No PROGRESS.md existed** before this session; the user asked to create one *before* reading
  more of the codebase, then to expand it thoroughly ahead of running `/compact`.
- **Read scope was intentionally minimal**: only `src/app/page.tsx`, `README.md`, `package.json`,
  `supabase-schema.sql`, and directory listings of `src/app`. Deeper files (`lib`, `components`,
  `types`, individual route handlers, pages) were **not** read — so all per-route behavior above is
  inferred from naming/structure, not source.
- **Key open architectural question carried forward:** the flat-vs-grouped route duplication (§7.1)
  is the most important thing to resolve next.

---

## 10. Open questions (need file inspection to answer)

- Which route set (groups vs flat) is live and which is dead?
- Which AI provider does each generation/chat route use, and are prod keys configured?
- Is the Friday-reminders cron scheduled and firing, and is it auth-guarded?
- What's in `proxy.ts`, `src/lib/`, `src/components/`, `src/types/index.ts`?
- Actual completion state of each admin/member page.

---

## 11. Changelog

Every code change is recorded here, newest first.

### 2026-06-03
- **Track `.env.example`.** Fixed `.gitignore` (`!.env.example`) so the env template — including
  the documented `CRON_SECRET` — is committed. Real env files (`.env`, `.env.local`) stay ignored.
  ⚠️ Set `CRON_SECRET` in Vercel project env for the cron guard to work in production.
- **Verified production build** (`npm run build`) passes — all routes compile.
- **Removed duplicate route groups.** Deleted empty `src/app/(admin)/`, `(auth)/`, `(member)/`
  scaffolding (zero files, abandoned migration). Flat `admin/`/`login/`/`dashboard/` are canonical.
- **Centralized AI clients.** Added `src/lib/ai.ts` with lazy, guarded, cached `getAnthropic()` /
  `getOpenAI()` + `CLAUDE_MODEL`. Rewired all 4 AI routes + `brain-search.ts`; removed module-scope
  `new Anthropic`/`new OpenAI` and `process.env.X!` assertions that crashed on missing keys.
  Confirmed: Anthropic = generation (`claude-opus-4-5`), OpenAI = embeddings only.
- **Hardened cron auth.** `cron/friday-reminders` now requires `Authorization: Bearer ${CRON_SECRET}`
  (returns 401 otherwise; previously open when secret unset). Added `CRON_SECRET` to `.env.example`.
  Schedule confirmed in `vercel.json`: `0 13 * * 5`.
- All changes verified with `npx tsc --noEmit` (exit 0). Not yet committed.
