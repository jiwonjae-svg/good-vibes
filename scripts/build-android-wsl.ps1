# Windows PowerShell: WSL을 통해 Android APK 로컬 빌드
# 사용법: .\scripts\build-android-wsl.ps1

$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$drive = $ProjectPath.Substring(0,1).ToLower()
$rest = $ProjectPath.Substring(3) -replace '\\', '/'
$WslPath = "/mnt/$drive/$rest"

Write-Host "=== WSL을 통한 Android 로컬 빌드 ===" -ForegroundColor Cyan
Write-Host "프로젝트 경로 (WSL): $WslPath"
Write-Host ""

# WSL에서 빌드 실행
wsl -d Ubuntu -e bash -c @"
export ANDROID_HOME=`$HOME/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=`$PATH:`$ANDROID_HOME/platform-tools:`$ANDROID_HOME/cmdline-tools/latest/bin

cd '$WslPath' || exit 1

# .env의 EXPO_PUBLIC_FIREBASE_API_KEY를 eas.local.json에 주입
# (EAS 로컬 빌드는 eas.json의 env만 사용, 셸 환경변수 미적용)
node scripts/prepare-eas-local.js || exit 1

# Firebase 설정 파일을 env로 주입 (로컬 빌드용, Android는 google-services.json만 필요)
if [ -f google-services.json ]; then
  export GOOGLE_SERVICES_JSON_B64=$(base64 -w0 google-services.json)
  [ -f GoogleService-Info.plist ] && export GOOGLE_SERVICE_INFO_PLIST_B64=$(base64 -w0 GoogleService-Info.plist)
  export EAS_BUILD=true
fi

if ! command -v node &> /dev/null; then
  echo 'Node.js가 WSL에 설치되지 않았습니다.'
  echo '먼저 scripts/setup-wsl-android-build.sh 를 WSL에서 실행하세요.'
  echo '  wsl -d Ubuntu'
  echo '  bash /mnt/c/Users/최원집/Documents/코드/Project-Good-Vibes/scripts/setup-wsl-android-build.sh'
  exit 1
fi

npm install --silent
eas build --local --platform android --profile preview --non-interactive
BUILD_EXIT=$?
[ -f eas.json.bak ] && cp eas.json.bak eas.json && rm eas.json.bak
exit $BUILD_EXIT
"@
