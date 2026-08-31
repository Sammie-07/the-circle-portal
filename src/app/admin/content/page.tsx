import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ContentQueue, { type ContentPost } from '@/components/admin/ContentQueue'

export const dynamic = 'force-dynamic'

const STAFF = ['owner', 'admin', 'manager', 'support', 'tech']

export default async function AdminContentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !STAFF.includes(profile.role)) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: posts } = await admin
    .from('content_posts')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 sm:p-8 max-w-7xl">
      <div className="mb-8">
        <p className="text-[#C9A227] text-xs tracking-[0.25em] uppercase mb-2">Admin</p>
        <h1 className="text-[var(--text)] font-serif text-3xl">Content</h1>
        <p className="text-[var(--text-3)] text-sm mt-1">
          On-brand Instagram &amp; Facebook posts generated from real member wins. Review, approve,
          download, and post. Aim for one every couple of days from the bank below.
        </p>
      </div>

      <ContentQueue initialPosts={(posts ?? []) as ContentPost[]} />
    </div>
  )
}
