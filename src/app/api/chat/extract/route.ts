import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MAX_CHARS = 20000

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const name = file.name || 'attachment'
  const lower = name.toLowerCase()
  const mime = file.type || ''

  const isPdf = mime === 'application/pdf' || lower.endsWith('.pdf')
  const isText =
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/csv' ||
    lower.endsWith('.txt') ||
    lower.endsWith('.md') ||
    lower.endsWith('.csv')

  let text = ''

  try {
    if (isPdf) {
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      const { extractText, getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(bytes)
      const { text: extracted } = await extractText(pdf, { mergePages: true })
      text = Array.isArray(extracted) ? extracted.join('\n') : extracted
    } else if (isText) {
      text = await file.text()
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload a PDF or text file.' },
        { status: 400 }
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ChatExtract] Extraction failed:', msg)
    return NextResponse.json(
      { error: 'Could not read that file. Try a different PDF or text file.' },
      { status: 400 }
    )
  }

  text = text.trim()
  if (!text) {
    return NextResponse.json(
      { error: 'No readable text found in that file.' },
      { status: 400 }
    )
  }

  let truncated = false
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS)
    truncated = true
  }

  return NextResponse.json({
    name,
    chars: text.length,
    text: truncated ? `${text}\n\n[... file truncated ...]` : text,
  })
}
