import type { CheckWords } from "@wirecat/cli-core"

/** The commands a message sends a person to; the command layer names them in its own words. */
export type Check = "chats.list" | "serve" | "session.start"

/** A command as the person types it, in one pair of backticks. */
export type Words = CheckWords<Check>
