import { CliError } from "@wirecat/cli-base"
import { bareCheck, type Message, type MessageEvent, type MessageHit } from "@wirecat/cli-core"
import type { LiveUpdates, MessengerCore, PassiveUpdates, PushedHistory, StoredMessages } from "@wirecat/cli-core/cli"
import { type ConnectionState, EngineError, type EngineEvent, type WhatsAppEngine } from "../engine/contract.js"
import type { Words } from "./checks.js"
import { fromEngine } from "./errors.js"
import { sameFile, toChatEvent, toChatUpdate, toMember, toMessage, toPersonReaction } from "./map.js"
import { toHistoryVote, toVoteEvent } from "./polls.js"

const hit = (message: Message): MessageHit => ({ ...message, chatTitle: null })

const ENDED: Partial<Record<ConnectionState, (words: Words, until?: string) => CliError>> = {
  logged_out: (words) =>
    fromEngine(
      new EngineError(
        "authentication_error",
        `WhatsApp logged this device out — log in again with ${words("session.start")}`,
        "device.logged-out",
      ),
    ),
  replaced: () =>
    fromEngine(
      new EngineError(
        "provider_unavailable",
        "another process took over this WhatsApp login; only one may hold it",
        "device.replaced",
      ),
    ),
  banned: (_words, until) =>
    fromEngine(
      new EngineError(
        "permission_error",
        "WhatsApp has banned or restricted this account; see the phone",
        "account.banned",
        until,
      ),
    ),
  outdated: () =>
    fromEngine(
      new EngineError(
        "provider_unavailable",
        "WhatsApp no longer accepts this version of wa; update it",
        "client.outdated",
      ),
    ),
  stopped: () =>
    fromEngine(new EngineError("provider_unavailable", "the WhatsApp engine stopped unexpectedly", "engine.stopped")),
}

const ENDING = new Set([
  ...Object.values(ENDED).map((end) => end(bareCheck).details.reason),
  "engine.stopped-mid-write",
])

/** A failure that means the connection is gone, not that one event was odd: it ends the listening. */
const ends = (error: unknown) =>
  (error instanceof EngineError && ENDING.has(error.reason)) ||
  (error instanceof CliError && ENDING.has(error.details.reason))

/**
 * Hands each event on until `signal` aborts; a connection WhatsApp ended rejects with why, unless `expected` says this
 * process asked for that end. Events are handled one at a time in arrival order. One whose handling fails is skipped
 * and the next still runs: a stalled queue would keep every later push out of the store until a restart. The first skip
 * is said on `warn` at once, kind and code only, never its content; `drained` settles when the handling caught up and
 * then says how many were skipped if there were more.
 */
const listening = (
  engine: WhatsAppEngine,
  kinds: readonly EngineEvent["event"][],
  signal: AbortSignal,
  words: Words,
  warn: (message: string) => void,
  handle: (event: EngineEvent) => void | Promise<void>,
  expected: (state: ConnectionState) => boolean = () => false,
): {
  done: Promise<void>
  stop: () => void
  drained: () => Promise<void>
  run: (kind: string, work: () => void | Promise<void>) => void
} => {
  let stop = () => {}
  let queue = Promise.resolve()
  let skipped = 0
  let fail: (kind: string, error: unknown) => void = () => {}
  const run = (kind: string, work: () => void | Promise<void>) => {
    queue = queue.then(work).catch((error: unknown) => fail(kind, error))
  }
  const done = new Promise<void>((resolve, reject) => {
    fail = (kind: string, error: unknown) => {
      if (ends(error)) return reject(error instanceof EngineError ? fromEngine(error) : error)
      skipped += 1
      if (skipped > 1) return
      const code = error instanceof CliError ? error.code : error instanceof Error ? error.name : "error"
      warn(
        `a pushed ${kind} event could not be handled and was skipped (${code}); the ones after it go on, ` +
          "and any more skips are counted when wa stops listening",
      )
    }
    const unlisten = engine.listen(kinds, (event) => {
      if (event.event === "connection" && expected(event.state)) return resolve()
      const ended = event.event === "connection" ? ENDED[event.state]?.(words, event.until) : undefined
      if (ended) reject(ended)
      else run(event.event, () => handle(event))
    })
    const aborted = () => resolve()
    signal.addEventListener("abort", aborted, { once: true })
    stop = () => {
      unlisten()
      signal.removeEventListener("abort", aborted)
    }
    if (signal.aborted) resolve()
  })
  // The caller may still be awaiting the engine's readiness when an ended connection rejects `done`.
  done.catch(() => {})
  const drained = () =>
    queue.then(() => {
      if (skipped > 1) warn(`${skipped} pushed events could not be handled and were skipped in all`)
    })
  return { done, stop, drained, run }
}

