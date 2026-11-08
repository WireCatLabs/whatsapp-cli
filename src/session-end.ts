import { existsSync, rmSync } from "node:fs"
import { CliError } from "@wirecat/cli-base"
import { asFirstWord, type MessengerContext } from "@wirecat/cli-core/cli"
import { privateStore } from "./paths.js"

export const endSession = async (
  context: Pick<MessengerContext, "profile" | "env" | "withMessenger">,
): Promise<{
  profile: string
  ended: boolean
  alreadyDropped?: boolean
}> => {
  const store = privateStore(context.profile, context.env)
  if (!existsSync(store)) {
    return { profile: context.profile, ended: false }
  }
  let dropped = false
  try {
    await context.withMessenger((adapter) => adapter.logout())
  } catch (error) {
    if (error instanceof CliError && error.details.reason === "device.in-use")
      throw new CliError(
        "provider_unavailable",
        `${error.message} — stop it first (\`wa ${asFirstWord(context.profile)}server stop\` for serve, or Ctrl+C ` +
          "where it runs), then end the session",
        { ...error.details, sent: false },
      )
    // The phone may have removed the device already; the keys here are then worth nothing, and still go.
    if (!(error instanceof CliError && error.code === "authentication_error")) throw error
    dropped = true
  }
  for (const suffix of ["", "-wal", "-shm", ".lock"]) rmSync(`${store}${suffix}`, { force: true })
  return { profile: context.profile, ended: true, ...(dropped ? { alreadyDropped: true } : {}) }
}
