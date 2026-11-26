/** Assigns an independent checkpoint key to each tab and retains it across reloads. */
export class TabSession {
  /** Retrieves the existing session key or starts a fresh session. */
  static open(storageKey: string, ready: (key?: string) => void) {
    let key: string
    try {
      key = sessionStorage.getItem(storageKey) ?? crypto.randomUUID()
      sessionStorage.setItem(storageKey, key)
    } catch {
      ready()
      return
    }
    TabSession.claim(storageKey, key, ready)
  }

  /** Gives a duplicated tab its own key while allowing a reloaded tab to reclaim its key. */
  private static claim(storageKey: string, key: string, ready: (key?: string) => void) {
    if (!navigator.locks) {
      ready(key)
      return
    }
    const timeout = new AbortController()
    const timer = window.setTimeout(() => timeout.abort(), 600)
    void navigator.locks.request('ai-sandbox:' + key, { signal: timeout.signal }, () => {
      window.clearTimeout(timer)
      ready(key)
      // The lock is released when the document is destroyed.
      return new Promise<void>(() => {})
    }).catch(() => {
      window.clearTimeout(timer)
      if (!timeout.signal.aborted) {
        ready(key)
        return
      }
      let replacement: string
      try {
        replacement = crypto.randomUUID()
        sessionStorage.setItem(storageKey, replacement)
      } catch {
        ready()
        return
      }
      TabSession.claim(storageKey, replacement, ready)
    })
  }
}
