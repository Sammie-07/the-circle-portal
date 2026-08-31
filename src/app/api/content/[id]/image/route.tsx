import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']
const GOLD = '#C9A227'

interface Slide {
  headline?: string
  body?: string
}

// GET /api/content/[id]/image?i=N — render slide N of a post as a 1080x1080
// on-brand PNG (deep near-black, gold accents). Same-origin + staff-gated.
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

  const slides = (Array.isArray(post.slides) ? post.slides : []) as Slide[]
  const total = slides.length || 1
  const slide = slides[i] ?? slides[0] ?? {}
  const headline = String(slide.headline ?? '').trim() || 'The Circle'
  const body = String(slide.body ?? '').trim()
  const isCover = i === 0

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0D0D0D',
          padding: '90px 88px',
          position: 'relative',
        }}
      >
        {/* gold glow */}
        <div style={{ position: 'absolute', top: '-260px', right: '-160px', width: '620px', height: '620px', borderRadius: '9999px', background: 'rgba(201,162,39,0.16)', filter: 'blur(60px)', display: 'flex' }} />

        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', letterSpacing: '6px', color: GOLD, fontSize: '26px', fontWeight: 700 }}>
            THE CIRCLE · #TEAMGOGO
          </div>
          <div style={{ display: 'flex', color: '#666', fontSize: '26px', fontWeight: 700 }}>
            {total > 1 ? `${i + 1} / ${total}` : ''}
          </div>
        </div>

        {/* body */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', width: '90px', height: '6px', background: GOLD, marginBottom: '40px' }} />
          <div
            style={{
              display: 'flex',
              color: '#FFFFFF',
              fontSize: isCover ? '92px' : '76px',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-1px',
            }}
          >
            {headline}
          </div>
          {body ? (
            <div style={{ display: 'flex', color: '#CFCFCF', fontSize: '40px', lineHeight: 1.4, marginTop: '34px', maxWidth: '860px' }}>
              {body}
            </div>
          ) : null}
        </div>

        {/* footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', color: '#FFFFFF', fontSize: '30px', fontWeight: 700 }}>Gogo Bethke</div>
          <div style={{ display: 'flex', color: GOLD, fontSize: '30px', fontWeight: 700 }}>
            {i === total - 1 ? 'Comment “CIRCLE”' : 'The Circle'}
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  )
}
