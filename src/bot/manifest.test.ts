import { describe, expect, it } from "vitest"
import { operations } from "./generated/manifest.js"

const byCommand = (command: string) => operations.find((operation) => operation.command === command)

describe("the generated Cloud API manifest", () => {
  it("never offers the Graph version as a flag", () => {
    expect(
      operations.flatMap((operation) => operation.parameters).some((parameter) => parameter.name === "Version"),
    ).toBe(false)
  })

  it("asks before registering a number, which deletes its WhatsApp account on the phone", () => {
    expect(byCommand("register-phone-number")?.effect).toBe("destructive")
    expect(byCommand("deregister-phone-number")?.effect).toBe("destructive")
  })

  it("lets the profile's settings fill the phone number and account ids", () => {
    const send = byCommand("send-message")
    expect(send?.parameters.find((parameter) => parameter.name === "Phone-Number-ID")?.required).toBe(false)
    expect(byCommand("list-templates")?.parameters.find((parameter) => parameter.name === "WABA-ID")?.required).toBe(
      false,
    )
  })

  it("uploads media as multipart and leaves out partner-only, Groups and Flows operations", () => {
    expect(byCommand("upload-media")?.request?.contentType).toBe("multipart/form-data")
    for (const gone of ["create-group", "create-flow", "get-solution-access-token", "download-media"])
      expect(byCommand(gone)).toBeUndefined()
  })
})
