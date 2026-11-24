param(
  [ValidateSet('assembleDebug', 'assembleRelease', 'bundleRelease')]
  [string]$Task = 'assembleDebug'
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$AndroidDir = Join-Path $ProjectRoot 'android'
$LocalToolchainFile = Join-Path $AndroidDir 'toolchain.local.json'

# Load optional gitignored local toolchain paths (JAVA_HOME / ANDROID_HOME)
if (Test-Path $LocalToolchainFile) {
  $cfg = Get-Content -Raw $LocalToolchainFile | ConvertFrom-Json
  if (-not $env:JAVA_HOME -and $cfg.javaHome -and (Test-Path $cfg.javaHome)) {
    $env:JAVA_HOME = $cfg.javaHome
  }
  if (-not $env:ANDROID_HOME -and $cfg.androidHome -and (Test-Path $cfg.androidHome)) {
    $env:ANDROID_HOME = $cfg.androidHome
    $env:ANDROID_SDK_ROOT = $cfg.androidHome
  }
}

# Fallback to standard Windows Android SDK install location when ANDROID_HOME isn't set
if (-not $env:ANDROID_HOME -and $env:LOCALAPPDATA) {
  $StdSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
  if (Test-Path $StdSdk) {
    $env:ANDROID_HOME = $StdSdk
    $env:ANDROID_SDK_ROOT = $StdSdk
  }
}

if (-not $env:JAVA_HOME -or -not (Test-Path $env:JAVA_HOME)) {
  throw "JAVA_HOME not found. Install JDK 21 and set JAVA_HOME (or create gitignored android/toolchain.local.json)."
}
if (-not $env:ANDROID_HOME -or -not (Test-Path $env:ANDROID_HOME)) {
  throw "ANDROID_HOME not found. Install Android SDK 36 and set ANDROID_HOME (or create gitignored android/toolchain.local.json)."
}

$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

# If building a release without plaintext signing.properties or env vars, prompt securely in memory
$SigningPropsFile = Join-Path $AndroidDir 'signing.properties'
$DefaultKeystore = Join-Path $env:USERPROFILE '.athar-signing\athar-release.jks'
$PromptedSigning = $false

if (
  $Task -in @('assembleRelease', 'bundleRelease') -and
  -not (Test-Path $SigningPropsFile) -and
  -not $env:ATHAR_STORE_PASSWORD -and
  (Test-Path $DefaultKeystore)
) {
  $sec = Read-Host 'Enter Athar release keystore password' -AsSecureString
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try {
    $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  $env:ATHAR_STORE_FILE = $DefaultKeystore
  $env:ATHAR_KEY_ALIAS = 'athar-release'
  $env:ATHAR_STORE_PASSWORD = $plain
  $env:ATHAR_KEY_PASSWORD = $plain
  $plain = $null
  $PromptedSigning = $true
}

Push-Location $ProjectRoot
try {
  Write-Host "==> Building web bundle..."
  npm.cmd run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "==> Syncing Capacitor Android project..."
  npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $SdkEscaped = $env:ANDROID_HOME.Replace('\', '\\').Replace(':', '\:')
  Set-Content -Path (Join-Path $AndroidDir 'local.properties') -Value "sdk.dir=$SdkEscaped" -Encoding ASCII

  Write-Host "==> Running Gradle :app:$Task (minSdk 24, targetSdk 36)..."
  Push-Location $AndroidDir
  try {
    & .\gradlew.bat $Task --no-daemon
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }
} finally {
  if ($PromptedSigning) {
    Remove-Item Env:ATHAR_STORE_FILE, Env:ATHAR_KEY_ALIAS, Env:ATHAR_STORE_PASSWORD, Env:ATHAR_KEY_PASSWORD -ErrorAction SilentlyContinue
  }
  Pop-Location
}
