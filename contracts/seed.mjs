import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { pathToFileURL } from "node:url"

const fromPrevious = createRequire(realpathSync(process.argv[2]))
const { openStore } = await import(pathToFileURL(fromPrevious.resolve("@wirecat/cli-core/store")).href)
const { privateStore } = await import(
  pathToFileURL(join(dirname(realpathSync(process.argv[2])), "..", "paths.js")).href
)
const state = process.env.WA_STATE_DIR
mkdirSync(join(state, "accounts"), { recursive: true })
writeFileSync(join(state, "accounts", "contract.json"), JSON.stringify({ account: "601" }), { mode: 0o600 })

const device = privateStore("contract", process.env)
mkdirSync(dirname(device), { recursive: true, mode: 0o700 })
const database = new DatabaseSync(device)
database.exec(
  "CREATE TABLE synthetic_device (marker TEXT NOT NULL); INSERT INTO synthetic_device VALUES ('upgrade-contract')",
)
database.close()
writeFileSync(join(state, "device-sha256"), createHash("sha256").update(readFileSync(device)).digest("hex"))

const store = await openStore({ env: process.env, now: () => Date.parse("2026-10-01T10:00:00Z") })
try {
  const account = { provider: "whatsapp", account: "601" }
  await store.chats.saveChats(account, [
    {
      id: "7",
      title: "Synthetic Contract Group",
      kind: "group",
      unreadCount: 0,
      lastMessageAt: null,
      participantsCount: null,
    },
  ])
  await store.messages.saveMessages(
    account,
    "7",
    [
      {
        id: "101",
        chatId: "7",
        senderId: "11",
        senderName: "Synthetic Example",
        text: "wirecat-synthetic-message-canary",
        timestamp: "2026-10-01T10:00:00Z",
        editedAt: null,
        outgoing: false,
        attachments: [],
        replyTo: null,
        forwardedFrom: null,
        reactions: null,
      },
    ],
    { via: "fixture" },
  )
} finally {
  await store.close()
}
process.stdout.write(
  `${JSON.stringify({
    seeded: true,
    sha256: createHash("sha256").update(readFileSync(process.env.MESSAGING_STORE)).digest("hex"),
  })}\n`,
)
