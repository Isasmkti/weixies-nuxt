const INLINE_RULES = [
  { type: 'link', pattern: /\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/i, content: 1, href: 2 },
  { type: 'bold', pattern: /\*\*(.+?)\*\*/, content: 1 },
  { type: 'underline', pattern: /<u>(.+?)<\/u>/i, content: 1 },
  { type: 'strike', pattern: /~~(.+?)~~/, content: 1 },
  { type: 'code', pattern: /`([^`\n]+)`/, content: 1 },
  { type: 'italic', pattern: /\*([^*\n]+)\*/, content: 1 },
]

const blockStart = line => (
  /^#{2,4}\s+/.test(line)
  || /^[-*]\s+/.test(line)
  || /^\d+[.)]\s+/.test(line)
  || /^>\s?/.test(line)
  || /^\s*---\s*$/.test(line)
)

export function parsePublicPageInline(value, depth = 0) {
  const source = String(value ?? '')
  if (!source || depth > 12) return source ? [{ type: 'text', text: source }] : []

  let selected = null
  for (const [priority, rule] of INLINE_RULES.entries()) {
    const match = rule.pattern.exec(source)
    if (!match) continue
    if (!selected || match.index < selected.match.index || (match.index === selected.match.index && priority < selected.priority)) {
      selected = { rule, match, priority }
    }
  }

  if (!selected) return [{ type: 'text', text: source }]

  const { rule, match } = selected
  const tokens = []
  if (match.index > 0) tokens.push({ type: 'text', text: source.slice(0, match.index) })

  const content = match[rule.content]
  tokens.push(rule.type === 'code'
    ? { type: rule.type, text: content }
    : {
        type: rule.type,
        href: rule.href ? match[rule.href] : undefined,
        children: parsePublicPageInline(content, depth + 1),
      })

  const remaining = source.slice(match.index + match[0].length)
  if (remaining) tokens.push(...parsePublicPageInline(remaining, depth))
  return tokens
}

export function parsePublicPageRichText(value) {
  const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    const heading = line.match(/^(#{2,4})\s+(.+)$/)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, content: parsePublicPageInline(heading[2]) })
      index += 1
      continue
    }

    if (/^\s*---\s*$/.test(line)) {
      blocks.push({ type: 'divider' })
      index += 1
      continue
    }

    const unordered = line.match(/^[-*]\s+(.+)$/)
    if (unordered) {
      const items = []
      while (index < lines.length) {
        const item = lines[index].match(/^[-*]\s+(.+)$/)
        if (!item) break
        items.push(parsePublicPageInline(item[1]))
        index += 1
      }
      blocks.push({ type: 'unordered-list', items })
      continue
    }

    const ordered = line.match(/^\d+[.)]\s+(.+)$/)
    if (ordered) {
      const items = []
      while (index < lines.length) {
        const item = lines[index].match(/^\d+[.)]\s+(.+)$/)
        if (!item) break
        items.push(parsePublicPageInline(item[1]))
        index += 1
      }
      blocks.push({ type: 'ordered-list', items })
      continue
    }

    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      const quoteLines = []
      while (index < lines.length) {
        const item = lines[index].match(/^>\s?(.*)$/)
        if (!item) break
        quoteLines.push(parsePublicPageInline(item[1]))
        index += 1
      }
      blocks.push({ type: 'quote', lines: quoteLines })
      continue
    }

    const paragraphLines = []
    while (index < lines.length && lines[index].trim() && !blockStart(lines[index])) {
      paragraphLines.push(parsePublicPageInline(lines[index]))
      index += 1
    }
    blocks.push({ type: 'paragraph', lines: paragraphLines })
  }

  return blocks
}

export function publicPageRichTextToPlainText(value) {
  return String(value ?? '')
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:)[^)]+\)/gi, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/<u>(.*?)<\/u>/gi, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{2,4}\s+/gm, '')
    .replace(/^[-*>]\s+/gm, '')
    .replace(/^\d+[.)]\s+/gm, '')
    .replace(/^\s*---\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}
