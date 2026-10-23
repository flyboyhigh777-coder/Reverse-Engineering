#!/usr/bin/env bash
# Builds a signed FastLoop APK without the Google-hosted Android SDK.
#
# dl.google.com is unreachable from this environment, so the toolchain is
# assembled from artifacts that are reachable:
#   aapt2             — the linux binary bundled inside org.apktool:apktool-lib
#   android framework — the resource jar bundled in the same artifact (aapt2 -I)
#   android.jar       — org.robolectric:android-all, used only as javac's bootclasspath
#   dx                — com.jakewharton.android.repackaged:dalvik-dx
#   apksig            — com.android.tools.build:apksig
#
# Usage: ./build-apk.sh [output.apk]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$(dirname "$HERE")"
KIT="${FASTLOOP_ANDROID_KIT:-$HOME/.fastloop-android-kit}"
OUT="${1:-$APP/build/fastloop.apk}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Kept level with the Gradle build, which Health Connect raised to 26.
MIN_SDK=26
TARGET_SDK=34
CENTRAL=https://repo1.maven.org/maven2

say() { printf '\033[36m%s\033[0m\n' "$*"; }

# ---------------------------------------------------------------- toolchain
if [ ! -x "$KIT/bin/aapt2" ]; then
  say "Собираю тулчейн в $KIT"
  mkdir -p "$KIT/bin" "$KIT/libs"
  APKTOOL_VERSION=3.0.3
  curl -fsS -o "$KIT/apktool-lib.jar" \
    "$CENTRAL/org/apktool/apktool-lib/$APKTOOL_VERSION/apktool-lib-$APKTOOL_VERSION.jar"
  unzip -o -q "$KIT/apktool-lib.jar" prebuilt/linux/aapt2 prebuilt/android-framework.jar -d "$KIT"
  mv "$KIT/prebuilt/linux/aapt2" "$KIT/bin/aapt2"
  mv "$KIT/prebuilt/android-framework.jar" "$KIT/libs/android-framework.jar"
  rm -rf "$KIT/prebuilt"
  chmod +x "$KIT/bin/aapt2"
  curl -fsS -o "$KIT/libs/dalvik-dx.jar" \
    "$CENTRAL/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar"
  curl -fsS -o "$KIT/libs/apksig.jar" \
    "$CENTRAL/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar"
  curl -fsS -o "$KIT/libs/android-all.jar" \
    "$CENTRAL/org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar"
fi

AAPT2="$KIT/bin/aapt2"
FRAMEWORK="$KIT/libs/android-framework.jar"
ANDROID_JAR="$KIT/libs/android-all.jar"

command -v javac >/dev/null || { echo "Нужен JDK: javac не найден" >&2; exit 1; }

# ------------------------------------------------------------------ web app
if [ ! -f "$APP/dist/index.html" ]; then
  say "Собираю веб-приложение"
  (cd "$APP" && npm run build)
fi
mkdir -p "$WORK/assets"
cp "$APP/dist/index.html" "$WORK/assets/index.html"

# ---------------------------------------------------------------- resources
say "Компилирую ресурсы"
mkdir -p "$WORK/res-compiled"
"$AAPT2" compile --dir "$HERE/res" -o "$WORK/res-compiled/res.zip"

say "Линкую пакет"
"$AAPT2" link \
  -o "$WORK/base.apk" \
  -I "$FRAMEWORK" \
  --manifest "$HERE/AndroidManifest.xml" \
  -R "$WORK/res-compiled/res.zip" \
  -A "$WORK/assets" \
  --min-sdk-version "$MIN_SDK" \
  --target-sdk-version "$TARGET_SDK" \
  --java "$WORK/gen" \
  --auto-add-overlay

# --------------------------------------------------------------------- code
say "Компилирую Java"
mkdir -p "$WORK/classes" "$WORK/gen"
# --release 8 keeps the bytecode at class-file 52, which is what dx accepts.
# The framework comes from the classpath; android-all.jar carries no java.*,
# so it cannot serve as a bootclasspath.
find "$HERE/src" "$WORK/gen" -name '*.java' > "$WORK/sources.txt"
( cd "$WORK" && javac -nowarn --release 8 -cp "$ANDROID_JAR" -d "$WORK/classes" "@$WORK/sources.txt" )

say "Дексую"
java -cp "$KIT/libs/dalvik-dx.jar" com.android.dx.command.Main \
  --dex --min-sdk-version="$MIN_SDK" --output="$WORK/classes.dex" "$WORK/classes"

# ------------------------------------------------------------------ package
say "Упаковываю"
python3 - "$WORK/base.apk" "$WORK/classes.dex" "$WORK/unsigned.apk" <<'PY'
import shutil, sys, zipfile
base, dex, out = sys.argv[1:4]
shutil.copyfile(base, out)
with zipfile.ZipFile(out, 'a', zipfile.ZIP_DEFLATED) as zf:
    zf.write(dex, 'classes.dex')
PY

# ------------------------------------------------------------------- signing
# Android refuses an update whose signing certificate differs from the one
# already installed. The key is therefore derived from a fixed seed in
# tools/KeyGen.java rather than generated at random, so every container
# produces the same certificate and builds keep updating each other. The
# fingerprint is asserted here: a silent change would produce an APK that
# cannot be installed over the previous one, which is worse than a failed
# build.
# The key, its seed and the fingerprint it must produce live in
# tools/make-keystore.sh, which the Gradle build uses too: one certificate
# with one place that asserts it, rather than two copies to drift apart.
KEYSTORE="$WORK/debug.p12"

say "Собираю ключ подписи"
CERT="$("$HERE/tools/make-keystore.sh" "$KEYSTORE" android fastloop | tail -n 1)"

say "Подписываю"
mkdir -p "$WORK/signer"
javac -nowarn -cp "$KIT/libs/apksig.jar" -d "$WORK/signer" "$HERE/tools/Sign.java"
mkdir -p "$(dirname "$OUT")"
# apksig 2.3.0 predates the module system and reaches into sun.security.*,
# which JDK 9+ keeps closed unless these exports are opened explicitly.
java \
  --add-exports java.base/sun.security.x509=ALL-UNNAMED \
  --add-exports java.base/sun.security.pkcs=ALL-UNNAMED \
  --add-exports java.base/sun.security.util=ALL-UNNAMED \
  -cp "$WORK/signer:$KIT/libs/apksig.jar" Sign \
  "$KEYSTORE" android fastloop android "$WORK/unsigned.apk" "$OUT" "$MIN_SDK"

say "Готово: $OUT ($(du -h "$OUT" | cut -f1)), сертификат $CERT"
