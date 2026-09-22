# Circle Portal — Progress (Blueprint Revisions)

**Dates:** 2026-09-21 → 2026-09-22
**Scope:** The Circle Portal only. Feature: **member-requested blueprint revisions.**

---

## What we built

Members can now request changes to their 12-month blueprint through a tokenized
questionnaire. An admin reviews the request, generates an updated draft with one
click, previews it, and publishes it — at which point it replaces the member's
live blueprint and emails them. The member keeps seeing their current blueprint
the whole time, with no gap, until the admin publishes.

### End-to-end flow
1. **Admin** opens a member's page → **"⟳ Copy Blueprint Revision Link"** (next to the check-in link button) → sends the link to the member.
2. **Member** opens the link, fills a short questionnaire (their new idea/direction), submits → instant confirmation.
3. **Admins are notified** (top-bar bell + email): "[member] requested a blueprint revision."
4. On the member's page, a **revision card** shows their answers with a clear two-step flow:
   - **Step 1 — Generate updated blueprint** (visible, ~1 min, surfaces any error). Edits the *existing* blueprint to fold in the new direction; only affected parts change. Result is stored as a **draft** (live blueprint untouched).
   - **Step 2 — Preview draft / Publish to member / Discard.**
5. **Publish** archives the old version to history, swaps the draft into the live blueprint, marks it sent (publishes to the member's portal), and emails the member. Discard drops the draft.
   - While a revision is pending, the standard blueprint controls (Regenerate / Send / Share / Download / status) are hidden so only the revision card shows.

### Questionnaire specifics
- Four questions: new direction, why now, what winning looks like in 12 months, what to stop/pause.
- Prominent **"Before you start"** note: you can only have **two big ideas going at once** or you'll burn out.
- Accountability note: more detail → more detailed blueprint.
- Every field's placeholder asks the member to be as detailed as possible.

---

## Database (Supabase project: The Circle Portal — `kfstwljubakcgjvyljba`)
Migration `blueprint_revisions_and_versions` applied 2026-09-21.
- **`blueprint_revisions`** — token, status (`sent`→`submitted`→`approved`/`rejected`), answers (jsonb), timestamps.
- **`blueprint_versions`** — archived prior blueprint HTML (history), written whenever a blueprint is replaced.
- **`members`** — added `blueprint_draft_html`, `blueprint_draft_generated_at`, `blueprint_draft_revision_id` (the zero-gap draft).
- Widened `admin_notifications` type check to allow `revision_submitted`.

---

## Code

**New files**
- `src/components/admin/RevisionLinkButton.tsx` — copy-link button on the member page.
- `src/app/blueprint-revision/[token]/page.tsx` + `RevisionForm.tsx` — public questionnaire.
- `src/app/api/blueprint-revision/[token]/submit/route.ts` — record submission + notify admins.
- `src/app/api/blueprints/revision/generate/route.ts` — create/copy the revision link.
- `src/app/api/blueprints/revision/[id]/generate-draft/route.ts` — admin one-click edit → draft.
- `src/app/api/blueprints/revision/[id]/publish/route.ts` — promote draft → live + email member.
- `src/app/api/blueprints/revision/[id]/resolve/route.ts` — dismiss/discard a request.
- `src/app/api/blueprints/versions/[id]/route.ts` — view any archived version.

**Changed files**
- `src/lib/blueprint-shell.ts` — centralized blueprint CSS/shell helpers; added `editBlueprintForRevision()` (surgical edit of the existing blueprint).
- `src/components/admin/BlueprintPanel.tsx` — revision card (generate → preview → publish/discard), version-history list, controls hidden during a revision.
- `src/app/admin/member/[id]/page.tsx` — new button + pending-revision/draft/version queries.
- `src/components/shared/NotificationBell.tsx` — `revision_submitted` type with a deep link.
- `src/app/api/blueprints/generate/route.ts` — archive the current blueprint to history before overwrite.
- `supabase-schema.sql` — the new tables/columns for the record.

---

## Key decisions / fixes
- **Edit, don't rebuild:** revisions surgically edit the existing blueprint rather than regenerating from the transcript.
- **Zero-gap:** the edit lands in a draft; the member's live blueprint is untouched until publish.
- **Reliability:** dropped the silent background auto-edit (it was failing quietly on Vercel due to an oversized token limit) in favor of a visible, one-click admin action that surfaces errors. Edit token limit set to a safe value with a clear "too long" error.

---

## Commits (main)
- `28212e4` questionnaire → review flow (initial)
- `b2315d0` zero-gap draft + publish flow
- `436e81c` two-ideas rule as a prominent note
- `fe54dfa` detail nudge in every field placeholder
- `ffeb385` reliable one-click generate → preview → publish
- `4dbe2b0` hide standard controls while a revision is pending

---

## Status
- **Deployed** to production (auto-deploys from `main`). DB migration applied.
- **Ready to test:** a submitted revision from Samuel Akinwande is queued — open his member page, click **Generate updated blueprint**, preview, publish.

## Open / next
- End-to-end live verification of generate → publish (draft written, old version archived, member email sent).
- Optional: if a single-pass edit ever truncates on very large blueprints, switch to section-by-section editing.
