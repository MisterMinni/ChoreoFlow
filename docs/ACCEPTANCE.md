# Abnahmeprotokoll – 16. Oktober 2026

Dieses Protokoll trennt implementierte Funktionen, tatsächlich ausgeführte Prüfungen und noch fehlende Freigaben. Es ist keine vollständige MVP-Abnahme.

## Lokal ausgeführte Prüfungen

| Prüfung | Tatsächlicher Nachweis |
| --- | --- |
| Frische Installation | `npm ci` erfolgreich, 751 Pakete aus dem Lockfile; `expo install --check`: Dependencies are up to date |
| `npm run check` | TypeScript ohne Fehler, ESLint ohne Warnungen, 50/50 Tests bestanden: 22 Kern, 21 Datenadapter, 4 PDF, 3 Audio |
| `npm run build:web` | Expo-58-SPA erfolgreich exportiert; echte JS-/Asset-Dateien unter `apps/app/dist` |
| iOS-JavaScript-Export | `expo export --platform ios --output-dir ../../.local/ios-bundle` erfolgreich: 3.914 Module, ein Hermes-Bundle (11 MB), 23 Assets. Ausschließlich JS-/Asset-Export, kein signierter Native-Build und kein Gerätetest |
| `npm run test:e2e` | Abschließend 11/11 Chromium-Tests gegen den frisch erzeugten statischen Build bestanden (56,8 s); keine Testwiederholungen zur Kaschierung von Fehlern |
| Editor | Neues Projekt, Position bearbeiten, Undo/Redo, Formation anlegen, Muster anwenden, Reload mit erhaltener Historie und Playback |
| 3D | Echtes Chromium-WebGL-Canvas, Kamerwechsel ohne Seitenfehler; Screenshot `test-results/editor-3d.png` |
| Kleine Ansicht | 390×844, dunkles Theme, bedienbarer Editor ohne horizontalen Überlauf |
| Audio | Synthetische WAV als echte Datei importiert/dekodiert, Wellenform, Trim/Versatz, Persistenz nach Reload, tatsächliche Audiouhr gegen Projektzeit und Trim-Ende geprüft |
| Exporte | Echte Downloads: JSON mit vollständigen Weltwerten, PNG mit Signatur/1600×1200/dekodierten Personenfarben, PDF mit fünf Seiten/eingebetteter Schrift/Dateiende |
| PDF zusätzlich | Poppler-Rendering visuell geprüft; pypdf liest Umlaute/Griechisch/Kyrillisch, keine JavaScript-Aktionen; 100-Personen-Liste vollständig, Mehrfachpositionen markiert |
| Cloud-UI | Formularzustände ohne Auth-Mailversand, fehlerhafte Linkbehandlung, schreibgeschützter Zuschauer mit **simulierter** RPC-Antwort; Token nur im Fragment und POST-Body |
| Datenadapter | Transaktionen mit Memory/fake-indexeddb plus echter Browser-Reload; Namespace-Isolation, Konflikte, Outbox und idempotente Cloud-Retries mit gemocktem Supabase-Client |
| Zwei Browser-Tabs | Gezielter Browserregressionstest bestanden: fremder Speicherstand bleibt trotz Besetzungslesen erhalten, weiterer veralteter Edit gesperrt, ungesicherter Entwurf als echte JSON-Datei exportierbar, danach kontrollierter Reload |
| Produktionssperre | Separate Versuche mit `APP_VARIANT=production`, `EXPO_PUBLIC_APP_ENV=production` und `VERCEL_ENV=production` wurden jeweils erwartungsgemäß abgewiesen |

Gefundene Fehler wurden vor dem erfolgreichen Lauf korrigiert: React-Native-Textfragmente, zu breite Stage-Testkennungen und Web-Textfelder, deren `onEndEditing` nicht ausgelöst wurde. Zahlenänderungen werden nun über den gemeinsamen Web-Blur-Adapter übernommen und durch Undo/Reload geprüft.

