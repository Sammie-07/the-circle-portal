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
2. ✅ **RESOLVED — Docs.** `README.md` rewritten from create-next-app boilerplate into a real
   project doc; `CLAUDE.md` expanded into a working guide (keeps `@AGENTS.md` import);
   `AGENTS.md` already held the modified-Next.js rules. (2026-06-09)
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
- ✅ Actual completion state of each admin/member page — **verified 2026-06-09**: all 19 pages
  + 40 API routes export properly with real content; `tsc` clean, `next build` compiles all
  routes. (Pre-existing component lint errors remain — see §11.)

---

## 11. Changelog

Every code change is recorded here, newest first.

### 2026-06-18
- **Three admin tweaks.** (1) Attendance records (`WeeklyLogsEditor`) now have a trash-icon
  delete on each row (confirm + toast, removes the `weekly_logs` row via the RLS admin client).
  (2) Renamed the payment-panel labels "Membership Start/End" → "Payment Start/End" (wording only,
  same underlying `membership_start`/`membership_end` fields). (3) Added an "Access Member's View"
  (impersonation) link to the action-button row on the admin member detail page, matching the one
  on the members list.
- **Fix: branded sign-in links bounced back to /login.** The branded emails mint links with the
  admin `generateLink` API, which has no client-side PKCE verifier — so `/auth/callback`'s `?code`
  exchange always failed and redirected to /login. Switched to the Supabase SSR token-hash flow:
  `auth-links.ts` now returns a link to a new `/auth/confirm` route (`token_hash` + `type`) that
  calls `verifyOtp` to establish the session, then redirects by role. Middleware exempts
  `/auth/confirm`; the three callers pass the app origin instead of a full callback URL.
  (`/auth/callback` kept for any PKCE flows.) Re-send any invite/login emails sent before this fix.
- **Tuesday Office Hours: Join button, no-meeting popup, admin control + Monday reminder.** New
  `office_hours_weeks` table (per-week status keyed by that week's Tuesday; no row = meeting as
  usual) + `office_hours_zoom_link` app setting (default the provided Zoom URL). Member dashboard's
  office-hours card is now `OfficeHoursCard`: on Tuesdays (ET) it shows a gold **Join the Zoom**
  button; when a week is marked off it shows a "No Office Hours this week" note + a once-per-week
  dismissible announcement popup; other days show the normal reminder. ET-aware week logic in
  `src/lib/office-hours.ts`. Admin **Settings** page gained an Office Hours section
  (`OfficeHoursSettings`): set this week to meeting/no-meeting + optional note, and edit the Zoom
  link. APIs: `/api/office-hours-week` (GET/PUT this week) and `office_hours_zoom_link` via
  `/api/settings`. New **Monday 9am ET cron** (`/api/cron/monday-office-hours`, `0 13 * * 1` in
  vercel.json, Bearer-guarded) emails owner/admin/manager a branded reminder to set the week.
- **Branded sign-in / invite emails (were plain Supabase defaults).** The member invite, staff
  invite, and self-service login all used `signInWithOtp`, which sends Supabase's plain built-in
  email. Now we generate the magic link ourselves (`src/lib/auth-links.ts`: `generateSigninLink`
  creates the account if needed for invites; `generateSigninLinkIfExists` does not, for login) and
  send our own branded HTML via a shared shell (`src/lib/email.ts` `brandedEmail()` + `sendEmail()`,
  matching the Friday-reminder design: dark bg, red Circle mark, gold eyebrow, serif heading, gold
  CTA button, divider footer). Wired into: `/api/invite` ("Your access to The Circle is ready"),
  `/api/admin-invite` ("You've been added to The Circle team"), and a new public
  `/api/auth/login-link` that the login page now posts to ("Your Circle login link"). Login is now
  account-enumeration-safe (always reports success) and stays invitation-only (no account created
  on self-login). Middleware exempts `/api/auth/`. Note: any remaining Supabase auth template
  emails are now bypassed for these flows (we createUser with email_confirm, no confirmation email).
