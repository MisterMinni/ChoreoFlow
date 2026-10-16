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
- Cloud- und Teamliste mit neuen lokalen Arbeitskopien, optionaler Musik-Wiederherstellung, sichtbaren Leser-/Bearbeiterrechten und bewusstem Zurücksichern. Eigene Entwürfe werden nicht ersetzt. Arbeitskopien behalten ihre geladene Serverbasis; Pending-Befehl und Bestätigung werden atomar verglichen, auch zwischen Tabs. Konflikte erhalten Entwurf und ausstehenden Befehl.
- Projektteam mit E-Mail-gebundenen, sieben Tage gültigen Einladungslinks, Annahme, Rollenwechsel, Entfernung und Widerruf. Kein automatischer Mailversand. Nur Eigentümer sehen Teamadressen; bis zu vier Bearbeiter einschließlich reservierter Einladungen benötigen aktives Pro des Eigentümers. Serverseitig auch bei Annahme und Tarifablauf geprüft.
- Private Musikübertragung mit Originalbytes, 20-MB-Grenze, Format-/MIME-/Größenprüfung und Decoder-Dauerprüfung beim lokalen Cachen. Konfligierende Dateien überschreiben keinen vorhandenen Cache; wiederholte Uploads vergleichen vorhandene Bytes. Öffentliche Probenlinks bleiben ohne Musik. Native Adapter implementiert, noch kein iPhone-Nachweis.
- Vercel-Projekt/Preview-Umgebungsvariablen eingerichtet; manuelle Preview des geprüften Commits READY. Automatische Git-Deployments deaktiviert; Produktionsbuild absichtlich gesperrt. Supabase Site URL und exakte Redirect-Allowlist gespeichert und erneut geprüft.

## Aktuelle lokale Abnahme

TypeScript und ESLint erfolgreich, **115/115 Tests** (46 Kern, 52 Daten, 4 PDF, 13 Audio), frischer Webexport. **20/20 Browsertests** bestanden (1,4 min); Details in `ACCEPTANCE.md`. Reale Cloudprobe zusätzlich mit synthetischen Daten: Anmeldung/Reload, Serverstände 1 bis 4, unveränderliche Veröffentlichung, getrennter anonymer Viewer und zwei erfolgreiche Linkwiderrufe. Einladungs-, Isolations- und Storage-Service-Tests auch in Supabase bestanden und vollständig zurückgerollt. Eine echte Leser-Einladung an eine synthetische Adresse wurde erstellt und widerrufen; kein Mailversand. Privater Upload und Download einer Zwei-Sekunden-WAV (88.244 Byte) sowie Öffnen als neue Arbeitskopie mit Musik im echten Browser erfolgreich. Dies ist noch keine Zwei-Konto-/Mehrgeräte-Abnahme. Kontowechsel, verspätete Downloads und veraltete Editoren sind gegen unbemerkte Überschreibung abgesichert.

## Reviewbarer und bereitgestellter Stand

