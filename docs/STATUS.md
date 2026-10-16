# Entwicklungsstand – 16. Oktober 2026

Erstes durchgängiges Entwicklungsinkrement. Einrichtung und MVP-Umsetzung sind vom Nutzer beauftragt; das bestehende Supabase-Projekt ist ausdrücklich als Testumgebung freigegeben. Das Produktdokument bleibt die Zielanforderung. Der MVP ist **noch nicht vollständig**. Keine Hintergrundarbeit oder Produktionsfreigabe zugesagt.

## Funktionsfähig implementiert

- npm-Monorepo, Expo Router, striktes TypeScript, gemeinsamer Kern und gemeinsame Oberfläche, Hell/Dunkel/System, responsive Bibliothek und Editor.
- Lokale Projekte und Besetzungen, synthetisches Showprojekt, versionierte Importprüfung, atomare IndexedDB-/SQLite-Adapter, persistente Befehlshistorie, Undo/Redo, sichtbare Speicherfehler und Schutz gegen veraltete Schreibstände.
- Gemeinsame Szenenauswertung für 2D/3D/PDF/PNG: Formationen, Haltephasen, Übergänge, Sekunden/Counts, Tempoabschnitte im Modell, lineare und gebogene Wege, Gruppenrotationen einschließlich mehrerer voller Umdrehungen, Mustervorlagen.
- WebGL-3D mit stilisierten Figuren, Blickrichtung und drei Kameras. Native Fiber-Adapter vorhanden; tatsächlicher iPhone-Nachweis offen.
- Berechnete Kollisions-/Bühnen-/Requisitenhinweise und schematisches Liftmodell. Kein Sicherheitsnachweis oder biomechanisches Modell.
- Lokaler Musikimport, persistente Originaldatei, ein Clip mit Trim, Versatz, Lautstärke und Fades. Audioposition führt während des Clips die Vorschau. Web-Wellenform. Mehrspur-/Split-Editor fehlt.
- Echter JSON-Export/-Import, Web-PNG und mehrseitiger PDF-Export mit Unicode-Schrift und Besetzung. Native Exportadapter noch am Gerät zu prüfen.
- Supabase-Testdatenbank mit RLS, Rollen, serverseitigen Quoten, CAS-Speichern und Idempotenz, unveränderlichen Veröffentlichungen, widerrufbaren anonymen Links und privatem Medienbucket.
- Optionale Cloud-Anmeldung und bewusste Cloudkopie in der UI, Veröffentlichungen und schreibgeschützte Linkansicht. Kein automatischer Team-Merge. Auth-Oberfläche ist noch nicht mit echter E-Mail-Zustellung abgenommen.
- Vercel-Projekt/Preview-Umgebungsvariablen eingerichtet; automatische Git-Deployments deaktiviert. Produktionsbuild absichtlich gesperrt.

## Meilensteine aus der Spezifikation

| Meilenstein | Stand / verbleibende Abnahme |
| --- | --- |
| M0 Grundlage | Weit umgesetzt; echter früher 3D-Test auf iPhone fehlt |
| M1 Nutzbarer Editor | Durchgängiger Ablauf vorhanden; vollständige Manipulation, Pfadwerkzeuge und native Gesten fehlen |
| M2 Bewegungen | Gruppenrotation und Konfliktkern; vollständige Gruppenmuster, Änderungsvorschläge und Lifteditor fehlen |
| M3 Musik und Planung | Ein Clip, Counts, Web-Wellenform, Notizen; Split, Requisiteneditor und vollständige Timing-UI fehlen |
| M4 Cloud und Team | Datenbank- und Freigabegrundlage; Auth-Zustellung, Team-/Ordneroberfläche, Realtime-Merge und Medien-Sync fehlen |
| M5 Verkauf und Ausgaben | Serverseitige Tarifregeln und PDF/JSON/Web-PNG; Store-Käufe, Kontolöschung, SMTP, native PNG, Medienpakete und echter Videoexport fehlen |
| M6 Abnahme | Nicht abgeschlossen: Gerät, Performance, vollständige Rechte-/Kauf-/Recovery-Flows und Storefreigabe fehlen |

## Noch notwendige Produktarbeit

Keine dieser Anforderungen gilt als stillschweigend gestrichen: Pinch/Pan, Auswahlrechteck, präzise Pfadgriffe, 3D-Manipulation, vollständiges Umordnen/Duplizieren/Löschen von Formationen und Personen, wiederverwendbare Formationsbibliothek, Gruppenbewegungen jenseits der Rotations-UI, Tempo-/Markereditor, Audio-Split/Mehrclip, Requisiten-/Liftbearbeitung, Ordnerrechte/Teamverwaltung, Konfliktauflösung bei mehreren Geräten, sichere Medienübertragung, Gerätebackups/Restore, Abo- und Kaufwiederherstellung, echter Videoexport, Datenschutz-/Storeangaben und Accessibility-Abnahme.

## Externe Voraussetzungen

- Expo-Konto BastianExpo, Owner `choreoflow`, Slug `bastianexpo`, Projekt-ID `733a2847-f234-4b34-bbf5-d7036b6d922f` im angemeldeten Dashboard bestätigt und in der App verknüpft. Bundle-ID, Apple-Signierung und echtes iPhone für Development Build/TestFlight fehlen. Kein physischer Gerätetest aus Webtests ableitbar.
- Brevo ist gewählt; die vom Eigentümer benannte Gmail-Adresse dient vorläufig als Absender, eigene Domain später. SMTP-Zugang, Bestätigung/Tracking, Supabase Site-URL/Redirects und echte Testkonten stehen aus; siehe `MAIL_SETUP.md`. Keine Mails versandt.
- Eigene Produktionsdatenbank, Produktionskonfiguration und Budgetentscheidung. Supabase-Organisation tatsächlich Free, kein Tarifupgrade vorgenommen.
- Store-Produktkennungen und Sandboxkonten, Unternehmens-/Datenschutzangaben des Eigentümers.

## Nächster ausführbarer Schritt

Nach Lesen von `ACCEPTANCE.md` zunächst einen echten iPhone-Development-Build mit den bestätigten Kennungen erstellen und 3D/SQLite/Audio/Export abnehmen; unabhängige Editorarbeit kann sofort lokal fortgesetzt werden. Priorität: vollständiges Formationsmanagement und Pfad-/Gruppenwerkzeuge, anschließend Teamkonflikte und Medien-Sync. Vor jedem Release die offenen Punkte von `STORE_RELEASE.md` und `DEPENDENCIES.md` beheben bzw. bewerten. Der vorhandene Entwicklungsstand bleibt reproduzierbar startbar.
