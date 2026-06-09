import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Injected when ?print=1 — a sticky bar with a Print button, hidden from printed output
const PRINT_BAR = `
<div id="print-bar" style="
  position:fixed;top:0;left:0;right:0;z-index:9999;
  background:#1a1200;border-bottom:1px solid rgba(201,162,39,0.5);
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 24px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
  box-shadow:0 2px 16px rgba(0,0,0,0.6);
">
  <div style="display:flex;align-items:center;gap:10px;">
    <span style="color:#C9A227;font-size:13px;">⬇</span>
    <span style="color:#ddd;font-size:13px;font-weight:500;">Save as PDF:</span>
    <span style="color:#888;font-size:12px;">Click Print, then choose <strong style="color:#bbb;">Save as PDF</strong> as your destination.</span>
  </div>
  <div style="display:flex;align-items:center;gap:10px;">
    <button onclick="window.print()" style="
      background:#C9A227;color:#0D0D0D;border:none;cursor:pointer;
      font-family:inherit;font-size:13px;font-weight:700;
      padding:7px 20px;border-radius:3px;letter-spacing:0.03em;
    ">Print / Save as PDF</button>
    <button onclick="document.getElementById('print-bar').remove()" style="
      background:transparent;border:1px solid #444;color:#888;cursor:pointer;
      font-family:inherit;font-size:12px;padding:6px 14px;border-radius:3px;
    ">✕</button>
  </div>
</div>
<style>
  @media print { #print-bar { display:none !important; } }
</style>
<style>body{padding-top:52px;}nav{top:52px !important;}@media print{body{padding-top:0;}nav{top:0 !important;}}</style>
`

// Download toolbar injected into the nav on every blueprint view
// Hidden from print output so it doesn't appear in the PDF
const downloadToolbar = (fileName: string) => `
<div id="dl-toolbar" style="
  display:flex;align-items:center;gap:8px;
  @media print{display:none}
">
  <button
    onclick="window.open(window.location.href+'?print=1','_blank')"
    title="Save as PDF"
    style="
      display:flex;align-items:center;gap:6px;
      background:transparent;border:1px solid rgba(201,162,39,0.35);
      color:#C9A227;cursor:pointer;
      font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
      font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;
      padding:6px 14px;border-radius:2px;
      transition:background 0.15s,border-color 0.15s;
    "
    onmouseover="this.style.background='rgba(201,162,39,0.1)';this.style.borderColor='rgba(201,162,39,0.6)'"
    onmouseout="this.style.background='transparent';this.style.borderColor='rgba(201,162,39,0.35)'"
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0">
      <path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="#C9A227" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    PDF
  </button>
  <button
    onclick="(function(){
      var a=document.createElement('a');
      var blob=new Blob([document.documentElement.outerHTML],{type:'text/html'});
      a.href=URL.createObjectURL(blob);
      a.download='${fileName}';
      a.click();
    })()"
    title="Download HTML file"
    style="
      display:flex;align-items:center;gap:6px;
      background:transparent;border:1px solid rgba(255,255,255,0.1);
      color:#888;cursor:pointer;
      font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
      font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;
      padding:6px 14px;border-radius:2px;
      transition:background 0.15s,border-color 0.15s,color 0.15s;
    "
    onmouseover="this.style.color='#ccc';this.style.borderColor='rgba(255,255,255,0.25)'"
    onmouseout="this.style.color='#888';this.style.borderColor='rgba(255,255,255,0.1)'"
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0">
      <path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    HTML
  </button>
</div>
<style>@media print{#dl-toolbar{display:none!important;}}</style>
`

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
      <style>body{background:#0D0D0D;color:#555;font-family:Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}</style>
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
