# Entwicklungsstand – 16. Oktober 2026

Durchgängiger Entwicklungsstand mit fortgesetzter Editorarbeit. Einrichtung und MVP-Umsetzung sind vom Nutzer beauftragt; das bestehende Supabase-Projekt ist ausdrücklich als Testumgebung freigegeben. Das Produktdokument bleibt die Zielanforderung. Der MVP ist **noch nicht vollständig**. Keine Hintergrundarbeit oder Produktionsfreigabe zugesagt.

## Funktionsfähig implementiert

- npm-Monorepo, Expo Router, striktes TypeScript, gemeinsamer Kern und gemeinsame Oberfläche, Hell/Dunkel/System, responsive Bibliothek und Editor.
- Lokale Projekte und Besetzungen, synthetisches Showprojekt, versionierte Importprüfung, atomare IndexedDB-/SQLite-Adapter, persistente Befehlshistorie, Undo/Redo, sichtbare Speicherfehler und Schutz gegen veraltete Schreibstände.
- Gemeinsame Szenenauswertung für 2D/3D/PDF/PNG: Formationen, Haltephasen, Übergänge, Sekunden/Counts, Tempoabschnitte im Modell, lineare und gebogene Wege, Gruppenrotationen einschließlich mehrerer voller Umdrehungen, Mustervorlagen.
- Formationen duplizieren, löschen und umordnen: Auswirkungen vorab prüfen, stabile IDs, explizite Behandlung betroffener Laufwege und Zeitereignisse, ein Undo-Schritt. Musik und zeitgebundene Elemente bleiben in der UI an ihrer absoluten Zeitposition. Neue Übergänge starten mit 4 Sekunden; unveränderte Nachbarpaare und volle Drehungen bleiben erhalten.
- WebGL-3D mit stilisierten Figuren, Blickrichtung und drei Kameras. Native Fiber-Adapter vorhanden; tatsächlicher iPhone-Nachweis offen.
- Berechnete Kollisions-/Bühnen-/Requisitenhinweise und schematisches Liftmodell. Kein Sicherheitsnachweis oder biomechanisches Modell.
- Lokaler Musikimport, persistente Originaldatei, ein Clip mit Trim, Versatz, Lautstärke und Fades. Audioposition führt während des Clips die Vorschau. Web-Wellenform. Mehrspur-/Split-Editor fehlt.
- Echter JSON-Export/-Import, Web-PNG und mehrseitiger PDF-Export mit Unicode-Schrift und Besetzung. Native Exportadapter noch am Gerät zu prüfen.
- Supabase-Testdatenbank mit RLS, Rollen, serverseitigen Quoten, CAS-Speichern und Idempotenz, unveränderlichen Veröffentlichungen, widerrufbaren anonymen Links und privatem Medienbucket.
- Optionale Cloud-Anmeldung und bewusste Cloudkopie in der UI, Veröffentlichungen und schreibgeschützte Linkansicht. Kein automatischer Team-Merge. Echte Registrierung und Mailbestätigung eines Testkontos erfolgreich; Echte App-Anmeldung, Sitzung nach Reload, Cloud-Sichern/Ändern, fester Zuschauerstand und Linkwiderruf im Browser erfolgreich geprüft.
- Vercel-Projekt/Preview-Umgebungsvariablen eingerichtet; manuelle Preview des geprüften Commits READY. Automatische Git-Deployments deaktiviert; Produktionsbuild absichtlich gesperrt. Supabase Site URL und exakte Redirect-Allowlist gespeichert und erneut geprüft.

## Aktuelle lokale Abnahme

TypeScript und ESLint erfolgreich, **86/86 Tests** (46 Kern, 33 Daten, 4 PDF, 3 Audio), frischer Webexport und **14/14 Browsertests** bestanden. Reale Cloudprobe zusätzlich mit synthetischen Daten: Anmeldung/Reload, Serverstände 1 bis 3, unveränderliche Veröffentlichung, getrennter anonymer Viewer und zwei erfolgreiche Linkwiderrufe. Kontowechsel, verspätete Downloads und veraltete Editoren sind gegen unbemerkte Überschreibung abgesichert. Details: `ACCEPTANCE.md`.

## Bisher reviewbarer und bereitgestellter Stand

