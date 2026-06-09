import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateRules, type ApplicationAnswers } from '@/lib/financial-rules'

// Best-effort: injects financial-health tasks into a member's homework based on
// their GHL application answers. Idempotent via rule_key. Never throws — a rule
// failure must never break blueprint generation.

export async function applyFinancialRules(
  memberId: string,
  memberEmail: string
): Promise<{ added: number }> {
  try {
    if (!memberEmail) return { added: 0 }
    const admin = createAdminClient()
    const email = memberEmail.trim().toLowerCase()

    const { data: application } = await admin
      .from('applications')
      .select('data')
      .eq('email', email)
      .maybeSingle()

    if (!application) return { added: 0 }

    const tasks = evaluateRules(application.data as ApplicationAnswers)
    if (tasks.length === 0) return { added: 0 }

    // Idempotency: skip tasks whose rule_key already exists for this member.
    const { data: existing } = await admin
      .from('homework')
      .select('rule_key, sort_order')
      .eq('member_id', memberId)

    const existingKeys = new Set(
      (existing ?? [])
        .map((r) => r.rule_key)
        .filter((k): k is string => typeof k === 'string')
    )
    const maxSort = (existing ?? []).reduce(
      (max, r) => (typeof r.sort_order === 'number' && r.sort_order > max ? r.sort_order : max),
      0
    )

    const toInsert = tasks
      .filter((t) => !existingKeys.has(t.rule_key))
      .map((t, i) => ({
        member_id: memberId,
        title: t.title,
        description: t.description ?? null,
        type: 'task' as const,
        completed: false,
        auto_suggested: false,
        rule_key: t.rule_key,
        created_by: null,
        sort_order: maxSort + 1 + i,
      }))

    if (toInsert.length === 0) return { added: 0 }

    const { error } = await admin.from('homework').insert(toInsert)
    if (error) {
      console.error('[applyFinancialRules] insert error:', error.message)
      return { added: 0 }
    }

    return { added: toInsert.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[applyFinancialRules] error:', msg)
    return { added: 0 }
  }
}
