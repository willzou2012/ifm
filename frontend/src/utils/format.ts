const pad = (num: number, size = 2) => String(num).padStart(size, '0')

/**
 * Formats a date like strftime. Supported are %Y %m %d %H %M %S %y %b %B %a
 * %A; unknown conversion specifiers are kept as they are.
 */
export function customStrftime(date: Date, format: string): string {
  const replacements: Record<string, string> = {
    '%Y': String(date.getFullYear()),
    '%m': pad(date.getMonth() + 1),
    '%d': pad(date.getDate()),
    '%H': pad(date.getHours()),
    '%M': pad(date.getMinutes()),
    '%S': pad(date.getSeconds()),
    '%y': String(date.getFullYear()).slice(-2),
    '%b': date.toLocaleString('default', { month: 'short' }),
    '%B': date.toLocaleString('default', { month: 'long' }),
    '%a': date.toLocaleString('default', { weekday: 'short' }),
    '%A': date.toLocaleString('default', { weekday: 'long' }),
  }
  return format.replace(/%[a-zA-Z]/g, (match) => replacements[match] ?? match)
}

/**
 * Formats a UNIX timestamp, either with a strftime-like custom format or in
 * the locale of the browser.
 */
export function formatDate(timestamp: number | undefined, customFormat?: string | false): string {
  if (timestamp === undefined) return ''
  const d = new Date(timestamp * 1000)
  if (customFormat) return customStrftime(d, customFormat)
  return d.toLocaleString(navigator.language || 'en-US')
}
