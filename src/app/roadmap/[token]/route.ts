import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { PRINT_BAR, downloadToolbar } from '@/lib/share-toolbar'

// Public, token-gated: the person's 12-Month CEO Roadmap (same toolbar and
// print mode as Circle blueprints at /b/[token]).
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { data: row } = /^[0-9a-f-]{36}$/i.test(token)
    ? await createAdminClient()
        .from('problem_statements')
        .select('name, roadmap_html')
        .eq('roadmap_token', token)
        .maybeSingle()
    : { data: null }

  if (!row?.roadmap_html) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Not Found</title>
      <style>body{background:#090909;color:#555;font-family:Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}</style>
      </head><body><p>Roadmap not found.</p></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const safeName = String(row.name ?? 'Your').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')
  let html = (row.roadmap_html as string).replace('</nav>', `${downloadToolbar(`${safeName}-12-Month-CEO-Roadmap.html`)}</nav>`)
  if (new URL(request.url).searchParams.get('print') === '1') html = html.replace('</body>', `${PRINT_BAR}</body>`)

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })
}
