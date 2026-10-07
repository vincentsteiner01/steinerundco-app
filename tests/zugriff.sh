#!/usr/bin/env bash
# Prüft, dass ohne Login nichts erreichbar ist – weder Daten noch Dateien.
# Aufruf: bash tests/zugriff.sh            (prüft Supabase direkt)
#         bash tests/zugriff.sh https://app.steinerundco.de   (prüft zusätzlich die Header der Website)
set -u

URL="https://ekaqkfgvisdngsskzbai.supabase.co"
KEY="sb_publishable_m_GF3cePpZgLGP9FH6Cc5Q_Zz6TJCTy"   # öffentlicher Schlüssel, steht auch im Frontend
FEHLER=0

pruefe() { # Beschreibung, erwartet (Teilstring), tatsächliche Antwort
  if [[ "$3" == *"$2"* ]]; then
    echo "  ok      $1"
  else
    echo "  FEHLER  $1"
    echo "          erwartet: $2"
    echo "          erhalten: ${3:0:200}"
    FEHLER=1
  fi
}

echo "Supabase ohne Login:"
for TABELLE in documents document_chunks cost_entries members categories subcategories; do
  ANTWORT=$(curl -s "$URL/rest/v1/$TABELLE?select=*&limit=1" -H "apikey: $KEY")
  pruefe "Tabelle $TABELLE gesperrt" "permission denied" "$ANTWORT"
done

ANTWORT=$(curl -s -X POST "$URL/rest/v1/rpc/is_member" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{}')
pruefe "Hilfsfunktion nicht über die API erreichbar" "PGRST202" "$ANTWORT"

ANTWORT=$(curl -s -X POST "$URL/storage/v1/object/list/akten" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"prefix":""}')
pruefe "Bucket-Inhalt nicht auflistbar" "[]" "$ANTWORT"

CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/storage/v1/object/public/akten/beliebig.pdf")
pruefe "Keine öffentlichen Datei-Links (HTTP 400)" "400" "$CODE"

ANTWORT=$(curl -s -X POST "$URL/storage/v1/object/sign/akten/beliebig.pdf" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"expiresIn":60}')
pruefe "Keine signierten Links ohne Login" "not found" "$(echo "$ANTWORT" | tr 'A-Z' 'a-z')"

# Nur die Einstellungen lesen – ein echter Registrierungsversuch würde bei offener Registrierung ein Konto anlegen.
ANTWORT=$(curl -s "$URL/auth/v1/settings" -H "apikey: $KEY")
pruefe "Selbstregistrierung abgeschaltet" '"disable_signup":true' "$ANTWORT"

if [[ $# -ge 1 ]]; then
  echo "Website $1:"
  HEADER=$(curl -sI "$1/")
  pruefe "Content-Security-Policy gesetzt" "content-security-policy" "$(echo "$HEADER" | tr 'A-Z' 'a-z')"
  pruefe "nicht in Suchmaschinen (X-Robots-Tag)" "x-robots-tag: noindex" "$(echo "$HEADER" | tr 'A-Z' 'a-z')"
  pruefe "Einbetten verboten (X-Frame-Options)" "x-frame-options: deny" "$(echo "$HEADER" | tr 'A-Z' 'a-z')"
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$1/supabase/migrations/20261007000001_schema.sql")
  pruefe "Migrationen nicht abrufbar" "404" "$CODE"
fi

echo
if [[ $FEHLER -eq 0 ]]; then echo "Alles gesperrt, wie es sein soll."; else echo "Es gibt Fehler, siehe oben."; fi
exit $FEHLER
