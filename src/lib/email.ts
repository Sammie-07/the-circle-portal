// Shared SendGrid sender + branded email shell (matches the Friday reminder
// design: dark background, red Circle mark, gold eyebrow, serif heading, gold
// CTA button, divider footer).

export async function sendEmail(to: string, subject: string, html: string) {
  return fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: process.env.SENDGRID_FROM_EMAIL! },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  })
}

interface BrandedEmailOpts {
  eyebrow: string
  heading: string
  /** Body paragraphs (plain strings; basic inline HTML like <strong> is allowed). */
  body: string[]
  /** Optional raw HTML block rendered after the paragraphs (e.g. a list/table). */
  bodyHtml?: string
  cta?: { text: string; url: string }
  /** Small print under the button (e.g. link-expiry note). */
  note?: string
  footer?: string
}

export function brandedEmail({ eyebrow, heading, body, bodyHtml, cta, note, footer = 'The Circle · 12-Month Coaching Program' }: BrandedEmailOpts): string {
  const paragraphs = body
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#AAAAAA;">${p}</p>`)
    .join('')
  const htmlBlock = bodyHtml ? `<tr><td style="padding-bottom:8px;">${bodyHtml}</td></tr>` : ''

  const ctaBlock = cta
    ? `<tr><td style="padding:8px 0 40px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#C9A227;border-radius:6px;">
                <a href="${cta.url}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#0D0D0D;text-decoration:none;">
                  ${cta.text}
                </a>
              </td>
            </tr>
          </table>
          ${note ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#666666;">${note}</p>` : ''}
        </td></tr>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D0D0D;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:28px;height:28px;border:1.5px solid #CC1F1F;border-radius:50%;text-align:center;vertical-align:middle;">
                <div style="width:8px;height:8px;background:#CC1F1F;border-radius:50%;margin:auto;margin-top:9px;"></div>
              </td>
              <td style="padding-left:10px;font-family:Georgia,serif;font-size:15px;color:#FFFFFF;">The Circle</td>
            </tr>
          </table>
        </td></tr>

        <!-- Eyebrow -->
        <tr><td style="padding-bottom:8px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#C9A227;">${eyebrow}</p>
        </td></tr>

        <!-- Heading -->
        <tr><td style="padding-bottom:24px;">
          <h1 style="margin:0;font-family:Georgia,serif;font-size:28px;color:#FFFFFF;font-weight:normal;">${heading}</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding-bottom:8px;">${paragraphs}</td></tr>

        <!-- Optional HTML block (lists/tables) -->
        ${htmlBlock}

        <!-- CTA -->
        ${ctaBlock}

        <!-- Divider -->
        <tr><td style="border-top:1px solid #2A2A2A;padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#444444;">${footer}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
