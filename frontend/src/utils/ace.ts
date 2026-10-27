/**
 * Minimal typings of the parts of the Ace editor API used by IFM. Ace is not
 * bundled with the application; it is loaded as a global (`window.ace`) by the
 * PHP page, either inlined or from a CDN, together with optional extensions.
 */
export interface AceSession {
  setValue(value: string): void
  setMode(mode: string): void
  getOption(name: string): unknown
  setOption(name: string, value: unknown): void
  $modeId?: string
}

export interface AceEditor {
  getValue(): string
  getSession(): AceSession
  getOption(name: string): unknown
  setOption(name: string, value: unknown): void
  on(event: 'change', cb: () => void): void
  focus(): void
  resize(): void
  destroy(): void
  container: HTMLElement
  commands: {
    addCommand(cmd: { name: string; bindKey: string; exec: (editor: AceEditor) => void }): void
  }
}

export interface AceStatic {
  edit(el: HTMLElement): AceEditor
  require(module: string): unknown
}

export function getAce(): AceStatic | undefined {
  return (window as { ace?: AceStatic }).ace
}

/** Guesses the ace mode of a file by its name, if the modelist extension is available. */
export function modeForPath(ace: AceStatic, filename: string): string | undefined {
  try {
    const modelist = ace.require('ace/ext/modelist') as
      { getModeForPath(path: string): { mode: string } } | undefined
    return modelist?.getModeForPath(filename).mode
  } catch {
    return undefined
  }
}
