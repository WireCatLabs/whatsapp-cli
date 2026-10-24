import * as v from "valibot"

const count = v.pipe(v.number(), v.integer(), v.minValue(0))
const account = v.strictObject({ id: v.string(), name: v.nullable(v.string()) })
const history = v.strictObject({ chats: count, messages: count, people: count })
export const sessionSchema = v.union([
  v.strictObject({ profile: v.string(), account, already_linked: v.boolean(), received: v.optional(history) }),
  v.strictObject({ profile: v.string(), ended: v.boolean() }),
])
export const setupSchema = v.strictObject({
  profile: v.string(),
  runtime: v.string(),
  paths: v.record(v.string(), v.string()),
  session: v.strictObject({ path: v.string(), reused: v.boolean() }),
  account,
  history: v.optional(history),
  chats: v.strictObject({ checked: count, has_more: v.boolean() }),
  agent: v.strictObject({ name: v.string(), written: v.array(v.string()) }),
  commands: v.record(v.string(), v.string()),
})
