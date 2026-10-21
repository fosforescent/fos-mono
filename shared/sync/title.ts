/**
 * Titles from text. `title` is a capability: a short string for a text. Two handlers fill it: `truncateTitle`, which
 * every peer runs at once (the text's first heading or line without its markup, cut at a word with an ellipsis), and
 * the fos server's language model, which writes a summary when a `title` requirement asks it (`title-request.ts`,
 * backend `titleHandler`). A note made from more than one line is titled by the first; asking the server replaces it.
 * No imports, so forms and the embed can use it.
 */
export const TITLE_LIMIT = 60

/** The instructions the model gets with the text to title. */
export const TITLE_SYSTEM = 'Write a short title for the text the user sends: at most eight words, in the text\'s language, no quotes, no trailing punctuation. Reply with the title only.'

/** A page title for a markdown text: its first heading, else its first line, without markup (frontmatter skipped). */
export function markdownTitle(markdown: string): string {
  const lines = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const line = lines.find(l => /^#{1,6}\s/.test(l)) ?? lines[0] ?? ''
  return line.replace(/^(#{1,6}|>|[-*+]|\d+[.)])\s+/, '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').trim().slice(0, 200)
}

/** The truncation handler: `markdownTitle`, cut at a word boundary within `limit` characters with an ellipsis. */
export function truncateTitle(text: string, limit = TITLE_LIMIT): string {
  const title = markdownTitle(text)
  if (title.length <= limit) return title
  const cut = title.slice(0, limit - 1), space = cut.lastIndexOf(' ')
  return `${(space > limit / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}
