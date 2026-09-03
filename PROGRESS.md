# Circle Portal — Progress

> **Canonical status doc.** Snapshot refreshed 2026-06-30 against the live code, schema, and
> deployment. Sections 1–8 below are the current state; **§9 Changelog** is the full dated
> history of every change (newest first). README and CLAUDE.md are real docs now.
>
> **Kept in sync:** every code change is logged in §9. Spot-check periodically that recent
> commits all have an entry (`git log --oneline` vs §9).

---

## 1. What it is

A member portal for **The Circle**, Gogo Bethke's 12-month real-estate coaching program.
Live at **https://the-circle-portal.vercel.app**.

- **Staff roles** (`owner`/`admin`/`manager`/`support`/`tech`) — Gogo, Adriana, Kristy, etc.
- **Members** — the coaching clients.

Members get: AI-generated 12-month blueprint, monthly/quarterly/annual reports, weekly
check-ins, homework/tasks (with notes), coaching-call + office-hours replays, documents, an
"Ask Gogo" AI chat grounded in her knowledge base ("the Brain"), Tuesday office-hours info,
and deadline reminders. Staff get: full member management, attendance logging (individual +
bulk), payments/billing, report & blueprint generation, a Homework overview, impersonation
("Access Member's View"), Settings, and automated team emails. Root (`src/app/page.tsx`)
redirects to `/login`.

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

**Config files:** `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`,
`postcss.config.mjs`, `components.json`, `.env.example`, `.env.local`,
`AGENTS.md` (modified-Next.js rules), `CLAUDE.md` (real working guide, imports `@AGENTS.md`),
`supabase-schema.sql`, `vercel.json` (crons). README is a real project doc.

---

## 3. Data model (`supabase-schema.sql` is the source of truth)

Postgres on Supabase with RLS on every table + an `is_admin()` SECURITY DEFINER helper
(matches all staff roles: owner/admin/manager/support/tech). Live project ref
`kfstwljubakcgjvyljba`. A **separate** Supabase project (`BRAIN_SUPABASE_*`) holds Gogo's
embedded wiki ("the Brain") used to ground chat/blueprints/reports.

