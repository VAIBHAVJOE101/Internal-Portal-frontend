// Azure DevOps stores descriptions and comments as HTML. Render them through a strict allow-list.

const ALLOWED = new Set([
  'p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'ul', 'ol', 'li', 'a', 'code', 'pre',
  'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr',
])

/** Returns sanitized HTML: unknown tags are unwrapped, all attributes except safe link hrefs are dropped. */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement
  const clean = (node: Element) => {
    for (const child of [...node.children]) {
      const tag = child.tagName.toLowerCase()
      if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object') {
        child.remove()
        continue
      }
      if (tag === 'img') {
        child.replaceWith(doc.createTextNode('[image]'))
        continue
      }
      clean(child)
      if (!ALLOWED.has(tag)) {
        child.replaceWith(...child.childNodes)
        continue
      }
      const href = tag === 'a' ? child.getAttribute('href') : null
      for (const attr of [...child.attributes]) child.removeAttribute(attr.name)
      if (tag === 'a') {
        if (href && /^(https?:|mailto:)/i.test(href)) {
          child.setAttribute('href', href)
          child.setAttribute('target', '_blank')
          child.setAttribute('rel', 'noopener noreferrer')
        }
      }
    }
  }
  clean(root)
  return root.innerHTML
}

/** Rough HTML → plain text for editing (keeps line structure). */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return ''
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html')
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

/** Plain text → simple escaped HTML paragraphs. */
export function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => `<div>${esc(para).replace(/\n/g, '<br>')}</div>`)
    .join('')
}
