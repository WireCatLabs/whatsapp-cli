import type { TextSpan } from "@wirecat/cli-core"

const MARKS: Partial<Record<TextSpan["type"], string>> = {
  bold: "*",
  heading: "*",
  italic: "_",
  strike: "~",
  code: "`",
  pre: "```",
}

// WhatsApp draws these on one line only.
const LINE_ONLY = new Set<TextSpan["type"]>(["bold", "heading", "italic", "strike", "code"])

/** WhatsApp ignores a mark with a space just inside it, so the space moves outside. */
const trimmed = (text: string, span: TextSpan, from: number, to: number): TextSpan | undefined => {
  // A code block's indentation is part of the code.
  while (from < to && span.type !== "pre" && /\s/u.test(text[from] ?? "")) from++
  while (to > from && /\s/u.test(text[to - 1] ?? "")) to--
  return to > from ? { ...span, from, length: to - from } : undefined
}

const perLine = (text: string, span: TextSpan): TextSpan[] => {
  const end = span.from + span.length
  if (!LINE_ONLY.has(span.type)) {
    const whole = trimmed(text, span, span.from, end)
    return whole ? [whole] : []
  }
  const pieces: TextSpan[] = []
  for (let start = span.from; start < end; ) {
    const newline = text.indexOf("\n", start)
    const stop = newline === -1 || newline >= end ? end : newline
    const piece = trimmed(text, span, start, stop)
    if (piece) pieces.push(piece)
    start = stop + 1
  }
  return pieces
}

const contains = (outer: TextSpan, inner: TextSpan) =>
  outer.from <= inner.from && inner.from + inner.length <= outer.from + outer.length

const apart = (a: TextSpan, b: TextSpan) => a.from + a.length <= b.from || b.from + b.length <= a.from

const linkTail = (text: string, span: TextSpan): string => {
  const label = text.slice(span.from, span.from + span.length)
  return span.url === undefined || span.url === label || span.url === `mailto:${label}` ? "" : ` (${span.url})`
}

/**
 * Text and its spans in WhatsApp's marks: `*bold*`, `_italic_`, `~strike~`, `` `code` ``, ```` ``` ```` blocks and
 * `> ` quotes. A link is its label and then its address, which WhatsApp makes clickable. Underline, spoiler and
 * highlight have no mark there and stay plain text, and a span that crosses another without nesting is dropped.
 */
export const toWhatsApp = (text: string, spans: readonly TextSpan[]): string => {
  const kept: TextSpan[] = []
  const ordered = spans
    .flatMap((span) => perLine(text, span))
    .sort((a, b) => a.from - b.from || b.length - a.length || a.type.localeCompare(b.type))
  for (const span of ordered) if (kept.every((one) => contains(one, span) || apart(one, span))) kept.push(span)

  let out = ""
  const open: TextSpan[] = []
  let next = 0
  for (let at = 0; at <= text.length; at++) {
    for (let top = open.at(-1); top && top.from + top.length === at; top = open.at(-1)) {
      open.pop()
      out += top.type === "link" ? linkTail(text, top) : (MARKS[top.type] ?? "")
    }
    for (; kept[next]?.from === at; next++) {
      const span = kept[next] as TextSpan
      open.push(span)
      out += span.type === "blockquote" ? "> " : (MARKS[span.type] ?? "")
    }
    if (at === text.length) break
    out += text[at]
    if (text[at] === "\n")
      out += open
        .filter((span) => span.type === "blockquote")
        .map(() => "> ")
        .join("")
  }
  return out
}
