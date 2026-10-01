// When a member asks Ask Gogo for a PDF, the model starts its reply with this
// marker line. The chat strips it from view and turns the reply into a PDF
// automatically. Kept tiny and separate from chat-pdf.tsx so detecting it never
// loads the PDF engine.

const MARKER = /^\s*\[\[PDF\]\][ \t]*\n?/

export function hasPdfMarker(content: string): boolean {
  return MARKER.test(content)
}

export function stripPdfMarker(content: string): string {
  return content.replace(MARKER, '')
}

/** The document title: the reply's first "# " heading, else a fallback. */
export function pdfTitle(content: string, fallback = 'Your Notes from Gogo'): string {
  const m = stripPdfMarker(content).match(/^\s*#\s+(.+)/)
  return m ? m[1].replace(/[*_`]/g, '').trim() : fallback
}
