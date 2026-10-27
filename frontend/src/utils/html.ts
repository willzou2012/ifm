const ALLOWED_TAGS = new Set(['UL', 'OL', 'LI', 'BR', 'CODE', 'B', 'STRONG', 'EM', 'I', 'P'])

function cleanNode(node: Node, doc: Document): Node {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element
    if (!ALLOWED_TAGS.has(el.tagName)) return doc.createTextNode(el.textContent ?? '')
    const copy = doc.createElement(el.tagName)
    el.childNodes.forEach((child) => copy.appendChild(cleanNode(child, doc)))
    return copy
  }
  return doc.createTextNode(node.textContent ?? '')
}

/**
 * Reduces server-generated HTML (e.g. error lists like `Error<ul><li>a</li></ul>`)
 * to a small set of harmless formatting tags. All attributes are dropped and
 * any other element is replaced by its text content.
 */
export function sanitizeHtml(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  const out = document.createElement('div')
  template.content.childNodes.forEach((n) => out.appendChild(cleanNode(n, document)))
  return out.innerHTML
}

/** Decodes HTML entities (the folder tree API delivers HTML-escaped names). */
export function decodeEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}