Zusätzlicher Datenverlustfehler korrigiert: unabhängige Besetzungs-/Einstellungslesungen dürfen nach einem Mehrtab-Konflikt die Editorrevision nicht auf den fremden Stand setzen. Der erste abgelehnte Entwurf bleibt sichtbar/exportierbar; nach einem Speicherfehler verhindert eine Sperre weitere Schreibversuche bis zum bewussten Reload. Neue Memory-/IndexedDB- und Browserregressionen sichern diesen Fall ab.

Die Browserprüfung ist mit Chromium und Software-WebGL ausgeführt. Das ist kein Safari-, VoiceOver-, Hardware-Leistungs- oder iPhone-Nachweis. Die Cloud-UI-Tests sind kein Nachweis echter Mailzustellung oder vollständiger Anmeldung.

## Entfernte CI und manuelle Preview

Quellcommit `669e38fb9cea36ab55ed2fb63abed5962a3b8467` ist gepusht und über [Draft-PR #1](https://github.com/MisterMinni/ChoreoFlow/pull/1) reviewbar. [GitHub-Linux-CI 38867122082](https://github.com/MisterMinni/ChoreoFlow/actions/runs/38867122082) ist erfolgreich: **50 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen**; Browser: **10 bestanden (24,2 s), 1 übersprungen**. Der übersprungene Test ist die simulierte Cloud-Viewer-Antwort, weil CI keine Cloudkonfiguration erhält. Der lokale Lauf mit Testprojekt-Konfiguration bestand weiterhin alle 11 Browsertests (56,8 s).

Der anschließende reine Dokumentationscommit `cd5a094` ist gepusht; dessen [CI 38869322092](https://github.com/MisterMinni/ChoreoFlow/actions/runs/38869322092) ist ebenfalls erfolgreich. Die Quell-Preview bleibt auf `669e38f`; aus dem Dokumentationscommit wurde keine neue App-Bereitstellung abgeleitet.

Vercel-Deployment `dpl_4p8z7E4cwNAcegbZrQWUsrgSwkwu` wurde manuell für exakt diesen Commit erstellt und erreichte **READY** nach 49 Sekunden Buildzeit. [Deployment-URL](https://choreoflow-75cbckwvz-bastian-minnichs-projects.vercel.app) und [Branch-Alias](https://choreoflow-git-codex-project-setup-bastian-minnichs-projects.vercel.app) sind eingerichtet. Authentifizierte Abrufe von `/` und `/share` lieferten HTTP 200, echte Expo-HTML und Assets. Im normalen Browser greift Vercel-SSO; das gilt auch für den auf App-Ebene anonymen Viewer. Diese Abrufe sind kein zusätzlicher vollständiger Browser-E2E-Lauf auf Vercel. Die Produktionsdomain wurde nicht aktualisiert.

Supabase Auth Site URL wurde auf den Branch-Alias gesetzt. Die Redirect-Allowlist enthält ausschließlich `http://localhost:8081`, `http://127.0.0.1:8082` und den exakten Branch-Alias, ohne Wildcards. Das Speichern wurde durch erneutes Öffnen in einem neuen Dashboard-Tab bestätigt.

Der Eigentümer hat Brevo-SMTP gespeichert. Im neu geladenen Supabase-Dashboard war der SMTP-Schalter aktiv (`aria-checked=true`) und „Save changes“ deaktiviert. Ein frischer Brevo-Tab zeigte den eigenen Key **„ChoreoFlow Test“** als aktiv; der andere vorhandene Key blieb unverändert. Die deutsche Registrierungsbestätigung mit Betreff **„ChoreoFlow: E-Mail-Adresse bestätigen“** ist gespeichert, die Linkvariable `ConfirmationURL` bleibt unverändert.

**Echte Registrierung und E-Mail-Bestätigung erfolgreich:** Der Eigentümer bestätigte die Mail. Am 16. Oktober 2026 zeigte `auth.users` genau ein Konto, mit `confirmation_sent_at=07:56:25 UTC` und `email_confirmed_at=07:56:40 UTC`. Die persönliche Adresse wird nicht dokumentiert. `last_sign_in_at` war noch nicht gesetzt; eine erfolgreiche App-Anmeldung ist damit noch nicht nachgewiesen.

**Brevo-Zustelllog nach ausdrücklicher Freigabe geprüft:** Für „ChoreoFlow: E-Mail-Adresse bestätigen“ sind am 16. Oktober 2026 um **09:56 Uhr Europe/Berlin** sowohl „Versendet“ als auch „Zugestellt“ protokolliert. Die Ersatzabsenderdomain `brevosend.com` erscheint tatsächlich im Log. „Angeklickt“ um 09:56/09:57 Uhr und „Von Proxy geladen“ belegen weiterhin aktives Klick-/Öffnungstracking. Die Konfiguration ist daher nicht trackingfrei. Der Umgang mit Auth-Mail-Tracking bleibt vor Produktion zu klären; die von einem weiteren Projekt verwendeten Kontoeinstellungen wurden nicht verändert.

## Tatsächlich am Supabase-Testprojekt geprüft

Zwei versionierte Migrationen wurden auf `zhuslvtfktpclopkoqtf` angewendet. Die SQL-Berechtigungsprüfung lief mit synthetischen A-/B-Benutzern in einer zurückgerollten Transaktion. Geprüft: Besitz-/Mitgliedsrechte, RLS und Storagezugriff, Free/Pro- und Ablaufregeln, serverseitige Grenzen, Revisionskonflikte und Idempotenz, unterbundene Rechteausweitung, unveränderliche Veröffentlichung, anonymer Link und Widerruf, Titelgrenzen. Danach blieben keine Testbenutzer/-projekte/-dateien zurück. Dieser Nachweis stammt aus der Zeit vor dem inzwischen begonnenen echten Testkonto-/Mailablauf und trifft keine Aussage über dessen aktuelle Nutzerzahlen.

Publikations-Roundtrip vom echten SQL-Sanitizer zum gemeinsamen Szenenkern geprüft: Linien-/Volldrehungsprojekt und Show-/Liftprojekt, Weltwerte in 0,25-s-Schritten gleich. Notizen und lokale Medienpfade werden aus dem freigegebenen Snapshot entfernt. Supabase-Sicherheitsberater nach Härtung: keine Befunde; Performancehinweise nur noch ungenutzte Indizes in der leeren Datenbank. Dies ersetzt keinen umfassenden Penetrationstest.

## Noch fehlende Abnahmen

- Physisches iPhone: native SQLite/SecureStore/Dateien, 3D, Gesten, Audio-Unterbrechung, PDF-Teilen und Hintergrundverhalten.
- App-Anmeldung, Sessionwiederherstellung, Passwortwiederherstellung, Kontolöschung und Datenexport; Umgang mit dem nachgewiesenen Auth-Link-/Öffnungstracking vor Produktion. Registrierung, protokollierte Zustellung und Mailbestätigung des einen echten Testkontos sind bereits nachgewiesen.
- Teamverwaltung, Ordnerrechte, gleichzeitige Bearbeitung über mehrere Geräte, Medien-Sync und Konfliktauflösung.
- Native PNG, portables Medienpaket, Videoexport, StoreKit-Kauf/Restore/Entitlement-Verifizierung.
- Performance bei 100 Personen/200 Formationen auf Zielgeräten; systematische Barrierefreiheit und Safari.
- Datenbank- und Medienwiederherstellung, Produktionskonfiguration, Datenschutz-/Storeangaben und TestFlight.
- Offene transitive npm-Sicherheitsmeldungen: Bewertung und Paketstand in `DEPENDENCIES.md`.

## Reproduktion und CI

Die Befehle stehen in der README. `tests/e2e` startet den vorher gebauten statischen Webstand auf `127.0.0.1:8082`. Ohne optionale Cloudkonfiguration wird der simulierte Zuschauer-RPC-Test ausdrücklich übersprungen; der lokale Editor bleibt vollständig testbar. GitHub Actions prüft Installation, Code, Webbuild und Browser ohne Zugangsdaten; es veröffentlicht keine Deployments. Der oben verlinkte erste entfernte CI-Lauf wurde einschließlich seiner Testzahlen im Log kontrolliert.
