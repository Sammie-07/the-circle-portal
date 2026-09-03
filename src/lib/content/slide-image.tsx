import { ImageResponse } from 'next/og'

// Premium, brand-designed slide renderer shared by the real post-image route and
// the dev preview route. Luxury palette: black, gold, hints of red. Real type
// (Playfair Display headlines + DM Sans labels/body), a drawn ⭕ brand mark, and
// the achievement-medallion motif from the celebration popup.

const GOLD = '#C9A227'
const GOLD_LT = '#E8CF7A'
const RED = '#CC1F1F'
const IVORY = '#F5F1E8'

// ── Fonts (fetched once per lambda, cached; graceful fallback to system) ──────
type Font = { name: string; data: ArrayBuffer; weight: 400 | 500 | 700 | 800; style: 'normal' }
let FONT_CACHE: Font[] | null = null

async function loadFonts(): Promise<Font[]> {
  if (FONT_CACHE) return FONT_CACHE
  const sources: { name: string; weight: 400 | 500 | 700 | 800; url: string }[] = [
    { name: 'Playfair Display', weight: 700, url: 'https://cdn.jsdelivr.net/npm/@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff' },
    { name: 'Playfair Display', weight: 800, url: 'https://cdn.jsdelivr.net/npm/@fontsource/playfair-display/files/playfair-display-latin-800-normal.woff' },
    { name: 'DM Sans', weight: 400, url: 'https://cdn.jsdelivr.net/npm/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff' },
    { name: 'DM Sans', weight: 500, url: 'https://cdn.jsdelivr.net/npm/@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff' },
    { name: 'DM Sans', weight: 700, url: 'https://cdn.jsdelivr.net/npm/@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff' },
  ]
  try {
    const fonts = await Promise.all(
      sources.map(async (s) => {
        const res = await fetch(s.url)
        if (!res.ok) throw new Error(`font ${s.name} ${s.weight}`)
        return { name: s.name, weight: s.weight, style: 'normal' as const, data: await res.arrayBuffer() }
      })
    )
    FONT_CACHE = fonts
    return fonts
  } catch {
    return [] // system-font fallback keeps images from ever breaking
  }
}

// ── Skins (variations on one luxury system) ──────────────────────────────────
interface Skin {
  bg: string
  headline: string
  body: string
  eyebrow: string
  accent: string // primary metallic
  ground: 'dark' | 'light'
  motif: 'frame' | 'medallion' | 'rule'
  redAccent: boolean
}

const SKINS: Skin[] = [
  // Onyx & gold, inset hairline frame (luxury card).
  { bg: 'linear-gradient(160deg, #12100C 0%, #0A0908 55%)', headline: IVORY, body: '#B9B2A4', eyebrow: GOLD_LT, accent: GOLD, ground: 'dark', motif: 'frame', redAccent: false },
  // Oxblood: red-forward luxury.
  { bg: 'linear-gradient(160deg, #1C0B0B 0%, #0A0706 60%)', headline: IVORY, body: '#C6B8B2', eyebrow: GOLD_LT, accent: GOLD, ground: 'dark', motif: 'rule', redAccent: true },
  // Spotlight medallion — concentric-ring emblem, centered.
  { bg: 'radial-gradient(120% 90% at 50% 22%, #1A150C 0%, #0A0908 62%)', headline: IVORY, body: '#CBC4B6', eyebrow: GOLD_LT, accent: GOLD_LT, ground: 'dark', motif: 'medallion', redAccent: false },
  // Ivory: light luxury, black serif.
  { bg: 'linear-gradient(160deg, #F7F3EA 0%, #EFE8DA 100%)', headline: '#141210', body: '#5A544A', eyebrow: '#9A7B12', accent: '#9A7B12', ground: 'light', motif: 'rule', redAccent: true },
  // Onyx, framed.
  { bg: 'linear-gradient(160deg, #100E0A 0%, #0A0908 60%)', headline: IVORY, body: '#B9B2A4', eyebrow: GOLD_LT, accent: GOLD, ground: 'dark', motif: 'frame', redAccent: false },
]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

const SANS = 'DM Sans, sans-serif'
const SERIF = 'Playfair Display, Georgia, serif'

// A drawn ⭕ brand ring lockup: "The Circle" + a RED ring (the brand mark is
// always red — the hint-of-red accent in the black/gold palette).
function BrandLockup({ color, size = 26, ring = 20 }: { color: string; size?: number; ring?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', fontFamily: SANS, fontWeight: 700, fontSize: `${size}px`, letterSpacing: '3px', color, textTransform: 'uppercase' }}>The Circle</div>
      <div style={{ display: 'flex', width: `${ring}px`, height: `${ring}px`, borderRadius: '9999px', border: `3px solid ${RED}`, marginLeft: '10px' }} />
    </div>
  )
}

