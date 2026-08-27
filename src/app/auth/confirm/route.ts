import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Verify a magic link minted via the admin API (token-hash flow).
//
// IMPORTANT: we do NOT verify on the initial GET. Email security scanners
// (Outlook/Hotmail "SafeLinks", antivirus, some corporate proxies) pre-fetch
// links in emails to vet them — and because our magic tokens are one-time, that
// pre-fetch would CONSUME the token before the human ever clicks, locking them
// out. So GET renders a "Continue to sign in" interstitial and the token is only
// verified on the POST that a real person triggers by clicking the button.
// Scanners issue GET/HEAD and don't submit forms, so the token survives.

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function interstitialHtml(tokenHash: string, type: string, ctx: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Sign in · The Circle</title>
<style>
  html,body{margin:0;height:100%;background:#0D0D0D;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;}
  .wrap{min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;}
  .card{width:100%;max-width:400px;text-align:center;}
  .mark{width:56px;height:56px;border:2px solid #CC1F1F;border-radius:9999px;margin:0 auto 24px;position:relative;}
  .dot{width:7px;height:7px;border-radius:9999px;background:#CC1F1F;position:absolute;}
  .t{top:6px;left:50%;transform:translateX(-50%);} .b{bottom:6px;left:50%;transform:translateX(-50%);}
  .l{left:6px;top:50%;transform:translateY(-50%);} .r{right:6px;top:50%;transform:translateY(-50%);}
  .eyebrow{color:#C9A227;font-size:11px;letter-spacing:.3em;text-transform:uppercase;margin:0 0 8px;}
  h1{color:#fff;font-family:Georgia,serif;font-size:22px;font-weight:normal;margin:0 0 12px;}
  p{color:#AAA;font-size:14px;line-height:1.6;margin:0 0 24px;}
  button{width:100%;background:#C9A227;color:#0D0D0D;font-size:15px;font-weight:600;border:0;border-radius:6px;padding:14px 24px;cursor:pointer;}
  button:hover{background:#d4ac2d;}
  .fine{color:#666;font-size:12px;margin-top:20px;}
</style>
</head>
<body>
  <div class="wrap"><div class="card">
    <div class="mark"><span class="dot t"></span><span class="dot b"></span><span class="dot l"></span><span class="dot r"></span></div>
    <p class="eyebrow">The Circle · Coaching Program</p>
    <h1>Finish signing in</h1>
    <p>You're one step away from your member portal. Click below to continue.</p>
    <form method="POST" action="/auth/confirm">
      <input type="hidden" name="token_hash" value="${esc(tokenHash)}" />
      <input type="hidden" name="type" value="${esc(type)}" />
      <input type="hidden" name="ctx" value="${esc(ctx)}" />
      <button type="submit">Continue to sign in →</button>
    </form>
    <p class="fine">For your security, this link only signs you in when you click above.</p>
  </div></div>
</body>
</html>`
}

// GET — render the click-to-continue interstitial (does NOT consume the token).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = (searchParams.get('type') as EmailOtpType | null) ?? 'magiclink'
  const ctx = normalizeCtx(searchParams.get('ctx'))

  if (!token_hash) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  return new Response(interstitialHtml(token_hash, type, ctx), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// Only allow the known set-password contexts; default to activate for invite links.
function normalizeCtx(v: string | null): 'activate' | 'transition' | 'reset' {
  return v === 'transition' || v === 'reset' ? v : 'activate'
}

// POST — the human clicked "Continue": now verify the token and establish the session.
export async function POST(request: Request) {
  const { origin } = new URL(request.url)

  let token_hash = ''
  let type: EmailOtpType = 'magiclink'
  let ctx: 'activate' | 'transition' | 'reset' = 'activate'
  try {
    const form = await request.formData()
    token_hash = String(form.get('token_hash') ?? '')
    type = (String(form.get('type') ?? 'magiclink') as EmailOtpType)
    ctx = normalizeCtx(String(form.get('ctx') ?? ''))
  } catch {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  if (token_hash) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (!profile) {
          await supabase.from('profiles').insert({
            id: user.id,
            role: 'member',
            full_name: user.email,
          })
        }

        // Verified via the email link → straight to choosing a password (no code).
        // 303 so the browser follows with a GET after the POST.
        return NextResponse.redirect(`${origin}/set-password?ctx=${ctx}`, { status: 303 })
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`, { status: 303 })
}
