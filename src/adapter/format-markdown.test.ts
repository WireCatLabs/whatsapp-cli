import { describe, expect, it } from "vitest"
import { formatMarkdown, toWhatsApp } from "./format-markdown.js"

const whatsApp = (markdown: string) => {
  const { text, spans } = formatMarkdown(markdown)
  return toWhatsApp(text, spans)
}

describe("Markdown as WhatsApp writes it", () => {
  it.each([
    ["**bold** _italic_ ~~gone~~ `code`", "*bold* _italic_ ~gone~ `code`"],
    ["WhatsApp's own *bold* and ~strike~ read the same", "WhatsApp's own *bold* and ~strike~ read the same"],
    ["*outer _inner_ outer*", "*outer _inner_ outer*"],
    ["# Title\n- one\n- two\n1. first", "*Title*\n- one\n- two\n1. first"],
    ["> line one\n> **two**\n>\n> three\n\nafter", "> line one\n> *two*\n> \n> three\n\nafter"],
    ["```js\n  code *raw*\n```\nafter", "```  code *raw*```\nafter"],
    [
      "[the site](https://example.test/a) or https://example.test/b",
      "the site (https://example.test/a) or https://example.test/b",
    ],
    ["[https://example.test](https://example.test)", "https://example.test"],
    ["__underline__ ||spoiler||", "underline spoiler"],
    ["** spaced **", " *spaced* "],
    ["**bold\nnext line**", "*bold*\n*next line*"],
    ["\\*literal\\* 2*3*4 file_name", "*literal* 2*3*4 file_name"],
    ["plain text", "plain text"],
  ])("%j → %j", (markdown, expected) => {
    expect(whatsApp(markdown)).toBe(expected)
  })

  it("drops a span that crosses another rather than write marks WhatsApp would show as typed", () => {
    expect(
      toWhatsApp("one two three", [
        { type: "bold", from: 0, length: 7 },
        { type: "italic", from: 4, length: 9 },
      ]),
    ).toBe("*one two* three")
  })
})