App-Quellcommit `0a8d962749f4a551657f7ce5c5075efe72655779` ist gepusht: [Draft-PR #1](https://github.com/MisterMinni/ChoreoFlow/pull/1). [GitHub-Linux-CI 38875139539](https://github.com/MisterMinni/ChoreoFlow/actions/runs/38875139539) ist erfolgreich: 86 Fachtests, 13 Browserabläufe bestanden, 1 Viewer-Test ohne Cloudkonfiguration übersprungen. Lokal: 86/86 Fachtests und 14/14 Browserabläufe; CI lässt den simulierten Cloud-Viewer ohne Cloudkonfiguration ausdrücklich aus.

Die [manuelle Preview](https://choreoflow-git-codex-project-setup-bastian-minnichs-projects.vercel.app) läuft als `dpl_CatNxFUoK1L9Q87osSw7EZ61jdtC` für exakt diesen App-Commit, READY nach 56 Sekunden Buildzeit. [Unveränderliche Deployment-URL](https://choreoflow-q6ve5bfpw-bastian-minnichs-projects.vercel.app). Authentifizierte Abrufe von `/` und `/share` liefern HTTP 200 mit echten Expo-Dateien. **Vercel-SSO schützt weiterhin die gesamte Preview, auch den auf App-Ebene anonymen Viewer.** Die Produktionsdomain `choreoflow.vercel.app` wurde nicht aktualisiert. Details: `ACCEPTANCE.md` und `VERCEL.md`.

Spätere reine Test-/Dokumentationskorrekturen ändern diesen bereitgestellten Appstand nicht. Als vorheriger funktionierender Rückfallstand bleibt `669e38f` / `dpl_4p8z7E4cwNAcegbZrQWUsrgSwkwu` verfügbar.

## Meilensteine aus der Spezifikation

| Meilenstein | Stand / verbleibende Abnahme |
| --- | --- |
| M0 Grundlage | Weit umgesetzt; echter früher 3D-Test auf iPhone fehlt |
| M1 Nutzbarer Editor | Formationsmanagement einschließlich Vorschau und Undo vorhanden; vollständige Manipulation, Pfadwerkzeuge und native Gesten fehlen |
| M2 Bewegungen | Gruppenrotation und Konfliktkern; vollständige Gruppenmuster, Änderungsvorschläge und Lifteditor fehlen |
| M3 Musik und Planung | Ein Clip, Counts, Web-Wellenform, Notizen; Split, Requisiteneditor und vollständige Timing-UI fehlen |
| M4 Cloud und Team | Teamverwaltung, Einladungen, Arbeitskopien, Cloud-Restore-UI und privater Musiktransfer implementiert; Ordnervererbung, Realtime-Merge und umfassende Mehrgeräte-Abnahme fehlen |
| M5 Verkauf und Ausgaben | Serverseitige Tarifregeln und PDF/JSON/Web-PNG; Store-Käufe, Kontolöschung, Klärung des Auth-Mail-Trackings vor Produktion, native PNG, Medienpakete und echter Videoexport fehlen |
| M6 Abnahme | Nicht abgeschlossen: Gerät, Performance, vollständige Rechte-/Kauf-/Recovery-Flows und Storefreigabe fehlen |

## Noch notwendige Produktarbeit

Keine dieser Anforderungen gilt als stillschweigend gestrichen: Pinch/Pan, Auswahlrechteck, präzise Pfadgriffe, 3D-Manipulation, vollständige Personenverwaltung, wiederverwendbare Formationsbibliothek, Gruppenbewegungen jenseits der Rotations-UI, Tempo-/Markereditor, Audio-Split/Mehrclip, Requisiten-/Liftbearbeitung, Ordnerrechte und Rechtevererbung, Konfliktauflösung bei mehreren Geräten, serverseitige Prüfung des Medieninhalts, bewusst freigegebene Musik in Veröffentlichungen, Gerätebackups/Restore, Abo- und Kaufwiederherstellung, echter Videoexport, Datenschutz-/Storeangaben und Accessibility-Abnahme.

## Externe Voraussetzungen

- Expo-Konto BastianExpo, Owner `choreoflow`, Slug `bastianexpo`, Projekt-ID `733a2847-f234-4b34-bbf5-d7036b6d922f` im angemeldeten Dashboard bestätigt und in der App verknüpft. Bundle-ID, Apple-Signierung und echtes iPhone für Development Build/TestFlight fehlen. Kein physischer Gerätetest aus Webtests ableitbar.
- Brevo-SMTP ist gespeichert und aktiviert, der eigene Key „ChoreoFlow Test“ aktiv und der andere Key unverändert. Vorläufiger Absender sowie deutsche Vorlage mit unveränderter `ConfirmationURL` sind bestätigt. **Ein echtes Testkonto ist registriert und per E-Mail bestätigt:** Nutzerbestätigung und `auth.users` stimmen überein; am 16. Oktober 2026 `confirmation_sent_at=07:56:25 UTC`, `email_confirmed_at=07:56:40 UTC`, genau ein bestätigtes Konto; im anschließenden Cloudtest ist auch `last_sign_in_at` gesetzt. Brevo protokolliert Versand/Zustellung um 09:56 Uhr Europe/Berlin und die tatsächliche Ersatzabsenderdomain `brevosend.com`. Klick-/Öffnungstracking ist laut „Angeklickt“/„Von Proxy geladen“ weiterhin aktiv, nicht trackingfrei und vor Produktion zu klären; Kontoeinstellungen wegen eines weiteren Projekts unverändert. App-Anmeldung und Sitzung nach Reload sind inzwischen geprüft; Passwortreset und Kontolöschung bleiben offen. Eigene Domain später; siehe `MAIL_SETUP.md`. Supabase Site URL ist der Preview-Branch-Alias; Redirects sind ausschließlich dieser Alias, `http://localhost:8081` und `http://127.0.0.1:8082`, ohne Wildcards und nach Speichern erneut verifiziert.
- Eigene Produktionsdatenbank, Produktionskonfiguration und Budgetentscheidung. Supabase-Organisation tatsächlich Free, kein Tarifupgrade vorgenommen.
- Store-Produktkennungen und Sandboxkonten, Unternehmens-/Datenschutzangaben des Eigentümers.

## Nächster ausführbarer Schritt

Die neue Team-/Medienoberfläche auf einem zweiten echten Konto und Gerät abnehmen; anschließend Ordnervererbung, bewusste Konfliktauflösung und Medienfreigabe für Veröffentlichungen ergänzen. Pfad-/Gruppenwerkzeuge können unabhängig fortgesetzt werden. Für einen echten iPhone-Development-Build fehlen weiterhin Bundle-ID und Apple-Signierung; dann 3D/SQLite/Audio/Export am Gerät abnehmen. Vor jedem Release die offenen Punkte von `STORE_RELEASE.md` und `DEPENDENCIES.md` beheben bzw. bewerten. Der vorhandene Entwicklungsstand bleibt reproduzierbar startbar.
