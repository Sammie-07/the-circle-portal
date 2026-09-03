// Shared confetti burst. Deterministic scatter (pure Math.sin hash) so render
// stays pure — no Math.random, no state, no effect. Computed once at module
// load; the spread still looks random. Animation keyframes `confetti-fall` live
// in globals.css. Falls the full viewport height over ~4–5s with per-piece
// drift + spin. Used by the survey completion overlay and the achievement gate.

const COLORS = ['#C9A227', '#E8CF7A', '#E0B94A', '#F5D77A', '#FFFFFF', '#F2F0EC', '#5bbd68']

const CONFETTI = Array.from({ length: 130 }, (_, i) => {
  const rnd = (seed: number) => {
    const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  const shape = rnd(7) // 0..1 → rect / streamer / circle
  const isCircle = shape > 0.72
  const isStreamer = !isCircle && shape > 0.42
  return {
    left: rnd(1) * 100,
    delay: rnd(2) * 1.3, // staggered entry so it keeps falling ~5s
    dur: 3.8 + rnd(3) * 1.6, // 3.8s – 5.4s fall
    w: isStreamer ? 4 + rnd(4) * 3 : 7 + rnd(4) * 7,
    h: isStreamer ? 14 + rnd(5) * 12 : isCircle ? 7 + rnd(5) * 7 : 8 + rnd(5) * 9,
    rot: rnd(6) * 360,
    drift: (rnd(8) - 0.5) * 220, // px sideways drift
    spin: 540 + rnd(9) * 900, // total rotation
    color: COLORS[Math.floor(rnd(10) * COLORS.length)],
    circle: isCircle,
  }
})

export default function Confetti() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {CONFETTI.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: p.circle ? '50%' : 2,
            // custom props consumed by the confetti-fall keyframe
            ['--drift' as string]: `${p.drift}px`,
            ['--spin' as string]: `${p.spin}deg`,
            transform: `rotate(${p.rot}deg)`,
            animation: `confetti-fall ${p.dur}s ${p.delay}s cubic-bezier(.25,.6,.5,1) forwards`,
          }}
        />
      ))}
    </div>
  )
}
