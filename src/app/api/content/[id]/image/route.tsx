import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { renderSlideImage } from '@/lib/content/slide-image'

export const runtime = 'nodejs'

const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']

// Category kicker shown on the cover slide, by signal type.
const EYEBROW: Record<string, string> = {
  member_win: 'Real Results',
  community: 'The Circle Community',
  takeaway: 'The Lesson',
  educational: 'The Playbook',
}

// GET /api/content/[id]/image?i=N — render slide N of a post as a premium
// 1080x1080 brand PNG (see src/lib/content/slide-image.tsx). Same-origin + staff-gated.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const i = Math.max(0, Number(new URL(request.url).searchParams.get('i') ?? '0') || 0)

  const admin = createAdminClient()
  const { data: post } = await admin.from('content_posts').select('slides, source_type').eq('id', id).maybeSingle()
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const slides = (Array.isArray(post.slides) ? post.slides : []) as { headline?: string; body?: string }[]
  const total = slides.length || 1
  const slide = slides[i] ?? slides[0] ?? {}
  const headline = String(slide.headline ?? '').trim() || 'The Circle'
  const body = String(slide.body ?? '').trim()
  const eyebrow = i === 0 ? EYEBROW[String(post.source_type)] : undefined

  return renderSlideImage({ seed: id, i, total, headline, body, eyebrow })
}
