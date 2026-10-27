/**
 * Copies a string to the clipboard. Uses the async clipboard API when
 * available (secure contexts) and falls back to a hidden textarea otherwise.
 */
export async function copyToClipboard(str: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(str)
      return
    } catch {
      // fall through to the legacy implementation
    }
  }
  const el = document.createElement('textarea')
  el.value = str
  el.setAttribute('readonly', '')
  el.style.position = 'absolute'
  el.style.left = '-9999px'
  document.body.appendChild(el)
  const selection = document.getSelection()
  const selected = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
  if (selection && selected) {
    selection.removeAllRanges()
    selection.addRange(selected)
  }
}
