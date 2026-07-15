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

## Anpassungen

- **Punkteregeln** ändert der Challenge-Ersteller direkt in der App (Tab „Regeln"), inkl. eigener Regeln wie „60 min Rad gefahren +2".
- Die Sichtbarkeit ist per Row Level Security abgesichert: Mitglieder einer Challenge sehen gegenseitig Punkte und Check-ins, Außenstehende nichts. Jeder kann nur eigene Check-ins eintragen/löschen.

## Hinweis

Der Code wurde statisch geprüft, aber `npm install && npm run build` konnte in der Erstellungsumgebung nicht ausgeführt werden (kein Registry-Zugriff). Falls beim ersten Build ein TypeScript-Fehler auftaucht, ist es vermutlich eine Kleinigkeit — Fehlermeldung einfach zurückschicken.
