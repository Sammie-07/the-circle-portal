// Turns an Ask Gogo reply (markdown) into a clean, Circle-branded PDF in the
// browser. Loaded with a dynamic import only when a member clicks
// "Download PDF", so the PDF engine never weighs down the chat itself.

import { Document, Page, Text, View, Link, StyleSheet, pdf } from '@react-pdf/renderer'
import { marked, type Token, type Tokens } from 'marked'

const GOLD = '#A8861C'
const INK = '#1C1C1C'
const BODY = '#333333'
const MUTED = '#8A8A8A'
const LINE = '#E4DCC4'

const s = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 64, paddingHorizontal: 58, fontFamily: 'Helvetica', fontSize: 10.5, color: BODY, lineHeight: 1.55 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 2.4, color: GOLD },
  brandMeta: { fontSize: 8, color: MUTED },
  rule: { height: 1.2, backgroundColor: GOLD, marginBottom: 26 },
  title: { fontFamily: 'Times-Roman', fontSize: 26, color: INK, lineHeight: 1.2, marginBottom: 8 },
  asked: { fontSize: 9, color: MUTED, marginBottom: 22, fontFamily: 'Helvetica-Oblique' },
  h1: { fontFamily: 'Times-Roman', fontSize: 19, color: INK, marginTop: 14, marginBottom: 8, lineHeight: 1.25 },
  h2: { fontFamily: 'Times-Roman', fontSize: 15.5, color: INK, marginTop: 14, marginBottom: 6, lineHeight: 1.25 },
  h3: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, letterSpacing: 1.6, color: GOLD, marginTop: 12, marginBottom: 5 },
  p: { marginBottom: 8 },
  list: { marginBottom: 8 },
  li: { flexDirection: 'row', marginBottom: 4 },
  bullet: { width: 16, color: GOLD, fontFamily: 'Helvetica-Bold' },
  liBody: { flex: 1 },
  quote: { borderLeftWidth: 2, borderLeftColor: GOLD, paddingLeft: 10, marginVertical: 8, fontFamily: 'Helvetica-Oblique', color: '#555555' },
  hr: { height: 0.8, backgroundColor: LINE, marginVertical: 12 },
  code: { fontFamily: 'Courier', fontSize: 9.5, backgroundColor: '#F5F1E6', padding: 8, marginBottom: 8 },
  table: { borderWidth: 0.8, borderColor: LINE, marginBottom: 10 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: LINE },
  trLast: { flexDirection: 'row' },
  th: { flex: 1, padding: 6, fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: INK, backgroundColor: '#F7F2E3' },
  td: { flex: 1, padding: 6, fontSize: 9.5 },
  footer: { position: 'absolute', bottom: 30, left: 58, right: 58, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: MUTED, borderTopWidth: 0.6, borderTopColor: LINE, paddingTop: 8 },
})

// The built-in PDF fonts only cover basic Latin, so swap the few symbols the
// chat uses for plain equivalents and drop emoji (they would print as junk).
function toPdfText(t: string): string {
  return t
    .replace(/→/g, '->').replace(/←/g, '<-').replace(/[✓✔✅]/g, '+').replace(/[✗✘❌]/g, 'x')
    .replace(/[→-⇿☀-➿]/g, '')
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
}

// Older replies went through a dash filter that turned markdown rules into
// commas ("---" -> ",-", "|---|" -> "|,,,|") and left " , " where a dash was.
// Repair those so they lay out and read cleanly.
function repairLegacyMarkdown(md: string): string {
  return md
    .replace(/ , /g, ', ')
    .split('\n')
    .map((line) => {
      if (/^\s*[,-]{2,}\s*$/.test(line) && line.includes(',')) return '---'
      if (/^\s*\|?(\s*:?[,-]+:?\s*\|)+\s*(:?[,-]+:?)?\s*\|?\s*$/.test(line) && line.includes(',')) return line.replace(/,/g, '-')
      return line
    })
    .join('\n')
}

function Inline({ tokens }: { tokens?: Token[] }) {
  if (!tokens) return null
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.type) {
          case 'strong':
            return <Text key={i} style={{ fontWeight: 'bold', color: INK }}><Inline tokens={(t as Tokens.Strong).tokens} /></Text>
          case 'em':
            return <Text key={i} style={{ fontStyle: 'italic' }}><Inline tokens={(t as Tokens.Em).tokens} /></Text>
          case 'codespan':
            return <Text key={i} style={{ fontFamily: 'Courier' }}>{toPdfText(decode((t as Tokens.Codespan).text))}</Text>
          case 'link':
            return <Link key={i} src={(t as Tokens.Link).href} style={{ color: GOLD }}><Inline tokens={(t as Tokens.Link).tokens} /></Link>
          case 'br':
            return <Text key={i}>{'\n'}</Text>
          case 'del':
            return <Text key={i} style={{ textDecoration: 'line-through' }}><Inline tokens={(t as Tokens.Del).tokens} /></Text>
          case 'text': {
            const tt = t as Tokens.Text
            return tt.tokens ? <Inline key={i} tokens={tt.tokens} /> : <Text key={i}>{toPdfText(decode(tt.text))}</Text>
          }
          default:
            return <Text key={i}>{toPdfText(decode('text' in t ? String(t.text) : t.raw))}</Text>
        }
      })}
    </>
  )
}

