import { CliError } from "@wirecat/cli-base"
import { type FormattedText, type TextSpan, validateFormattedText } from "@wirecat/cli-core"

const STYLES: [string, TextSpan["type"]][] = [
  ["**", "bold"],
  ["__", "underline"],
  ["~~", "strike"],
  ["||", "spoiler"],
  ["*", "bold"],
  ["_", "italic"],
  ["~", "strike"],
]
const WORD = /[\p{L}\p{N}]/u
const before = (input: string, at: number) => {
  const code = input.charCodeAt(at - 1)
  return code >= 0xdc00 && code <= 0xdfff ? input.slice(at - 2, at) : (input[at - 1] ?? "")
}
const after = (input: string, at: number) => String.fromCodePoint(input.codePointAt(at) ?? 0)
const fail = (message: string): never => {
  throw new CliError("validation_error", message)
}

const balanced = (input: string, start: number, open: string, close: string): number | undefined => {
  let depth = 1
  for (let at = start + 1; at < input.length; at++) {
    if (input[at] === "\\") {
      at++
      continue
    }
    if (input[at] === open) {
      if (++depth > 32) fail("Markdown nesting exceeds 32 levels")
    }
    if (input[at] === close && --depth === 0) return at
  }
  return undefined
}

const parse = (input: string, depth = 0): FormattedText => {
  if (depth > 32) fail("Markdown nesting exceeds 32 levels")
  let text = "",
    at = 0
  const spans: TextSpan[] = []
  const links = input.includes("](")
  const append = (part: FormattedText, type?: TextSpan["type"], extra: Partial<TextSpan> = {}) => {
    const from = text.length
    text += part.text
    for (const span of part.spans) spans.push({ ...span, from: from + span.from })
    if (type && part.text.length > 0) spans.push({ type, from, length: part.text.length, ...extra })
    if (spans.length > 100) fail("Markdown has more than 100 formatting spans")
  }
  while (at < input.length) {
    const lineStart = at === 0 || input[at - 1] === "\n"
    if (lineStart && input.startsWith("```", at)) {
      const opening = /^```([\w.+#-]*)[ \t]*\r?\n/u.exec(input.slice(at))
      // WhatsApp's own monospace sits on one line.
      const inline = opening ? null : /^```([^`\r\n]+)```/u.exec(input.slice(at))
      if (inline) {
        append({ text: inline[1] ?? "", spans: [] }, "pre", { language: "" })
        at += inline[0].length
        continue
      }
      if (!opening)
        throw new CliError("validation_error", "a Markdown code fence needs a newline and an optional language token")
      if (opening) {
        const bodyStart = at + opening[0].length
        const closing = /^(?:```)[ \t]*(?:\r?\n|$)/gmu
        closing.lastIndex = bodyStart
        const end = closing.exec(input)
        if (!end) throw new CliError("validation_error", "a Markdown code fence needs a closing fence")
        append({ text: input.slice(bodyStart, end.index), spans: [] }, "pre", { language: opening[1] ?? "" })
        at = end.index + end[0].length
        continue
      }
    }
    if (lineStart && /^>(?: |\r?\n|$)/u.test(input.slice(at))) {
      const quoted: string[] = []
      let trailing = ""
      while (at < input.length && /^>(?: |\r?\n|$)/u.test(input.slice(at))) {
        const end = input.indexOf("\n", at)
        const lineEnd = end === -1 ? input.length : end
        const line = input.slice(at, lineEnd)
        quoted.push(line.replace(/^> ?/u, ""))
        at = end === -1 ? input.length : end + 1
        trailing = end === -1 ? "" : "\n"
      }
      append(parse(quoted.join("\n"), depth + 1), "blockquote")
      text += trailing
      continue
    }
    if (lineStart) {
      const heading = /^#{1,6} +([^\r\n]*)(\r?\n|$)/u.exec(input.slice(at))
      if (heading) {
        append(parse(heading[1] ?? "", depth + 1), "heading")
        text += heading[2] ?? ""
        at += heading[0].length
        continue
      }
    }

    if (input[at] === "\\" && at + 1 < input.length) {
      text += input[at + 1]
      at += 2
      continue
    }
    if (links && input[at] === "[") {
      const labelEnd = balanced(input, at, "[", "]")
      if (labelEnd !== undefined && input[labelEnd + 1] === "(") {
        const urlEnd = balanced(input, labelEnd + 1, "(", ")")
        if (urlEnd !== undefined) {
          const url = input.slice(labelEnd + 2, urlEnd).replace(/\\([\\()])/gu, "$1")
          append(parse(input.slice(at + 1, labelEnd), depth + 1), "link", { url })
          at = urlEnd + 1
          continue
        }
      }
    }
    if (input[at] === "`" && !input.startsWith("```", at)) {
      const end = input.indexOf("`", at + 1)
      if (end > at + 1) {
        const content = input.slice(at + 1, end)
        if (!content.includes("\n") && !content.includes("\r")) {
          append({ text: content, spans: [] }, "code")
          at = end + 1
          continue
        }
      }
    }
    const style = STYLES.find(([marker]) => input.startsWith(marker, at))
    if (style) {
      const [marker, type] = style
      let end = input.indexOf(marker, at + marker.length)
      while (
        end !== -1 &&
        (() => {
          let escapes = 0
          for (let i = end - 1; i >= 0 && input[i] === "\\"; i--) escapes++
          return escapes % 2 === 1
        })()
      )
        end = input.indexOf(marker, end + marker.length)
      const edge =
        (marker !== "_" && marker !== "*") ||
        (!WORD.test(before(input, at)) && !WORD.test(after(input, end + marker.length)))
      if (end > at + marker.length && edge) {
        append(parse(input.slice(at + marker.length, end), depth + 1), type)
        at = end + marker.length
        continue
      }
      text += marker
      at += marker.length
      continue
    }
    text += input[at]
    at++
  }
  return { text, spans }
}

/** tg's Markdown with `#` headings: `*` and `**` are bold, as WhatsApp's own `*` is, so its marks read the same. */
export const formatMarkdown = (input: string): FormattedText => {
  const result = parse(input)
  result.spans.sort((a, b) => a.from - b.from || b.length - a.length || a.type.localeCompare(b.type))
  return validateFormattedText(result)
}

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
