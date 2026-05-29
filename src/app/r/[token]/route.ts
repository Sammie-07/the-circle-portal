import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
  body { padding-top: 52px; }
  @media print { body { padding-top: 0; } }
</style>
`

function downloadToolbar(fileName: string) {
  return `
<div id="dl-toolbar" style="display:flex;align-items:center;gap:8px;">
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
    "
    onmouseover="this.style.background='rgba(201,162,39,0.1)'"
    onmouseout="this.style.background='transparent'"
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0">
      <path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="#C9A227" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    PDF
  </button>
  <button
    onclick="(function(){var a=document.createElement('a');var blob=new Blob([document.documentElement.outerHTML],{type:'text/html'});a.href=URL.createObjectURL(blob);a.download='${fileName}';a.click();})()"
    title="Download HTML file"
    style="
      display:flex;align-items:center;gap:6px;
      background:transparent;border:1px solid rgba(255,255,255,0.1);
      color:#888;cursor:pointer;
      font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
      font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;
      padding:6px 14px;border-radius:2px;
    "
    onmouseover="this.style.color='#ccc'"
    onmouseout="this.style.color='#888'"
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0">
      <path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    HTML
  </button>
</div>
<style>@media print{#dl-toolbar{display:none!important;}}</style>
`
}

function wrapInShell(body: string, memberName: string, periodLabel: string, periodType: string, toolbar: string): string {
  const typeLabel = periodType === 'monthly' ? 'Monthly Report' : periodType === 'quarterly' ? 'Quarterly Report' : 'Annual Review'
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${periodLabel} · ${memberName} · The Circle</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #0D0D0D;
      color: #F5F5F5;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #0D0D0D;
      border-bottom: 1px solid #1E1E1E;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      height: 52px;
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .nav-logo {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 1.5px solid #CC1F1F;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .nav-logo-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #CC1F1F;
    }
    .nav-title {
      color: #F5F5F5;
      font-family: Georgia, serif;
      font-size: 14px;
      font-weight: normal;
    }
    .nav-subtitle {
      color: #444;
      font-size: 11px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
    .report-wrapper {
      max-width: 740px;
      margin: 0 auto;
      padding: 48px 24px 80px;
    }
    @media print {
      nav { position: relative; }
    }
  </style>
</head>
<body>
  <nav>
    <div class="nav-brand">
      <div class="nav-logo"><div class="nav-logo-dot"></div></div>
      <div>
        <div class="nav-title">The Circle</div>
        <div class="nav-subtitle">${typeLabel}</div>
      </div>
    </div>
    ${toolbar}
  </nav>
  <div class="report-wrapper">
    ${body}
  </div>
</body>
</html>`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createClient()

  const { data: report } = await supabase
    .from('reports')
    .select('*, members(name, email)')
    .eq('share_token', token)
    .single()

  if (!report || !report.content_html) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Not Found</title>
      <style>body{background:#0D0D0D;color:#555;font-family:Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}</style>
      </head><body><p>Report not found.</p></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const member = report.members as { name: string; email: string }
  const url = new URL(request.url)
  const printMode = url.searchParams.get('print') === '1'

  const safeName = member.name.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')
  const fileName = `${safeName}-${report.period_label.replace(/\s+/g, '-')}-Report.html`

  let html = wrapInShell(
    report.content_html,
    member.name,
    report.period_label,
    report.period_type,
    downloadToolbar(fileName)
  )

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