// marked HTML-escapes inline text; undo that for the PDF.
function decode(t: string): string {
  return t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

function Blocks({ tokens }: { tokens: Token[] }) {
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.type) {
          case 'heading': {
            const h = t as Tokens.Heading
            const style = h.depth <= 1 ? s.h1 : h.depth === 2 ? s.h2 : s.h3
            return (
              <Text key={i} style={style} minPresenceAhead={40}>
                {h.depth >= 3 ? toPdfText(decode(h.text)).toUpperCase() : <Inline tokens={h.tokens} />}
              </Text>
            )
          }
          case 'paragraph':
            return <Text key={i} style={s.p}><Inline tokens={(t as Tokens.Paragraph).tokens} /></Text>
          case 'list': {
            const l = t as Tokens.List
            const start = typeof l.start === 'number' ? l.start : 1
            return (
              <View key={i} style={s.list}>
                {l.items.map((item, j) => (
                  <View key={j} style={s.li} wrap={false}>
                    <Text style={s.bullet}>{l.ordered ? `${start + j}.` : '•'}</Text>
                    <View style={s.liBody}><ListItemBody tokens={item.tokens} /></View>
                  </View>
                ))}
              </View>
            )
          }
          case 'blockquote':
            return <View key={i} style={s.quote}><Blocks tokens={(t as Tokens.Blockquote).tokens} /></View>
          case 'hr':
            return <View key={i} style={s.hr} />
          case 'code':
            return <Text key={i} style={s.code}>{toPdfText((t as Tokens.Code).text)}</Text>
          case 'table': {
            const tb = t as Tokens.Table
            return (
              <View key={i} style={s.table}>
                <View style={s.tr} wrap={false}>
                  {tb.header.map((c, j) => <Text key={j} style={s.th}><Inline tokens={c.tokens} /></Text>)}
                </View>
                {tb.rows.map((row, r) => (
                  <View key={r} style={r === tb.rows.length - 1 ? s.trLast : s.tr} wrap={false}>
                    {row.map((c, j) => <Text key={j} style={s.td}><Inline tokens={c.tokens} /></Text>)}
                  </View>
                ))}
              </View>
            )
          }
          case 'space':
            return null
          default:
            return 'text' in t ? <Text key={i} style={s.p}>{toPdfText(decode(String(t.text)))}</Text> : null
        }
      })}
    </>
  )
}

// List items hold "text" tokens (tight lists) or full blocks (loose lists).
function ListItemBody({ tokens }: { tokens: Token[] }) {
  return (
    <>
      {tokens.map((t, i) =>
        t.type === 'text'
          ? <Text key={i}><Inline tokens={(t as Tokens.Text).tokens ?? [t]} /></Text>
          : <Blocks key={i} tokens={[t]} />
      )}
    </>
  )
}

export interface ChatPdfInput {
  content: string
  title: string
  askedQuestion?: string | null
  date?: Date
}

export function ChatPdf({ content, title, askedQuestion, date = new Date() }: ChatPdfInput) {
  const tokens = marked.lexer(content, { gfm: true })
  const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return (
    <Document title={title} author="Gogo Bethke" creator="The Circle">
      <Page size="LETTER" style={s.page}>
        <View style={s.brandRow} fixed>
          <Text style={s.brand}>THE CIRCLE  ·  ASK GOGO</Text>
          <Text style={s.brandMeta}>{dateStr}</Text>
        </View>
        <View style={s.rule} fixed />
        <Text style={s.title}>{toPdfText(title)}</Text>
        {askedQuestion ? <Text style={s.asked}>You asked: {toPdfText(askedQuestion)}</Text> : <View style={{ marginBottom: 14 }} />}
        <Blocks tokens={tokens} />
        <View style={s.footer} fixed>
          <Text>The Circle  ·  Gogo Bethke</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

const PDF_REQUEST = /\b(pdf|printable|handout)\b|\b(in|into|as|on) a (doc|document|one[- ]pager)\b/i

/** True when a member's message is asking for a PDF / document version. */
export function isPdfRequest(text: string | null | undefined): boolean {
  return !!text && PDF_REQUEST.test(text)
}

/**
 * Pull a document title from the reply (its first "# " heading, which is then
 * removed from the body so it isn't printed twice), otherwise fall back.
 */
export function prepareChatPdf(raw: string, fallbackTitle: string): { title: string; body: string } {
  let body = repairLegacyMarkdown(raw).trim()
  // Drop the closing "tap Download PDF below" pointer; it means nothing on paper.
  body = body.replace(/(^|[.!?]\s+|\n)[^.!?\n]*\bdownload pdf\b[^\n]*$/i, '$1').trim()
  const m = body.match(/^\s*#\s+(.+)\n?/)
  if (m) return { title: m[1].replace(/[*_`]/g, '').trim(), body: body.slice(m[0].length).trim() }
  return { title: fallbackTitle, body }
}

function slug(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'gogo-notes'
}

/** Build the PDF and trigger a download in the browser. */
export async function downloadChatPdf(input: { content: string; fallbackTitle: string; askedQuestion?: string | null; date?: Date }) {
  const { title, body } = prepareChatPdf(input.content, input.fallbackTitle)
  const blob = await pdf(<ChatPdf content={body} title={title} askedQuestion={input.askedQuestion} date={input.date} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug(title)}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
