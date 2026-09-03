import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generatePost } from '@/lib/content/generate'
import { themeForAchievement, type ContentSignal } from '@/lib/content/signals'
import { reconcileAchievementPostNotifications } from '@/lib/achievements'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const CONTENT_ROLES = ['owner', 'admin', 'manager']

// POST /api/admin/achievements/make-post — admin turns ONE achievement into a
// content draft on demand. Milestones auto-post; this lets admins opt in the
// small (non-milestone) ones too. Idempotent via the same dedupe key the auto
// pipeline uses, so it can never create a duplicate of an already-posted win.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!CONTENT_ROLES.includes(profile?.role ?? '')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let achievementId: string | undefined
  try { achievementId = (await request.json())?.achievementId } catch { /* noop */ }
  if (!achievementId) return NextResponse.json({ error: 'achievementId required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: a } = await admin
    .from('achievements')
    .select('id, member_id, achievement_key, title, body')
    .eq('id', achievementId)
    .maybeSingle()
  if (!a) return NextResponse.json({ error: 'Achievement not found' }, { status: 404 })

  const { data: member } = await admin.from('members').select('name').eq('id', a.member_id).maybeSingle()
  const name = member?.name ?? 'A Circle member'
  const dedupeKey = `achv:${a.member_id}:${a.achievement_key}`

  // Already drafted (auto or a prior click)? Return it instead of duplicating.
  const { data: existing } = await admin.from('content_posts').select('id').eq('dedupe_key', dedupeKey).maybeSingle()
  if (existing) return NextResponse.json({ ok: true, postId: existing.id, alreadyExists: true })

  const signal: ContentSignal = {
    sourceType: 'member_win',
    memberId: a.member_id,
    memberName: name,
    theme: themeForAchievement(a.achievement_key),
    dedupeKey,
    summary: `${name} · ${a.title}`,
    data: {
      member: name,
      milestone: a.title,
      detail: a.body,
      note: 'a member achievement an admin chose to celebrate publicly — consistency, discipline, and doing the work in The Circle',
    },
  }

  let postId: string | null = null
  try {
    const content = await generatePost(signal)
    const { data: inserted } = await admin
      .from('content_posts')
      .upsert(
        {
          source_type: signal.sourceType,
          member_id: signal.memberId,
          signal: signal.data,
          trigger_summary: signal.summary,
          dedupe_key: signal.dedupeKey,
          format: content.format,
          platform: content.platform,
          caption: content.caption,
          hashtags: content.hashtags,
          slides: content.slides,
          art_direction: content.artDirection,
          status: 'draft',
        },
        { onConflict: 'dedupe_key', ignoreDuplicates: true }
      )
      .select('id')
      .maybeSingle()
    postId = inserted?.id ?? null
  } catch {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }

  // Log the "post drafted" admin notification for this new draft.
  await reconcileAchievementPostNotifications(admin).catch(() => {})

  return NextResponse.json({ ok: true, postId })
}
