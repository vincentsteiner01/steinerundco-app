# Aktendashboard · app.steinerundco.de

Privates Aktendashboard für Vincent Steiner und Mike Mbokolanzi: Briefe fotografieren oder als PDF hochladen, einordnen, auf allen Geräten wiederfinden. Kein Produkt, nur intern.

- **Oberfläche:** statisches HTML, CSS und JavaScript in `public/`, ohne Build-Schritt. `supabase-js` kommt per CDN (Version und Prüfsumme fest in `index.html`).
- **Server:** Supabase-Projekt „Akten Dashboard (Frankfurt)“, Ref `ekaqkfgvisdngsskzbai`, Region `eu-central-1`, Free-Tarif.
- **Spezifikation:** `anweisung-akten-dashboard.md` im übergeordneten Projektordner.

## Aufbau

```
public/                  ← Dokumentenstamm in Plesk
  index.html             App-Hülle, Hash-Routing (#/, #/neu, #/dokument/…, #/papierkorb)
  .htaccess              Sicherheits-Header, Content-Security-Policy, noindex
  css/app.css            dunkles Design im Stil der Website
  js/config.js           Supabase-URL und öffentlicher Schlüssel
  js/api.js              alle Zugriffe auf Supabase
  js/bilder.js           Fotos verkleinern, mehrere Seiten → ein PDF
  js/views/              Anmeldung, Liste, Hochladen, Detail, Papierkorb
supabase/migrations/     Datenbankschema, Zugriffsregeln, Kategorien
supabase/mail-vorlage-magic-link.html   deutsche Anmeldemail mit Link und Code
tests/zugriff.sh         prüft, dass ohne Login nichts erreichbar ist
```

## Lokal starten

```bash
python3 -m http.server 8767 --bind 127.0.0.1 --directory public
```

Dann http://localhost:8767 öffnen. In Claude Code heißt die Vorschau „aktendashboard“.

## Sicherheit in Kürze

- Ohne Login sind alle Tabellen und der Bucket `akten` gesperrt. Angemeldet sieht nur, wer in der Tabelle `members` steht.
- Dateien gibt es nur über signierte Links mit 2 Minuten Laufzeit.
- Endgültig löschen geht nur aus dem Papierkorb. Dateien aktiver Dokumente lassen sich nicht löschen.
- Im Browser steht nur der öffentliche Publishable Key. Der `service_role`-Schlüssel und der Anthropic-Schlüssel kommen nie ins Repository.
- Prüfen: `bash tests/zugriff.sh`, nach dem Veröffentlichen zusätzlich `bash tests/zugriff.sh https://app.steinerundco.de`.

## Einmalig im Supabase-Dashboard einstellen

1. **Authentication → Sign In / Providers:** „Allow new users to sign up“ ausschalten. E-Mail-Anmeldung bleibt an.
2. **Authentication → URL Configuration:** Site URL `https://app.steinerundco.de`. Bei den Redirect URLs `https://app.steinerundco.de/**`, `http://localhost:8767/**` und `http://127.0.0.1:8767/**` eintragen.
3. **Authentication → Emails → SMTP Settings** (Mailversand über Google Workspace, sonst erreichen Mails nur Mitglieder des Supabase-Teams):
   - Vorher im Google-Konto, das senden soll: Bestätigung in zwei Schritten aktivieren, dann unter https://myaccount.google.com/apppasswords ein App-Passwort „Supabase Akten“ erzeugen.
   - Sender email address: die Adresse dieses Google-Kontos (oder ein dort eingerichteter Alias, sonst ersetzt Google den Absender)
   - Sender name: `Akten · Steiner & Co.`
   - Host `smtp.gmail.com`, Port `465`, Minimum interval `60`
   - Username: dieselbe Google-Adresse, Password: das App-Passwort (16 Zeichen, ohne Leerzeichen)
