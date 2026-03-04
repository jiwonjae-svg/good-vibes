#!/bin/bash
# WSL 환경에서 EAS 로컬 Android 빌드를 위한 설정 스크립트
# 사용법: wsl -d Ubuntu -e bash ./scripts/setup-wsl-android-build.sh

set -e

echo "=== WSL Android 빌드 환경 설정 ==="

# 1. Node.js 설치 (nvm 사용)
if ! command -v node &> /dev/null; then
  echo "Node.js 설치 중..."
  export NVM_DIR="$HOME/.nvm"
  if [ ! -d "$NVM_DIR" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    . "$NVM_DIR/nvm.sh"
  fi
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
fi
echo "Node: $(node -v), npm: $(npm -v)"

# 2. Java 17 설치
if [ ! -d /usr/lib/jvm/java-17-openjdk-amd64 ]; then
  echo "Java 17 설치 중..."
  sudo apt-get update -qq
  sudo apt-get install -y openjdk-17-jdk
fi
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
echo "Java: $(java -version 2>&1 | head -1)"

# 3. Android SDK 설치
ANDROID_HOME="$HOME/Android/Sdk"
if [ ! -f "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "Android command-line tools 설치 중..."
  mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
  cd /tmp
  rm -rf cmdtools cmdline-tools cmdtools.zip 2>/dev/null || true
  wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdtools.zip
  unzip -q -o cmdtools.zip -d cmdtools
  # 구조: cmdtools/cmdline-tools/{bin,lib,...} -> ANDROID_HOME/cmdline-tools/latest/
  if [ -d "cmdtools/cmdline-tools" ]; then
    cp -r cmdtools/cmdline-tools/* "$ANDROID_HOME/cmdline-tools/latest/"
  else
    cp -r cmdtools/* "$ANDROID_HOME/cmdline-tools/latest/"
  fi
  rm -rf cmdtools cmdtools.zip
  cd -
fi

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# 4. Ninja + CMake (네이티브 빌드에 필수)
if ! command -v ninja &> /dev/null; then
  echo "Ninja 설치 중..."
  sudo apt-get update -qq
  sudo apt-get install -y ninja-build cmake
fi
echo "Ninja: $(ninja --version 2>/dev/null || echo 'installed')"

# 5. Android SDK 컴포넌트 설치
echo "Android SDK 컴포넌트 설치 중..."
yes | sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools"
yes | sdkmanager --sdk_root="$ANDROID_HOME" "platforms;android-35"
yes | sdkmanager --sdk_root="$ANDROID_HOME" "build-tools;35.0.0"
# NDK: 27.1.12297018이 없으면 26.1.10909125 또는 25.2.9519653 시도
yes | sdkmanager --sdk_root="$ANDROID_HOME" "ndk;26.1.10909125" 2>/dev/null || \
yes | sdkmanager --sdk_root="$ANDROID_HOME" "ndk;25.2.9519653" 2>/dev/null || \
yes | sdkmanager --sdk_root="$ANDROID_HOME" "ndk"

# 4. 환경 변수 저장
BASHRC="$HOME/.bashrc"
grep -q "ANDROID_HOME" "$BASHRC" || echo "export ANDROID_HOME=$ANDROID_HOME" >> "$BASHRC"
grep -q "JAVA_HOME" "$BASHRC" || echo "export JAVA_HOME=$JAVA_HOME" >> "$BASHRC"
grep -q "PATH.*ANDROID_HOME" "$BASHRC" || echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin' >> "$BASHRC"

# 6. eas-cli 전역 설치
npm install -g eas-cli 2>/dev/null || true

echo ""
echo "=== 설정 완료! ==="
echo "다음 명령으로 빌드하세요:"
echo "  wsl -d Ubuntu"
echo "  cd /mnt/c/Users/최원집/Documents/코드/Project-Good-Vibes"
echo "  export ANDROID_HOME=\$HOME/Android/Sdk"
echo "  export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64"
echo "  npm install"
echo "  eas build --local --platform android --profile preview"
echo ""
echo "또는: npm install -g eas-cli (npx eas 오류 시)"
