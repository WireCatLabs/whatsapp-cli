param([Parameter(Mandatory = $true)][string] $Tarball, [Parameter(Mandatory = $true)][string] $EngineTarball)
$ErrorActionPreference = 'Stop'
$testRoot = Join-Path $env:RUNNER_TEMP 'wa ready install'
$prefix = Join-Path $testRoot 'npm prefix'
$secondPrefix = Join-Path $testRoot 'npm ignored scripts'
$env:CI = 'true'
$env:WA_CONFIG_DIR = Join-Path $testRoot 'config'
$env:WA_STATE_DIR = Join-Path $testRoot 'state'
$env:WA_CACHE_DIR = Join-Path $testRoot 'cache'
$env:MESSAGING_STORE = Join-Path $testRoot 'messages.db'
$env:WA_INSTALL_AGENT = 'all'
$env:WA_NO_UPDATE_CHECK = '1'
Remove-Item Env:WA_ENGINE -ErrorAction SilentlyContinue
$node = (Get-Command node | Select-Object -First 1).Source
$powershell = (Get-Command powershell.exe | Select-Object -First 1).Source
$nodeDirectory = Split-Path $node -Parent
$key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Environment')
$sentinel = '%LOCALAPPDATA%\WireCat existing folder'
$key.SetValue('Path', $sentinel, [Microsoft.Win32.RegistryValueKind]::ExpandString)
$key.Dispose()
if (Get-Command wa -ErrorAction SilentlyContinue) { throw 'Expected wa to be absent before install.' }

# The actual packed npm lifecycle hook must persist PATH and install skills without login. The engine package goes
# in the same install, because the engine of an unreleased version is not on npm yet.
& npm.cmd install --global --prefix $prefix --allow-scripts=@wirecat/whatsapp-cli --foreground-scripts $Tarball $EngineTarball
if ($LASTEXITCODE -ne 0) { throw 'Packed global npm install failed.' }
$goEngine = [Uri]::new((Join-Path $prefix 'node_modules/@wirecat/whatsapp-cli/dist/engine/go-engine.js')).AbsoluteUri
$engine = & $node --input-type=module -e "import('$goEngine').then((m) => console.log(m.engineBinary()))"
if ($LASTEXITCODE -ne 0 -or $engine -notmatch 'whatsapp-engine-win32-') { throw 'The engine package did not resolve.' }
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
if ((& $engine --version) -ne $version) { throw 'The installed engine did not run, or is another version.' }
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment')
$userPath = [string] $key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
$kind = $key.GetValueKind('Path')
$key.Dispose()
if (-not $userPath.Contains($sentinel) -or -not $userPath.Contains($prefix)) { throw 'User PATH was lost or not repaired.' }
if ($kind -ne [Microsoft.Win32.RegistryValueKind]::ExpandString) { throw 'PATH registry type changed.' }
foreach ($dir in @('.agents', '.claude')) {
    $file = Join-Path $env:USERPROFILE "$dir/skills/whatsapp-cli/SKILL.md"
    if (-not (Test-Path $file) -or (Get-Content $file -Raw) -notmatch 'name: whatsapp-cli') { throw 'Install did not install the skill.' }
}
if (Test-Path (Join-Path $prefix 'wa.ps1')) { throw 'Unsigned PowerShell shim still shadows wa.cmd.' }

# Rebuild PATH from persistent registry values, not the installer or npm process environment.
$env:Path = [Environment]::ExpandEnvironmentVariables("$([Environment]::GetEnvironmentVariable('Path', 'Machine'));$userPath")
& $powershell -NoProfile -ExecutionPolicy Restricted -Command 'wa --version; if ($LASTEXITCODE -ne 0) { exit 1 }; wa skill show | Out-Null; if ($LASTEXITCODE -ne 0) { exit 1 }'
if ($LASTEXITCODE -ne 0) { throw 'Fresh restricted PowerShell cannot run bare wa.' }

$installer = Join-Path $prefix 'node_modules/@wirecat/whatsapp-cli/install/windows.ps1'
$before = $userPath
& $installer -RepairOnly -Prefix $prefix -NodeDirectory $nodeDirectory -Json
if ($LASTEXITCODE -ne 0) { throw 'Repeated PATH repair failed.' }
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment')
$after = [string] $key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
$key.Dispose()
if ($before -cne $after) { throw 'Repeated repair duplicated or rewrote PATH.' }

# Explicit installer must complete even when npm lifecycle scripts are disabled.
$env:npm_config_ignore_scripts = 'true'
$result = & $installer -Prefix $secondPrefix -PackageSpec $Tarball -Agent codex -Json
if ($LASTEXITCODE -ne 0) { throw 'Installer did not handle disabled lifecycle scripts.' }
$result = ($result -join "`n") | ConvertFrom-Json
if ($result.tool -ne 'wa' -or $result.written.Count -ne 1) { throw 'Installer result is incomplete.' }
& wa --version
if ($LASTEXITCODE -ne 0) { throw 'Current shell cannot run bare wa after installer.' }

# Windows' built-in PowerShell 5.1 must also complete npm installation despite stderr warnings.
Remove-Item Env:npm_config_ignore_scripts
$env:WA_TEST_INSTALLER = $installer
$env:WA_TEST_TARBALL = $Tarball
$env:WA_TEST_PREFIX = Join-Path $testRoot 'npm Windows PowerShell 51'
$agentDirectory = if ($env:HOME) { $env:HOME } else { $env:USERPROFILE }
$claudeSkill = Join-Path $agentDirectory '.claude/skills/whatsapp-cli/SKILL.md'
$claudeTime = (Get-Item $claudeSkill).LastWriteTimeUtc
$code = '& $env:WA_TEST_INSTALLER -Prefix $env:WA_TEST_PREFIX -PackageSpec $env:WA_TEST_TARBALL -Agent codex -Json'
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code))
$native = & $powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded
if ($LASTEXITCODE -ne 0) { throw 'PowerShell 5.1 installation failed.' }
$native = ($native -join "`n") | ConvertFrom-Json
if ($native.tool -ne 'wa' -or $native.written.Count -ne 1) { throw 'PowerShell 5.1 installer result is incomplete.' }
if ((Get-Item $claudeSkill).LastWriteTimeUtc -ne $claudeTime) { throw 'Codex-only installation rewrote the Claude skill.' }
Write-Output 'PASS: persistent/current PATH, engine resolved and run, restricted shell, skills, repeat, disabled scripts, full PowerShell 5.1 installation'