// Concentric-ring emblem (mask-free, Satori-safe): gold outer ring, thin gold
// inner ring, red ⭕ at the centre. A luxury seal, echoing the celebration mark.
function Medallion({ size = 190 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', position: 'relative', width: `${size}px`, height: `${size}px`, alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', border: `2px solid ${GOLD}`, background: 'radial-gradient(closest-side, rgba(201,162,39,0.14), rgba(0,0,0,0))' }}>
      <div style={{ display: 'flex', width: `${size - 34}px`, height: `${size - 34}px`, borderRadius: '9999px', border: `1px solid rgba(201,162,39,0.5)`, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', width: '46px', height: '46px', borderRadius: '9999px', border: `5px solid ${RED}` }} />
      </div>
    </div>
  )
}

export async function renderSlideImage(opts: {
  seed: string
  i: number
  total: number
  headline: string
  body: string
  eyebrow?: string
  skinIndex?: number
}): Promise<ImageResponse> {
  const { seed, i, total, headline, body } = opts
  const fonts = await loadFonts()
  const skin = SKINS[(opts.skinIndex ?? hashStr(seed)) % SKINS.length]
  const role: 'cover' | 'point' | 'cta' = total > 1 && i === total - 1 ? 'cta' : i === 0 ? 'cover' : 'point'
  // Category kicker, not the brand name (the brand mark lives in the header/footer).
  const eyebrow = (opts.eyebrow ?? (role === 'cta' ? 'Join The Circle' : role === 'cover' ? 'Real Results' : 'Inside The Circle')).toUpperCase()
  const headlineSize = role === 'cover' ? 92 : role === 'cta' ? 84 : 70
  const dark = skin.ground === 'dark'
  const counterColor = dark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.4)'

  return new ImageResponse(
    (
      <div style={{ width: '1080px', height: '1080px', display: 'flex', background: skin.bg, position: 'relative', fontFamily: SANS }}>
        {/* soft glow — radial fade (Satori can't blur, so gradient to transparent) */}
        <div style={{ position: 'absolute', top: '-260px', right: '-180px', width: '640px', height: '640px', borderRadius: '9999px', background: 'radial-gradient(closest-side, rgba(201,162,39,0.20), rgba(201,162,39,0))', display: 'flex' }} />

        {/* inset luxury frame */}
        {skin.motif === 'frame' ? (
          <div style={{ position: 'absolute', top: '46px', left: '46px', right: '46px', bottom: '46px', border: `1px solid ${skin.accent}`, borderRadius: '6px', display: 'flex', opacity: 0.55 }} />
        ) : null}

        {/* content */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '92px', justifyContent: 'space-between', position: 'relative' }}>
          {/* header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <BrandLockup color={skin.accent} />
            <div style={{ display: 'flex', fontFamily: SANS, fontWeight: 500, fontSize: '24px', letterSpacing: '3px', color: counterColor }}>{total > 1 ? `${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : ''}</div>
          </div>

          {/* center */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: role === 'cta' || skin.motif === 'medallion' ? 'center' : 'flex-start', textAlign: role === 'cta' || skin.motif === 'medallion' ? 'center' : 'left', width: '100%' }}>
            {skin.motif === 'medallion' ? <div style={{ display: 'flex', marginBottom: '36px' }}><Medallion size={200} /></div> : null}

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '26px' }}>
              {skin.redAccent ? <div style={{ display: 'flex', width: '40px', height: '4px', background: RED, marginRight: '16px' }} /> : null}
              <div style={{ display: 'flex', fontFamily: SANS, fontWeight: 700, fontSize: '23px', letterSpacing: '5px', color: skin.eyebrow }}>{eyebrow}</div>
            </div>

            <div style={{ display: 'flex', fontFamily: SERIF, fontWeight: role === 'cover' ? 800 : 700, fontSize: `${headlineSize}px`, lineHeight: 1.04, letterSpacing: '-1px', color: skin.headline, maxWidth: '900px' }}>{headline}</div>

            <div style={{ display: 'flex', width: '96px', height: '3px', background: skin.accent, marginTop: '38px' }} />

            {body ? (
              <div style={{ display: 'flex', fontFamily: SANS, fontWeight: 400, fontSize: '38px', lineHeight: 1.45, color: skin.body, marginTop: '30px', maxWidth: '860px' }}>{body}</div>
            ) : null}
          </div>

          {/* footer — brand lockup left (red ⭕ mark), CTA right on the last slide */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontFamily: SANS, fontWeight: 700, fontSize: '25px', letterSpacing: '2px', color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}>The Circle</div>
              <div style={{ display: 'flex', width: '18px', height: '18px', borderRadius: '9999px', border: `3px solid ${RED}`, marginLeft: '9px' }} />
            </div>
            {i === total - 1 && total > 1 ? (
              <div style={{ display: 'flex', fontFamily: SANS, fontWeight: 700, fontSize: '26px', letterSpacing: '2px', color: skin.accent }}>COMMENT “CIRCLE”</div>
            ) : (
              <div style={{ display: 'flex', fontFamily: SANS, fontWeight: 500, fontSize: '24px', letterSpacing: '2px', color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }}>with Gogo Bethke</div>
            )}
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080, fonts: fonts.length ? fonts : undefined }
  )
}
