import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import RevisionForm from './RevisionForm'

export default async function BlueprintRevisionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: revision } = await supabase
    .from('blueprint_revisions')
    .select('id, member_id, status')
    .eq('token', token)
    .single()

  if (!revision) notFound()

  const { data: member } = await supabase
    .from('members')
    .select('name')
    .eq('id', revision.member_id)
    .single()

  if (!member) notFound()

  return (
    <RevisionForm
      token={token}
      memberName={member.name}
      alreadySubmitted={revision.status !== 'sent'}
    />
  )
}
