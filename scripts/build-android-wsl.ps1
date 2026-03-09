# Windows PowerShell: WSL을 통해 Android APK 로컬 빌드
# 사용법: .\scripts\build-android-wsl.ps1

$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$drive = $ProjectPath.Substring(0,1).ToLower()
$rest = $ProjectPath.Substring(3) -replace '\\', '/'
$WslPath = "/mnt/$drive/$rest"

Write-Host "=== WSL을 통한 Android 로컬 빌드 ===" -ForegroundColor Cyan
Write-Host "프로젝트 경로 (WSL): $WslPath"
Write-Host ""

# ── 임시 bash 스크립트를 파일로 작성 (PowerShell 변수 확장 방지) ──────────
$TempScript = "$env:TEMP\dailyglow_build.sh"

# @'...'@ 을 사용해 PowerShell이 내부 $ 를 전혀 건드리지 않게 함
$BashContent = @'
#!/bin/bash
set -e

# nvm / node 초기화
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# Android / Java 환경
export ANDROID_HOME="$HOME/Android/Sdk"
export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"

# 프로젝트 디렉토리로 이동 (경로는 아래 sed 로 치환됨)
cd 'WSLPATH_PLACEHOLDER' || exit 1

if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js가 WSL에 설치되지 않았습니다."
  echo "먼저 scripts/setup-wsl-android-build.sh 를 WSL Ubuntu 에서 실행하세요."
  exit 1
fi

# eas.json 에 API 키 주입
node scripts/prepare-eas-local.js || exit 1

# Firebase 설정 파일 base64 인코딩 (EAS 로컬 빌드에 필요)
if [ -f google-services.json ]; then
  export GOOGLE_SERVICES_JSON_B64=$(base64 -w0 google-services.json)
  export EAS_BUILD=true
fi
if [ -f GoogleService-Info.plist ]; then
  export GOOGLE_SERVICE_INFO_PLIST_B64=$(base64 -w0 GoogleService-Info.plist)
fi

npm install --silent
eas build --local --platform android --profile preview --non-interactive
BUILD_EXIT=$?

[ -f eas.json.bak ] && cp eas.json.bak eas.json && rm eas.json.bak
exit $BUILD_EXIT
'@

# WSLPATH_PLACEHOLDER 를 실제 경로로 교체
$BashContent = $BashContent -replace 'WSLPATH_PLACEHOLDER', $WslPath

# LF 줄끝으로 저장 (bash 에서 \r 오류 방지)
[System.IO.File]::WriteAllText($TempScript, ($BashContent -replace "`r`n", "`n"))

Write-Host "빌드 스크립트 작성 완료: $TempScript" -ForegroundColor Gray

# ── WSL 에서 실행 ─────────────────────────────────────────────────────────────
$WslTempScript = "/mnt/" + $TempScript.Substring(0,1).ToLower() + "/" + ($TempScript.Substring(3) -replace '\\', '/')

wsl -d Ubuntu bash "$WslTempScript"
$ExitCode = $LASTEXITCODE

Remove-Item $TempScript -ErrorAction SilentlyContinue

if ($ExitCode -eq 0) {
  Write-Host ""
  Write-Host "=== 빌드 성공! ===" -ForegroundColor Green
  Write-Host "APK 파일이 프로젝트 루트에 생성됐습니다." -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "=== 빌드 실패 (exit code: $ExitCode) ===" -ForegroundColor Red
}

exit $ExitCode
