# Windows에서 WSL로 Android APK 로컬 빌드하기

`eas build --local`은 **Windows를 지원하지 않습니다**. macOS 또는 Linux가 필요합니다.  
Windows에서는 **WSL2(Windows Subsystem for Linux)**를 사용해 로컬 빌드가 가능합니다.

---

## 1단계: WSL2 + Ubuntu 설치

이미 WSL이 있다면 건너뛰세요.

```powershell
wsl --install -d Ubuntu
```

설치 후 PC를 재시작하고, Ubuntu를 처음 실행할 때 사용자명/비밀번호를 설정합니다.

---

## 2단계: WSL Ubuntu에서 환경 설정

**Windows PowerShell**에서 WSL Ubuntu 셸을 엽니다:

```powershell
wsl -d Ubuntu
```

이제 **Ubuntu 터미널**에서 아래 명령을 순서대로 실행합니다.

### 2-1. Node.js (nvm)

```bash
# nvm 설치
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc

# Node 20 설치
nvm install 20
nvm use 20
node -v   # v20.x 확인
```

### 2-2. Java 17

```bash
sudo apt-get update
sudo apt-get install -y openjdk-17-jdk

export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
```

### 2-3. Android SDK

```bash
mkdir -p ~/Android/Sdk/cmdline-tools/latest
cd /tmp
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdtools.zip
unzip -o cmdtools.zip
# 압축 해제 구조에 따라 다음 중 하나 실행
mv cmdline-tools/* ~/Android/Sdk/cmdline-tools/latest/ 2>/dev/null || mv cmdline-tools/bin cmdline-tools/lib cmdline-tools/*.txt cmdline-tools/*.properties ~/Android/Sdk/cmdline-tools/latest/ 2>/dev/null
rm -rf cmdline-tools cmdtools.zip

export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
echo 'export ANDROID_HOME=$HOME/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools' >> ~/.bashrc
source ~/.bashrc
```

### 2-4. SDK 컴포넌트 설치

```bash
yes | sdkmanager --sdk_root=$ANDROID_HOME "platform-tools"
yes | sdkmanager --sdk_root=$ANDROID_HOME "platforms;android-35"
yes | sdkmanager --sdk_root=$ANDROID_HOME "build-tools;35.0.0"
# NDK: 사용 가능한 버전 설치
yes | sdkmanager --sdk_root=$ANDROID_HOME "ndk;26.1.10909125"

# Ninja + CMake (네이티브 C++ 빌드에 필수 - "Could not find Ninja" 오류 해결)
sudo apt-get install -y ninja-build cmake
```

---

## 3단계: 빌드 실행

프로젝트가 `C:\Users\최원집\Documents\코드\Project-Good-Vibes`에 있다면:

```bash
# WSL Ubuntu 터미널에서
cd /mnt/c/Users/최원집/Documents/코드/Project-Good-Vibes

# 환경 변수 설정 (같은 셸에서)
export ANDROID_HOME=$HOME/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# eas-cli 전역 설치 (npx eas 오류 시)
npm install -g eas-cli

# Firebase 설정 파일이 프로젝트 루트에 있어야 합니다 (gitignored)
# 없으면 Firebase Console에서 google-services.json, GoogleService-Info.plist 다운로드

# .env 필수: EXPO_PUBLIC_FIREBASE_API_KEY가 .env에 있어야 합니다.
# (로컬 빌드는 EAS Secret 미적용, eas.json env에도 키가 없음)

# eas.json 패치 (API 키 주입) 후 빌드
node scripts/prepare-eas-local.js
npm install
eas build --local --platform android --profile preview --non-interactive
# 빌드 후 eas.json 복원
[ -f eas.json.bak ] && cp eas.json.bak eas.json && rm eas.json.bak
```

또는 **PowerShell에서** 한 번에 실행:
```powershell
npm run build:android:wsl
```

빌드가 끝나면 APK가 프로젝트 루트에 생성됩니다.

---

## 자동 설정 스크립트

WSL Ubuntu 터미널에서 다음을 실행하면 위 설정을 한 번에 수행합니다  
(비밀번호 입력 등이 필요할 수 있음):

```bash
cd /mnt/c/Users/최원집/Documents/코드/Project-Good-Vibes
bash scripts/setup-wsl-android-build.sh
```

---

## 대안: EAS 클라우드 빌드

WSL 설정이 부담스러우면, 로컬 빌드 없이 **EAS 클라우드 빌드**를 사용할 수 있습니다:

```powershell
npm run build:android:local   # Windows에서는 실패
npx eas build --platform android --profile preview  # 클라우드 빌드 (--local 제외)
```

클라우드 빌드는 Windows에서 그대로 동작합니다.
