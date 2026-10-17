import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { statSync } from "node:fs"

export const assertPrivate = (path: string, unixMode: number): void => {
  if (process.platform !== "win32") {
    assert.equal(statSync(path).mode & 0o777, unixMode)
    return
  }
  const script = `
$ErrorActionPreference = 'Stop'
$owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$allowed = @($owner, 'S-1-5-18', 'S-1-5-32-544')
$path = $env:WA_TEST_PRIVATE_PATH
$acl = if (([System.IO.File]::GetAttributes($path) -band [System.IO.FileAttributes]::Directory) -ne 0) {
  [System.IO.Directory]::GetAccessControl($path)
} else {
  [System.IO.File]::GetAccessControl($path)
}
$rules = $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
foreach ($rule in $rules) {
  if ($rule.AccessControlType -eq 'Allow' -and
      ($rule.PropagationFlags -band [System.Security.AccessControl.PropagationFlags]::InheritOnly) -eq 0 -and
      ($rule.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::ReadData) -ne 0 -and
      $rule.IdentityReference.Value -notin $allowed) {
    throw 'fixture is readable by another principal'
  }
}
`
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
    {
      env: { ...process.env, WA_TEST_PRIVATE_PATH: path },
      stdio: "pipe",
      windowsHide: true,
    },
  )
}
