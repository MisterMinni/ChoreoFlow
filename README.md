# ChoreoFlow

Ein lokaler Choreografie-Editor für Web und iPhone auf einer gemeinsamen Expo-/React-Native-Codebasis. Dieser Entwicklungsstand ist ein geprüftes erstes Inkrement, **kein vollständiger oder verkaufsfertiger MVP**. Fortschritt und offene Arbeit: [STATUS](docs/STATUS.md), Nachweise: [ACCEPTANCE](docs/ACCEPTANCE.md).

## Lokal starten (Windows)

Voraussetzung: Node.js 22 ab 22.13 (geprüft: 22.14.0), npm 11.

```powershell
npm ci
npm run dev:web
```

`http://localhost:8081` öffnen. Keine Anmeldung, API-Schlüssel, Docker oder EAS nötig. Ein synthetisches Showprojekt wird beim ersten Start angelegt. Projekt anlegen, Personen auswählen und verschieben, Formationen ergänzen, duplizieren und umordnen, Muster und Drehungen anwenden und die gemeinsame Szene in 2D/3D abspielen. Änderungen und Undo/Redo bleiben nach Neuladen erhalten. Browserdaten sind an die genaue Adresse gebunden; `localhost` und `127.0.0.1` verwenden getrennte Speicher.

Im Projektmenü finden sich Besetzung, Musik, Notizen, geometrische Konflikthinweise, Cloud/Freigaben und Exporte. Musikimport speichert die Originaldatei lokal; JSON-Projektdateien enthalten **keine Audiodateien**. Separat sichern. PDF und Web-PNG sind echte Dateien, kein Platzhalterexport.

## Prüfungen

```powershell
npm run check
npm run build:web
npx playwright install chromium
npm run test:e2e
```

Die Browserprüfung verwendet den zuvor erzeugten Build auf Port 8082. Für eine lokale Build-Vorschau: `npm run serve:web`, dann `http://127.0.0.1:8082`. Ein Browser-Test ersetzt keinen iPhone-Test.

## iPhone und Cloud

`npm run dev:iphone` startet Metro für einen eigenen Development Build. EAS-Projekt, Bundle-ID und Signierung müssen mit den tatsächlichen Apple-/Expo-Konten verbunden werden. Das ist noch kein installierbarer iPhone-Build. Siehe [STORE_RELEASE](docs/STORE_RELEASE.md).

Cloud ist optional. `apps/app/.env.example` beschreibt die öffentlichen Konfigurationswerte; lokale Werte kommen in die ignorierte `apps/app/.env.local`. Niemals Secret-/Service-Role-Schlüssel im Client verwenden. Das vorhandene Supabase-Projekt dient ausdrücklich als **Testumgebung**. Datenbankmigrationen, RLS, Rechte- und Quotenprüfungen sowie Brevo-SMTP sind eingerichtet. Echte Registrierung, Mailzustellung und E-Mail-Bestätigung wurden geprüft; auch App-Anmeldung, Sitzung nach Reload, Cloud-Sichern, unveränderlicher Zuschauerstand und Linkwiderruf sind geprüft. Passwortreset, Kontolöschung und vollständige Team-/Medienabläufe stehen noch aus. Brevo-Linktracking ist weiterhin aktiv und vor Produktion zu klären. Siehe [CLOUD](docs/CLOUD.md), [MAIL_SETUP](docs/MAIL_SETUP.md) und [OPERATIONS](docs/OPERATIONS.md).

Vercel veröffentlicht ausschließlich bewusst gestartete Previews. Git-Autodeploy ist deaktiviert und Produktionsbuilds sind gesperrt. Siehe [VERCEL](docs/VERCEL.md).

## Aufbau

- `apps/app`: Expo Router, gemeinsame Oberfläche, Plattformadapter für 3D, Audio und Export.
- `packages/core`: Modell, gemeinsame Szenenauswertung, Zeit, Geometrie, Konflikte, Undo/Redo.
- `packages/data`: IndexedDB/SQLite und explizite Cloudkopien mit Revisionsprüfung.
- `packages/ui`: gemeinsame Komponenten und Hell-/Dunkel-Themes.
- `supabase`: Migrationen, generierte Typen und transaktionale Berechtigungstests.
- `docs`: Architektur, Produktanforderungen, Betriebs- und Abnahmestand.