- **Payments: auto-generate the due schedule from the billing plan.** New
  `POST /api/member-payments/generate` (owner/admin/manager) reads the member's billing plan and
  inserts one unpaid payment row per period — monthly on the `due_day` (12 rows by default, or
  bounded by membership_start→end), annual on the anniversary (1 by default). Idempotent: skips any
  due_date that already has a row, capped at 60 rows. Wired a "Generate schedule" button into the
  Billing Settings footer and a "Generate from billing plan →" link in the empty-ledger state; both
  reload + toast the count. Now setting up billing and clicking generate populates the ledger and
  the Total Due / Outstanding totals automatically, instead of adding each payment by hand.
- **Payments panel: clarified billing vs. ledger + billing now drives "Next Due".** The summary
  cards (Total Due / Paid / Outstanding / Next Due) are computed from the recorded payments ledger,
  so saving Billing Settings (the plan: schedule/amount/dates) didn't visibly change them — which
  read like a bug. Added `nextDueFromBilling()` to project the next due date + amount from the
  billing plan (monthly due-day or annual anniversary, respecting membership end), used as the
  "Next Due" fallback when no upcoming payment row exists (shows "· from plan"). Added an explainer
  under the summary so it's clear the totals come from recorded payments while Billing Settings sets
  the projected Next Due.

### 2026-06-16
- **#teamgogo agent count is now an editable admin setting (no redeploy).** Moved the hard-coded
  1,660 into a new `app_settings` key/value table (migration `add_app_settings`, RLS: authed read
  / staff write, seeded `teamgogo_agent_count = 1660`). `CANONICAL_FACTS` became
  `buildCanonicalFacts(count)`; both chat routes call it with `getTeamAgentCount()`
  (`src/lib/settings.ts`, service-role read) so every chat uses the live value. New
  `GET/PUT /api/settings` (PUT = owner/admin/manager, stores digits only) + a new
  `/admin/settings` page (with sidebar "Settings" link) where the count is editable with a toast.
  Update it there whenever the team grows. (Supersedes the earlier hard-coded note.) Also fixed the
  stale "1,600 agents" example in `GOGO_SYSTEM_PROMPT`.
