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

### 2026-06-08
- **Admin "Access Member's View" (impersonation, for presentations).** Members-list row link →
  `/api/admin/impersonate?member=ID` sets an httpOnly `view_as_member` cookie (staff-only, 2h) and
  redirects to `/dashboard`; `?exit=1` clears it. New `lib/portalContext.ts` `resolvePortalContext()`:
  when a staff user has the cookie set, member pages render that member's portal using the service-role
  client; otherwise (normal members, or staff without cookie) behavior is byte-for-byte unchanged
  (cookie client + RLS + own member; staff still redirect to /admin). Dashboard layout shows a gold
  "Viewing {name}'s portal — admin preview / Exit" banner in the impersonation branch (ChatBubble +
  paused-gate omitted there). All member pages refactored to query the resolved member via the
  resolved client. Verified: normal member sees only own data.
- **Four fixes/features:** (1) Task "Add note" is now a clear bordered **button** with an icon (was a
  faint text link). (2) **My Notes = multiple titled notes**: new `member_note_entries` table (RLS:
  member-own + admin; old single-blob notes migrated in), new `api/member-note-entries` (GET/POST) +
  `[id]` (PATCH/DELETE), new `MyNotes` component (list + editor, create/edit/delete). (3) **Chat
  messages no longer disappear**: assistant reply was inserted AFTER `controller.close()`, which
  serverless froze before completing (DB had 6 user msgs but only 2 assistant) — now persisted BEFORE
  close + session `updated_at` bumped. (4) **Chat file upload**: paperclip → `api/chat/extract` (PDF
  via `unpdf`, text files; capped 20k chars) → file content injected into that turn's prompt for the
  model; saved transcript stays clean (only a "📎 Attached: name" marker).
- **Task notes + AI follow-up tasks.** Added `homework.notes` + `auto_suggested` columns. Members can
  write a note on any task (PATCH allows member notes on own items). New `POST /api/homework/[id]/note`
  saves the note, then asks Claude whether it implies a NEW actionable follow-up; if so it creates a
  task for that member (`type=task`, `auto_suggested=true`) via service role (after ownership check) —
  conservative, and graceful if the AI is unavailable (note still saves). `HomeworkSection` got a
  per-task note box with inline "✨ Added a follow-up task" confirmation; new tasks appear without
  reload and carry a "from your note" badge.
- **Office hours time fixed** to "12 noon ET" (was 11am) on the member dashboard. Still Tuesday.
- **Member profile redesign (human, not a table).** New presentational `MemberProfileCard`
  (prominent headshot + bio + key-info chips: cohort, member-since, city, status badge, Instagram/
  website links). Shown on the member's `My Profile` tab AND the admin member view (replaced the plain
  name/email header block; action buttons + stats preserved). Headshot sourced from the Documents hub
  (`doc_type=headshot`) via the signed-URL download route — member page reads via RLS, admin page via
  service role. Members get an inline `ProfilePhotoUpload` ("Change/Add photo"); editing preserved
  (ProfileForm on member side, Edit buttons on admin side).
- **GoGet'Em Community buttons (member dashboard).** Added a Community card with two new-tab links:
  "Open Community" → members.gogetemcommunity.com, "Community Calendar" → the ClientClub events page,
  and "GGTC Social Calendar" → the Google Calendar embed URL. Static external links, no DB/API.

### 2026-06-08
- **Admin "Payments" tab (all-members overview).** New `/admin/payments` page + sidebar tab listing
  every member with schedule, amount, due day, membership status, next due date and outstanding
  balance in one table (sorted overdue-first) + summary cards (total outstanding, overdue count,
  members with billing). Owner/admin/manager only (support redirected to /admin); uses service-role
  read (RLS is_admin()-only). Each row links to the member detail page. Completes the spreadsheet
  replacement (overview + per-member detail).
- **Per-member payment tracking (admin-only) — replaces the spreadsheet.** New `member_billing`
  (1:1: schedule monthly/annual, amount, currency, due_day, membership_start/end, membership_status
  active/paused/cancelled, notes) + `member_payments` ledger (due_date, period_label, amount_due,
  amount_paid, status unpaid/partial/paid, paid_date, notes). Partial/split payments = amount_paid <
  amount_due. RLS admin-only (no member policy). API: `member-billing` (GET/PUT upsert),
  `member-payments` (GET/POST) + `[id]` (PATCH/DELETE) — all gated owner/admin/manager.
  `MemberPaymentsPanel` on the member detail page: editable billing settings + outstanding-balance
  summary (total due/paid/balance, next due) + payments ledger with add/edit/delete and
  auto-derived status. Admin-only, no member-facing surface. (Built from the written requirements —
  could not open the source Google Sheet; columns adjustable on request.)
- **Per-member Documents hub.** Stores each member's contract, DISC assessment, application,
  headshot & onboarding files. New `member_documents` table + **private** `member-documents` storage
  bucket (sensitive — never public; schema updated, applied to live DB). API:
  `api/member-documents` (GET list, POST upload) + `[id]` (PATCH/DELETE) + `[id]/download`
  (access-checked → 60s signed URL redirect). Access: upload/delete = owner/admin/manager;
  list/download = any staff OR the owning member (by email). Admin `MemberDocumentsPanel` on the
  member detail page (doc-type badges, image thumbnails, upload/delete); member read-only
  `/dashboard/documents` page + "My Documents" sidebar link. Lets Gogo/Adriana/Kristy pull any
  member's DISC etc. on demand, and members see their own.
  **Update:** members can now upload their OWN documents too — `POST /api/member-documents` opened to
  the owning member (own member_id only; staff still upload for anyone). Member `/dashboard/documents`
  has an Upload Document control. The list API returns uploader name/role and the admin panel shows
  "uploaded by …" with a "Member upload" badge so the backend can see what members upload.
