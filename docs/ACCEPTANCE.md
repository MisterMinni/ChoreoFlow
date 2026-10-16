# Abnahmeprotokoll – 16. Oktober 2026

Dieses Protokoll trennt implementierte Funktionen, tatsächlich ausgeführte Prüfungen und noch fehlende Freigaben. Es ist keine vollständige MVP-Abnahme.

## Lokal ausgeführte Prüfungen

| Prüfung | Tatsächlicher Nachweis |
| --- | --- |
| Frische Installation | `npm ci` erfolgreich, 751 Pakete aus dem Lockfile; `expo install --check`: Dependencies are up to date |
| `npm run check` | TypeScript ohne Fehler, ESLint ohne Warnungen, 115/115 Tests bestanden: 46 Kern, 52 Datenadapter, 4 PDF, 13 Audio |
| `npm run build:web` | Expo-58-SPA erfolgreich exportiert; echte JS-/Asset-Dateien unter `apps/app/dist` |
| iOS-JavaScript-Export | `expo export --platform ios --output-dir ../../.local/ios-bundle` erfolgreich: 3.914 Module, ein Hermes-Bundle (11 MB), 23 Assets. Ausschließlich JS-/Asset-Export, kein signierter Native-Build und kein Gerätetest |
| `npm run test:e2e` | Team-/Medienerweiterung: abschließend 20/20 Chromium-Abläufe gegen den frisch erzeugten statischen Build bestanden (1,4 min) |
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

Die Browserprüfung ist mit Chromium und Software-WebGL ausgeführt. Das ist kein Safari-, VoiceOver-, Hardware-Leistungs- oder iPhone-Nachweis. Automatisierte Cloud-UI-Tests mit simulierten Antworten sind kein eigener Nachweis echter Mailzustellung oder Anmeldung; der getrennte reale Ablauf ist unten dokumentiert.

## Entfernte CI und manuelle Preview

