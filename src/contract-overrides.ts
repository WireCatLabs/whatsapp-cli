import type { SharedContractOverride } from "@wirecat/cli-base/commands"

// Reviewed differences from Core. A changed default requires reviewing this declaration.
export const SHELL_OVERRIDES: Readonly<{
  setup: readonly SharedContractOverride[]
  session: readonly SharedContractOverride[]
}> = {
  setup: [
    {
      command: ["setup"],
      field: "description",
      before: "set up the account and connect an agent",
      after: "set up WhatsApp and connect your agent",
      reason:
        "This provider binds its own account linking protocol, credential flow and typed receipt to the shared setup lifecycle.",
    },
    {
      command: ["setup"],
      field: "options",
      before: [
        {
          flags: "--agent <agent>",
          description: "install instructions for this agent",
          takes_value: true,
          mandatory: false,
        },
        {
          flags: "--method <method>",
          description: "login method",
          takes_value: true,
          mandatory: false,
        },
      ],
      after: [
        {
          flags: "--agent <agent>",
          description: "install the skill for this agent; asks at a terminal, otherwise none",
          takes_value: true,
          mandatory: false,
          choices: ["none", "codex", "cursor", "claude", "gemini", "all"],
        },
        {
          flags: "--method <method>",
          description: "how to log in when there is no session",
          takes_value: true,
          mandatory: false,
          choices: ["qr", "phone"],
          default: "qr",
        },
      ],
      reason:
        "This provider binds its own account linking protocol, credential flow and typed receipt to the shared setup lifecycle.",
    },
    {
      command: ["setup"],
      field: "output",
      before: null,
      after: {
        entity: "setup",
      },
      reason:
        "This provider binds its own account linking protocol, credential flow and typed receipt to the shared setup lifecycle.",
    },
    {
      command: ["setup"],
      field: "examples",
      before: null,
      after: ["wa personal setup", "wa personal setup --agent codex", "wa personal setup --agent claude --json"],
      reason:
        "This provider binds its own account linking protocol, credential flow and typed receipt to the shared setup lifecycle.",
    },
  ],
  session: [
    {
      command: ["session"],
      field: "description",
      before: "link this account, or end its login",
      after: "link this profile to WhatsApp as a device, or unlink it",
      reason:
        "This provider binds its own account linking protocol, credential flow and typed receipt to the shared session lifecycle.",
    },
    {
      command: ["session"],
      field: "effects",
      before: {
        remote: "none",
        local: "none",
      },
      after: null,
      reason:
        "This provider binds its own account linking protocol, credential flow and typed receipt to the shared session lifecycle.",
    },
    {
      command: ["session", "start"],
      field: "description",
      before: "link this account",
      after: "link by QR code (default) or a pairing code, then keep the pushed history",
      reason:
        "This provider binds its own account linking protocol, credential flow and typed receipt to the shared session lifecycle.",
    },
    {
      command: ["session", "start"],
      field: "arguments",
      before: [
        {
          name: "method",
          required: false,
          variadic: false,
          description: "login method",
        },
      ],
      after: [
        {
          name: "method",
          required: false,
          variadic: false,
          description: "how to link",
          choices: ["qr", "phone"],
          default: "qr",
        },
      ],
      reason:
        "This provider binds its own account linking protocol, credential flow and typed receipt to the shared session lifecycle.",
    },
    {
      command: ["session", "start"],
      field: "output",
      before: null,
      after: {
        entity: "session",
      },
      reason:
        "This provider binds its own account linking protocol, credential flow and typed receipt to the shared session lifecycle.",
    },
    {
      command: ["session", "start"],
      field: "examples",
      before: null,
      after: ["wa personal session start", "wa personal session start phone"],
      reason:
        "This provider binds its own account linking protocol, credential flow and typed receipt to the shared session lifecycle.",
    },
    {
      command: ["session", "end"],
      field: "description",
      before: "end this account's login",
      after: "unlink this device on WhatsApp's side and delete its keys here",
      reason:
        "This provider binds its own account linking protocol, credential flow and typed receipt to the shared session lifecycle.",
    },
    {
      command: ["session", "end"],
      field: "output",
      before: null,
      after: {
        entity: "session",
      },
      reason:
        "This provider binds its own account linking protocol, credential flow and typed receipt to the shared session lifecycle.",
    },
    {
      command: ["session", "end"],
      field: "examples",
      before: null,
      after: ["wa personal session end"],
      reason:
        "This provider binds its own account linking protocol, credential flow and typed receipt to the shared session lifecycle.",
    },
  ],
}
