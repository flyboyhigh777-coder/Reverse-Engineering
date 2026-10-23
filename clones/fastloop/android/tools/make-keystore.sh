#!/usr/bin/env bash
# Rebuilds the one signing key, and refuses to hand over a different one.
#
# Android will not install an update whose certificate differs from the one
# already on the phone, and the only way out of that is to uninstall — which
# destroys the diary. The key is therefore derived from a fixed seed in
# KeyGen.java rather than generated, so every container and every build
# system produces the same certificate, and the fingerprint is asserted here
# rather than trusted: a silent change would produce an APK that cannot be
# installed over the previous one, which is worse than a failed build.
#
# Usage: make-keystore.sh <output.p12> [password] [alias]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:?нужен путь к хранилищу ключа}"
PASS="${2:-android}"
ALIAS="${3:-fastloop}"

EXPECTED_CERT=7A6C9128ABAA5E064D496416605C87853F33553D25D20130EECFF56D22C1BEDE

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$(dirname "$OUT")"
javac -nowarn --add-exports java.base/sun.security.x509=ALL-UNNAMED \
  -d "$WORK" "$HERE/KeyGen.java" 2>/dev/null

CERT="$(java \
  --add-exports java.base/sun.security.x509=ALL-UNNAMED \
  --add-exports java.base/sun.security.util=ALL-UNNAMED \
  -cp "$WORK" KeyGen "$OUT" "$PASS" "$ALIAS" | tail -n 1)"

if [ "$CERT" != "$EXPECTED_CERT" ]; then
  cat >&2 <<EOF
Сертификат подписи изменился — такой APK не встанет поверх установленного.
  ожидался: $EXPECTED_CERT
  получен:  $CERT
Проверьте tools/KeyGen.java и версию JDK, прежде чем собирать дальше.
EOF
  exit 1
fi

echo "$CERT"
