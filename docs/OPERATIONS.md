# Betrieb und offene Konfiguration

## Bestehende Ressourcen

GitHub `MisterMinni/ChoreoFlow`; Vercel `bastian-minnichs-projects/choreoflow`; Supabase-Testprojekt `zhuslvtfktpclopkoqtf`, Frankfurt. Die Supabase-Organisation wurde als **Free** ausgelesen, entgegen der Pro-Annahme im Produktdokument. Kein Tarif wurde geändert.

Der Eigentümer hat unter Expo-Nutzer `BastianExpo` das Projekt [choreoflow/bastianexpo](https://expo.dev/accounts/choreoflow/projects/bastianexpo) angelegt. Nach seinem Login wurden im Expo-Dashboard Owner `choreoflow`, Slug `bastianexpo` und Projekt-UUID `733a2847-f234-4b34-bbf5-d7036b6d922f` verifiziert. `apps/app/app.config.ts` enthält diese Verknüpfung; die von Expo geladenen Konfigurationswerte wurden erfolgreich geprüft. Es wurde dadurch kein nativer Build erstellt oder signiert.

`docs/VERCEL.md` und `docs/CLOUD.md` enthalten die konkreten Konfigurationen. Git-Deployments sind deaktiviert; Produktion ist zusätzlich im Expo-Build gesperrt, bis Produktionsauthentifizierung, Store und native Abnahme umgesetzt sind.

Commit `669e38fb9cea36ab55ed2fb63abed5962a3b8467` ist gepusht und in [Draft-PR #1](https://github.com/MisterMinni/ChoreoFlow/pull/1). [Linux-CI 38867122082](https://github.com/MisterMinni/ChoreoFlow/actions/runs/38867122082) ist erfolgreich. Die manuelle [Preview am stabilen Branch-Alias](https://choreoflow-git-codex-project-setup-bastian-minnichs-projects.vercel.app) läuft als Deployment `dpl_4p8z7E4cwNAcegbZrQWUsrgSwkwu` mit Status READY; `choreoflow.vercel.app` wurde nicht aktualisiert. Vercel-SSO schützt die gesamte Preview einschließlich `/share`; ein anonymer Supabase-Viewerlink allein überwindet diese vorgeschaltete Zugangsschranke nicht.

Der spätere Dokumentationscommit `cd5a094` ist gepusht und [CI 38869322092](https://github.com/MisterMinni/ChoreoFlow/actions/runs/38869322092) erfolgreich. Die App-Preview verwendet weiterhin den geprüften Quellcommit `669e38f`.

Supabase Auth Site URL entspricht exakt dem Branch-Alias. Erlaubte Redirects: `http://localhost:8081`, `http://127.0.0.1:8082` und `https://choreoflow-git-codex-project-setup-bastian-minnichs-projects.vercel.app`. Keine Wildcards. Die gespeicherten Werte wurden in einem neuen Dashboard-Tab erneut geprüft.

## Lokal

Node 22.14.0 war vorhanden und wurde verwendet. Unterstützte Entwicklungslinie: Node 22 ab 22.13, npm 11. `npm ci` im Root; `.env.local` ist optional. Expo lädt appbezogene Werte aus `apps/app/.env.local`. Auf keinen Fall Service-Role-/Secret-Keys unter `EXPO_PUBLIC_*` setzen.

Browserprojekte und Musik leben in IndexedDB auf genau dem verwendeten Origin. `localhost` und `127.0.0.1` sind verschiedene Speicherorte. Native Daten liegen in SQLite und dem App-Dokumentverzeichnis. Browserdaten können beim Löschen von Website-Daten verloren gehen; eigene Projektdateien separat sichern. Medienpakete und umfassende Medienbackups sind noch nicht implementiert.

## Verifizierter Cloudablauf am 16. Oktober 2026

Das echte, per Mail bestätigte Testkonto wurde in der App angemeldet; nach Reload blieb die Sitzung erhalten. Die aggregierte Auth-Prüfung bestätigte ein Konto, ein bestätigtes Konto und ein Konto mit erfolgreicher Anmeldung. Für den Funktionstest wurde eine separate synthetische Projektkopie mit acht Personen verwendet: Upload als Serverrevision 1, Veröffentlichung einer Formation mit vier Sekunden Dauer und Abruf durch einen lokalen Viewer auf getrenntem Origin ohne Supabase-Anmeldung.

Nach einer zusätzlichen Entwurfsformation und Upload als Revision 2 zeigte der neu geladene Viewer weiterhin die ursprüngliche Veröffentlichung. Die SQL-Prüfung bestätigte zwei Formationen im Entwurf bei Revision 2 gegenüber einer Formation in der Publikation mit `source_revision=1`. Nach Widerruf über die App wurde ein neuer Linkabruf abgelehnt. Ein App-Reload erhielt Serverstand-2-Metadaten und Widerrufstatus. Die Nachweise enthalten keine persönlichen Adressen oder Klartext-Linktokens im Repository. Details und Grenzen: [CLOUD.md](./CLOUD.md).

Die Datenpaket-Regressionssuite umfasst 29 bestandene Tests, darunter kontogebundene Requests, Kontoabmeldung/-wechsel, Wiederanmeldung, Retry und verspätete Downloads. Dies ist zusätzliche Adapterprüfung; reale Mehrgeräte- oder Zwei-Konto-Bearbeitung wurde damit nicht nachgewiesen. Der aktuelle Supabase-Security-Advisor meldet **WARN: `auth_leaked_password_protection` deaktiviert**. Die Schutzfunktion benötigt Pro; es wurde kein Upgrade ausgelöst. Frühere Nullbefunde und leere Datenbestände in `CLOUD.md` sind ausdrücklich historische Ergebnisse der zurückgerollten SQL-Tests.

## Noch erforderliche externe Einrichtung

- **Brevo-SMTP arbeitet im Supabase-Testprojekt.** Der eigene Key „ChoreoFlow Test“ ist aktiv; ein weiterer vorhandener Key blieb unverändert. Die deutsche Bestätigungsvorlage verwendet weiterhin `ConfirmationURL`. Registrierung, Mailbestätigung und App-Anmeldung eines echten Testkontos sind bestätigt; Brevo protokolliert Versand/Zustellung am 16. Oktober 2026 um 09:56 Uhr Europe/Berlin mit der Ersatzabsenderdomain `brevosend.com`. Persönliche Adresse und Zugangsdaten bleiben außerhalb des Repositorys. Klick-/Öffnungstracking ist laut Log weiterhin aktiv und vor Produktion zu klären. Wegen der Nutzung durch ein weiteres Projekt wurden die Kontoeinstellungen nicht verändert. Eigene Domain später; kein Domainkauf für den aktuellen Test nötig. [MAIL_SETUP.md](./MAIL_SETUP.md)
- Passwortreset und Kontolöschung, echte Prüfung mit zwei Konten und mehreren Geräten sowie echte Medien-Uploads/-Downloads bleiben offen. Eine Oberfläche zum Auswählen und Wiederherstellen gespeicherter Cloudprojekte fehlt; die aktuelle Cloudintegration sichert bewusst eine Kopie und veröffentlicht einen festen Probenstand.
- Das Expo-Projekt ist verifiziert und lokal verknüpft; eine bestätigte **Bundle-ID fehlt weiterhin**. Apple-Zugang, native Apple-Anmeldung und StoreKit-Produktkennungen bleiben ebenfalls erforderlich. Native Builds und Signierung sind noch offen. [STORE_RELEASE.md](./STORE_RELEASE.md)
- Separate Produktionsinstanz nach bewusster Entscheidung des Eigentümers. Keine automatische kostenpflichtige Supabase-Branch-Erzeugung.
- Budgetalarme/Verbrauchsgrenzen in beiden Anbietern; vollständige Backup- und Restore-Übung für Datenbank **und** Medien.

## Release und Rückfall

Vor einer manuellen Preview: `npm run check`, `npm run build:web`, `npm run test:e2e`. Geprüften Commit dokumentieren. Vercel-Preview bleibt unter SSO; ein normaler Git-Push veröffentlicht nichts. Für einen Web-Rückfall kann ein früherer geprüfter Build wieder bereitgestellt werden. SQL-Migrationen werden damit nicht rückgängig gemacht: additive Migrationen, Client-Schemakompatibilität und eigene Datenbanksicherung sind erforderlich. Bei Datenverlust keine irreversible Rückmigration ohne geprüften Restoreplan.

Keine Produktionsfreigabe, keine Store-Einreichung und keine gesetzlichen/vertraglichen Angaben wurden erledigt. Datenschutz-/Unternehmensdaten müssen vom Eigentümer stammen und fachlich geprüft werden.
