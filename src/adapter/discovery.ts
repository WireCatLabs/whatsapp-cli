import type { MessengerAdapter } from "@wirecat/cli-core/cli"
import type { WhatsAppEngine } from "../engine/contract.js"

export type DiscoveryAdapter = Required<Pick<MessengerAdapter, "inspect" | "sessions" | "folders">>

export const discoveryAdapter = (
  engine: WhatsAppEngine,
  translated: <T>(work: Promise<T>) => Promise<T>,
): DiscoveryAdapter => ({
  folders: async () =>
    (await translated(engine.folders())).map((label) => ({
      id: label.id,
      title: label.name,
      chatIds: [...new Set(label.chats)],
    })),
  inspect: async (link) => {
    const preview = await translated(engine.inspect(link))
    return {
      kind: preview.kind === "newsletter" ? "channel" : "group",
      title: preview.name,
      id: preview.jid,
      username: null,
      description: preview.description,
      participantsCount: preview.participants,
      member: preview.member,
      approvalNeeded: preview.approval,
    }
  },
  sessions: async () =>
    (await translated(engine.devices())).map((device) => ({
      current: device.current,
      device: String(device.id),
      client: null,
      location: null,
      lastActiveAt: null,
    })),
})
