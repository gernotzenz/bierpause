# 🍺🚫 Bierpause

Punkte-Challenge-App für alkoholfreie Wochen. Next.js 14 + Tailwind + Supabase, gehostet auf Vercel.

**Features:** E-Mail/Passwort-Login, Challenges (8/12 Wochen) mit Einladungscode, tägliches Check-in mit Punkteregeln (anpassbar durch den Ersteller), Leaderboard mit Wochenverlauf, Kalenderübersicht.

**Standard-Punkteregeln:**

| Aufgabe | Punkte |
|---|---|
| Kein Alkohol heute | +1 |
| Ganzes Wochenende alkoholfrei (nur Sa/So anklickbar) | +3 |
| Sport gemacht statt Bier | +2 |
| 3 Liter Wasser getrunken | +1 |
| 8 Stunden geschlafen | +1 |
| Mehr als 2 Bier an einem Tag | −3 |
| Betrunken gewesen | −5 |

---

## 1. Supabase einrichten (~5 min)

1. Auf [supabase.com](https://supabase.com) ein neues Projekt erstellen (Free Tier reicht).
2. Im Dashboard: **SQL Editor** → neue Query → kompletten Inhalt von `supabase/schema.sql` einfügen → **Run**.
3. **Project Settings → API**: `Project URL` und `anon public` Key kopieren (brauchst du gleich).
4. Optional, aber praktisch zum Testen: **Authentication → Providers → Email** → „Confirm email" deaktivieren. Dann funktioniert der Login sofort ohne Bestätigungsmail.

## 2. Lokal starten (WSL)

```bash
# Node 18+ nötig (in WSL z. B. via nvm):
# curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# nvm install --lts

cd bierpause
cp .env.local.example .env.local
# .env.local editieren und URL + anon key aus Schritt 1.3 eintragen

npm install
npm run dev
```

Dann im Browser: http://localhost:3000

## 3. Auf Vercel deployen

1. Projekt in ein GitHub-Repo pushen:
   ```bash
   git init && git add . && git commit -m "init"
   gh repo create bierpause --private --source=. --push   # oder manuell über github.com
   ```
2. Auf [vercel.com](https://vercel.com) → **Add New → Project** → das Repo importieren. Framework wird als Next.js erkannt, nichts ändern.
3. Unter **Environment Variables** eintragen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy** klicken.
5. In Supabase unter **Authentication → URL Configuration** die Vercel-URL (z. B. `https://bierpause.vercel.app`) als Site URL eintragen.

## 4. Challenge starten

1. Registrieren, Challenge erstellen (Name, Startdatum, 8 oder 12 Wochen).
2. Auf der Challenge-Seite den **Einladungscode** kopieren und dem Kumpel schicken.
3. Er registriert sich und tritt per Code bei. Ab dann: täglich einchecken, Leaderboard beobachten. 🚴

## Strava-Anbindung (optional)

Übernimmt Rad-/Sporteinheiten automatisch als Sport-Check-in.

1. **Strava-App anlegen:** [strava.com/settings/api](https://www.strava.com/settings/api) → App erstellen. Bei „Authorization Callback Domain" die Vercel-Domain **ohne** `https://` eintragen (z. B. `bierpause.vercel.app`). `Client ID` und `Client Secret` notieren.
2. **Supabase:** SQL Editor → Inhalt von `supabase/strava.sql` ausführen.
3. **Vercel → Settings → Environment Variables**, drei neue Einträge:
   - `NEXT_PUBLIC_STRAVA_CLIENT_ID` = Client ID
   - `STRAVA_CLIENT_SECRET` = Client Secret
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase → Project Settings → API Keys → `service_role` (secret) — niemals mit `NEXT_PUBLIC_` prefixen!
4. In Vercel unter Deployments → „Redeploy" klicken (Env-Variablen greifen erst nach neuem Deploy).
5. In der App: Check-in-Tab → „Mit Strava verbinden" → autorisieren. Danach holt „Aktivitäten prüfen" die Einheiten des gewählten Tags und trägt Sport automatisch ein.

**Punkte pro Sportstunde:** Der Strava-Import zählt die Gesamtminuten des Tages und trägt Sport mit `Regel-Punkte × gerundete Stunden` ein (2h-Ausfahrt bei 3 Punkten = +6). Dafür die Sport-Regel im Regeln-Tab auf den gewünschten Stundensatz stellen (z. B. 3) und einmalig `supabase/quantity.sql` im SQL Editor ausführen. Manuelles Abhaken zählt weiterhin als 1 Stunde.

Hinweis: Neue Strava-Apps sind anfangs oft auf **einen** verbundenen Athleten limitiert. Wenn dein Kumpel sich nicht verbinden kann, in den Strava-API-Einstellungen eine Kapazitätserhöhung beantragen — oder er legt sich eine eigene Strava-App an.

## Web Push / PWA (optional)

Die App ist als PWA installierbar und pusht Badge-Erfolge an die anderen Mitglieder.

1. **Supabase:** SQL Editor → Inhalt von `supabase/push.sql` ausführen.
2. **Vercel → Environment Variables**, drei neue Einträge (VAPID-Schlüsselpaar; ein eigenes lässt sich z. B. auf vapidkeys.com generieren):
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = Public Key
   - `VAPID_PRIVATE_KEY` = Private Key
   - `VAPID_SUBJECT` = `mailto:deine@mail.at`
3. **Redeploy** in Vercel.
4. In der App auf der Challenge-Seite: „🔔 Benachrichtigungen → Aktivieren" (jeder Teilnehmer auf jedem Gerät einmal).

**iPhone:** Push funktioniert nur, wenn die Seite installiert ist: In Safari → Teilen → „Zum Home-Bildschirm". Danach die App vom Homescreen öffnen und Benachrichtigungen aktivieren. Android/Chrome funktioniert direkt im Browser.

Gepusht wird, sobald jemand durch einen Check-in ein neues Badge freischaltet (z. B. „🔥 Gernot hat einen Erfolg! ‚Zwei Wochen trocken' freigeschaltet").

## Anpassungen

- **Punkteregeln** ändert der Challenge-Ersteller direkt in der App (Tab „Regeln"), inkl. eigener Regeln wie „60 min Rad gefahren +2".
- Die Sichtbarkeit ist per Row Level Security abgesichert: Mitglieder einer Challenge sehen gegenseitig Punkte und Check-ins, Außenstehende nichts. Jeder kann nur eigene Check-ins eintragen/löschen.

## Credits

Emojis von [OpenMoji](https://openmoji.org) (CC BY-SA 4.0), geladen via CDN.

## Hinweis

Der Code wurde statisch geprüft, aber `npm install && npm run build` konnte in der Erstellungsumgebung nicht ausgeführt werden (kein Registry-Zugriff). Falls beim ersten Build ein TypeScript-Fehler auftaucht, ist es vermutlich eine Kleinigkeit — Fehlermeldung einfach zurückschicken.
