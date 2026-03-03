# 시크릿/API 키 설정 가이드

Google API 키 노출 알림을 해결하기 위해 Firebase 설정 파일은 Git에 커밋하지 않습니다.

## 1. 로컬 개발 / 로컬 빌드

Firebase Console에서 다운로드한 `google-services.json`과 `GoogleService-Info.plist`를 **프로젝트 루트**에 두세요.

- [Firebase Console](https://console.firebase.google.com/) → 프로젝트 선택 → 프로젝트 설정
- Android: `google-services.json` 다운로드
- iOS: `GoogleService-Info.plist` 다운로드

이 파일들은 `.gitignore`에 포함되어 있으므로 커밋되지 않습니다.

## 2. EAS 빌드 (클라우드)

EAS Build(클라우드)를 사용할 때는 아래 시크릿을 등록해야 합니다.

### 시크릿 등록 (한 번만 실행)

```bash
# Linux/macOS
eas secret:create --name GOOGLE_SERVICES_JSON_B64 --value "$(base64 -w0 google-services.json)" --scope project
eas secret:create --name GOOGLE_SERVICE_INFO_PLIST_B64 --value "$(base64 -w0 GoogleService-Info.plist)" --scope project
```

```powershell
# Windows PowerShell
$json = [Convert]::ToBase64String([IO.File]::ReadAllBytes("google-services.json"))
eas secret:create --name GOOGLE_SERVICES_JSON_B64 --value $json --scope project

$plist = [Convert]::ToBase64String([IO.File]::ReadAllBytes("GoogleService-Info.plist"))
eas secret:create --name GOOGLE_SERVICE_INFO_PLIST_B64 --value $plist --scope project
```

빌드 시 `scripts/setup-google-services.js`가 이 시크릿을 디코딩하여 필요한 파일을 생성합니다.

## 2-1. EAS 로컬 빌드 (WSL 등)

로컬 빌드 시에는 환경 변수로 전달하세요.

```bash
# WSL/Linux/macOS
export GOOGLE_SERVICES_JSON_B64=$(base64 -w0 google-services.json)
export GOOGLE_SERVICE_INFO_PLIST_B64=$(base64 -w0 GoogleService-Info.plist)
eas build --local --platform android --profile preview --non-interactive
```

## 3. Google Cloud Console에서 API 키 제한 (필수)

노출된 API 키는 **반드시 제한 설정**하거나 **재발급**해야 합니다.

1. [Google Cloud Console](https://console.cloud.google.com/) → API 및 서비스 → 사용자 인증 정보
2. 해당 API 키 선택 → **제한** 탭
3. **애플리케이션 제한**:
   - Android: 앱 패키지명 `com.jiwonjae.dailyglow` + SHA-1 지문 추가
   - iOS: 번들 ID `com.jiwonjae.dailyglow` 추가
4. **API 제한**: Firebase/필요한 API만 허용

또는 **키 재발급** 후 새 키로 위 파일들을 업데이트하고, 이전 키는 비활성화/삭제하세요.