/** Re-keys that arrive this close together go to cli-core as one batch, up to this many. */
const REKEY_WINDOW_MS = 100
const REKEY_BATCH = 500

export const listenAdapter = ({
  engine,
  stored,
  words,
  warn,
  translated,
}: {
  engine: WhatsAppEngine
  stored: StoredMessages
  words: Words
  warn: (message: string) => void
  translated: <T>(work: Promise<T>) => Promise<T>
}): LiveUpdates & PassiveUpdates & PushedHistory & Pick<MessengerCore, "logout"> => {
  // Set by `session end`: WhatsApp then ends the connection as logged out, which is the answer, not a failure.
  let loggingOut = false
  // Held re-keys of a running `feed`: a live event may name the new id, and must not reach cli-core before them (§5).
  const holding = new Set<() => void>()
  const handingOn = (
    onEvent: (event: MessageEvent) => void,
    signal: AbortSignal,
    expected?: (state: ConnectionState) => boolean,
  ) => {
    const handed = async (event: EngineEvent) => {
      for (const handOn of holding) handOn()
      if (event.event === "message") onEvent({ event: "message", message: hit(toMessage(event.message)) })
      else if (event.event === "edit") onEvent({ event: "edit", message: hit(toMessage(event.message)) })
      else if (event.event === "delete")
        onEvent({
          event: "delete",
          chatId: event.chat,
          chatTitle: null,
          messageId: event.id,
        })
      else if (event.event === "star")
        onEvent({
          event: "star",
          chatId: event.chat,
          chatTitle: null,
          messageId: event.id,
          starred: event.starred,
        })
      else if (event.event === "reaction")
        onEvent({
          event: "person_reaction",
          chatId: event.reaction.chat,
          chatTitle: null,
          messageId: event.reaction.message,
          reaction: toPersonReaction(event.reaction),
        })
      else if (event.event === "receipt")
        onEvent({
          event: "delivery",
          chatId: event.receipt.chat,
          chatTitle: null,
          messageId: event.receipt.id,
          delivery: event.receipt.delivery,
          at: event.receipt.at,
        })
      else if (event.event === "vote") {
        const vote = await toVoteEvent(event.vote, stored)
        if (vote) onEvent(vote)
      } else if (event.event === "chat_event")
        onEvent({
          event: "chat_event",
          chatId: event.change.chat,
          chatTitle: null,
          change: toChatEvent(event.change),
        })
    }
    // In arrival order: a vote reads its poll from the store, and nothing after it may overtake it.
    const live = listening(
      engine,
      ["message", "edit", "delete", "vote", "reaction", "star", "receipt", "chat_event", "connection"],
      signal,
      words,
      warn,
      handed,
      expected,
    )
    return {
      done: live.done,
      stop: async () => {
        live.stop()
        await live.drained()
      },
    }
  }
  // A push after a re-link carries the path the file had then, and the store may hold the one the phone uploaded
  // again. cli-core keeps a stored ref only when the pushed file has none, so the pushed one is left off when it names
  // the same file; another file keeps its own. Only a message with a ref costs a store read; one that fails hands the
  // message on as pushed, never loses it.
  const withoutKeptRefs = async (message: Message): Promise<Message> => {
    if (!message.attachments.some((file) => file.providerRef)) return message
    const kept = await stored.message(message.chatId, message.id).catch(() => undefined)
    if (!kept?.attachments.some((file) => file.providerRef)) return message
    return {
      ...message,
      attachments: message.attachments.map((file, position) => {
        if (!sameFile(file.providerRef, kept.attachments[position]?.providerRef)) return file
        const { providerRef: _pushed, ...rest } = file
        return rest
      }),
    }
  }
  const pushing = async (
    onBatch: Parameters<PushedHistory["feed"]>[0],
    signal: AbortSignal,
    expected?: (state: ConnectionState) => boolean,
  ) => {
    // cli-core saves each batch's re-keys apart, so thousands at a serve's start must not come one batch each; a push
    // hands on the held ones before its own, as they arrived.
    let held: { from: string; to: string }[] = []
    let due: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      clearTimeout(due)
      due = undefined
      if (held.length === 0) return
      const rekeys = held
      held = []
      onBatch({ rekeys })
    }
    // In arrival order: a push waits for its store reads, and a re-key after it must not overtake it.
    const handed = async (event: EngineEvent) => {
      if (event.event === "rekey") {
        held.push({ from: event.from, to: event.to })
        if (held.length >= REKEY_BATCH) flush()
        else due ??= setTimeout(() => pushes.run("rekey", flush), REKEY_WINDOW_MS)
        return
      }
      if (event.event !== "history") return
      flush()
      const { rekeys, chats, contacts, messages, votes, reactions, events, stars, deletions } = event.history
      const batch = {
        rekeys: rekeys ?? [],
        chats: chats.map(toChatUpdate),
        people: contacts.map(toMember),
        messages: await Promise.all(messages.map((message) => withoutKeptRefs(toMessage(message)))),
        votes: votes.flatMap((vote) => toHistoryVote(vote) ?? []),
        reactions: (reactions ?? []).map((reaction) => ({
          chatId: reaction.chat,
          messageId: reaction.message,
          reaction: toPersonReaction(reaction),
        })),
        events: (events ?? []).map((change) => ({ chatId: change.chat, change: toChatEvent(change) })),
        stars: (stars ?? []).map((one) => ({ chatId: one.chat, messageId: one.message, starred: one.starred })),
        deletions: (deletions ?? []).map((one) => ({ chatId: one.chat, messageId: one.message })),
      }
      const saved: unknown = await onBatch(batch)
      // The phone pushes this once: the engine keeps it until the store has it. A handler that stores nothing says
      // nothing, and the push counts as stored.
      if (event.history.push) await engine.historySaved(event.history.push, saved !== false).catch(() => {})
    }
    const pushes = listening(engine, ["history", "rekey", "connection"], signal, words, warn, handed, expected)
    const handOn = () => {
      try {
        flush()
      } catch (error) {
        pushes.run("rekey", () => Promise.reject(error))
      }
    }
    holding.add(handOn)
    try {
      await pushes.done
    } finally {
      holding.delete(handOn)
      pushes.stop()
      pushes.run("rekey", flush)
      await pushes.drained()
    }
  }
  const ownLogout = (state: ConnectionState) => state === "logged_out" && loggingOut
  return {
    logout: () => {
      loggingOut = true
      return translated(engine.logout())
    },

    watch: async (onEvent: (event: MessageEvent) => void, signal: AbortSignal, onReady?: () => void) => {
      const live = handingOn(onEvent, signal)
      try {
        await translated(engine.ready(signal))
        if (!signal.aborted) onReady?.()
        await live.done
      } finally {
        await live.stop()
      }
    },

    // What a one-shot connection receives: WhatsApp hands a queued message to a linked device once, so it is saved
    // here or lost. Never connects; the command's own request does that.
    listen: async (onEvent, signal) => {
      const live = handingOn(onEvent, signal, ownLogout)
      try {
        await live.done
      } finally {
        await live.stop()
      }
    },

    // The history a one-shot connection is pushed, which WhatsApp likewise sends once. Never connects.
    listenHistory: (onBatch, signal) => pushing(onBatch, signal, ownLogout),

    feed: (onBatch, signal) => pushing(onBatch, signal),
  }
}
