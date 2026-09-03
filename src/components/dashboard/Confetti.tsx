// Shared confetti burst. Deterministic scatter (pure Math.sin hash) so render
// stays pure — no Math.random, no state, no effect. Computed once at module
// load; the spread still looks random. Animation keyframes `confetti-fall` live
// in globals.css. Used by the survey completion overlay and the achievement gate.

const CONFETTI = Array.from({ length: 80 }, (_, i) => {
  const rnd = (seed: number) => {
    const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  return {
    left: rnd(1) * 100,
    delay: rnd(2) * 0.6,
    dur: 1.9 + rnd(3) * 1.6,
    w: 6 + rnd(4) * 7,
    h: 8 + rnd(5) * 8,
    rot: rnd(6) * 360,
    color: ['#C9A227', '#E0B94A', '#F5F5F5', '#5bbd68', '#ffffff'][i % 5],
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
            top: -24,
            left: `${p.left}%`,
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: 2,
            transform: `rotate(${p.rot}deg)`,
            animation: `confetti-fall ${p.dur}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  )
}