App-Quellcommit `0a8d962749f4a551657f7ce5c5075efe72655779` ist gepusht und über [Draft-PR #1](https://github.com/MisterMinni/ChoreoFlow/pull/1) reviewbar. [GitHub-Linux-CI 38875139539](https://github.com/MisterMinni/ChoreoFlow/actions/runs/38875139539) ist erfolgreich: 86 Fachtests und 13 Browserabläufe bestanden, 1 Test übersprungen. Der simulierte Cloud-Viewer wird dort ohne Cloudkonfiguration ausdrücklich übersprungen; lokal sind alle 14 Browserabläufe mit der Testkonfiguration erfolgreich.

Vercel-Deployment `dpl_CatNxFUoK1L9Q87osSw7EZ61jdtC` wurde manuell für exakt diesen App-Commit erstellt und erreichte **READY** nach 56 Sekunden Buildzeit. [Deployment-URL](https://choreoflow-q6ve5bfpw-bastian-minnichs-projects.vercel.app) und [Branch-Alias](https://choreoflow-git-codex-project-setup-bastian-minnichs-projects.vercel.app) sind eingerichtet. Authentifizierte Abrufe von `/` und `/share` lieferten HTTP 200, echte Expo-HTML und Assets. Im normalen Browser greift weiterhin Vercel-SSO, auch für den auf App-Ebene anonymen Viewer. Diese Abrufe ersetzen keinen vollständigen Browser-E2E-Lauf auf Vercel. Die Produktionsdomain wurde nicht aktualisiert.

Ein zuvor fehlgeschlagener Dokumentations-CI-Lauf (`38871756407`) hatte die Editor-URL unmittelbar nach dem Klick erfasst, bevor die Router-Navigation abgeschlossen war. Der Test wartet nun ausdrücklich auf `/editor/…`; die gezielte lokale Wiederholung bestand. Dies ändert keine Appdatei. Spätere Test-/Dokumentationscommits behalten die oben bezeichnete Quell-Preview.

Supabase Auth Site URL wurde auf den Branch-Alias gesetzt. Die Redirect-Allowlist enthält ausschließlich `http://localhost:8081`, `http://127.0.0.1:8082` und den exakten Branch-Alias, ohne Wildcards. Das Speichern wurde durch erneutes Öffnen in einem neuen Dashboard-Tab bestätigt.

Der Eigentümer hat Brevo-SMTP gespeichert. Im neu geladenen Supabase-Dashboard war der SMTP-Schalter aktiv (`aria-checked=true`) und „Save changes“ deaktiviert. Ein frischer Brevo-Tab zeigte den eigenen Key **„ChoreoFlow Test“** als aktiv; der andere vorhandene Key blieb unverändert. Die deutsche Registrierungsbestätigung mit Betreff **„ChoreoFlow: E-Mail-Adresse bestätigen“** ist gespeichert, die Linkvariable `ConfirmationURL` bleibt unverändert.

**Echte Registrierung und E-Mail-Bestätigung erfolgreich:** Der Eigentümer bestätigte die Mail. Am 16. Oktober 2026 zeigte `auth.users` genau ein Konto, mit `confirmation_sent_at=07:56:25 UTC` und `email_confirmed_at=07:56:40 UTC`. Die persönliche Adresse wird nicht dokumentiert. Beim späteren realen Cloudtest war `last_sign_in_at` gesetzt: ein Konto, eines bestätigt, eines angemeldet. Anmeldung und Sitzung nach Reload wurden zusätzlich in der App geprüft.

**Brevo-Zustelllog nach ausdrücklicher Freigabe geprüft:** Für „ChoreoFlow: E-Mail-Adresse bestätigen“ sind am 16. Oktober 2026 um **09:56 Uhr Europe/Berlin** sowohl „Versendet“ als auch „Zugestellt“ protokolliert. Die Ersatzabsenderdomain `brevosend.com` erscheint tatsächlich im Log. „Angeklickt“ um 09:56/09:57 Uhr und „Von Proxy geladen“ belegen weiterhin aktives Klick-/Öffnungstracking. Die Konfiguration ist daher nicht trackingfrei. Der Umgang mit Auth-Mail-Tracking bleibt vor Produktion zu klären; die von einem weiteren Projekt verwendeten Kontoeinstellungen wurden nicht verändert.

## Tatsächlich am Supabase-Testprojekt geprüft

Zwei versionierte Migrationen wurden auf `zhuslvtfktpclopkoqtf` angewendet. Die SQL-Berechtigungsprüfung lief mit synthetischen A-/B-Benutzern in einer zurückgerollten Transaktion. Geprüft: Besitz-/Mitgliedsrechte, RLS und Storagezugriff, Free/Pro- und Ablaufregeln, serverseitige Grenzen, Revisionskonflikte und Idempotenz, unterbundene Rechteausweitung, unveränderliche Veröffentlichung, anonymer Link und Widerruf, Titelgrenzen. Danach blieben keine Testbenutzer/-projekte/-dateien zurück. Dieser Nachweis stammt aus der Zeit vor dem inzwischen begonnenen echten Testkonto-/Mailablauf und trifft keine Aussage über dessen aktuelle Nutzerzahlen.

Publikations-Roundtrip vom echten SQL-Sanitizer zum gemeinsamen Szenenkern geprüft: Linien-/Volldrehungsprojekt und Show-/Liftprojekt, Weltwerte in 0,25-s-Schritten gleich. Notizen und lokale Medienpfade werden aus dem freigegebenen Snapshot entfernt. Die frühere Prüfung nach der Schemahärtung hatte keine Security-Befunde. Die erneute Prüfung beim Cloudtest meldet eine WARN: deaktivierter Schutz gegen kompromittierte Passwörter (Supabase Pro oder höher erforderlich). Alle sieben öffentlichen Tabellen haben RLS; keine direkten Projektschreibrechte für anon/authenticated. Kein Tarifupgrade vorgenommen. Dies ersetzt keinen umfassenden Penetrationstest.

## Fortgesetzte Cloud- und Formationsprüfung

Die echte Browserprobe nutzte ausschließlich das separate Projekt **„Cloud-Prüfung 16.10. · synthetisch“** mit acht künstlichen Personen. Vorhandene persönliche Entwürfe wurden nicht geändert. Ablauf: angemeldetes Testkonto → bewusste Sicherung (Serverrevision 1) → Veröffentlichung → Zuschauer auf getrenntem Browser-Origin ohne Supabase-Anmeldung → Entwurf um Formation ergänzt und erneut gesichert (Revision 2) → veröffentlichter Stand bleibt auf Revision 1 → Link widerrufen → erneuter Linkabruf zeigt „ungültig, abgelaufen oder wurde widerrufen“. Die Datenbank bestätigte zwei Formationen im Entwurf und eine in der unveränderten Publikation. Nach App-Reload blieben Konto, Serverstand und Widerrufmetadaten verfügbar.

Diese Probe lief mit lokalem Web-Build gegen das echte Supabase-Testprojekt. Sie belegt keine frei erreichbare Vercel-Freigabe, zwei gleichzeitig arbeitende echte Konten, Medienübertragung oder geräteübergreifende Wiederherstellung. Bereits geladene Zuschauerstände werden durch Widerruf nicht rückwirkend aus dem Browser gelöscht; neue Abrufe sind gesperrt.

Mit dem korrigierten Build wurde die neue Formationskopie zusätzlich als Serverstand 3 gesichert, veröffentlicht und im getrennten Zuschauer-Origin geprüft (20 Sekunden, acht Personen). Wechsel zwischen diesem gültigen und dem alten widerrufenen Fragment funktioniert ohne Seitenreload; auch der zweite Testlink wurde anschließend erfolgreich widerrufen. Die synthetischen Teststände bleiben nachvollziehbar gespeichert.

Zusätzlich gefundene und korrigierte Fehler:

- Kontowechsel während eines laufenden Uploads/Downloads: jede Anfrage trägt den exakt geprüften Start-Token; spätere Schritte prüfen weiter die Kontozuordnung. Veröffentlichungsaktionen erwarten die erfasste Nutzer-ID. Verspätete Antworten dürfen keine fremden Cloudmetadaten in der Oberfläche setzen.
- Ein Hintergrunddownload darf die Konfliktbasis eines bereits geöffneten alten Entwurfs nicht fortschreiben. Vier Regressionen reproduzierten vorher mögliche Überschreibungen und bestehen nach dem Fix; bewusster Reload schaltet Bearbeitung wieder frei.
- Verspäteter Remote-Download: eine ältere Serverrevision überschreibt keinen neueren bestätigten Stand; derselbe Stand erhält Undo und lokale Medienreferenzen.
- Wechsel des Freigabe-Fragments im selben Browser-Tab: der Viewer verwirft alten Stand und Wiedergabe vor dem neuen Abruf. Die Regression scheiterte vor der Korrektur.
- Formationsauswahl und Endzeit: Auswahl erfolgt über stabile IDs; neue Endformationen werden erst gegen die neue Projektdauer angesprungen. Duplizieren erhält bestehende volle Drehungen; Umordnen/Löschen zeigen verlorene Bewegungen vor Bestätigung. Zeitereignisse werden nicht still gekürzt.

Die 86 Fach-/Daten-/Export-/Audiotests umfassen 24 neue Formationstests und zwölf neue Datenadaptertests. Alle 14 Browserabläufe bestanden nach Korrektur der zuvor fehlenden Web-Auswahlkennzeichnung (`aria-pressed`). Drei neue Abläufe prüfen Formationskopie, Reihenfolge, Löschung, vollständige Drehungen, JSON-Roundtrip, Reload/Undo/Redo sowie das 390-px-Layout. Token-Pinning wird auch mit dem echten Supabase-JS-Requestpfad und simuliertem HTTP geprüft; das ist kein weiterer echter Zwei-Konto-Cloudtest.

## Team- und Medienerweiterung

Neue Arbeitskopien haben ausdrücklich eine eigene lokale Projektkennung und eine unveränderte Zuordnung zum Serverprojekt. Sie übernehmen dessen geladene Revision, nicht einen beliebigen später abgefragten Stand. Leser dürfen die Cloudkopie nicht zurückschreiben; lokale Änderungen und JSON-Export bleiben möglich. Eigentümer/Bearbeiter nutzen CAS und persistente Befehls-IDs. Ein im Review reproduzierter Mehrtab-Fehler wurde korrigiert: Anlage und Bestätigung eines Pending-Befehls vergleichen und ersetzen den gesamten Origin atomar. Regressionen prüfen konkurrierende Repositoryinstanzen in Memory und IndexedDB sowie ein verspätetes ACK.

Die Migration `20261016090240_project_invitations.sql` wurde im ausdrücklich freigegebenen Testprojekt angewendet. `supabase/tests/invitations.sql` und die angepasste `isolation.sql` bestanden dort vollständig, anschließend Rollback der synthetischen Konten und Mitgliedschaften. Geprüft: bestätigte Datenbank-E-Mail statt manipulierbarer JWT-/Profilangaben, falsches Konto, unbestätigte Adresse, Ablauf, Widerruf, erneute Annahme nach Entfernung, Owner-only-Adressen, Rollenwechsel, vier reservierte Bearbeitungsplätze, Pro-Ablauf und anonymer Zugriff. Security-Advisor weiterhin nur die bekannte Warnung zur deaktivierten Leaked-Password-Protection; keine neue RLS-Warnung.

Im echten Browser ließ sich für das synthetische Cloud-Prüfprojekt eine Leser-Einladung an `choreoflow-reader@example.invalid` erstellen und widerrufen. SQL bestätigte eine widerrufene, nicht angenommene Einladung. Es wurde keine E-Mail versendet. Der tatsächliche Beitritt eines zweiten echten Kontos bleibt ungetestet; Rollen und Annahme sind durch die SQL-Prüfung abgedeckt.

Der erste echte Musik-Upload deckte einen Fehler im Quoten-Trigger auf: Supabase Storage prüft den Zugriff zunächst als angemeldeter Benutzer, schreibt das Objekt anschließend aber intern als `service_role` ohne Benutzer-Subjekt. Migration `20261016091914_storage_service_quota.sql` berücksichtigt diesen tatsächlichen Datenbankrollenwechsel, bindet Objektpfad und `owner_id` weiterhin an den Projekteigentümer und prüft Größe/Quote auch beim finalen Schreiben. RLS und Grants bleiben unverändert. `storage-service.sql` und die angepasste `isolation.sql` bestanden im echten Testprojekt; alle SQL-Testfixtures wurden zurückgerollt. Manipulierbare JWT-Rollenangaben reichen für die interne Schreibberechtigung nicht aus.

Nach der Korrektur bestanden privater Upload und authentifizierter Download im echten Browser: eine generierte Zwei-Sekunden-WAV mit 88.244 Byte, anschließend bestätigter lokaler Cache. SQL bestätigte genau ein Objekt mit dieser Größe im nicht öffentlichen Bucket. Das ist ein Test mit demselben echten Konto und Browser, kein zweites Gerät oder iPhone. Der Security-Advisor meldet weiterhin ausschließlich die bereits bekannte Warnung zur deaktivierten Leaked-Password-Protection.

Neue Browserregressionen verwenden vollständig simulierte Supabase-Antworten: Teamverwaltung/Einladungswiderruf ohne Mail-API, Leserrechte, stabile Retry-Befehle bei Teamkonflikten und Einladungstoken ausschließlich im Fragment/POST. Zwei Medienabläufe prüfen echte Chromium-Dekodierung einer generierten Zwei-Sekunden-WAV, byteidentischen IndexedDB-Cache über SHA-256, Wiedergabe nach Reload ohne zusätzlichen Download und Abweisung abgeschnittener Downloads ohne Arbeitskopie/Origin. Keine Aussage über iPhone oder reale zweite Geräte.

CI erhält ausschließlich synthetische öffentliche Cloudkonfiguration, damit auch diese Mock-Abläufe ausgeführt werden. Sie verwendet keine echten Zugangsdaten und keine reale Supabase-Instanz.

Abschließende lokale Abnahme: 115/115 Fachtests, TypeScript und ESLint ohne Fehler/Warnungen, frischer Expo-Webexport sowie 20/20 Browserabläufe bestanden. Ein vorheriger paralleler Aufruf zweier Playwright-Prozesse kollidierte im gemeinsamen Trace-Ordner; die getrennte Wiederholung und danach der vollständige Einprozesslauf bestanden. Dies war ein Test-Artefaktkonflikt, kein nachgewiesener Appfehler.

## Noch fehlende Abnahmen

- Physisches iPhone: native SQLite/SecureStore/Dateien, 3D, Gesten, Audio-Unterbrechung, PDF-Teilen und Hintergrundverhalten.
- Passwortwiederherstellung, Kontolöschung und vollständiger Konto-Datenexport; Umgang mit dem nachgewiesenen Auth-Link-/Öffnungstracking vor Produktion. Registrierung, protokollierte Zustellung, Mailbestätigung, App-Anmeldung und Sitzung nach Reload des einen echten Testkontos sind bereits nachgewiesen.
- Echter Beitritt eines zweiten Kontos und gleichzeitige Bearbeitung über mehrere Geräte; Ordnerrechte/Vererbung und interaktive Konfliktauflösung. Teamverwaltung und neue lokale Cloud-Arbeitskopien sind implementiert und wie oben geprüft.
- Serverseitige Audio-Inhaltsprüfung über Dateigröße/MIME hinaus, veröffentlichte Musik mit eigener Zugriffsfreigabe, Medienbackups und native Medienübertragung. Browser-Header/Decoder/Cache sind geprüft.
- Native PNG, portables Medienpaket, Videoexport, StoreKit-Kauf/Restore/Entitlement-Verifizierung.
- Performance bei 100 Personen/200 Formationen auf Zielgeräten; systematische Barrierefreiheit und Safari.
- Datenbank- und Medienwiederherstellung, Produktionskonfiguration, Datenschutz-/Storeangaben und TestFlight.
- Offene transitive npm-Sicherheitsmeldungen: Bewertung und Paketstand in `DEPENDENCIES.md`.

## Reproduktion und CI

Die Befehle stehen in der README. `tests/e2e` startet den vorher gebauten statischen Webstand auf `127.0.0.1:8082`. Ohne optionale Cloudkonfiguration werden die simulierten Cloudabläufe ausdrücklich übersprungen; der lokale Editor bleibt vollständig testbar. GitHub Actions baut mit synthetischer öffentlicher Konfiguration und prüft alle 20 Browserabläufe ohne echte Zugangsdaten; es veröffentlicht keine Deployments. Die entfernten CI-Läufe sind mit ihren tatsächlich beobachteten Ergebnissen oben dokumentiert.
