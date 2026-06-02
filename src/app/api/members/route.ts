import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST — create a member record without sending any invite email
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { name, email, cohort } = await request.json()
  if (!name || !email) return NextResponse.json({ error: 'name and email required' }, { status: 400 })

  const { data: existing } = await supabase.from('members').select('id').eq('email', email).single()
  if (existing) return NextResponse.json({ error: 'A member with this email already exists' }, { status: 409 })

  const { data: member, error } = await supabase
    .from('members')
    .insert({ name, email, cohort: cohort || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ member })
}
