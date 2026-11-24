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
  Pop-Location
}
