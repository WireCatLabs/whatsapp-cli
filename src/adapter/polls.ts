import { CliError } from "@wirecat/cli-base"
import { countedPoll, type Message, type Poll, type PollVote, type PollVoteEvent } from "@wirecat/cli-core"
import type { HistoryVote, MessagePolls, StoredMessages } from "@wirecat/cli-core/cli"
import * as v from "valibot"
import { type WaKey, type WaPoll, type WaVote, type WhatsAppEngine, waPoll } from "../engine/contract.js"
import { toMessage } from "./map.js"

// WhatsApp polls never close, so there is nothing for `closePoll` to do.
export type PollAdapter = Omit<MessagePolls, "closePoll">

const pollIn = (message: Message | undefined): WaPoll | undefined => {
  const parsed = v.safeParse(waPoll, message?.providerMetadata?.poll)
  return parsed.success ? parsed.output : undefined
}

const pollOf = (message: Message): WaPoll => {
  const poll = pollIn(message)
  if (!poll) throw new CliError("not_found", `message ${message.id} carries no poll`)
  return poll
}

/** The poll as its message carries it, before the votes the store keeps are counted in. */
const toPoll = (chatId: string, message: Message, poll: WaPoll): Poll => ({
  chatId,
  messageId: message.id,
  question: poll.question,
  answers: poll.answers.map(({ id, text }) => ({ id, text, voters: null, chosen: false })),
  closed: false,
  multiple: poll.multiple,
  anonymous: false,
  voters: null,
  quiz: false,
  revote: true,
  creator: message.outgoing === true,
})

/**
 * A vote as cli-core keeps it. WhatsApp names each chosen answer by the full hash of its text, an answer id is the
 * start of it. A vote whose answers this poll does not have is dropped rather than kept as a vote taken back.
 */
const toPollVote = (vote: WaVote, poll: WaPoll): PollVote | undefined => {
  const answers = poll.answers
    .filter((answer) => vote.selected.some((hash) => hash.startsWith(answer.id)))
    .map((answer) => answer.id)
  if (answers.length === 0 && vote.selected.length > 0) return undefined
  return { person: { id: vote.voter, name: vote.voterName, username: null }, answers, votedAt: vote.votedAt }
}

/** A live vote, for a poll the store holds; one for a poll it does not hold is dropped. */
export const toVoteEvent = async (
  vote: WaVote,
  chatTitle: string | null,
  stored: StoredMessages,
): Promise<PollVoteEvent | undefined> => {
  const poll = pollIn(await stored.message(vote.chat, vote.message).catch(() => undefined))
  const counted = poll && toPollVote(vote, poll)
  return counted && { event: "vote", chatId: vote.chat, chatTitle, messageId: vote.message, vote: counted }
}

/** A vote from a history push, counted by the poll it carries. */
export const toHistoryVote = (vote: WaVote): HistoryVote | undefined => {
  const counted = vote.poll && toPollVote(vote, vote.poll)
  return counted && { chatId: vote.chat, messageId: vote.message, vote: counted }
}

/**
 * Polls as WhatsApp has them: everyone in the chat sees who voted for what, a vote can always be changed, and a poll
 * neither closes nor is a quiz. A poll is read from the store, which holds the message that carries it and each
 * voter's newest vote; WhatsApp has no request for either.
 */
export const pollAdapter = ({
  engine,
  stored,
  held,
  keyOf,
  translated,
}: {
  engine: WhatsAppEngine
  stored: StoredMessages
  held: (chatId: string, messageId: string) => Promise<Message>
  keyOf: (chatId: string, message: Message) => WaKey
  translated: <T>(work: Promise<T>) => Promise<T>
}): PollAdapter => ({
  poll: async (chatId, messageId) => {
    const message = await held(chatId, messageId)
    return countedPoll(
      toPoll(chatId, message, pollOf(message)),
      await stored.pollVotes(chatId, messageId),
      engine.self(),
    )
  },

  // cli-core keeps this vote only after it returns, so the answer counts it in itself.
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
    const self = engine.self()
    const others = (await stored.pollVotes(chatId, messageId)).filter((vote) => vote.person.id !== self)
    const mine =
      self === null
        ? []
        : [{ person: { id: self, name: null, username: null }, answers: answerIds, votedAt: new Date().toISOString() }]
    return countedPoll(toPoll(chatId, message, poll), [...mine, ...others], self)
  },

  pollVoters: async (chatId, messageId, { limit, answerId }) => {
    await held(chatId, messageId)
    const voters = (await stored.pollVotes(chatId, messageId)).filter(
      (vote) => vote.answers.length > 0 && (answerId === undefined || vote.answers.includes(answerId)),
    )
    return { items: voters.slice(0, limit), hasMore: voters.length > limit, total: voters.length }
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
