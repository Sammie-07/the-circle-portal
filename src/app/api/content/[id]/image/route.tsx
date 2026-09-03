import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']

interface Slide {
  headline?: string
  body?: string
}

// A set of distinct visual "skins" so carousels don't all look the same. The
// skin is picked deterministically per post (hash of its id), so every slide in
// one post shares a look, but different posts get different treatments.
interface Skin {
  bg: string
  fg: string
  sub: string
  accent: string
  eyebrow: string
  counter: string
  footerBrand: string
  align: 'flex-start' | 'center'
  header: 'text' | 'band'
  deco: 'glow' | 'rail' | 'ring' | 'none'
}

const SKINS: Skin[] = [
  // 0 — Noir with a soft gold corner glow, left aligned.
  { bg: '#090909', fg: '#FFFFFF', sub: '#CFCFCF', accent: '#C9A227', eyebrow: '#C9A227', counter: '#666666', footerBrand: '#FFFFFF', align: 'flex-start', header: 'text', deco: 'glow' },
  // 1 — Gold band header, high contrast.
  { bg: '#0B0B0B', fg: '#FFFFFF', sub: '#C9C9C9', accent: '#C9A227', eyebrow: '#0B0B0B', counter: '#0B0B0B', footerBrand: '#FFFFFF', align: 'flex-start', header: 'band', deco: 'none' },
  // 2 — Editorial: full-bleed gold left rail, charcoal ground.
  { bg: '#0E0E0E', fg: '#F2F0EC', sub: '#B4B4B4', accent: '#C9A227', eyebrow: '#C9A227', counter: '#666666', footerBrand: '#F2F0EC', align: 'flex-start', header: 'text', deco: 'rail' },
  // 3 — Cream / light. Stands out in a dark feed.
  { bg: '#F2F0EC', fg: '#141414', sub: '#4A4A4A', accent: '#9A7B12', eyebrow: '#9A7B12', counter: '#B3AFA6', footerBrand: '#141414', align: 'flex-start', header: 'text', deco: 'none' },
  // 4 — Spotlight: centered, warm-dark ground, gold ring, lighter gold accent.
  { bg: '#0C0A07', fg: '#FFFFFF', sub: '#DADADA', accent: '#E8CF7A', eyebrow: '#E8CF7A', counter: '#7A7A7A', footerBrand: '#FFFFFF', align: 'center', header: 'text', deco: 'ring' },
]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// GET /api/content/[id]/image?i=N — render slide N of a post as a 1080x1080
// on-brand PNG. The layout/skin varies per post. Same-origin + staff-gated.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const i = Math.max(0, Number(new URL(request.url).searchParams.get('i') ?? '0') || 0)

  const admin = createAdminClient()
  const { data: post } = await admin.from('content_posts').select('slides').eq('id', id).maybeSingle()
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const slides = (Array.isArray(post.slides) ? post.slides : []) as Slide[]
  const total = slides.length || 1
  const slide = slides[i] ?? slides[0] ?? {}
  const headline = String(slide.headline ?? '').trim() || 'The Circle'
  const body = String(slide.body ?? '').trim()

  const skin = SKINS[hashStr(id) % SKINS.length]
  const role: 'cover' | 'point' | 'cta' = total > 1 && i === total - 1 ? 'cta' : i === 0 ? 'cover' : 'point'
  const align = role === 'cta' ? 'center' : skin.align
  const centered = align === 'center'
  const headlineSize = role === 'cover' ? 94 : role === 'cta' ? 82 : 72
  const headlineColor = role === 'cta' ? skin.accent : skin.fg

  const pad = skin.deco === 'rail' ? '86px 80px 86px 118px' : '86px 80px'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: skin.bg,
          padding: pad,
          position: 'relative',
        }}
      >
        {/* decoration */}
        {skin.deco === 'glow' ? (
          <div style={{ position: 'absolute', top: '-260px', right: '-160px', width: '620px', height: '620px', borderRadius: '9999px', background: 'rgba(201,162,39,0.16)', filter: 'blur(60px)', display: 'flex' }} />
        ) : null}
        {skin.deco === 'rail' ? (
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '16px', background: skin.accent, display: 'flex' }} />
        ) : null}
        {skin.deco === 'ring' ? (
          <div style={{ position: 'absolute', top: '270px', left: '290px', width: '500px', height: '500px', borderRadius: '9999px', border: '2px solid rgba(232,207,122,0.22)', display: 'flex' }} />
        ) : null}

        {/* header */}
        {skin.header === 'band' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: skin.accent, borderRadius: '8px', padding: '16px 24px' }}>
            <div style={{ display: 'flex', letterSpacing: '5px', color: '#0B0B0B', fontSize: '24px', fontWeight: 800 }}>THE CIRCLE · #TEAMGOGO</div>
            <div style={{ display: 'flex', color: '#0B0B0B', fontSize: '24px', fontWeight: 800 }}>{total > 1 ? `${i + 1} / ${total}` : ''}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', letterSpacing: '6px', color: skin.eyebrow, fontSize: '26px', fontWeight: 700 }}>THE CIRCLE · #TEAMGOGO</div>
            <div style={{ display: 'flex', color: skin.counter, fontSize: '26px', fontWeight: 700 }}>{total > 1 ? `${i + 1} / ${total}` : ''}</div>
          </div>
        )}

        {/* body */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: centered ? 'center' : 'flex-start', width: '100%' }}>
          <div style={{ display: 'flex', width: '90px', height: '6px', background: skin.accent, marginBottom: '40px' }} />
          <div
            style={{
              display: 'flex',
              color: headlineColor,
              fontSize: `${headlineSize}px`,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-1px',
              maxWidth: '920px',
              textAlign: centered ? 'center' : 'left',
            }}
          >
            {headline}
          </div>
          {body ? (
            <div style={{ display: 'flex', color: skin.sub, fontSize: '40px', lineHeight: 1.4, marginTop: '34px', maxWidth: '880px', textAlign: centered ? 'center' : 'left' }}>
              {body}
            </div>
          ) : null}
        </div>

        {/* footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', color: skin.footerBrand, fontSize: '30px', fontWeight: 700 }}>Gogo Bethke</div>
          <div style={{ display: 'flex', color: skin.accent, fontSize: '30px', fontWeight: 700 }}>
            {i === total - 1 ? 'Comment “CIRCLE”' : 'The Circle'}
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  )
}
