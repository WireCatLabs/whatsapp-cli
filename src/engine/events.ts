import type { EngineEvent } from "./contract.js"

type Kind = EngineEvent["event"]

interface Listener {
  kinds: ReadonlySet<Kind>
  onEvent: (event: EngineEvent) => void
}

/** Fans events out by kind, and keeps each one nobody listens for until a listener of its kind arrives. */
export const eventHub = () => {
  const listeners = new Set<Listener>()
  let kept: EngineEvent[] = []

  const emit = (event: EngineEvent): void => {
    const takers = [...listeners].filter((listener) => listener.kinds.has(event.event))
    if (takers.length === 0) kept.push(event)
    for (const listener of takers) listener.onEvent(event)
  }

  const listen = (kinds: readonly Kind[], onEvent: (event: EngineEvent) => void): (() => void) => {
    const listener: Listener = { kinds: new Set(kinds), onEvent }
    listeners.add(listener)
    const mine = kept.filter((event) => listener.kinds.has(event.event))
    kept = kept.filter((event) => !listener.kinds.has(event.event))
    for (const event of mine) onEvent(event)
    return () => listeners.delete(listener)
  }

  return { emit, listen }
}
