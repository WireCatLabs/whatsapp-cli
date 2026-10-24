#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs"

const path = process.env.WA_ONESHOT_FIXTURE_STATE
if (!path) throw new Error("missing isolated fixture state")
const state = JSON.parse(readFileSync(path, "utf8"))
const mode = process.env.WA_ONESHOT_FIXTURE_MODE ?? "normal"
const accounts = { receiver: "100000000000001@lid", sender: "100000000000002@lid", same: "100000000000001@lid" }
const args = process.argv.slice(2)
const answer = (value) => console.log(JSON.stringify(value))
const save = () => writeFileSync(path, JSON.stringify(state))
const fail = (code) => {
  console.error(JSON.stringify({ error: { code } }))
  save()
  process.exit(5)
}
const deliver = (text, chat = accounts.sender) => state.rows.push({ account: accounts.receiver, chat, text })

if (args[0] === "__stop") {
  state.running = false
  state.actions.push({ action: "stop" })
} else if (args[0] === "__restore") {
  state.running = true
  state.actions.push({ action: "restore" })
  if (mode === "late-marker") for (const entry of state.pending) deliver(entry.text, entry.chat)
  if (mode === "lost-after-restart") state.rows = state.rows.filter((one) => one.account !== accounts.receiver)
} else if (args[0] === "__phone") {
  state.actions.push({ action: "phone" })
  if (state.running) deliver(args[1], accounts.receiver)
  else state.pending.push({ text: args[1], chat: accounts.receiver })
} else if (args[0] === "__running") {
  process.exit(state.running ? 0 : 1)
} else if (args[0] === "__lock") {
  if (!state.running && mode === "lock-unreadable") process.exit(1)
  console.log(state.running ? "serve (pid 102)|102|true" : "||false")
} else if (args[0] === "account" && args[1] === "list") {
  answer({ items: Object.entries(accounts).map(([profile, account]) => ({ profile, account })) })
} else {
  const [profile, root, command] = args
  const account = accounts[profile]
  if (!account) fail("validation_error")
  if (root === "messages" && command === "send") {
    state.actions.push({ action: "send", profile, target: args[3], confirmed: args.includes("--yes") })
    if (mode === "send-refused") fail("permission_error")
    if (mode === "send-preview") {
      answer({ item: { preview: true } })
      save()
      process.exit(0)
    }
    const text = args[4]
    state.rows.push({ account, chat: args[3], text })
    if (state.running) deliver(text)
    else state.pending.push({ text, chat: accounts.sender })
    if (mode === "receiver-restarted") state.running = true
    answer({ item: { message: { id: `synthetic-message-${state.rows.length}`, chat_id: args[3], text } } })
  } else if (root === "doctor" && args.includes("--online")) {
    state.actions.push({ action: "doctor", profile })
    if (mode === "doctor-failed") fail("provider_unavailable")
    if (mode !== "drop-marker" && mode !== "late-marker")
      for (const entry of state.pending) deliver(entry.text, entry.chat)
    answer({ item: {} })
  } else if (root === "search" && command === "messages") {
    if (mode === "read-failed") fail("provider_unavailable")
    const chat = args.find((one) => one.startsWith("chat:"))?.slice(5)
    state.actions.push({ action: "search", account, chat })
    answer({
      items: state.rows.filter((one) => one.account === account && one.chat === chat && one.text.includes(args[3])),
    })
  } else if (root === "messages" && command === "list") {
    if (mode === "read-failed") fail("provider_unavailable")
    const chat = args[3]
    state.actions.push({ action: "list", account, chat })
    answer({ items: state.rows.filter((one) => one.account === account && one.chat === chat) })
  } else fail("validation_error")
}
save()
