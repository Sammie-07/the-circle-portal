// Fetches a Fathom call transcript from a public share link (no login / API key).
// The share page embeds a `copy_transcript?token=<shareToken>` URL that returns
// the full transcript as speaker-attributed HTML. We fetch that and flatten it
// to "Speaker: text" lines for the model to read.

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'

export interface FathomTranscript {
  title: string
  speakers: string[]
  text: string
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

export async function fetchFathomTranscript(shareUrl: string): Promise<FathomTranscript> {
  const m = shareUrl.trim().match(/fathom\.video\/share\/([A-Za-z0-9_-]+)/)
  if (!m) throw new Error('That does not look like a Fathom share link (it should look like https://fathom.video/share/...).')

  const pageRes = await fetch(`https://fathom.video/share/${m[1]}`, { headers: { 'User-Agent': UA } })
  if (!pageRes.ok) throw new Error(`Could not open the Fathom link (HTTP ${pageRes.status}). Check that the link is correct and sharing is on.`)
  const page = await pageRes.text()

  // The transcript URL is embedded in the page config (HTML-entity encoded).
  const decoded = page.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  const urlMatch = decoded.match(/"copyTranscriptUrl":"([^"]+)"/)
  if (!urlMatch) {
    throw new Error('Could not find a transcript on that Fathom page. Make sure the recording is shared publicly and has a transcript.')
  }

  const tRes = await fetch(urlMatch[1], { headers: { 'User-Agent': UA, Referer: shareUrl } })
  if (!tRes.ok) throw new Error(`Could not load the transcript (HTTP ${tRes.status}). The link may be private.`)
  const data = (await tRes.json()) as { html?: string }
  const html = data.html ?? ''

  const title = decodeEntities((html.match(/<h1>([^<]*)<\/h1>/)?.[1] ?? 'Fathom call').trim())

  // Each utterance is: <b>Speaker</b></p><p ...>text</p>
  const speakers = new Set<string>()
  const lines: string[] = []
  const re = /<b>([^<]+)<\/b><\/p><p[^>]*>([\s\S]*?)<\/p>/g
  let u: RegExpExecArray | null
  while ((u = re.exec(html))) {
    const speaker = decodeEntities(u[1]).trim()
    const said = decodeEntities(u[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
    if (!speaker || !said) continue
    speakers.add(speaker)
    lines.push(`${speaker}: ${said}`)
  }

  const text = lines.join('\n')
  if (!text) throw new Error('The transcript came back empty. The call may not have finished processing on Fathom yet.')

  // Guard token/time budget on very long calls.
  const capped = text.length > 120_000 ? text.slice(0, 120_000) + '\n...[transcript truncated]' : text
  return { title, speakers: [...speakers], text: capped }
}
