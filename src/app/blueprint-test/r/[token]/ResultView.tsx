'use client'

import { useEffect, useState } from 'react'
import { FREEDOM_LABEL, type FreedomKey } from '@/lib/blueprint-test/questions'
import type { TestResult } from '@/lib/blueprint-test/results'
import type { Destination, Scores } from '@/lib/blueprint-test/score'

type Status = 'pending' | 'ready' | 'error'

const FREEDOMS: FreedomKey[] = ['time', 'location', 'financial', 'ceo']

function band(n: number): string {
  if (n >= 75) return 'Strong'
  if (n >= 50) return 'Building'
  if (n >= 25) return 'Stuck'
  return 'Critical'
}

interface Props {
  token: string
  firstName: string
  scores: Scores
  bottleneck: FreedomKey
  primary: Destination
  secondary: Destination | null
  initialStatus: Status
  initialResult: TestResult | null
}

export default function ResultView({ token, firstName, scores, bottleneck, primary, secondary, initialStatus, initialResult }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus)
  const [result, setResult] = useState<TestResult | null>(initialResult)

  // Poll while Gogo's write-up is being generated (usually under a minute).
  useEffect(() => {
    if (status !== 'pending') return
    let stopped = false
    const started = Date.now()
    const tick = async () => {
      if (stopped) return
      try {
        const r = await fetch(`/api/blueprint-test/${token}`, { cache: 'no-store' })
        const d = await r.json()
        if (d.status === 'ready' && d.result) { setResult(d.result); setStatus('ready'); return }
        if (d.status === 'error') { setStatus('error'); return }
      } catch {}
      if (Date.now() - started > 4 * 60_000) { setStatus('error'); return }
      setTimeout(tick, 3000)
    }
    const t = setTimeout(tick, 2500)
    return () => { stopped = true; clearTimeout(t) }
  }, [status, token])

  async function retry() {
    setStatus('pending')
    await fetch(`/api/blueprint-test/${token}`, { method: 'POST' }).catch(() => {})
  }

  return (
    <div className="min-h-screen bg-[#090909] text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-7 h-7 rounded-full border border-[#CC1F1F] flex items-center justify-center flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-[#CC1F1F]" />
          </div>
          <span className="font-serif text-base">Gogo Bethke</span>
        </div>

        <p className="text-[#C9A227] text-[10px] tracking-[0.28em] uppercase mb-3">Your Blueprint Results</p>
        <h1 className="font-serif text-[34px] sm:text-[42px] leading-[1.1] mb-6">
          {result?.headline ?? `${firstName}, here is where you stand.`}
        </h1>

        {/* Scores are instant (rules, not AI), so they show while the write-up loads. */}
        <div className="rounded-2xl border border-[#222] bg-[#0f0f0f] p-5 sm:p-6 mb-8">
          <div className="flex items-baseline justify-between mb-5">
            <span className="text-sm text-[#888]">Overall freedom score</span>
            <span className="font-serif text-[40px] leading-none text-[#C9A227]">{scores.overall}<span className="text-[18px] text-[#666]">/100</span></span>
          </div>
          <div className="space-y-4">
            {FREEDOMS.map((k) => (
              <div key={k}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className={k === bottleneck ? 'text-white font-semibold' : 'text-[#ccc]'}>
                    {FREEDOM_LABEL[k]}{k === bottleneck && <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-[#ff8a5c]">Your bottleneck</span>}
                  </span>
                  <span className="text-[#888]">{band(scores[k])} · {scores[k]}</span>
                </div>
                <div className="h-2 rounded-full bg-[#1c1c1c] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(scores[k], 3)}%`, background: k === bottleneck ? '#ff8a5c' : '#C9A227' }} />
                </div>
                {result?.freedoms?.[k] && <p className="text-[13px] text-[#999] leading-relaxed mt-2">{result.freedoms[k]}</p>}
              </div>
            ))}
          </div>
        </div>

        {status === 'pending' && (
          <div className="rounded-2xl border border-[#222] p-6 text-center mb-8">
            <div className="w-6 h-6 mx-auto mb-3 rounded-full border-2 border-[#C9A227] border-t-transparent animate-spin" />
            <p className="text-[#ccc]">Reading your answers and writing your results…</p>
            <p className="text-[#666] text-sm mt-1">This takes about a minute. Stay on this page.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-2xl border border-[#442222] p-6 text-center mb-8">
            <p className="text-[#ccc] mb-3">Your scores are ready, but the written part did not come through.</p>
            <button onClick={retry} className="bg-[#C9A227] text-[#090909] font-semibold px-6 py-2.5 rounded-lg">Try again</button>
          </div>
        )}

        {status === 'ready' && result && (
          <div className="space-y-10 mb-10">
            <section className="space-y-4">
              {result.opening.split(/\n\n+/).map((p, i) => <p key={i} className="text-[#ddd] leading-relaxed">{p}</p>)}
            </section>

            <section className="rounded-2xl border border-[#ff8a5c]/30 bg-[#ff8a5c]/[0.04] p-5 sm:p-6">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#ff8a5c] mb-2">What is really holding you back</p>
              <h2 className="font-serif text-[24px] mb-3">{FREEDOM_LABEL[bottleneck]}</h2>
              <p className="text-[#ddd] leading-relaxed">{result.bottleneck}</p>
            </section>

            <section>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#C9A227] mb-4">Your first three moves</p>
              <ol className="space-y-4">
                {result.first_moves.map((m, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="font-serif text-[22px] text-[#C9A227] leading-none mt-0.5 w-5 flex-none">{i + 1}</span>
                    <p className="text-[#ddd] leading-relaxed">{m}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="border-t border-[#222] pt-8">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#888] mb-3">The other half</p>
              <p className="text-[#bbb] leading-relaxed">{result.the_other_half}</p>
            </section>
          </div>
        )}

        <div className="rounded-2xl border border-[#C9A227]/40 bg-[#C9A227]/[0.06] p-6 sm:p-7">
          {status === 'ready' && result?.closing && <p className="text-white leading-relaxed mb-4">{result.closing}</p>}
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#C9A227] mb-2">Where I would start you</p>
          <h3 className="font-serif text-[26px] mb-2">{primary.label}</h3>
          <p className="text-[#aaa] text-sm leading-relaxed mb-5">{primary.blurb}</p>
          <a href={primary.url} target="_blank" rel="noopener noreferrer"
            className="block sm:inline-block text-center bg-[#C9A227] text-[#090909] font-semibold px-7 py-3.5 rounded-lg hover:bg-[#d4ac2d] transition-colors">
            {primary.cta} →
          </a>
        </div>

        {secondary && (
          <div className="rounded-2xl border border-[#222] p-5 mt-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#888] mb-1">Also a fit for you</p>
            <p className="text-white font-semibold">{secondary.label}</p>
            <p className="text-[#999] text-sm leading-relaxed mt-1 mb-3">{secondary.blurb}</p>
            <a href={secondary.url} target="_blank" rel="noopener noreferrer" className="text-[#C9A227] text-sm hover:underline">{secondary.cta} →</a>
          </div>
        )}

        <p className="text-[11px] text-[#555] mt-10 leading-relaxed">
          Your scores come from your answers. The written results are AI-assisted, drawn from Gogo Bethke&apos;s teachings. They are guidance, not a promise of results.
        </p>
      </div>
    </div>
  )
}