Tables (13): `profiles` (extends `auth.users`; `role`, `full_name`; auto-created by the
`handle_new_user` trigger, which also auto-promotes staff from `admin_invites`), `members`
(`status` active/inactive/graduated, `cohort`, `blueprint_*`, `invited_at`, `is_internal`,
profile fields; member↔login matched by **email**, `user_id` is unused), `weekly_logs`
(attendance per week, unique member+week), `reports`, `homework` (tasks/homework with
`completed`, `due_date`, `notes`=member's comment, `auto_suggested`, `rule_key`),
`clarity_calls` (per-member replays), `office_hours` (global replays), `office_hours_weeks`
(per-week meeting on/off), `member_billing` + `member_payments` (admin-only finances),
`member_documents` (private bucket), `member_note_entries` (member's "My Notes"),
`applications` (GHL webhook landing zone, keyed by email), `app_settings` (key/value:
`teamgogo_agent_count`, `office_hours_zoom_link`). Also `admin_invites` and a `weekly_checkins`
table. Storage buckets: `blueprints` (public), `member-documents` (private).

**RLS pattern:** admins (via `is_admin()`) manage all; members read/write only their own
(matched by email). Reports: members read only **sent** ones. Finances: admin-only, no member
policy. **Promote staff** once via SQL: `update profiles set role='owner' where id='<uid>'`.

## 4. Routes

**Pages** — Admin: `/admin` (members) · `member/[id]` · `homework` · `reports` · `bulk-reports`
· `log` · `payments` · `office-hours` · `team` · `settings`. Member: `/dashboard` · `blueprint`
· `reports[/[id]]` · `calls` · `documents` · `notes` · `profile`. Auth: `login`, `auth/callback`,
`auth/confirm`. Public token (no login): `/b/[token]` (blueprint), `/r/[token]` (report),
`/checkin/[token]`.

**API** (~48 routes under `src/app/api/`): auth/invites (`invite`, `invite/signin-link`,
`admin-invite`, `auth/login-link`); AI gen (`blueprints/generate|send|upload`,
`reports/generate|send`, `homework/generate-from-blueprint`); chat (`chat/sessions[...]`,
`chat/[sessionId]/messages`, `chat/preview`, `chat/extract`); CRUD (`members[/[id]]`, `profile`,
`team/[profileId]`, `homework[/[id]][/note|/followup]`, `clarity-calls[/[id]]`,
`office-hours[/[id]]`, `office-hours-week`, `member-billing`, `member-payments[/[id]|/generate]`,
`member-documents[...]`, `member-note-entries[...]`, `member-notes`, `settings`); check-ins
(`checkin/generate`, `checkin/[token]/submit`); GHL (`ghl/application`); admin
(`admin/impersonate`, `admin/digest-preview`); **crons** (`cron/*`, see §6).

**Middleware** (`src/proxy.ts`): redirects unauthenticated users to `/login`, EXCEPT
self-authenticating routes it exempts: `/b/`, `/r/`, `/checkin/`, `/api/ghl/`, `/api/cron/`,
`/api/checkin/`, `/api/auth/`, `/auth/confirm`. Gates `/admin` to staff roles.

## 5. Architecture & conventions (the golden rules)

- **Two Supabase clients, pick deliberately.** `@/lib/supabase/server` (`createClient`) =
  RLS-bound cookie client (act *as the logged-in user*). `@/lib/supabase/admin`
  (`createAdminClient`) = service-role, **bypasses RLS, server-only** — for token-gated public
  routes and admin writes after a role check. Never import admin into a client component.
- **Public token routes** (`/b`, `/r`, `/checkin`) have **no public RLS policy** — they MUST use
  the service-role client or anon visitors 404.
- **Impersonation:** `resolvePortalContext()` (`src/lib/portalContext.ts`) — staff + a
  `view_as_member` cookie renders that member's portal via the admin client; member pages use it.
- **AI:** Anthropic = text generation (`CLAUDE_MODEL='claude-opus-4-5'`), OpenAI = embeddings only.
  Go through `src/lib/ai.ts`. Chat/blueprints/reports are grounded via `src/lib/brain-search.ts`,
  which also normalizes canonical names and injects `buildCanonicalFacts(agentCount)` (Kristy
  Waker spelling; #teamgogo = editable agent count, default 1660).
- **Emails:** all branded via `src/lib/email.ts` `brandedEmail()` + `sendEmail()` (SendGrid),
  matching the Friday-reminder design. Sign-in links: generated ourselves (`src/lib/auth-links.ts`)
  so we control the email, NOT Supabase's plain default. Magic-link recovery handled both
  server-side (`/auth/confirm`) and client-side (login page reads `#access_token` hash).
- **Output cleaning:** generated blueprint/report HTML strips ```` ```html ```` fences and bans
  em dashes (reports → comma; blueprints → comma for em, hyphen for en to keep ranges).
- **Save feedback:** global toast — `src/lib/toast.ts` `toast()` + `<Toaster/>` in root layout.
- **Dates:** custom `DateField` popover calendar (`src/components/shared/DateField.tsx`) instead
  of native inputs everywhere.
- **Deploy: single path.** Push to `main` → Vercel Git integration builds + promotes. Do NOT also
  run `vercel --prod` (double-deploy). Before pushing: `npx tsc --noEmit` (0) + `npm run lint` (0).
  Log every change in §9.

## 6. Automation (crons — `vercel.json`, all Bearer `CRON_SECRET`-guarded)

| Cron | Schedule (UTC) | What |
|---|---|---|
| `friday-reminders` | `0 13 * * 5` (Fri 9am ET) | Weekly check-in emails to members + admin reminder |
| `monday-office-hours` | `0 13 * * 1` (Mon 9am ET) | Ask admins to set whether Tue office hours happen |
| `task-reminders` | `0 14 * * *` (daily ~9–10am ET) | One bundled email per member of tasks near deadline (3 days before → 3 after) |
| `tuesday-digest` | `0 13 * * 2` (Tue 9am ET) | AI narrative recap of each real member's past week to Gogo+admins, before office hours |
| `payment-reminders` | `30 13 * * *` (daily 9:30am ET) | Emails admins about member payments due today (+ still-unpaid overdue) so they check Stripe & update the portal |

## 7. Environment variables

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_API_KEY`, `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL`, `BRAIN_SUPABASE_URL` /
`BRAIN_SUPABASE_ANON_KEY`, `CRON_SECRET`, `GHL_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`. (`dev`
script unsets `ANTHROPIC_API_KEY` so AI fails loud locally instead of spending tokens.)

## 8. Known limitations / things to watch

- **Drive replay popout:** call replays are Google Drive `/preview` iframes; an opaque patch hides
  the "open in new window" button, but the URL still lives in page source for a determined user.
  Truly private hosting (signed URLs) is the only full fix — not yet done.
- **GHL applications are backend-only** by product decision (not shown in any UI); they feed
  financial-task injection on blueprint generation via `src/lib/apply-financial-rules.ts`.
- **`members.user_id` is unused** — member↔auth is matched by email; don't rely on `user_id`.
- **Pre-existing component lint** was cleared to zero (legitimate React-19 effect patterns carry
  justified `eslint-disable`); keep `npm run lint` green.

---

## 9. Changelog

Every code change is recorded here, newest first.

### 2026-09-02
- **Portal-wide UI facelift — cloned the "The Circle Portal.dc.html" design across every member and
  admin surface (visual only; no features added or removed).** New dark design system driven by CSS
  variables in `globals.css` (bg `#090909`, surface `#0E0E0E`, gold `#C9A227` / gold-text `#E8CF7A`,
  red `#CC1F1F` / red-text; `--gold-soft`/`--gold-line`/`--border-2`/`--tile`/`--surface-2` tokens),
  Playfair Display headings + DM Sans body, and two motion keyframes (`tcrise` fade-up = `.tc-rise`,
  `tcpulse` = `.tc-pulse`). Because the palette is token-driven, updating the variables reskinned all
  var-based components at once. Specific work:
  - **Login** — rebuilt as the two-column design (4-dot CircleMark network, Playfair headline,
    passwords notice, show/hide toggle); same `signInWithPassword` logic.
  - **Shell** — `Sidebar` moved to Lucide icons + glowing gold active-nav (gold-soft gradient +
    inset gold bar + soft glow) + user card; new sticky `PortalTopBar` (context line + "Ask Gogo"
    button that fires a `window` event to the existing `ChatBubble`, plus "Join office hours").
  - **Dashboard** — cloned exactly to the mockup: welcome hero folds attendance + homework stats +
    avatar; office-hours hero (`OfficeHoursCard`, radial glow, `tc-pulse` live dot, all states kept);
    deadline alert; blueprint/report cards; new **RecentReplays** (inline modal video player,
    YouTube/Drive/Loom/Vimeo); community card.
  - **My Homework / My Blueprint / My Reports** — cloned to their design treatments (eyebrow +
    Playfair 38 headers, count chips, 18px cards, report grid with latest=gold).
  - **My Calls** — new `CallsScreen`: featured 16:9 player + side card (uses stored call notes, no
    invented chapter data), "Office Hours Replay" tile grid, "Clarity Call Replay" compact rows;
    all tiles play inline in a modal. Replaces the old `ClarityCallsList` on the page.
  - **My Documents** — single unified 18px container with divided rows: file-kind icon box
    (image thumbnail preserved), name/type/date, gold "Download ↓".
  - **My Notes** — no design in the file, so built to match the system: polished two-column journal
    (gold-soft active note with inset gold bar, serif title editor, autosave-on-blur footer). All
    create/save/delete logic unchanged.
  - **Join office hours button (top bar)** — now only renders on `isMeetingDayET` (matches the
    dashboard `OfficeHoursCard`); it is no longer a permanent link to Gogo's Zoom. Appears on the
    actual meeting day (Tuesday, or a rescheduled day) and disappears otherwise.
  - All remaining member + admin pages received the shared card language (gold eyebrow, Playfair
    38 titles, 18px cards) via a bulk transform. tsc + lint + build clean; deployed (`0b4739d`).

### 2026-08-31
- **Import call activity from a Fathom link (Log This Week) + auto-suggested homework.** New "Import
  from Fathom" panel on the Log This Week tab: paste a Fathom share link and it reads the call
  transcript and pre-fills every member's row. `src/lib/fathom.ts` fetches the transcript from a
  public share link with no login/API key (the share page embeds a `copy_transcript?token=` URL that
  returns speaker-attributed HTML; we flatten it to "Speaker: text"). `POST /api/logs/from-fathom`
  (admin) runs it through claude-sonnet-5 to, per active non-internal member: set Showed Up (spoke on
  the call), Questions (COUNT of distinct problems/questions/help raised, broadened beyond literal
  questions), and Notes (a judged record of what is worth noting for the monthly report, not a full
  transcript). Fuzzy-matches transcript names (with suffixes/nicknames) to the roster; staff/coach
  speakers are ignored. Everything lands editable in the existing rows, nothing saves until the admin
  clicks Save. It ALSO auto-suggests homework in each member's backend from action items Gogo
  assigned or the member committed to on the call (new source `call`, `auto_suggested=true`, deduped
  against existing call tasks; migration `homework_source_add_call` + taskSource "AI · Call" label).
  Never invents tasks. tsc + lint + build clean.
- **Reports overhaul: real homework, accomplishments beyond the blueprint, real numbers, softer tone + per-member quarterly notifications.** Three changes to `/api/reports/generate`: (1) the report now READS the `homework` table (it previously only saw a per-week `homework_done` boolean, so real milestones and any work assigned live on calls were invisible). Blueprint-source homework is scored as the north-star blueprint %; non-blueprint (live/call-assigned) work is celebrated as "accomplishments beyond the plan" but NOT scored, so members who pivot mid-program are honored, not penalised. The prompt gives an explicit big-vs-small rubric (CPA/taxes/debt payoff/real estate/hiring/team/income streams = narrative; tactical tasks like "capitalize headers" = never in the narrative). (2) Real task-based NUMBERS: homework completed this period, blueprint progress %, overall completion %, attendance %, questions. (3) TONE softened: kinder, more sensitive and human, still honest about gaps without pampering. Also: quarterly reports now labelled by the member's program quarter (journey-based, not calendar), and owner/manager (not just admin) can generate. (4) NEW per-member quarterly notification: quarters run in 13-week blocks from each member's `join_date`; daily cron `/api/cron/quarter-reports` emails admins when a member finishes a quarter so they can generate+send that member's quarterly report, deduped once per member per quarter via new `quarter_report_notifications` table. tsc + lint + build clean.
- **Auth reconciliation complete (0 orphans).** Second pass deleted the last 3 orphan logins:
  `seanbatesrealestate@gmail.com` (member record intentionally removed), `support@teamgogo.team`, and
  `assistant@gogosrealestate.com`. Final audit: every auth account is now either a member or staff,
  every member has a login, and no data rows (homework/reports/weekly_logs/billing/payments/surveys/
  content) reference a deleted member. 11 orphan logins removed in total.
- **Orphan-login cleanup + the dead-end page is now actionable.** Deleted 8 orphan auth accounts
  (no member row, no staff role): the Tammy/Chrissi duplicates, two `kn?waker` typo variants, a
  Samuel alt, `admin@sdrsells.com` (alt of gina.tran@), `epichawaiihomes@`, and a stale test login.
  **Deliberately kept all 4 staff logins** (owner `gogosrealestate@gmail.com`, `tech@`, `kristy@`,
  `admin@gogosrealestate.com`) which legitimately have no member row. Also replaced the dead-end
  "Your member profile is being set up. Check back soon." on the 3 member pages with a new shared
  `UnrecognizedAccount` card: it names the signed-in address, explains it matches no member profile,
  and offers a **Sign out and try another email** button. The old copy never resolved on its own and
  had no escape, which is why affected members just sat and waited. tsc + lint + build clean.
- **Fixed: admin actions could silently create logins at addresses no member owned.** Tammy and
  Chrissi both hit "Your member profile is being set up" because each had a SECOND auth account at
  an address with no `members` row (member↔login is matched by email). Root cause: `generateSigninLink`
  creates an account when none exists, and two callers passed an arbitrary admin-typed email with no
  member check, so "Send Password Reset" / "Copy Sign-In Link" at a wrong-or-alternate address minted
  a brand-new working login that matched no member record. Fixes: (1) `generateSigninLink` takes
  `{allowCreate}`; `/api/auth/admin-reset` passes `false` so a RESET can never create an account and
  errors clearly instead; (2) `/api/invite/signin-link` now requires an existing member row (404 with
  a clear message), matching `/api/invite` which already did. Data fix: repointed Tammy's member email
  to tammy@alwaysyourrealtor.com and Christine's to chrissi.polizzi@exprealty.com (the accounts they
  actually use); both verified matching, blueprints + homework intact. tsc + lint + build clean.
- **Fixed report refine: regenerating now EDITS the report instead of rewriting it.** Admin report
  reported "it fixes one thing and changes back another" after an hour of refining. Root cause: the
  "Apply & Regenerate" flow appended the feedback to the ORIGINAL generation prompt and never passed
  the existing report to the model, so every round wrote a brand-new report from scratch, re-rolling
  every sentence and silently undoing earlier accepted fixes. `/api/reports/generate` now has a
  REVISION MODE: when refining an existing unsent report it sends the live `content_html` plus the
  requested change and demands a targeted edit (everything untouched must return byte-identical), so
  the document itself carries accumulated state and prior fixes persist. Also raised `max_tokens`
  2500 → 8000 (a revision must return the COMPLETE document; the old cap risked truncating longer
  reports mid-save) and added a guard that refuses to overwrite when a revision returns <60% of the
  original length. tsc + lint + build clean.
- **Standardized CTA + chat-bubble overlap fix.** All captions now always close with the same
  mechanic (polished wording only): "Comment CIRCLE" to join the coaching (only CTA; no DM/link-in-bio);
  carousel final slide is the CTA slide; image footer CTA reads Comment "CIRCLE". Regenerated all 13
  drafts against the new rule (verified: 13/13 carry it). Also fixed the fixed Ask-Gogo chat bubble
  overlapping the last members-table row actions (added pb-28 to the scrollable main in admin +
  member layouts). Backfill cap lowered 3→2 to stay under the 60s function limit.
- **Content bank seeded (13 real posts across 7 member profiles) + dedupe-index bug fixed.** Content
  upserts were silently failing: `ON CONFLICT (dedupe_key)` needs a NON-partial unique index, but
  the table had a partial one (`where dedupe_key is not null`) — every insert threw "no unique or
  exclusion constraint matching the ON CONFLICT specification". Migration `content_posts_dedupe_full_unique`
  drops it for a plain unique index (NULLs still distinct). Backfilled the bank from existing activity
  via the token-gated `/api/cron/content-backfill` (Yvonne/Krystal/Gina/Allison: homework+blueprint;
  Christine/Rachel/Tammy: blueprint; + 2 educational). Backfill token cleared (endpoint now inert).
- **Content signals now span all real members (blueprints + homework); exclude internal.** Added a
  blueprint signal (any member with a generated 12-month blueprint → a journey/proof post, deduped
  once per member) and a `planning` educational theme; the scanner now skips `is_internal` accounts
  so test profiles are never featured. Combined with homework-completion milestones, every active
  real member with activity now produces posts (Krystal/Yvonne/Gina/Allison via homework+blueprint,
  Christine/Rachel/Tammy via blueprint). Added a token-gated `/api/content/backfill` (inert unless
  `app_settings.content_backfill_token` is set) to seed the bank from existing activity on demand.
- **Content Machine: automatic background generation + feedback loop (fixes the "network error").**
  The manual "Generate" button ran up to 6 Opus calls synchronously and blew past Vercel Hobby's
  function limit → 504 → client "network error". Reworked so generation NEVER runs in a request the
  user awaits: new `src/lib/content/generate-batch.ts` `generateBatch({cap,memberId,force})` (scans
  signals, dedupes, generates a small cap, inserts each post incrementally so partials survive a
  timeout; rate-limited to once/75s for untargeted runs). Triggers, all via `after()`: (1) the
  Content tab load auto-generates (cap 2) in the background; (2) a member submitting their survey
  auto-generates for that member (cap 3, forced); (3) new daily cron `/api/cron/content`
  (`0 16 * * *`, cap 4) as a safety net. Deleted the synchronous `/api/content/generate` route and
  the button — the tab now shows an "auto" note + a Refresh. **Feedback loop:** added
  `content_posts.feedback` (migration `content_posts_add_feedback`); each post has a Feedback box
  (saved via PATCH) and the last 8 feedback notes are injected into every future generation as
  guidance. "Reject" relabeled **Discard**. tsc + lint + `next build` clean.
- **Content Machine — new admin "Content" tab (Phase 1).** Turns real member activity into
  on-brand IG/FB posts, grounded in Gogo's Brain. Pieces:
  - **Data:** migration `content_posts` (recorded in `supabase-schema.sql`) — one row per generated
    post (source_type member_win/community/takeaway/educational, signal jsonb, caption, hashtags,
    slides jsonb `[{headline,body,imageDirection}]`, art_direction, format single/carousel, status
    draft→approved→posted/rejected, dedupe_key unique). Admin-only RLS.
  - **Signals** (`src/lib/content/signals.ts`): scans active members → survey highlights (reusing
    `highlightsBetween`), homework milestones (every 5 completed), latest takeaways, a community
    aggregate, and one educational signal per active theme. `dedupeKey` stops regeneration.
  - **Generator** (`src/lib/content/generate.ts`): **the Brain is the core** — per signal it does a
    signal-aware semantic search over the live `BRAIN_SUPABASE` wiki (same `searchBrain`/
    `match_brain_chunks` path as Ask Gogo/blueprints; **12 chunks**), and the prompt uses the Brain
    as the LENS to interpret the activity and supply the lesson/framing/voice (member numbers are
    the proof). Claude (`claude-opus-4-5`) returns JSON {caption, hashtags, slides[], artDirection};
    brand rules enforced (no em/en dashes). One-line `NAME_MODE` privacy switch (named ↔ anonymized).
  - **Visuals:** branded 1080×1080 PNG per slide via `next/og` (`/api/content/[id]/image?i=N`) —
    deep-black + gold, "THE CIRCLE · #teamgogo", slide counter, CTA. No external image API. Per-slide
    download; art-direction "Canva brief" shown for hand-building. (Phase 2: Canva Connect editable
    designs + auto-triggers/scheduling.)
  - **API:** `POST /api/content/generate` (staff; scan→dedupe→generate up to 6/run, concurrency 2),
    `GET /api/content`, `PATCH/DELETE /api/content/[id]`. **Tab:** `/admin/content` + `ContentQueue`
    (filter draft/approved/posted/rejected, edit caption+hashtags, copy, approve→mark-posted, reject,
    delete, download). Sidebar "Content" nav after Progress. tsc + lint + `next build` clean.

### 2026-08-30
- **Full launch prep: allowlist removed; Progress shows test data without it.** Decoupled the admin
  Progress tab from the rollout allowlist — internal/test accounts now appear only when they have
  real survey responses (so Samuel stays visible for review). Removed the `survey_allowlist`
  app_setting and cleared `survey_periods` so the survey now targets EVERY active member and only
  goes live when an admin clicks Send. Admin Progress + preview are visible to all staff. tsc + lint
  + build clean.
- **Staff "Preview member survey" button.** So the team can see the exact member popup without a
  member account or disturbing data, `SurveyGate` gained a `preview` mode (fetches nothing, persists
  nothing, dismissible via ×/Esc/backdrop, header shows "· Preview", submit just toasts + closes).
  New `SurveyPreviewButton` renders it on demand; added to the admin **Progress** page header. Lets
  Sam stay fully complete (Aug→Sep growth view) while the popup is still demoable from any staff
  account. tsc + lint + build clean.
- **Survey sending is now MANUAL (auto-cron disabled, admin button added).** Per request, hold
  automated sends while the survey is reviewed. Changes: (1) the daily `/api/cron/surveys` cron is
  **removed from `vercel.json`** and the route itself guards on `SURVEYS_CRON_ENABLED==='true'`
  (returns `action:'disabled'` otherwise), so nothing auto-sends or auto-reminds. (2) The in-portal
  popup no longer keys off the calendar (`isWindowOpen`) — `/api/surveys/me` now activates the
  survey only when the current month's `survey_periods.sent_at` is set, i.e. after an admin sends.
  (3) New shared `src/lib/survey-send.ts` `sendMonthlySurvey()` (stamps the period + emails eligible
  members, allowlist-respected, idempotent unless `force`) and `getCurrentPeriodStatus()`. (4) New
  admin-gated `POST /api/surveys/send` (owner/admin/manager). (5) New **Settings** card
  `SurveySendCard` — "Send {Month} survey now" (confirm dialog; emails members + makes the portal
  popup go live), showing sent status + a Resend option. To re-automate later: set
  `SURVEYS_CRON_ENABLED=true` and restore the cron entry. tsc + lint + `next build` clean.
- **Progress tab redesign (`SurveyProgress`).** Reworked the admin Progress view from a flat
  table into a richer, theme-aware dashboard (works in light + dark via CSS vars): a member header
  with status pill; a row of four **KPI stat cards** (monthly income, credit score, total debt,
  closings) each showing the latest value, a delta chip vs the prior month, and an inline
  **sparkline** of the full series; the **Highlights & content ideas** panel restyled with icon
  chips; the **all-metrics table** refined (month-header chips, the latest month gold-tinted with a
  "Latest" badge, zebra rows, per-cell ▲/▼ delta); and a dedicated **Monthly takeaways** block
  (quote cards, latest emphasized) pulled out of the table. Fully data-driven off
  `SURVEY_QUESTIONS` + `indicatorFor`/`highlightsBetween` (no hardcoded values). Also fixed the
  Progress page to surface allowlisted internal/test accounts during rollout (so the
  `akinwandesammy02` test profile appears). Visible to all staff incl. `tech@gogosrealestate.com`
  (admin). tsc + lint + `next build` clean.

### 2026-08-28
- **Monthly progress surveys ("Circle Progress Check") — new feature.** A 13-question monthly
  check-in (income, income sources, closings, avg price range, debt, credit score, investments +
  value, real-estate properties, LLCs, VAs, hours/week, biggest takeaway) that goes out the **first
  Monday of every month**, is enforced as a **blocking, non-dismissible popup** in the member portal
  until completed (answers **autosave** as a draft so they can resume), and feeds an admin tracking
  view with progress indicators. Pieces:
  - **Data:** migration `monthly_progress_surveys` (applied live + in `supabase-schema.sql`). Two
    tables — `survey_periods` (one row per month = send/reminder idempotency) and `survey_responses`
    (one row per member per month, `answers` jsonb, `draft`→`complete`, unique on member+month). RLS:
    members read/write own (by email, matching `member_note_entries`), admins all, authed read on
    periods. Questions themselves are fixed in code (`src/lib/survey-questions.ts`), not a table.
  - **Logic:** `src/lib/survey.ts` — ET-based first-Monday math, the open-window check, and the
    indicator/highlight engine (▲/▼ per numeric field, direction-aware good/bad; "content-worthy"
    highlights for income jumps ≥25%, credit-score milestones/+20, debt paydown ≥10%, and business
    growth in LLCs/VAs/income sources/properties/investments).
  - **Member side:** blocking modal `SurveyGate` (wired into `dashboard/layout.tsx`, real active
    members only), backed by `GET/PATCH /api/surveys/me` (fetch + autosave-draft + submit).
  - **Admin side:** new **Progress** tab (`/admin/progress` + `SurveyProgress`), sidebar nav added.
    Per-member pivot (rows = questions, a new column each month, ▲/▼ vs the prior column) plus a
    **Highlights & content ideas** panel. Month-1 compares to **intake** where available — but note
    the intake only stored `credit_score` + `has_investments` as structured fields (`blueprint_data`
    is null for all; blueprints exist only as `blueprint_html` + `blueprint_transcript`), so the
    other 11 metrics baseline from the first survey. (Follow-up option: AI-extract starting numbers
    from each intake transcript to enrich month-1 baselines.)
  - **Cron:** `/api/cron/surveys` (daily `0 15 * * *`, Bearer `CRON_SECRET`) — opens + emails on the
    first Monday, re-nudges non-completers Wed/Fri/Sun that week (every 2 days through the send week),
    idempotent via `survey_periods.sent_at`/`reminded_on`. Registered in `vercel.json`.
  - **Limited rollout gate:** `app_settings.survey_allowlist` (comma-separated emails) via new
    `getSurveyAllowlist()`/`isEmailInSurveyRollout()` in `settings.ts`. When set, the survey (popup +
    emails) activates ONLY for those emails; when cleared, it's live for every active member.
    **Currently seeded to `akinwandesammy02@gmail.com` (internal test account) only** for a live
    feel-test before full launch — clear the key to launch for everyone. tsc + lint + build clean.

### 2026-08-27
- **Admins can send a member a password reset link.** New "🔑 Send Password Reset" button on each
  member's admin detail page (`SendResetButton`, in the action-button row next to Copy Sign-In Link).
  New admin-gated endpoint `POST /api/auth/admin-reset` (owner/admin/manager) emails the member a
  branded "Reset your Circle password" email with a `ctx=reset` token link (auto-verifies via the
  `/auth/confirm` interstitial → `/set-password`; code is the fallback), click-tracking disabled.
  Shipped (commit `4c09bde`, pushed to `main` → live).

### 2026-08-26
- **Auth reshaped: password-only login; links removed; invites = activation + set-password.**
  Per request, after another loop (Chrissi). Changes: (1) **Login (`/login`) is password-only** —
  email + password, a "Forgot your password? Reset it →" link, and a **transition banner** steering
  existing (now logged-out) members to set their password. No magic-link send, no in-login code entry.
  (2) **`/set-password` is now a self-contained flow** (`PasswordSetupFlow`): verify email by 8-digit
  code (browser `verifyOtp`, email→magiclink fallback), then choose a password (`updateUser`).
  Contextual copy via `?ctx=` — `activate` (new member), `transition` (existing), `reset` (forgot).
  Reachable logged-out (invites) or logged-in (finish setup); middleware `/set-password` exempted.
  (3) **Invites carry a token link that AUTO-VERIFIES** — clicking it from the email goes through the
  `/auth/confirm` interstitial (scanner-safe click-to-continue), verifies, and lands them on
  `/set-password` already signed in, so they just pick a password (NO code). `generateSigninLink`
  now takes a `ctx` that flows through the interstitial → `/set-password?ctx=…`. `/api/invite`,
  `/api/admin-invite`, and the admin "copy sign-in link" all send `ctx=activate` token links. The
  code is only the FALLBACK (link expired/eaten → they land unauthenticated and the flow asks email
  → code). (4) **Removed** the magic-link login endpoint (`/api/auth/login-link`), old
  `SetPasswordForm`, and `generateSigninLinkIfExists`. Codes only for reset / failed-link fallback.
  tsc + lint + build clean. Shipped (commit `9c02a4e`, pushed to `main` → live). **Password login is
  now the portal's normal sign-in.**
- **Password login (the permanent answer to the magic-link loops).** Recurring loops (Rachel, then
  Chrissi Pollizi — who only got in via the code) come from email link-scanners/prefetch that we
  can't control. Switched the portal to **email + password as the normal login** (`signInWithPassword`
  on the browser client). Magic links/codes are now used ONLY for first-time setup and password
  resets: after verifying by code or link, the user lands on a new **`/set-password`** page
  (`SetPasswordForm`, `auth.updateUser({ password })`, min 8 chars) and uses their password from then
  on. Reworked `src/app/login/page.tsx` (default = password; "First time here, or forgot your
  password?" → code, with link as a secondary option). Both verify paths now redirect to
  `/set-password`: `/api/auth/otp-verify` returns `/set-password`; `/auth/confirm` POST redirects
  there. Members set their own password (we never handle it). Note: relies on Supabase's email
  password provider being enabled (default on). Scanner-proof for daily logins — no email involved.
- **Disabled SendGrid click-tracking on auth emails (the actual root cause).** Rachel's link came
  through `url6427.gogosrealestate.com/ls/click?...` — SendGrid was rewriting every login link into a
  one-time tracking redirect. That added latency AND gave scanners/previews an extra hop to consume
  the single-use token. `sendEmail()` gained an `opts.disableClickTracking` flag (sets
  `tracking_settings.click_tracking/open_tracking.enable=false`); applied to all auth sends: invite,
  admin-invite, login-link, and login-code. Login emails now carry the clean direct
  `/auth/confirm` link (marketing/reminder emails keep tracking). Pairs with the interstitial below.
- **Permanent fix for Outlook/Hotmail "SafeLinks" burning magic links: click-to-continue
  interstitial.** Root cause of the login loop: email security scanners pre-fetch the link (GET) to
  vet it, which our `/auth/confirm` verified immediately — consuming the one-time token before the
  human clicked. Reworked `/auth/confirm`: **GET now renders a branded "Continue to sign in"
  interstitial and does NOT verify**; the token is verified only on the **POST** that a real click
  submits (303 → /admin or /dashboard by role; failure → /login?error=auth_failed). Scanners issue
  GET/HEAD and don't submit forms, so the token survives the scan and only the human consumes it.
  Costs one extra click for everyone (standard mitigation). Pairs with the login-code fallback below
  and the middleware already exempts /auth/confirm (path-based, so POST is allowed too).
- **Login-code input accepts 8 digits.** Supabase is configured for 8-digit OTPs but the code box
  capped at 6; widened to 8 and made all member-facing copy length-agnostic ("login code").
- **Login by code (fallback for when links get eaten by email scanners).** Root problem:
  Outlook/Hotmail "SafeLinks" (and similar corporate scanners) pre-open one-time magic links to
  vet them, consuming the token before the member clicks — an unbreakable loop for those members
  (Rachel Bucci). Added a code-based path ALONGSIDE the existing magic link (both options kept):
  `generateSigninOtpIfExists()` (`auth-links.ts`) mints the 6-digit `email_otp` paired with a magic
  link (invitation-only, no account creation); `POST /api/auth/otp-request` emails it branded (big
  gold code block, enumeration-safe); `POST /api/auth/otp-verify` verifies it server-side
  (`verifyOtp`, tries type 'email' then 'magiclink' for version-safety), ensures a profile row, and
  returns the role-based redirect. Login page reworked into link/code modes: "Trouble with the link?
  Email me a 6-digit code instead" on the link form and the inbox screen, and the `auth_failed`
  notice now shows a one-tap "Email me a 6-digit code instead" button. Codes can't be consumed by a
  URL scanner, so they work when links don't.
- **Login: expired/used sign-in links no longer silently loop.** A member (Rachel Bucci) was stuck
  re-clicking an old invite link and landing back on /login with no explanation. Root cause: sign-in
  links are one-time + short-lived (Supabase magic-link expiry), and `/auth/confirm` bounces failures
  to `/login?error=auth_failed`, but the login page never read that param — so the member got zero
  feedback and looped. The login page now detects `?error=auth_failed` on mount and shows a clear
  notice ("that link expired or was already used, enter your email for a fresh one; open it in
  Safari/Chrome, not your email app") and strips the param. Also restyled the error slot as a
  readable notice box. No auth-flow change; token-hash verify is unchanged. (Immediate member fix is
  a fresh link, opened in a real browser, used promptly.)

### 2026-07-10
- **Office Hours: third weekly option — "Rescheduled" to another day/time.** The Settings
  Tuesday-Office-Hours control was a two-way toggle (meeting / no-meeting). Added a **Rescheduled
  this week** option where the admin picks a **day of the week** (dropdown) and **time** (time
  input); members then see the call moved to that day/time. Migration
  `office_hours_weeks_add_rescheduled` adds `status` ('meeting'|'no_meeting'|'rescheduled', backfilled
  from `has_meeting` which is kept in sync), `rescheduled_date`, `rescheduled_time` (recorded in
  `supabase-schema.sql`). `getOfficeHoursStatus()` now returns `status` + rescheduled fields + an
  `isMeetingDayET` flag (true on Tuesday for normal weeks, or on the moved date for rescheduled
  weeks). `OfficeHoursCard` renders three states: on the call day it shows the **Join the Zoom**
  button (with the moved time for reschedules); otherwise a "moved to {Day} at {time}" notice, plus a
  once-per-week announcement popup for changed weeks. `OfficeHoursSettings` got the 3-way selector +
  weekday/time pickers (weekday → concrete date within the week); `/api/office-hours-week`
  GET/PUT handle `status`/`rescheduled_*` (back-compat with old `has_meeting` payloads); the Monday
  reminder cron reports the rescheduled slot. Preview overrides: `?oh=moved` / `?oh=movedtoday`.
- **Member quarter now comes from actual program start, not signup date.** The dashboard derived the
  Current Quarter from `members.join_date`, which was auto-set to when the member was added, so
  everyone showed Q1. `join_date` is now the editable **program start date**: exposed as a
  "Program start date" field in the admin Payments panel (`MemberPaymentsPanel`, saved via
  `PATCH /api/members/[id]` — added `join_date` to the editable fields with date validation).
  **Backfilled** all 5 real members' `join_date` from their `member_billing.membership_start`
  (the real start), so quarters corrected immediately (Allison Q3, Gina Q3, Krystal Q1, Sean Q4,
  Yvonne Q1). Note: quarter must stay on `members` (member-readable) not `member_billing`
  (admin-only RLS), so the field writes `join_date`, and AttendanceCard's month range now starts
  from the true start too.
- **Member dashboard decluttered + dedicated "My Homework" page.** Homework was a long list at the
  bottom of the dashboard, mixed and messy. New member nav item **My Homework** →
  `/dashboard/homework` (server page, loads the member's tasks and renders `HomeworkSection`). The
  dashboard now stays analytics + shortcuts only: removed the homework list; the deadline-reminder
  bubble and the Homework stat card now link to `/dashboard/homework` (was an on-page anchor).
- **Member homework sorted: unfinished first.** `HomeworkSection` now sorts BOTH the "This Week's
  Homework" and "Blueprint Tasks" lists by a shared comparator — incomplete first (soonest due
  first, undated last), completed sink to the bottom — so done/not-done no longer interleave. (The
  Blueprint list already did this; homework didn't.)
- **Billing: 6-month (and custom) plan length + fixed a false-outstanding case.** Billing assumed a
  12-month program, so a special short deal generated too many payment rows and looked outstanding
  forever. Added a **Plan length** selector to Billing Settings (12 months / 6 months) backed by a
  new `member_billing.term_months` column (migration `member_billing_add_term_months`, int 1-60 or
  null = legacy 12-mo default; recorded in `supabase-schema.sql`). Wired through:
  `/api/member-billing` PUT (validate + persist), the schedule generator
  (`/api/member-payments/generate` monthly cap = `term_months`, so a 6-month plan makes exactly 6
  rows), and the client `nextDueFromBilling()` projection (stops after the agreed number of monthly
  payments, so no phantom "next due"). Backward compatible: existing members read as 12 and behave
  as before until edited. **Fixed Sean Bates** (a real 6-month / 6×$2,500 = $15,000 deal): his
  ledger had 10 rows (membership_end was set ~10 months out), leaving 4 unpaid phantom rows =
  $10,000 false outstanding (also overdue, which the new payment-reminder cron would have emailed
  daily). Deleted the 4 unpaid rows and set his `term_months = 6`; he now shows 6 paid rows,
  $15,000 paid, **$0 outstanding**. Admin-only; no member-facing change.
- **Admin homework rows now show the auto-captured "Added" date.** Small, muted "Added {Mon D, YYYY}"
  in the top-right corner of each task row on both admin surfaces (`HomeworkOverview` TaskRow +
  `HomeworkPanel` row), so admins have a record of when each task was created. Uses the existing
  `created_at` (system-set on insert — no manual entry, no schema/API change); display-only. Pairs
  with the newest-first sort below.
- **Admin homework now sorts by date sent (newest first).** Per admin request: tasks were mixed up
  so recent homework and months-old items were interleaved and hard to track. Both admin surfaces
  now sort each list by `created_at` (the "sent" date, same field the date filter uses) descending,
  tie-broken by id for stability on batch inserts: the `/admin/homework` overview (`HomeworkOverview`
  To-do + Completed lists, was due-date / completion-date) and the per-member `HomeworkPanel` on the
  member detail page (pending + done, was the API's `sort_order` order). Sorting only (no display or
  filter change); member-facing homework order is untouched.
- **Payment due-date reminders to admins (new daily cron).** Requested: nudge admins on a member's
  payment due date so they remember to check Stripe and mark it paid in the portal. New
  `/api/cron/payment-reminders` (`30 13 * * *` = daily 9:30am ET, Bearer `CRON_SECRET`-guarded,
  service-role). Finds `member_payments` rows still `unpaid`/`partial` with a remaining balance and
  `due_date <= today (ET)`, splits into **Due today** (gold) and **Overdue and still unpaid** (red,
  so a missed update keeps nudging), excludes `is_internal` accounts, formats each line with the
  member, remaining amount (member's `member_billing.currency`, default USD), period label and due
  date. Sends ONE branded email per admin (owner/admin/manager, via `profiles.email`) with a CTA to
  `/admin/payments`; sends nothing on a quiet day. Registered in `vercel.json`. Admin-only, no
  member-facing change. Current data: 0 due/overdue today, 19 future (earliest 2026-08-12), so it
  stays silent until real due dates arrive.
- **Backfilled Kristy Waker's `profiles.email`** (`kristy@gogosrealestate.com`) — it was NULL from
  the manual profile fix, which would have excluded her from every admin email (digest, office-hours,
  payment reminders). All four owner/admin/manager profiles now have emails.

### 2026-06-30
- **Task labels now reflect origin (admin vs AI), not just type.** Admins couldn't tell tasks they
  assigned apart from ones AI/automation added — everything read as homework. New
  `homework.source` column (migration `homework_add_source`, applied live + recorded in
  `supabase-schema.sql`, check-constrained) records how each task entered:
  `admin` (manual add), `blueprint` (AI from blueprint), `financial` (GHL financial rules),
  `ai_followup` (AI suggested from a note), `followup` (manual "make follow-up" button). Set at all
  five insert sites. New `src/lib/taskSource.ts` maps source → label
  (**Homework** / AI · Blueprint / AI · Finance / AI · Note / Follow-up) + badge style (admin = gold,
  AI/auto = muted). Swapped the old type-based "Blueprint/HW" badge for the source badge in both
  admin surfaces (`HomeworkPanel`, `HomeworkOverview`); the overview's filter tabs are now
  All / Homework / AI-added. Backfill heuristic: `rule_key`→financial, `auto_suggested`→ai_followup,
  else admin — so **pre-existing blueprint tasks can't be distinguished from manual ones and read as
  "Homework"; only newly generated blueprint tasks get tagged** (live counts after backfill:
  admin 97, ai_followup 10). Member-facing UI unchanged.
- **Tuesday digest now lists due-soon + overdue tasks per member.** Each member section in the
  weekly team briefing (`src/lib/weekly-digest.ts`) now shows two explicit, deterministic lists
  beneath the narrative: **Overdue a week or more** (open, due ≥7 days ago, red, most-overdue first)
  and **Due in the next 5 days** (open, due today→+5, gold, soonest first), each with a per-task
  "N days overdue" / "due today/tomorrow/in N days" label. Independent of the AI narrative so they
  always render. Verified against live data (e.g. Krystal Thomas → 1 overdue + 4 due-today).
- **Chat monitor now excludes internal/test accounts.** `/admin/chats` filters out members flagged
  `is_internal` (matching the digest), so it shows real members only instead of being dominated by
  staff test chats.
- **Ask Gogo for staff + member-chat monitoring tab.** Two asks: (1) give Gogo/admins their own
  Ask Gogo bubble, and (2) let staff read every member's Ask Gogo conversation to check the Brain's
  accuracy.
  - **Staff chats now persist with history.** `chat_sessions` was member-only (`member_id NOT NULL`,
    FK → members, member-own RLS). Migration `chat_sessions_allow_staff_owner` (applied to live DB):
    made `member_id` nullable, added `staff_id uuid → profiles`, an XOR check
    (`chat_sessions_owner_chk` — exactly one owner), an `idx_chat_sessions_staff` index, and
    `staff_own_sessions`/`staff_own_messages` RLS policies (parallel to the member ones; permissive
    policies OR together). Verified the XOR rejects both-null and both-set.
  - New `src/lib/chatOwner.ts` `resolveChatOwner()` resolves the current user to a chat owner —
    staff (by `auth.uid()` → `staff_id`) checked first, else member (by email → `member_id`) — and
    returns the column to filter/insert on. Rewired `/api/chat/sessions` (GET/POST) and
    `/api/chat/[sessionId]/messages` (GET/POST) through it, so the existing `ChatOverlay` now works
    for staff with zero client changes. Admin layout renders `<ChatBubble />` (persisted, NOT the
    ephemeral `preview` path; impersonation still uses `preview`).
  - **New `/admin/chats` monitoring tab** (sidebar "Ask Gogo Chats", after Office Hours). Read-only
    master-detail: left list of every **member** session (member name, title, last-updated, message
    count, searchable); right pane loads the full transcript with Ask Gogo's markdown rendered.
    Server page is staff-gated (all roles: owner/admin/manager/support/tech) and reads via the
    **service-role** client since chat RLS is owner-only (no admin policy). Transcript fetched from
    new staff-gated `GET /api/admin/chats/[sessionId]` (service-role). Staff test chats are excluded
    (`member_id IS NOT NULL`). New component `src/components/admin/ChatMonitor.tsx`.
  - Added the chat tables to `supabase-schema.sql` (they had never been recorded there) reflecting
    the new staff-owner shape. tsc + lint + `next build` all clean.
  - **Follow-up: monitor groups chats by member.** The `/admin/chats` list now groups sessions
    under a collapsible per-member header (member name + chat count) instead of a flat list; each
    member's sessions nest beneath, ordered most-recent-first, members ordered by latest activity.
    Passed `member_id` through the page for stable grouping; search still filters across members
    and titles.

### 2026-06-25
- **Digest preview made async + exclude internal accounts.** The preview was slow because the AI
  narrative pass (~30–60s) ran before responding; `/api/admin/digest-preview` now acknowledges
  instantly and builds+sends in the background via `after()`. Also added `members.is_internal`
  (migration) flagged true for the 5 staff/test accounts (Ferny Rodriguez, Kristy Waker, Samuel
  Akinwande, Tech Team, Test member); `buildWeeklyDigest` excludes them so only real members appear.
- **Tuesday 9am weekly member digest (team briefing).** New `src/lib/weekly-digest.ts`
  `buildWeeklyDigest()` gathers each active+invited member's past 7 days (tasks completed, portal
  notes/comments, this-week attendance from weekly_logs, open/overdue counts) and asks Claude for a
  warm, factual 2–4 sentence narrative per member (deterministic template fallback if AI is off).
  Renders a branded email with one section per member (name, stat chips, narrative, quoted notes).
  New cron `/api/cron/tuesday-digest` (`0 13 * * 2` = Tue 9am ET, Bearer-guarded) emails it to
  owner/admin/manager before office hours. Also added `/api/admin/digest-preview` (staff POST →
  sends the digest to the requesting admin's own email) and a "Weekly Member Digest" card on the
  admin Settings page with a "Send me a preview now" button.
- **Admins can now see members' task notes.** Members write notes on their tasks
  (`homework.notes`), but the admin views never rendered them. Both admin homework surfaces now
  show a gold "Member note" block under any task that has one: the per-member `HomeworkPanel`
  (member detail page) and the `/admin/homework` overview (added `notes` to its query/shape).
  Read-only display; the data was already being stored.

### 2026-06-19
- **Block the Drive popout on call replays.** Google Drive's `/preview` player shows an
  "open in new window" button (top-right) that exposes the raw file link — members shouldn't get
  that. Can't style a cross-origin iframe, so `VideoEmbed` (used by Clarity Calls + Office Hours
  replays) now overlays a transparent click-blocker over that corner for Drive embeds, neutralizing
  the popout while leaving the centre/bottom playback controls untouched. (The src is still in page
  source for a determined user via devtools — unavoidable with iframe embeds — but the obvious
  button is dead.)
- **Homework overview: type + sent-date filters.** The admin `/admin/homework` detail pane now has
  a filter bar: type tabs (All / Homework / Blueprint) and a "Sent" date range (From / To, on
  `created_at`) so an admin can narrow to e.g. "blueprint tasks I sent last week." The summary % and
  the To-do / Completed lists reflect the filter (with a "(filtered)" hint); the member roster counts
  stay overall. Passed `homework.created_at` through the page.
- **Member profile reordered + widened.** On the admin member detail page, **Homework/Tasks** now
  comes first (right after the stats), then **Log This Week + Reports** side-by-side near the top,
  then Blueprint / Clarity Calls / Documents, with **Payments moved to the very bottom**. Container
  widened `max-w-5xl → max-w-7xl` to use the empty right-side space.
- **Task deadline reminders (email + in-portal).** (1) New daily cron `/api/cron/task-reminders`
  (`0 14 * * *` in vercel.json, Bearer-guarded) emails each active+invited member ONE bundled
  branded email listing every incomplete task whose due date is within the window (3 days before →
  3 days after, a short overdue grace), sorted by due date with "Due in N days / Due today / N days
  overdue" labels — never one email per task, and tasks drop off once completed or >3 days overdue.
  Added an optional `bodyHtml` block to `brandedEmail()` for the task list/table. (2) In-portal:
  the member dashboard shows a "⏰ tasks coming due" reminder bubble (amber, red if any overdue)
  linking down to the homework section; per-task due badges already existed.

### 2026-06-18
- **New admin "Homework" overview (quick-glance task tracking).** Requested by an admin: a way to
  scan everyone's homework without opening profiles one by one. New `/admin/homework` page + sidebar
  nav item (after Members). Left list of members each with a done/total + progress bar; a detail
  pane with a member dropdown and prev/next arrows to switch without going back; the selected
  member's tasks split into "To do" (sorted by due date) and "Completed" (sorted by completion),
  with a % summary. Read-only glance with a link into the member's full profile to edit. Server
  page (`src/app/admin/homework/page.tsx`) fetches members + homework via the RLS admin client;
  client renderer `HomeworkOverview`.
- **Desktop sidebar pinned to viewport.** It was `min-h-screen`, so on long pages it stretched and
  the footer (user email / Light mode / Sign out) dropped to the bottom of the page. Now
  `h-screen sticky top-0 self-start` so it stays viewport-height and pinned; the nav scrolls
  internally if needed and the footer is always reachable without scrolling.
- **Three admin tweaks.** (1) Attendance records (`WeeklyLogsEditor`) now have a trash-icon
  delete on each row (confirm + toast, removes the `weekly_logs` row via the RLS admin client).
  (2) Renamed the payment-panel labels "Membership Start/End" → "Payment Start/End" (wording only,
  same underlying `membership_start`/`membership_end` fields). (3) Added an "Access Member's View"
  (impersonation) link to the action-button row on the admin member detail page, matching the one
  on the members list.
- **Fix: login recovers session from implicit-flow magic links.** Some magic links come back with
  the tokens in the URL hash (`#access_token=…`), which the server callback can't read, so it
  bounced to `/login` leaving the session stranded. The login page now detects those hash tokens
  client-side, calls `setSession` on the cookie-backed SSR browser client, and redirects in (shows
  a "Signing you in…" spinner). Belt-and-suspenders alongside the `/auth/confirm` token-hash route.
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
  lookup (see §9). `/r/[token]` had the same latent bug and was fixed too.
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
