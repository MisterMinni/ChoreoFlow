# Betrieb und offene Konfiguration

## Bestehende Ressourcen

GitHub `MisterMinni/ChoreoFlow`; Vercel `bastian-minnichs-projects/choreoflow`; Supabase-Testprojekt `zhuslvtfktpclopkoqtf`, Frankfurt. Die Supabase-Organisation wurde als **Free** ausgelesen, entgegen der Pro-Annahme im Produktdokument. Kein Tarif wurde geändert.

Der Eigentümer hat unter Expo-Nutzer `BastianExpo` das Projekt [choreoflow/bastianexpo](https://expo.dev/accounts/choreoflow/projects/bastianexpo) angelegt. Nach seinem Login wurden im Expo-Dashboard Owner `choreoflow`, Slug `bastianexpo` und Projekt-UUID `733a2847-f234-4b34-bbf5-d7036b6d922f` verifiziert. `apps/app/app.config.ts` enthält diese Verknüpfung; die von Expo geladenen Konfigurationswerte wurden erfolgreich geprüft. Es wurde dadurch kein nativer Build erstellt oder signiert.

`docs/VERCEL.md` und `docs/CLOUD.md` enthalten die konkreten Konfigurationen. Git-Deployments sind deaktiviert; Produktion ist zusätzlich im Expo-Build gesperrt, bis Produktionsauthentifizierung, Store und native Abnahme umgesetzt sind.

## Lokal

Node 22.14.0 war vorhanden und wurde verwendet. Unterstützte Entwicklungslinie: Node 22 ab 22.13, npm 11. `npm ci` im Root; `.env.local` ist optional. Expo lädt appbezogene Werte aus `apps/app/.env.local`. Auf keinen Fall Service-Role-/Secret-Keys unter `EXPO_PUBLIC_*` setzen.

Browserprojekte und Musik leben in IndexedDB auf genau dem verwendeten Origin. `localhost` und `127.0.0.1` sind verschiedene Speicherorte. Native Daten liegen in SQLite und dem App-Dokumentverzeichnis. Browserdaten können beim Löschen von Website-Daten verloren gehen; eigene Projektdateien separat sichern. Medienpakete und umfassende Medienbackups sind noch nicht implementiert.

## Noch erforderliche externe Einrichtung

- Auth-Site-URL und exakte Redirect-Allowlist im Supabase-Dashboard setzen, nachdem die dauerhaft gewünschte Testadresse feststeht. Keine pauschale öffentliche Wildcard für fremde Domains.
- **Brevo wurde als SMTP-Anbieter gewählt.** Vorläufig wird die vom Eigentümer benannte Gmail-Adresse verwendet; sie wird nicht im Repository gespeichert. Brevo ersetzt dabei die nicht authentifizierbare Gmail-Absenderdomain durch `brevosend.com`. Eigene Domain später; kein Domainkauf für den aktuellen Test nötig. Brevo-Zugang, SMTP-Key, Tracking-Konfiguration und Zustelltest bleiben offen. [MAIL_SETUP.md](./MAIL_SETUP.md)
- Das Expo-Projekt ist verifiziert und lokal verknüpft; eine bestätigte **Bundle-ID fehlt weiterhin**. Apple-Zugang, native Apple-Anmeldung und StoreKit-Produktkennungen bleiben ebenfalls erforderlich. Native Builds und Signierung sind noch offen. [STORE_RELEASE.md](./STORE_RELEASE.md)
- Separate Produktionsinstanz nach bewusster Entscheidung des Eigentümers. Keine automatische kostenpflichtige Supabase-Branch-Erzeugung.
- Budgetalarme/Verbrauchsgrenzen in beiden Anbietern; vollständige Backup- und Restore-Übung für Datenbank **und** Medien.

## Release und Rückfall

Vor einer manuellen Preview: `npm run check`, `npm run build:web`, `npm run test:e2e`. Geprüften Commit dokumentieren. Vercel-Preview bleibt unter SSO; ein normaler Git-Push veröffentlicht nichts. Für einen Web-Rückfall kann ein früherer geprüfter Build wieder bereitgestellt werden. SQL-Migrationen werden damit nicht rückgängig gemacht: additive Migrationen, Client-Schemakompatibilität und eigene Datenbanksicherung sind erforderlich. Bei Datenverlust keine irreversible Rückmigration ohne geprüften Restoreplan.

Keine Produktionsfreigabe, keine Store-Einreichung und keine gesetzlichen/vertraglichen Angaben wurden erledigt. Datenschutz-/Unternehmensdaten müssen vom Eigentümer stammen und fachlich geprüft werden.