Commit `669e38fb9cea36ab55ed2fb63abed5962a3b8467` ist gepusht: [Draft-PR #1](https://github.com/MisterMinni/ChoreoFlow/pull/1). [GitHub-Linux-CI 38867122082](https://github.com/MisterMinni/ChoreoFlow/actions/runs/38867122082) ist erfolgreich: 50/50 Tests; Browser 10 bestanden, ein Cloud-Viewer-Test ohne Cloudkonfiguration ausdrücklich übersprungen. Lokal mit Testkonfiguration: 11/11 Browsertests bestanden.

Der spätere reine Dokumentationscommit `cd5a094` ist ebenfalls gepusht; [CI 38869322092](https://github.com/MisterMinni/ChoreoFlow/actions/runs/38869322092) ist erfolgreich. Die bereitgestellte Quell-Preview bleibt auf `669e38f`.

Die [manuelle Preview](https://choreoflow-git-codex-project-setup-bastian-minnichs-projects.vercel.app) läuft als `dpl_4p8z7E4cwNAcegbZrQWUsrgSwkwu` für exakt diesen Commit, READY nach 49 Sekunden Buildzeit. Authentifizierte Abrufe von `/` und `/share` liefern HTTP 200 mit echten Expo-Dateien. **Vercel-SSO schützt weiterhin die gesamte Preview, auch den auf App-Ebene anonymen Viewer.** Die Produktionsdomain `choreoflow.vercel.app` wurde nicht aktualisiert. Details und Prüfgrenzen: `ACCEPTANCE.md` und `VERCEL.md`.

## Meilensteine aus der Spezifikation

| Meilenstein | Stand / verbleibende Abnahme |
| --- | --- |
| M0 Grundlage | Weit umgesetzt; echter früher 3D-Test auf iPhone fehlt |
| M1 Nutzbarer Editor | Formationsmanagement einschließlich Vorschau und Undo vorhanden; vollständige Manipulation, Pfadwerkzeuge und native Gesten fehlen |
| M2 Bewegungen | Gruppenrotation und Konfliktkern; vollständige Gruppenmuster, Änderungsvorschläge und Lifteditor fehlen |
| M3 Musik und Planung | Ein Clip, Counts, Web-Wellenform, Notizen; Split, Requisiteneditor und vollständige Timing-UI fehlen |
| M4 Cloud und Team | Echter Login/Reload/Sichern/Publizieren/Widerruf geprüft; Team-/Ordneroberfläche, Cloud-Restore-UI, Realtime-Merge und Medien-Sync fehlen |
| M5 Verkauf und Ausgaben | Serverseitige Tarifregeln und PDF/JSON/Web-PNG; Store-Käufe, Kontolöschung, Klärung des Auth-Mail-Trackings vor Produktion, native PNG, Medienpakete und echter Videoexport fehlen |
| M6 Abnahme | Nicht abgeschlossen: Gerät, Performance, vollständige Rechte-/Kauf-/Recovery-Flows und Storefreigabe fehlen |

## Noch notwendige Produktarbeit

Keine dieser Anforderungen gilt als stillschweigend gestrichen: Pinch/Pan, Auswahlrechteck, präzise Pfadgriffe, 3D-Manipulation, vollständige Personenverwaltung, wiederverwendbare Formationsbibliothek, Gruppenbewegungen jenseits der Rotations-UI, Tempo-/Markereditor, Audio-Split/Mehrclip, Requisiten-/Liftbearbeitung, Ordnerrechte/Teamverwaltung, Konfliktauflösung bei mehreren Geräten, sichere Medienübertragung, Gerätebackups/Restore, Abo- und Kaufwiederherstellung, echter Videoexport, Datenschutz-/Storeangaben und Accessibility-Abnahme.

## Externe Voraussetzungen

- Expo-Konto BastianExpo, Owner `choreoflow`, Slug `bastianexpo`, Projekt-ID `733a2847-f234-4b34-bbf5-d7036b6d922f` im angemeldeten Dashboard bestätigt und in der App verknüpft. Bundle-ID, Apple-Signierung und echtes iPhone für Development Build/TestFlight fehlen. Kein physischer Gerätetest aus Webtests ableitbar.
- Brevo-SMTP ist gespeichert und aktiviert, der eigene Key „ChoreoFlow Test“ aktiv und der andere Key unverändert. Vorläufiger Absender sowie deutsche Vorlage mit unveränderter `ConfirmationURL` sind bestätigt. **Ein echtes Testkonto ist registriert und per E-Mail bestätigt:** Nutzerbestätigung und `auth.users` stimmen überein; am 16. Oktober 2026 `confirmation_sent_at=07:56:25 UTC`, `email_confirmed_at=07:56:40 UTC`, genau ein bestätigtes Konto; im anschließenden Cloudtest ist auch `last_sign_in_at` gesetzt. Brevo protokolliert Versand/Zustellung um 09:56 Uhr Europe/Berlin und die tatsächliche Ersatzabsenderdomain `brevosend.com`. Klick-/Öffnungstracking ist laut „Angeklickt“/„Von Proxy geladen“ weiterhin aktiv, nicht trackingfrei und vor Produktion zu klären; Kontoeinstellungen wegen eines weiteren Projekts unverändert. App-Anmeldung und Sitzung nach Reload sind inzwischen geprüft; Passwortreset und Kontolöschung bleiben offen. Eigene Domain später; siehe `MAIL_SETUP.md`. Supabase Site URL ist der Preview-Branch-Alias; Redirects sind ausschließlich dieser Alias, `http://localhost:8081` und `http://127.0.0.1:8082`, ohne Wildcards und nach Speichern erneut verifiziert.
- Eigene Produktionsdatenbank, Produktionskonfiguration und Budgetentscheidung. Supabase-Organisation tatsächlich Free, kein Tarifupgrade vorgenommen.
- Store-Produktkennungen und Sandboxkonten, Unternehmens-/Datenschutzangaben des Eigentümers.

## Nächster ausführbarer Schritt

Nach Lesen von `ACCEPTANCE.md` zunächst die noch fehlende Bundle-ID und Apple-Signierungszugänge bestätigen. Anschließend einen echten iPhone-Development-Build erstellen und 3D/SQLite/Audio/Export am Gerät abnehmen. Unabhängige Editorarbeit kann sofort lokal fortgesetzt werden. Priorität: Pfad-/Gruppenwerkzeuge, anschließend Cloud-Wiederherstellung, Teamkonflikte und Medien-Sync. Vor jedem Release die offenen Punkte von `STORE_RELEASE.md` und `DEPENDENCIES.md` beheben bzw. bewerten. Der vorhandene Entwicklungsstand bleibt reproduzierbar startbar.
