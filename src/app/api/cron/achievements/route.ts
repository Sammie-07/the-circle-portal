import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectForMember, reconcileAchievementPostNotifications } from '@/lib/achievements'
import { generateBatch } from '@/lib/content/generate-batch'

export const runtime = 'nodejs'
export const maxDuration = 60

// Daily sweep: awards time/attendance/survey/tenure achievements (rules) for
// every active member and runs the AI catch-all pass for as many as fit inside
// a safe time budget (rules are cheap; the AI call is the slow part). Milestone
// achievements email the member (with a per-member cooldown). The instant
// homework-completion hook covers real-time task wins; this catches everything
// time-based that no user action triggers.
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // One-time launch backfill: ?mode=backfill records everyone's CURRENT
  // achievements as already seen + emailed (no confetti, no email), so only new
  // milestones from now on celebrate. Run once right after the feature deploys.
  const backfill = new URL(request.url).searchParams.get('mode') === 'backfill'

  const admin = createAdminClient()
  const { data: members } = await admin
    .from('members')
    .select('id')
    .eq('status', 'active')
    .eq('is_internal', false)
    .not('email', 'is', null)

  const list = members ?? []
  const started = Date.now()
  const AI_BUDGET_MS = 42_000 // stop starting AI calls after this; rules still run for all

  let awardedTotal = 0
  let milestoneTotal = 0
  let aiRan = 0
  for (const m of list) {
    if (backfill) {
      try {
        awardedTotal += (await detectForMember(admin, m.id as string, { backfill: true })).length
      } catch {}
      continue
    }
    const includeAi = Date.now() - started < AI_BUDGET_MS
    if (includeAi) aiRan++
    try {
      const awarded = await detectForMember(admin, m.id as string, { includeAi, email: true })
      awardedTotal += awarded.length
      milestoneTotal += awarded.filter((a) => a.tier === 'milestone').length
    } catch {
      // per-member failure never aborts the sweep
    }
  }

  if (backfill) return NextResponse.json({ mode: 'backfill', members: list.length, recorded: awardedTotal })

  // New milestones are postable — draft a small content batch from them
  // (achievements feed the content machine as member_win signals). Capped so it
  // can't blow the function budget; drafts land in the admin content queue.
  let drafted = 0
  if (milestoneTotal > 0) {
    drafted = await generateBatch({ force: true, cap: 4 }).catch(() => 0)
    await reconcileAchievementPostNotifications(admin).catch(() => {})
  }

  return NextResponse.json({ members: list.length, aiRan, awarded: awardedTotal, milestones: milestoneTotal, drafted })
}