- **Monthly attendance filter (member dashboard).** Extracted the Attendance stat card into a client
  component `components/dashboard/AttendanceCard.tsx` with a month dropdown. Members pick a month and
  the % / "X of Y calls" / progress bar recompute for just that period; defaults to "All time".
  Months are a continuous range from the member's join month through the current month (passed
  `joinDate`), so the current month and not-yet-logged months are always selectable (fixed June
  missing because it had no logs yet). No DB/API change.
  Then upgraded to **From/To month range selection**: two month selectors — full span = all time
  (default), same month in both = single month, different = a date range. Order-tolerant.

### 2026-06-05
- **REVERTED team-panel + middleware changes to last-good `019d4d4`** (commit c2da91c) after the
  admin portal became slow/unresponsive and the team page blanked. Restored `src/proxy.ts`,
  `Sidebar.tsx`, `admin/team/page.tsx`; removed `admin/team/error.tsx`. Office Hours / Clarity Calls
  untouched. Team panel is back to showing Active Members only (pending-invites display + the
  `invited_at` fix were rolled back). Root cause of the slowness was never confirmed (DB + Auth were
  verified healthy); to re-approach the team-panel request cleanly once the portal is confirmed
  stable. The earlier perf notes below describe changes that are now reverted.
- **Admin portal slowness — investigation + perf fixes (REVERTED, see above).** Verified backend is healthy: Postgres
  logs show no slow queries (only the pre-fix `admin_invites.created_at` errors); Auth `/user`
  (getUser) calls are ~2ms median and only ~0.1/s — not rate-limited. Slowness is app-side. Fixes:
  (1) removed the redundant `profiles` query the middleware ran on EVERY request — role gating for
  `/admin` is already done in `admin/layout.tsx`, and the middleware's stricter `admin`-only check
  could bounce owner/manager/support in a redirect loop; (2) `Sidebar` links set `prefetch={false}`
  so loading one admin page no longer triggers background server renders of all 6 sibling dynamic
  routes. Added `admin/team/error.tsx` boundary + null-safe auth guard so the team page surfaces
  real errors instead of a blank screen. Root cause of the original blank team page still to be
  confirmed from the error-boundary message. NOTE: double-deploy (git push Git-integration + CLI
  `vercel --prod`) still firing — should disable one.
- **Fixed Team panel not showing invited members.** The "Pending Invites" query on
  `admin/team/page.tsx` selected/ordered by `created_at`, but `admin_invites` has no such column
  (it's `invited_at`) — so the query errored and the section rendered empty. Two invited members
  (`support@teamgogo.team`, `kristy@gogosrealestate.com`) were invisible. Fixed column names and
  routed the query through the service-role client (admin_invites is RLS-protected). Active-members
  list and auto-promotion-on-accept (via the `handle_new_user` trigger) were already correct; invited
  members now show as "Pending" immediately and move to "Active" once they accept their login link.

### 2026-06-03
- **Split calls into Clarity Call Replay (per-member) + Office Hours Replay (global).** Office hours
  are weekly and identical for everyone, so they get their own GLOBAL `office_hours` table (no
  member_id; RLS: admins manage, any authenticated user reads) — added to schema + live DB. New API
  `api/office-hours` (GET all / POST) + `api/office-hours/[id]` (PATCH/DELETE), writes gated
  owner/admin/manager. Admin manages them ONCE at `/admin/office-hours` (`OfficeHoursPanel`, linked
  in the admin sidebar) and they appear on every member's portal. Member `/dashboard/calls` now shows
  two sections: "Clarity Call Replay" (their own) then "Office Hours Replay" (global), each an
  independent `ClarityCallsList` player. Per-member admin panel relabeled "Clarity Call Replay".
- **Clarity Calls feature.** Members can rewatch their coaching calls via embedded players (no video
  hosting — just URLs). New `clarity_calls` table (member-scoped, RLS: admins all / members own;
  added to schema + applied to live DB). New API `api/clarity-calls` (GET list, POST) and
  `api/clarity-calls/[id]` (PATCH, DELETE), role-gated owner/admin/manager. Admin: `ClarityCallsPanel`
  on the member detail page (add/edit/delete by pasting a URL). Member: `/dashboard/calls` (sidebar
  list + 16:9 embed), linked as "My Calls" in `components/shared/Sidebar.tsx`. `getEmbedUrl` supports
  **YouTube** (watch/youtu.be/shorts/embed), **Google Drive** (`/file/d/ID` + `?id=ID` → `/preview`),
  **Loom**, **Vimeo**, with a "Watch recording" link fallback. Built from a teammate's draft, fully
  rewritten to this project's conventions (cookie auth, real Supabase helpers, CSS-var theme) and
  Google Drive support added (the draft lacked it). Build passes.
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
