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
  anchor: 'top' | 'center' | 'bottom' // where the headline block sits vertically
}

const SKINS: Skin[] = [
  // 0 — Noir with a soft gold corner glow; headline sits low.
  { bg: '#090909', fg: '#FFFFFF', sub: '#CFCFCF', accent: '#C9A227', eyebrow: '#C9A227', counter: '#666666', footerBrand: '#FFFFFF', align: 'flex-start', header: 'text', deco: 'glow', anchor: 'bottom' },
  // 1 — Gold band header, high contrast; headline centered.
  { bg: '#0B0B0B', fg: '#FFFFFF', sub: '#C9C9C9', accent: '#C9A227', eyebrow: '#0B0B0B', counter: '#0B0B0B', footerBrand: '#FFFFFF', align: 'flex-start', header: 'band', deco: 'none', anchor: 'center' },
  // 2 — Editorial: full-bleed gold left rail; headline high.
  { bg: '#0E0E0E', fg: '#F2F0EC', sub: '#B4B4B4', accent: '#C9A227', eyebrow: '#C9A227', counter: '#666666', footerBrand: '#F2F0EC', align: 'flex-start', header: 'text', deco: 'rail', anchor: 'top' },
  // 3 — Cream / light, stands out in a dark feed; headline low.
  { bg: '#F2F0EC', fg: '#141414', sub: '#4A4A4A', accent: '#9A7B12', eyebrow: '#9A7B12', counter: '#B3AFA6', footerBrand: '#141414', align: 'flex-start', header: 'text', deco: 'none', anchor: 'bottom' },
  // 4 — Spotlight: centered, warm-dark, gold ring, lighter gold accent.
  { bg: '#0C0A07', fg: '#FFFFFF', sub: '#DADADA', accent: '#E8CF7A', eyebrow: '#E8CF7A', counter: '#7A7A7A', footerBrand: '#FFFFFF', align: 'center', header: 'text', deco: 'ring', anchor: 'center' },
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
  // Vertical composition varies per skin so posts don't look identical.
  const growTop = skin.anchor === 'top' ? 0 : skin.anchor === 'center' ? 1 : 2
  const growBottom = skin.anchor === 'top' ? 2 : skin.anchor === 'center' ? 1 : 0
  const headerColor = skin.header === 'band' ? '#0B0B0B' : skin.eyebrow
  const ringSize = skin.header === 'band' ? 20 : 22

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
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

        {/* header — the brand mark carries a drawn ⭕ ring */}
        <div
          style={
            skin.header === 'band'
              ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: skin.accent, borderRadius: '8px', padding: '16px 24px' }
              : { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
          }
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', letterSpacing: skin.header === 'band' ? '5px' : '6px', color: headerColor, fontSize: skin.header === 'band' ? '24px' : '26px', fontWeight: skin.header === 'band' ? 800 : 700 }}>THE CIRCLE</div>
            <div style={{ display: 'flex', width: `${ringSize}px`, height: `${ringSize}px`, borderRadius: '9999px', border: `3px solid ${headerColor}`, margin: '0 12px' }} />
            <div style={{ display: 'flex', letterSpacing: skin.header === 'band' ? '5px' : '6px', color: headerColor, fontSize: skin.header === 'band' ? '24px' : '26px', fontWeight: skin.header === 'band' ? 800 : 700 }}>#TEAMGOGO</div>
          </div>
          <div style={{ display: 'flex', color: skin.header === 'band' ? '#0B0B0B' : skin.counter, fontSize: skin.header === 'band' ? '24px' : '26px', fontWeight: skin.header === 'band' ? 800 : 700 }}>{total > 1 ? `${i + 1} / ${total}` : ''}</div>
        </div>

        {/* spacer (varies headline position) */}
        <div style={{ display: 'flex', flexGrow: growTop }} />

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

        {/* spacer */}
        <div style={{ display: 'flex', flexGrow: growBottom }} />

        {/* footer — brand signature (The Circle ⭕), not a personal account */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', color: skin.footerBrand, fontSize: '30px', fontWeight: 700 }}>The Circle</div>
            <div style={{ display: 'flex', width: '24px', height: '24px', borderRadius: '9999px', border: `3px solid ${skin.accent}`, marginLeft: '10px' }} />
          </div>
          <div style={{ display: 'flex', color: skin.accent, fontSize: '30px', fontWeight: 700 }}>
            {i === total - 1 ? 'Comment “CIRCLE”' : 'with Gogo Bethke'}
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  )
}