4. **Authentication → Emails → Templates → Magic Link:** Betreff `Dein Anmeldelink für die Akten`, als Inhalt alles aus `supabase/mail-vorlage-magic-link.html`. Die Standardmail enthält nur den Link; erst mit dieser Vorlage steht auch der Code darin, den die Anmeldeseite für ein zweites Gerät anbietet.
5. **Authentication → Users → Add user → Create new user:** beide Konten anlegen, „Auto Confirm User“ anhaken, als Passwort ein langes Zufallspasswort aus dem Passwortmanager (wird nie benutzt). Danach werden sie per SQL in `members` eingetragen:
   Wer per Einladung angelegt wurde und sie nie angenommen hat, gilt als unbestätigt und kann sich bei abgeschalteter Registrierung nicht anmelden. Deshalb beim Freischalten auch bestätigen:
   ```sql
   update auth.users set email_confirmed_at = now()
   where email in ('…', '…') and email_confirmed_at is null;

   insert into public.members (user_id, email, display_name)
   select id, email, case when email like 'vincent%' then 'Vincent' else 'Mike' end
   from auth.users where email in ('…', '…');
   ```
6. **Organisation → Legal Documents:** Auftragsverarbeitungsvertrag (DPA) abschließen.

## Plesk einrichten

Das Repository ist **öffentlich**, damit Plesk es ohne Zugangsdaten holen kann. Zwei Wege mit Zugangsdaten scheiterten: Den SSH-Schlüssel des Abonnements nutzt schon die Website als Deploy Key (GitHub erlaubt ihn nur einmal), und für HTTPS mit Token fehlen dem Plesk-Hilfsskript `pass-from-env.sh` die Ausführungsrechte.
Deshalb gilt: **Niemals Geheimnisse committen.** Der Anthropic-Schlüssel liegt nur in den Supabase-Secrets, der `service_role`-Schlüssel nirgends im Code. Sichtbar sind nur Code, Schema und diese README. Die Daten schützen Login und Zugriffsregeln.

1. **Subdomain** `app.steinerundco.de` mit Dokumentenstamm **`app.steinerundco.de/public`**. Den DNS-Eintrag gibt es schon.
2. **Plesk → app.steinerundco.de → Git → Repository hinzufügen:**
   - Remote repository, URL `https://github.com/vincentsteiner01/steinerundco-app.git`, Username und Password leer
   - Deployment mode **Automatic**, Server path **`/app.steinerundco.de`** (Stammverzeichnis, *nicht* `…/public`)
3. **Webhook:** In Plesk beim Repository die Webhook-URL kopieren. Auf GitHub im Repository → Settings → Webhooks → Add webhook: Payload URL einfügen, Content type `application/json`, „Just the push event“.
4. **SSL/TLS-Zertifikate:** Let's Encrypt für `app.steinerundco.de`, unter Hosting die 301-Weiterleitung auf HTTPS aktivieren.

Weil der Dokumentenstamm `public/` ist, liefert die Website README, Migrationen und Tests nicht aus.

## Veröffentlichen

Lokal prüfen, dann `git add -A && git commit -m "…" && git push`. Plesk rollt nach etwa 20 Sekunden aus.

## Free-Tarif: was das bedeutet

- **Pause nach 7 Tagen ohne Zugriff.** Das Projekt schläft dann, die Daten bleiben. Im Supabase-Dashboard lässt es sich wieder aufwecken.
- **Keine automatischen Backups.** Deshalb monatlich selbst sichern (Datenbank-Export und den Bucket `akten` herunterladen).
- **Grenzen:** 1 GB Dateien, 500 MB Datenbank, 50 MB je Datei (die App erlaubt 25 MB). Bei etwa 0,5 MB pro fotografiertem Brief reicht das für ein paar Tausend Briefe.
- Upgrade auf Pro (25 $/Monat, tägliche Backups, keine Pause) jederzeit ohne Umzug möglich.

## Phasen

1. **Grundgerüst** (dieser Stand): Login, Hochladen per Kamera und Ziehen und Ablegen, Liste, Detailansicht, Papierkorb.
2. **Analyse und Suche:** Edge Function `analyze-document` mit Claude, deutsche Volltextsuche.
3. **Übersichten:** Kennzahlen, Fälligkeiten, Kosten.
4. **Fragen an die Akten:** Edge Function `ask` mit Quellenangabe.
