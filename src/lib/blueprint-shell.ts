// Shared helper for wrapping an uploaded PDF blueprint in the same branded
// "The Circle" shell used by generated blueprints. The structure deliberately
// mirrors the generated shell (dark bg, gold/red accents, sticky <nav> with
// .nav-brand + .nav-links) so that src/app/b/[token]/route.ts can inject its
// download toolbar via its existing `html.replace('</nav>', ...)` call.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function wrapPdfBlueprint({
  memberName,
  pdfUrl,
  extractedText,
}: {
  memberName: string
  pdfUrl: string
  extractedText: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(memberName)} · Blueprint · The Circle</title>
<style>
  :root{--gold:#C9A227;--red:#CC1F1F;--bg:#0D0D0D;--border:rgba(201,162,39,0.18);--muted:#777;}
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{background:var(--bg);height:100%;color:#EFEFEF;font-family:'Georgia','Times New Roman',serif;}
  nav{position:sticky;top:0;z-index:200;background:rgba(13,13,13,0.98);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 56px;height:54px;}
  .nav-brand{display:flex;align-items:center;gap:10px;color:var(--gold);font-family:'Helvetica Neue',sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:600;}
  .nav-circle{width:18px;height:18px;border-radius:50%;border:2px solid var(--red);display:inline-block;flex-shrink:0;}
  .nav-links{display:flex;gap:32px;}
  .nav-links a{color:var(--muted);text-decoration:none;font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;}
  .pdf-wrap{max-width:1100px;margin:0 auto;}
  iframe{display:block;}
  @media (max-width:640px){nav{padding:0 20px;}.nav-links{display:none;}}
</style>
</head>
<body>
<nav>
  <div class="nav-brand"><span class="nav-circle"></span> The Circle</div>
  <div class="nav-links"><a>12-Month Blueprint</a></div>
</nav>
<div class="pdf-wrap">
  <iframe src="${pdfUrl}#toolbar=0&navpanes=0&view=FitH" style="width:100%;height:calc(100vh - 54px);border:0;background:#0a0a0a"></iframe>
</div>
<div style="display:none" aria-hidden="true">${escapeHtml(extractedText)}</div>
</body>
</html>`
}
