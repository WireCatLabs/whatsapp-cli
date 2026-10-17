import { CliError } from "@wirecat/cli-base"
import type { Message, Poll } from "@wirecat/cli-core"
import type { MessagePolls } from "@wirecat/cli-core/cli"
import * as v from "valibot"
import { type WaKey, type WaPoll, type WhatsAppEngine, waPoll } from "../engine/contract.js"
import { toMessage } from "./map.js"

export type PollAdapter = Omit<MessagePolls, "pollVoters">

const pollOf = (message: Message): WaPoll => {
  const parsed = v.safeParse(waPoll, message.providerMetadata?.poll)
  if (!parsed.success) throw new CliError("not_found", `message ${message.id} carries no poll`)
  return parsed.output
}

/**
 * What the store knows of a poll. WhatsApp has no request for the votes: each comes once, encrypted, as its own
 * message, and nothing counts them, so the counts are `null` and `chosen` says only what this command voted.
 */
const toPoll = (chatId: string, message: Message, poll: WaPoll, chosen: readonly string[] = []): Poll => ({
  chatId,
  messageId: message.id,
  question: poll.question,
  answers: poll.answers.map(({ id, text }) => ({ id, text, voters: null, chosen: chosen.includes(id) })),
  closed: false,
  multiple: poll.multiple,
  anonymous: false,
  voters: null,
  quiz: false,
  revote: true,
  creator: message.outgoing === true,
})

/**
 * Polls as WhatsApp has them: everyone in the chat sees who voted for what, a vote can always be changed, and a poll
 * neither closes nor is a quiz. A poll is read from the store, which holds the message that carries it.
 */
export const pollAdapter = ({
  engine,
  held,
  keyOf,
  translated,
}: {
  engine: WhatsAppEngine
  held: (chatId: string, messageId: string) => Promise<Message>
  keyOf: (chatId: string, message: Message) => WaKey
  translated: <T>(work: Promise<T>) => Promise<T>
}): PollAdapter => ({
  poll: async (chatId, messageId) => {
    const message = await held(chatId, messageId)
    return toPoll(chatId, message, pollOf(message))
  },

  vote: async (chatId, messageId, answerIds) => {
    const message = await held(chatId, messageId)
    const poll = pollOf(message)
    const known = new Map(poll.answers.map((answer) => [answer.id, answer.text]))
    const unknown = answerIds.filter((answer) => !known.has(answer))
    if (unknown.length > 0)
      throw new CliError(
        "validation_error",
        `${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not an answer of this poll — its answers are ${[...known.keys()].join(", ")}`,
      )
    if (answerIds.length > 1 && !poll.multiple)
      throw new CliError("validation_error", "this poll takes one answer; give one id")
    await translated(
      engine.vote(
        keyOf(chatId, message),
        answerIds.map((answer) => known.get(answer) as string),
      ),
    )
    return toPoll(chatId, message, poll, answerIds)
  },

  closePoll: async () => {
    throw new CliError("validation_error", "WhatsApp polls cannot be closed; they stay open")
  },

  createPoll: async (chatId, poll, { sendId, silent, threadId, sendAs }) => {
    if (poll.anonymous)
      throw new CliError(
        "validation_error",
        "everyone in a WhatsApp chat sees who voted for what; leave out --anonymous",
      )
    if (poll.quiz !== undefined || poll.closeAfter !== undefined)
      throw new CliError("validation_error", "WhatsApp polls are neither quizzes nor close by themselves")
    if (silent || threadId !== undefined || sendAs !== undefined)
      throw new CliError("validation_error", "WhatsApp sends a poll without --silent, --send-as or a topic")
    if (new Set(poll.answers).size < poll.answers.length)
      throw new CliError("validation_error", "each answer needs text of its own: WhatsApp counts a vote by it")
    const message = await translated(
      engine.createPoll({
        chat: chatId,
        id: sendId,
        question: poll.question,
        answers: poll.answers,
        multiple: poll.multiple,
      }),
    )
    return { message: toMessage(message), sendId }
  },
})
