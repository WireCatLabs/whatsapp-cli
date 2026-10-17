/** The commands a message sends a person to; the command layer names them in its own words. */
export type Check = "chats.list" | "serve" | "session.start"

/** A command as the person types it, in one pair of backticks. */
export type Words = (check: Check) => string

/** Without the command layer's words, a check is named by its command path alone. */
export const bareCheck: Words = (check) => `\`${check.replaceAll(".", " ")}\``
