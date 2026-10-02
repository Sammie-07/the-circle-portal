import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeCaption } from '@/lib/content/caption'
import type { ConceptBrief } from '@/lib/content/concepts'
import type { Bucket } from '@/lib/content/buckets'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']

// POST /api/content/[id]/caption — write (or rewrite) the caption for one idea.
// Body (optional): { note?: string } to steer the rewrite.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  let body: { note?: string } = {}
  try { body = await request.json() } catch { /* no body is fine */ }

  const admin = createAdminClient()
  const { data: post } = await admin.from('content_posts').select('id, bucket, brief, caption').eq('id', id).maybeSingle()
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!post.brief || !post.bucket) return NextResponse.json({ error: 'This item has no concept brief to write from' }, { status: 400 })

  try {
    const c = await writeCaption(post.bucket as Bucket, post.brief as ConceptBrief, {
      note: body.note?.trim() || undefined,
      previous: (post.caption as string) || undefined,
    })
    const { error } = await admin.from('content_posts').update({ caption: c.caption, hashtags: c.hashtags, edited: false, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, caption: c.caption, hashtags: c.hashtags })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not write a caption' }, { status: 500 })
  }
}
