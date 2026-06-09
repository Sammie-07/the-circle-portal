import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ApplicationAnswers } from '@/lib/financial-rules'

export const runtime = 'nodejs'

// Machine-to-machine webhook from GoHighLevel. Secured by a shared secret only
// (no Supabase auth). Always returns 200 on success so GHL does not retry.

type Body = Record<string, unknown>

function pick(body: Body, keys: string[]): unknown {
  for (const k of keys) {
    if (body[k] !== undefined && body[k] !== null) return body[k]
  }
  return undefined
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const digits = v.replace(/[^\d.]/g, '')
    if (!digits) return null
    const n = Number(digits)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function coerceBoolean(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (['yes', 'y', 'true', '1'].includes(s)) return true
    if (['no', 'n', 'false', '0'].includes(s)) return false
  }
  return null
}

// A free-text answer "counts" as a real investment unless it's blank or a
// none-ish token (none / n/a / no / 0 / -).
function isMeaningfulText(v: unknown): boolean {
  const t = (v ?? '').toString().trim().toLowerCase()
  if (!t) return false
  return !['none', 'n/a', 'na', 'no', 'nope', 'nothing', '0', '-', '.', 'null', 'n.a.'].includes(t)
}

// has_investments is derived from the free-text portfolio fields. Returns the
// derived boolean (null if no investment fields were sent at all) plus the
// combined text for storage.
function deriveInvestments(body: Body): { has: boolean | null; text: string | null } {
  // explicit boolean wins (backward compat)
  const explicit = coerceBoolean(pick(body, ['has_investments', 'Has Investments']))
  const keys = [
    'investments_1', 'investments_2', 'investments', 'investment_portfolio',
    'Investments', 'Investment Portfolio', 'Investments 1', 'Investments 2',
  ]
  const texts: string[] = []
  let anyKeyPresent = false
  for (const k of keys) {
    if (body[k] !== undefined && body[k] !== null) {
      anyKeyPresent = true
      const s = body[k]?.toString().trim()
      if (s) texts.push(s)
    }
  }
  const text = texts.join(' | ') || null
  if (explicit !== null) return { has: explicit, text }
  if (!anyKeyPresent) return { has: null, text }
  return { has: texts.some(isMeaningfulText), text }
}

function extractEmail(body: Body): string | null {
  const contact = body.contact as Body | undefined
  const raw =
    pick(body, ['email', 'contact_email', 'Email']) ??
    (contact && typeof contact === 'object' ? contact.email : undefined)
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  return email || null
}

export async function POST(request: Request) {
  try {
    // ── Security: shared secret via header or query param ──
    const expected = process.env.GHL_WEBHOOK_SECRET
    if (!expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = new URL(request.url)
    const provided = request.headers.get('x-webhook-secret') ?? url.searchParams.get('key')
    if (provided !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse body leniently ──
    let body: Body = {}
    try {
      const parsed = await request.json()
      if (parsed && typeof parsed === 'object') body = parsed as Body
    } catch {
      body = {}
    }

    const email = extractEmail(body)
    if (!email) {
      return NextResponse.json({ error: 'email required' }, { status: 400 })
    }

    // ── Normalize known answers, tolerant of GHL field/type variance ──
    const investments = deriveInvestments(body)
    const data: ApplicationAnswers = {
      credit_score: coerceNumber(
        pick(body, ['credit_score', 'Credit Score', 'creditScore'])
      ),
      owes_back_taxes: coerceBoolean(
        pick(body, ['owes_back_taxes', 'Owes Back Taxes', 'back_taxes'])
      ),
      has_investments: investments.has,
      investments_text: investments.text,
    }

    const admin = createAdminClient()

    await admin
      .from('applications')
      .upsert(
        {
          email,
          data,
          raw: body,
          received_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      )

    const { data: member } = await admin
      .from('members')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    return NextResponse.json({ ok: true, email, matched: !!member })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GHL Application] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
