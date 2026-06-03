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
   (previously open when the secret was unset). `CRON_SECRET` documented in `.env.example`
   and **set in Vercel Production env (2026-06-03)** — redeploy required for it to take effect.

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
- **Name correction: Kristy Waker (was "Christie/Christy").** Gogo's Director of Operations / first
  hire is **Kristy Waker**; auto-transcribed clippings in the brain misspell it as Christie/Christy/
  Christiey, leaking into outputs. Fix applied at the app layer (brain lives in a separate
  `BRAIN_SUPABASE_URL` project; raw Clippings are immutable): added `sanitizeBrainText()` +
  `CANONICAL_FACTS` to `src/lib/brain-search.ts`. All retrieved brain text is now normalized
  (Christie→Kristy) before reaching any prompt — applied in chat (`buildBrainContext`), blueprints,
  and reports (their inline `fetchBrainContext`). Chat prompt also gets the explicit `CANONICAL_FACTS`
  override. Covers all current brain-driven outputs.
- **Ask Gogo chat — less choppy voice.** The chat system prompt (`api/chat/[sessionId]/messages`)
  was forcing staccato ("Sentences are short. Actually short. One idea per sentence... No dense
  blocks. One idea per paragraph."), producing too many hard stops. Rewrote the rhythm rules to
  favour flowing, connected sentences with short punches reserved for emphasis. Brand frameworks,
  first-person rule, em-dash ban, and banned-phrase list all left intact.
- **Regenerated Krystal Thomas's PDF blueprint** with the branded shell directly via SQL (her PDF
  was already in storage; the new upload hadn't run — stale browser tab, no server hit). Diagnosis:
  no new storage object + unchanged `blueprint_generated_at` confirmed the re-upload never reached
  the server. Upload handler code is correct; a fresh page load fixes future uploads.
- **KNOWN ISSUE (pre-existing, not yet fixed): `/b/[token]` share links require login.** The route
  reads `members` via the RLS-bound SSR client with no public-read policy, so anonymous visitors get
  404 — affects generated AND uploaded blueprints. Logged-in admins/members see them fine. Emailed
  links to non-users would 404. Fix options: service-role read in the route, or a public RLS policy
  scoped to share-token lookups.
- **Uploaded PDF blueprints now use the branded Circle shell.** Previously a PDF opened in the raw
  browser PDF viewer (no branding). New `src/lib/blueprint-shell.ts` `wrapPdfBlueprint()` reproduces
  the generated blueprint's dark theme + "The Circle" sticky `<nav>`, embeds the PDF cleanly
  (`#toolbar=0&navpanes=0&view=FitH`), and keeps the hidden extracted-text div for homework. The
  `<nav>` matches the generated structure so `b/[token]`'s download-toolbar injection works
  unchanged. ⚠️ Already-uploaded PDFs must be **re-uploaded** to get the new shell (no auto-migrate).
- **Auto-deploy enabled.** Every code change is now deployed to Vercel production via
  `vercel --prod --yes` (CLI, linked project `the-circle-portal`, user sammie-07) right after the
  GitHub push. Live URL: https://the-circle-portal.vercel.app . First such deploy shipped all of
  today's work (`dpl_8ctTEHpUpFjWW5XUnoV8uJoRqPMo`). Docs-only commits skip the deploy.
- **Spacing fix.** Admin member detail action buttons were cramped (inline, no gap). Wrapped them
  in a `flex flex-wrap justify-end gap-2` row so they breathe and wrap cleanly.
- **Upload existing blueprint.** New `POST /api/blueprints/upload` (admin-gated, nodejs runtime)
  accepts an `.html` or `.pdf` file. HTML → stored directly as `blueprint_html`. PDF → uploaded to
  the new public `blueprints` Supabase Storage bucket, embedded via `<iframe>` in `blueprint_html`
  with hidden extracted text (via `unpdf`) so homework generation still works; extracted text also
  saved to `blueprint_transcript`. Sets share token + generated_at, resets sent timestamps — so an
  uploaded blueprint behaves identically to a generated one (share link, member view, send,
  homework). Upload UI added to `BlueprintPanel`. **DB:** created `blueprints` storage bucket
  (public, 25 MB, pdf/html) — recorded in `supabase-schema.sql`. New dep: `unpdf`.
- **Deactivate / Delete members.** Dashboard layout now blocks members whose `status != 'active'`
  with a "Your access is paused" page (deactivate = reversible pause). New `DeactivateMember`/
  `Reactivate` button (owner/admin/manager, PATCH status). New `DELETE /api/members/[id]`
  (owner/admin only) removes the member row (cascades logs + reports), deletes the auth login
  account, and best-effort cleans the member's storage folder; `DeleteMemberButton` uses
  type-the-name confirmation and redirects to `/admin`.
- **Admin can edit member profiles.** New `PATCH /api/members/[id]` (role-gated to
  `owner`/`admin`/`manager`; service-role write after server-side role check; 409 on duplicate
  email). New `EditMemberButton` modal on the admin member detail page (name, email, cohort,
  status, phone, city, instagram, website, bio — sends only changed fields, then `router.refresh()`).
  Extended `Member` type with `phone/city/instagram/website/bio`. No DB migration needed — those
  columns already existed. Build passes. ⚠️ Editing `email` changes the login↔member RLS linkage.
- **`CRON_SECRET` set in Vercel Production.** Cron auth guard is now live (pending a redeploy).
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
