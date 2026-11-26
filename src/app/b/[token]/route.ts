import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { PRINT_BAR, downloadToolbar } from '@/lib/share-toolbar'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  // The share token IS the access credential — look it up with the service-role
  // client so anonymous (non-logged-in) visitors can open the link. RLS on
  // `members` has no public-read policy, so the cookie client would 404 here.
  const supabase = createAdminClient()

  const { data: member } = await supabase
    .from('members')
    .select('name, blueprint_html, blueprint_generated_at')
    .eq('blueprint_share_token', token)
    .single()

  if (!member || !member.blueprint_html) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Not Found</title>
      <style>body{background:#090909;color:#555;font-family:Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}</style>
      </head><body><p>Blueprint not found or not yet generated.</p></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const url = new URL(request.url)
  const printMode = url.searchParams.get('print') === '1'

  // Safe filename from member name
  const safeName = member.name.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')
  const fileName = `${safeName}-Blueprint.html`

  let html = member.blueprint_html

  // Always inject the download toolbar into the nav (right before </nav>)
  // This puts PDF + HTML buttons in the top-right of the sticky nav
  html = html.replace('</nav>', `${downloadToolbar(fileName)}</nav>`)

  // In print mode, also show the print instruction bar at the very top
  if (printMode) {
    html = html.replace('</body>', `${PRINT_BAR}</body>`)
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
