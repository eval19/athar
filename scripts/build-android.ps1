param(
  [ValidateSet('assembleDebug', 'assembleRelease', 'bundleRelease')]
  [string]$Task = 'assembleDebug'
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ParentDir = Split-Path -Parent $ProjectRoot
$AndroidDir = Join-Path $ProjectRoot 'android'

# Resolve JDK 21 (prefer JAVA_HOME if set, else optional sibling local toolchain)
$DefaultJdk = Join-Path $ParentDir 'muajjin\.tools\jdk-21.0.12.1+1'
if (-not $env:JAVA_HOME -and (Test-Path $DefaultJdk)) {
  $env:JAVA_HOME = $DefaultJdk
}

# Resolve Android SDK 36 (prefer ANDROID_HOME if set, else optional sibling local toolchain)
$DefaultSdk = Join-Path $ParentDir 'muajjin\.tools\android-sdk'
if (-not $env:ANDROID_HOME -and (Test-Path $DefaultSdk)) {
  $env:ANDROID_HOME = $DefaultSdk
  $env:ANDROID_SDK_ROOT = $DefaultSdk
}

if (-not $env:JAVA_HOME -or -not (Test-Path $env:JAVA_HOME)) {
  throw "JAVA_HOME not found. Install JDK 21 or set JAVA_HOME."
}
if (-not $env:ANDROID_HOME -or -not (Test-Path $env:ANDROID_HOME)) {
  throw "ANDROID_HOME not found. Install Android SDK 36 or set ANDROID_HOME."
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
