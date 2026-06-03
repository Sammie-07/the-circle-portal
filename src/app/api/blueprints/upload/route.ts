import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { wrapPdfBlueprint } from '@/lib/blueprint-shell'
import { NextResponse } from 'next/server'

export const maxDuration = 60
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const memberId = form.get('member_id')
    const file = form.get('file')

    if (!memberId || typeof memberId !== 'string') {
      return NextResponse.json({ error: 'member_id required' }, { status: 400 })
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }

    const db = createAdminClient()

    const { data: member } = await db.from('members').select('*').eq('id', memberId).single()
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const fileName = file.name.toLowerCase()
    const mime = file.type
    const isHtml = mime === 'text/html' || fileName.endsWith('.html') || fileName.endsWith('.htm')
    const isPdf = mime === 'application/pdf' || fileName.endsWith('.pdf')

    if (!isHtml && !isPdf) {
      return NextResponse.json({ error: 'File must be an .html or .pdf document' }, { status: 400 })
    }

    const shareToken = member.blueprint_share_token ?? crypto.randomUUID()

    // Base update shared by both file types
    const updates: Record<string, unknown> = {
      blueprint_generated_at: new Date().toISOString(),
      blueprint_share_token: shareToken,
      blueprint_sent_to_gogo_at: null,
      blueprint_sent_to_member_at: null,
    }

    if (isHtml) {
      const htmlContent = await file.text()
      if (!htmlContent.trim()) {
        return NextResponse.json({ error: 'Uploaded HTML file is empty' }, { status: 400 })
      }
      updates.blueprint_html = htmlContent
      // Leave blueprint_transcript unchanged for HTML uploads
    } else {
      // PDF — upload bytes to storage, extract text, build embed + hidden-text HTML
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)

      const path = `${memberId}/${crypto.randomUUID()}.pdf`
      const { error: uploadError } = await db.storage
        .from('blueprints')
        .upload(path, bytes, { contentType: 'application/pdf', upsert: true })

      if (uploadError) {
        return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 })
      }

      const { data: pub } = db.storage.from('blueprints').getPublicUrl(path)
      const publicUrl = pub.publicUrl

      // Extract text from the PDF for homework (serverless-friendly, no native deps)
      let extractedText = ''
      try {
        const { extractText, getDocumentProxy } = await import('unpdf')
        const pdf = await getDocumentProxy(bytes)
        const { text } = await extractText(pdf, { mergePages: true })
        extractedText = Array.isArray(text) ? text.join('\n') : text
      } catch (err) {
        console.warn('[BlueprintUpload] PDF text extraction failed:', err instanceof Error ? err.message : String(err))
      }

      updates.blueprint_html = wrapPdfBlueprint({ memberName: member.name, pdfUrl: publicUrl, extractedText })
      updates.blueprint_transcript = extractedText
    }

    const { error: dbError } = await db.from('members').update(updates).eq('id', memberId)
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    return NextResponse.json({ ok: true, share_token: shareToken })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[BlueprintUpload] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