- **Attendance is now editable everywhere (individual + bulk).** Previously the admin member
  view's "Recent Weeks" list was read-only, and `BulkLogForm` only preloaded the *current*
  week's logs. Now: (1) new `WeeklyLogsEditor` replaces the read-only list, every past week's
  Showed-up / Homework / Questions / Notes is editable inline and saves immediately (upsert on
  member_id+week_of, toast confirmation, `router.refresh()`); (2) `BulkLogForm` fetches the
  selected week's existing logs whenever the week picker changes, so switching weeks edits real
  data instead of blind-overwriting it. The "Log This Week" form (new entries) and the
  member-facing AttendanceCard (read-only stat, members can't edit their own) are unchanged.
- **Reverted Zoom support for replays (back to Google Drive / inline embeds).** Per request,
  removed all the Zoom-specific handling added earlier: the member-side "Watch on Zoom" panel +
  expiry "Heads up" note (`ClarityCallsList`), the `isZoomUrl` branch, and the admin expiry
  warnings + Zoom mentions in the Office Hours and Clarity Calls panels. Recordings are back to
  the original behavior: `getEmbedUrl` inline-embeds YouTube, **Google Drive**, Loom, and Vimeo
  (Drive support was always there), with a "Watch recording ↗" link fallback for anything else.
  URL placeholders restored to "YouTube, Google Drive, Loom, or Vimeo link". The
  `clarity_calls`/`office_hours` tables and APIs are unchanged; this is UI-only. (Supersedes the
  four Zoom-related notes below.)
- **Zoom replay "Heads up" note made visible.** It was rendered in the faintest text color
  (`--text-4`) and was hard to read; bumped it to amber, slightly larger, with a bold "Heads up:"
  lead so members actually notice the 2-week expiry warning.
- **Task fields auto-grow; Zoom replay note reworded.** (1) The task title + description inputs
  were single-line and clipped long text. New `AutoGrowTextarea` (`src/components/shared/`)
  expands as you type so the whole task is always visible; wired into the homework add + edit
  forms. (2) Reworded the member-side Zoom panel note: removed the (non-existent) passcode
  mention and the "ask your coach to re-post" line (nothing can be done once it's gone), now tells
  members the replay is only available ~2 weeks and to watch it before then. Also corrected the
  admin "expired" warning to say expired Zoom recordings can't be recovered (instead of suggesting
  a re-upload that's no longer possible).
- **Save confirmations (toasts) across the portal.** Saving billing details (and many other
  forms) silently succeeded with no on-screen acknowledgement. Added a global toast system
  (`src/lib/toast.ts` `toast()` + `<Toaster/>` mounted in the root layout, dispatched via a
  window event so any client component can fire one with a one-liner). Wired success/error
  toasts into every save flow: member billing + payments, homework/tasks (add/edit/delete),
  office-hours & clarity-call recordings, member documents (upload/delete), edit member,
  activate/deactivate, weekly log, bulk weekly log, member profile (member-facing), report send,
  invite member/admin, send invite, and copy sign-in link.
- **Task due date is optional + owners can manage tasks.** Due date was never `required` in the
  form, but the homework API gated POST/PATCH/DELETE on `role === 'admin'` only — so an **owner**
  (Gogo) got 403 when adding/editing tasks. Broadened to `owner/admin/manager` (matching the
  other editor endpoints) and labelled the field "Due date (optional)" with a "No due date"
  placeholder. Empty dates already persist as null.
- **Calendar date picker everywhere.** Replaced every native `<input type="date">` (which only
  shows a calendar via a small icon and otherwise invites manual typing) with a new dependency-free
  `DateField` popover calendar (`src/components/shared/DateField.tsx`): click to open a month grid,
  prev/next, Today, and Clear (for optional dates). Applied to homework due date, member billing
  (membership start/end), payment due/paid dates, office-hours & clarity-call dates, blueprint call
  date, and weekly/bulk log week pickers.
- **Zoom expiry warnings.** Zoom share links expire (~2 weeks, Zoom's retention default), after
  which the recording disappears. The portal can't stop that, but it now surfaces it: the admin
  Office Hours + Clarity Calls panels show an age-based warning on every Zoom entry (amber
  "expires ~2 weeks" while fresh; red "X days old, may no longer play, re-upload" past 14 days,
  measured from the call date or when it was added). The add/edit forms recommend re-hosting on
  YouTube/Drive for a permanent replay, and the member-side Zoom panel notes that an expired link
  may need re-posting. (A durable fix, auto-archiving Zoom recordings via the Zoom API, would be a
  separate integration.)
- **Zoom recordings supported for Office Hours / Clarity Call replays.** Zoom cloud recordings
  can't be embedded in an iframe (Zoom sends `X-Frame-Options` and recordings often need a
  passcode), so `ClarityCallsList` (the shared member player) now detects any `*.zoom.us/rec/...`
  link and renders a branded "Watch on Zoom ↗" panel (opens in a new tab, with a passcode hint)
  instead of a blank frame. YouTube / Vimeo / Loom / Google Drive still play inline. Updated the
  admin add/edit copy in both `OfficeHoursPanel` and `ClarityCallsPanel` to list Zoom and explain
  which providers play inline vs. open in a new tab. No DB/API change — any URL was already
  accepted; this just handles Zoom gracefully on render.
- **Members table: invite-aware Status + meaningful Health.** The Status column showed every
  member as "active" (raw `members.status`), hiding that many had never been sent their login
  link. Status now reflects both membership state and invite state: `Active` (green) only when
  the member is active AND `invited_at` is set; `Not invited` (amber) for active-but-uninvited;
  plus `Paused` (inactive) and `Graduated`. The summary cards changed to match: `Active (invited)`,
  `Awaiting Invite`, `Total Enrolled`, `Avg Attendance` (dropped the dead "Reports Sent —"
  placeholder). The **Health** column was just a bare colored dot mirroring attendance; it's now
  a labeled signal (`On track` / `Watch` / `At risk` / `No data`) combining attendance + homework
  so the roster can be scanned at a glance.
- **Check-in confirmation: "Go to my portal" button.** After a member submits their weekly
  check-in, the success screen now has a gold button linking to `/dashboard` so they can get
  back to their portal (previously it was a dead end). If they aren't logged in, `/dashboard`
  routes them through login as usual.

### 2026-06-16
- **Fixed: "Cannot coerce the result to a single JSON object" when saving a profile.** Two root
  causes. (1) `members` has no RLS policy letting a member update their own row (only admins),
  so `/api/profile`'s RLS cookie-client update hit 0 rows and `.single()` threw. (2) The profile
  page resolves through `resolvePortalContext` (so it shows the impersonated member during a
  staff preview), but the API matched by raw `user.email` — which for an impersonating admin
  (e.g. admin@gogosrealestate.com viewing Yvonne) matched no member at all. Rewrote `/api/profile`
  to resolve the same context and update the resolved member id via the service-role client:
  normal members edit their own record, staff-in-preview edit the member they're viewing.
  Now uses `.maybeSingle()` with a clear 404 instead of the cryptic coerce error.
- **GHL application answers are backend-only (no UI).** Product decision: applications must not
  be displayed anywhere in the portal, including the admin member view. Removed the "Application
  (from GHL)" card (and its fetch/format helpers) from the admin member page. The data flow is
  unchanged and intentional: GHL webhook → `applications` table (keyed by email) → consumed
  server-side by `apply-financial-rules.ts` to auto-inject financial tasks when a member's
  blueprint is generated. Nothing about the table, webhook, or rules changed — only the UI was
  removed. (Supersedes the earlier same-day note about expanding that card.)

### 2026-06-16
- **Mobile responsiveness pass (portal + chat).** The portal was desktop-only: a fixed `w-56`
  sidebar sat beside content with no mobile treatment, so phones got a squished two-column
  layout and a chat that was unusable. Fixes:
  - **Layouts** (`dashboard`, `admin`, and the impersonation branch) now stack:
    `flex` → `flex flex-col md:flex-row`.
  - **Sidebar** rebuilt as responsive: a sticky mobile top bar (logo + hamburger) that opens a
    slide-in drawer with a backdrop; the original `w-56` rail is unchanged on `md+`
    (`hidden md:flex`). Nav links close the drawer on tap.
  - **Ask Gogo chat** (`ChatOverlay`): the sessions list now overlays the chat on mobile
    (absolute, slides in, backdrop) instead of pushing it into a sliver; defaults open on
    desktop, closed on mobile; selecting a chat or starting a new one closes it on mobile.
    Header/messages/input padding tightened to `px-4 sm:px-6`.
  - **Content**: member dashboard stat row `grid-cols-3 → grid-cols-1 sm:grid-cols-3`, its
    two-column section `→ grid-cols-1 md:grid-cols-2`; admin stat rows (`grid-cols-3/4`) made
    responsive; member-detail panels stack on small screens. All page paddings `p-8 → p-4 sm:p-8`.
  - **Tables**: `MembersTable` and `AdminReportsTable` wrapped in `overflow-x-auto` with a
    `min-w-[640px]` table so they scroll horizontally instead of breaking the layout (payments
    tables were already wrapped). Modals were already mobile-safe (`w-full max-w-* p-4`).
  - tsc + lint + `next build` all clean.

### 2026-06-15
- **Reports: killed the `` ```html `` banner + banned em dashes.** Claude was wrapping report
  HTML in a markdown code fence, so a literal `` ```html `` rendered at the top of every report.
  Added `cleanReportHtml()` in `reports/generate` that (1) strips leading/trailing code fences
  and (2) removes em/en dashes (replaced with a comma) as a hard guarantee. Also rewrote the
  generation prompt: explicit "never use em/en dashes," "write flowing prose, not clipped
  fragments," and "output raw HTML, never wrap in ``` fences"; removed the choppy example lines
  the model was imitating. **Backfilled all 13 existing reports** in the live DB (fence stripped,
  dashes → commas; 0 remaining), so the public `/r/[token]` links and `/dashboard/reports/[id]`
  views are clean too.
- **Blueprints: same fence-strip + em-dash ban (range-safe).** Applied the same treatment to
  `blueprints/generate`. New `cleanBlueprintPart()` runs on each of the 3 generated HTML parts
  before they're concatenated: strips any ``` fence, replaces em dashes (—) with a comma, and
  converts en dashes (–) to plain hyphens. The en-dash distinction matters here, blueprints use
  ranges like "Q1 · Months 1–3" that a comma would corrupt, so those become "Months 1-3" (verified
  intact). Added the same punctuation/voice rule to all 3 prompts. **Backfilled all 4 existing
  blueprints** in the live DB (em → comma, en → hyphen); 0 dashes remain and range labels are
  preserved.
- **Friday check-in no longer goes to un-invited members.** Members are created in the portal
  before they're granted access (no login link sent yet), but the `cron/friday-reminders` job
  selected *every* member with an email — so people who'd never been invited (e.g. Krystal
  Thomas) received weekly check-in emails. Added a `members.invited_at timestamptz` column
  (migration `add_members_invited_at`, applied to live DB) and gated the cron query on
  `status='active' AND invited_at IS NOT NULL`. **Backfill:** stamped `invited_at = created_at`
  for every member who already has an `auth.users` account (they've logged in, so were
  definitely invited) — 5 members (Tech Team, Samuel Akinwande, Test member, Kristy Waker,
  Ferny Rodriguez); the other 5 with no account (Allison Mireau, Gina Tran, Krystal Thomas,
  Tina Gamble, Yvonne Zielinski) stay NULL and are now excluded. Both invite endpoints stamp
  `invited_at` on first invite going forward: `/api/invite` (Send Invite button) and
  `/api/invite/signin-link` (copy sign-in link). Note `members.user_id` is unused (always
  NULL — member↔login is matched by email via RLS), so it can't serve as the invited signal.
  Updated `supabase-schema.sql` + `Member` type. `/api/checkin/generate` (manual per-member)
  is unaffected by design.

### 2026-06-09
- **Fixed: public blueprint share links (`/b/[token]`) required login.** Root cause was RLS,
  not middleware: `members` has no anon-read policy, so the route's RLS-bound cookie client
  returned nothing for logged-out visitors → 404 (affected generated AND uploaded
  blueprints). Switched `src/app/b/[token]/route.ts` to the **service-role**
  `createAdminClient()` for the token lookup — the unguessable share token is itself the
  access credential, mirroring how `/checkin/[token]` already works. **Also fixed the same
  latent bug in `/r/[token]`** (reports): its RLS policy only exposes a member's own *sent*
  reports, so anonymous report links would also 404 despite the earlier middleware exemption
  — now uses `createAdminClient()` too. Build + `tsc` clean; both routes lint clean.
- **Docs: replaced create-next-app boilerplate.** Wrote a real `README.md` (stack, env-var
  table, architecture: two-client Supabase pattern, public token routes, AI providers,
  routes, deploy) and expanded `CLAUDE.md` (golden rules, single-deploy policy, pre-push
  checklist) while keeping its `@AGENTS.md` import. `AGENTS.md` already carried the
  modified-Next.js rules and was left as-is.
- **Deploy policy: single path (kills the double-deploy).** Documented in `CLAUDE.md` +
  `README.md` that production deploys come from **`git push` to `main`** via Vercel's Git
  integration ONLY — `vercel --prod` must no longer be run by hand. (No repo config forced
  the second deploy; it was the manual CLI step, now retired by policy. Supersedes the
  2026-06-03 "Auto-deploy enabled" CLI-deploy note.)
- **Verified per-page completion state (was inferred-only).** All 19 `page.tsx` routes have
  real default exports with substantive content (19–278 lines, no stubs); all 40 API
  `route.ts` files export HTTP handlers; `npx tsc --noEmit` exits 0 and `next build`
  compiles all routes successfully.
- **Lint: zero errors (was 20 errors + 2 warnings).** Cleared the entire pre-existing
  `npm run lint` backlog so it now exits 0. Real fixes: escaped 5 JSX apostrophes
  (`react/no-unescaped-entities`), hoisted `ToggleButton` out of `WeeklyLogForm`'s render
  (`react-hooks/static-components`), dropped an unused `today` param from `wrapWithShell`,
  and a `prefer-const` autofix in `ChatOverlay`. The remaining `react-hooks/set-state-in-effect`
  hits are legitimate effects (fetch-on-mount, progress animation on a `generating` flag,
  mount side-effects, localStorage theme hydration) — each suppressed with a justified
  `eslint-disable-next-line` rather than a risky behavioral refactor of live code. `tsc` +
  build still clean.

### 2026-06-08
- **Auto-inject financial tasks from GHL application answers (on blueprint generation).** New
  `applications` table (landing zone keyed by email) + `homework.rule_key` (idempotency).
  `POST /api/ghl/application` — secret-gated webhook (`GHL_WEBHOOK_SECRET` via `x-webhook-secret`
  header or `?key=`), normalizes credit_score / owes_back_taxes / has_investments (tolerant of GHL
  field-name + type variance), upserts `applications`. `src/lib/financial-rules.ts` = config rules
  (credit<750, owes back taxes, no investments → task bundles) + `evaluateRules`.
  `src/lib/apply-financial-rules.ts` injects matching tasks into homework (type `task`, dedup by
  `rule_key`), best-effort. Hooked into `blueprints/generate` after save. Admin member page shows a
  read-only "Application (from GHL)" card. Rules editable in code (admin editor = later). **ACTION:
  set `GHL_WEBHOOK_SECRET` in Vercel; point a GHL workflow at `/api/ghl/application?key=<secret>`.**
  `GHL_WEBHOOK_SECRET` is now set in Vercel prod. Investments are TWO free-text portfolio fields —
  webhook derives `has_investments` from whether the text is meaningful (blank/none → false) and
  stores `investments_text`. Map the two GHL fields to keys `investments_1` / `investments_2`.
  Every submission is stored in `applications` (keyed by email) whether or not they become a member.
  **Fix:** middleware was redirecting unauthenticated requests (incl. the GHL webhook) to /login (307),
  so the webhook never reached the handler. Exempted self-authenticating routes from the login
  redirect: `/api/ghl`, `/api/cron`, `/api/checkin`, and public token pages `/r/`, `/checkin/` (also
  un-broke cron + public report/check-in links). Verified webhook end-to-end: stores + parses
  credit_score/owes_back_taxes/has_investments correctly.
  **Fix 2:** real GHL submissions nest mapped fields under `customData` (not top-level) and also send
  full question-label keys — parser now merges `customData` up + has label fallbacks (e.g. "What is
  your credit score?"), and treats `has_investments`/`other_investments` as the two free-text
  portfolio fields. Verified live (740 / no back taxes / has investments). Re-parsed Krystal's stored
  row. Tasks inject on blueprint GENERATION (her 740<750 → credit-health tasks next gen).
- **Fixed: owner's admin dashboard showed no data.** `is_admin()` (used by RLS "admins can view all"
  on members/logs/reports/etc.) only matched `role='admin'`, so an `owner` (and manager/support) saw
  nothing through the RLS cookie client — Gogo's `/admin` was empty. Broadened `is_admin()` to all
  staff roles (owner/admin/manager/support/tech). Also normalized 3 policies that hardcoded
  `role='admin'` (`admin_invites`, `homework`, `member_notes`) to use `is_admin()`. DB-only change,
  live immediately (no redeploy). Granular writes still gated at the API layer.
- **Gogo (gogosrealestate@gmail.com) set as `owner`.** Her auth account existed but the signup
  trigger had silently failed to create a profile — created the profile row with role `owner`.
  **Also fixed middleware**: `/admin` was gated to `role==='admin'` only, which would loop an
  owner/manager/support between /admin and /dashboard — broadened to the full staff set
  (owner/admin/manager/support/tech), matching the admin layout. Owner now gets full admin portal
  + team superuser powers.
- **Admin "Access Member's View" (impersonation, for presentations).** Members-list row link →
  `/api/admin/impersonate?member=ID` sets an httpOnly `view_as_member` cookie (staff-only, 2h) and
  redirects to `/dashboard`; `?exit=1` clears it. New `lib/portalContext.ts` `resolvePortalContext()`:
  when a staff user has the cookie set, member pages render that member's portal using the service-role
  client; otherwise (normal members, or staff without cookie) behavior is byte-for-byte unchanged
  (cookie client + RLS + own member; staff still redirect to /admin). Dashboard layout shows a gold
  "Viewing {name}'s portal — admin preview / Exit" banner in the impersonation branch (ChatBubble +
  paused-gate omitted there). All member pages refactored to query the resolved member via the
  resolved client. Verified: normal member sees only own data.
  **Update:** Ask Gogo bubble is now shown in preview too (portal fidelity), but chat APIs
  deliberately still run under the viewer's own session — the member's chat history is NOT loaded or
  exposed during preview (privacy).
  **Update 2:** preview chat now actually WORKS via an ephemeral path — new `POST /api/chat/preview`
  (staff-only, no DB, no member lookup) streams a Brain-grounded answer; `ChatOverlay` `preview` mode
  skips all session/message fetches + sidebar and posts there (history kept in component state only).
  Persists nothing, never touches the member's real chats. Extracted `GOGO_SYSTEM_PROMPT` to
  `src/lib/gogo-chat.ts` (verbatim) for reuse; normal member chat unchanged.
- **Four fixes/features:** (1) Task "Add note" is now a clear bordered **button** with an icon (was a
  faint text link). (2) **My Notes = multiple titled notes**: new `member_note_entries` table (RLS:
  member-own + admin; old single-blob notes migrated in), new `api/member-note-entries` (GET/POST) +
  `[id]` (PATCH/DELETE), new `MyNotes` component (list + editor, create/edit/delete). (3) **Chat
  messages no longer disappear**: assistant reply was inserted AFTER `controller.close()`, which
  serverless froze before completing (DB had 6 user msgs but only 2 assistant) — now persisted BEFORE
  close + session `updated_at` bumped. (4) **Chat file upload**: paperclip → `api/chat/extract` (PDF
  via `unpdf`, text files; capped 20k chars) → file content injected into that turn's prompt for the
  model; saved transcript stays clean (only a "📎 Attached: name" marker).
- **Manual "Make follow-up task" button.** AI auto-creation is conservative, so members can now turn
  a note into a follow-up task themselves: new `POST /api/homework/[id]/followup` (no AI, access =
  staff or owning member) creates a task linked via `source_note_homework_id`. Button shows on the
  saved-note bubble and in the editor; jumps to the new task after creating.
- **Task notes UX: comment bubbles + follow-up links.** Saved notes now render as a read-only comment
  bubble with an Edit button (no more open textarea sitting there after save). "Add note" only shows
  when empty; explicit Save/Cancel editor. Follow-up tasks spawned from a note appear as clickable
  chips on the source task that scroll to + highlight the created task — persistent via new
  `homework.source_note_homework_id` column (set by the note endpoint).
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
- ~~**KNOWN ISSUE (pre-existing, not yet fixed): `/b/[token]` share links require login.**~~
  ✅ **FIXED 2026-06-09** — route now uses the service-role `createAdminClient()` for the token
  lookup (see §11). `/r/[token]` had the same latent bug and was fixed too.
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
