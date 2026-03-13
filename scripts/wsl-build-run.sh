#!/bin/bash
. "$HOME/.nvm/nvm.sh"
export ANDROID_HOME="$HOME/Android/Sdk"
export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools/bin:$ANDROID_HOME/tools:$ANDROID_HOME/emulator:$PATH"
cd /mnt/c/Users/최원집/Documents/코드/Project-Good-Vibes
node scripts/prepare-eas-local.js
eas build --local --platform android --profile preview
