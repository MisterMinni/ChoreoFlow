# Vercel-Testumgebung

Stand: 16. Oktober 2026. Dieses Projekt ist fuer die manuell veroeffentlichte Testfassung vorgesehen. Ein Produktivsystem mit eigener Supabase-Instanz ist noch nicht eingerichtet.

## Verifizierte Ziele

- Vercel: `bastian-minnichs-projects/choreoflow`
- Team-ID: `team_8qLAvC69b2s9pAZ4DMrxdDft`
- Projekt-ID: `prj_ybVb68h82tltuy6YQcF3LahckFz4`
- GitHub: `MisterMinni/ChoreoFlow`
- Supabase-Testprojekt: `zhuslvtfktpclopkoqtf`
- Supabase-URL: `https://zhuslvtfktpclopkoqtf.supabase.co`

Die lokale Zuordnung liegt in `.vercel/project.json` und darf nicht versioniert werden. Bei einem neuen Checkout das bestehende Projekt explizit verknuepfen; kein neues Projekt anlegen. Vor CLI-Aktionen Projekt und Team mit `vercel project inspect` kontrollieren.

## Build-Konfiguration

Per Vercel-Connector gespeichert:

| Einstellung | Wert |
| --- | --- |
| Root Directory | Repository-Wurzel (`null` in der API) |
| Framework | Other (`null`) |
| Install Command | `npm ci` |
| Build Command | `npm run build:web` |
| Output Directory | `apps/app/dist` |
| Node.js | `22.x` |

Node 22.x und der unveraenderte Vercel-SSO-Schutz wurden erneut ausgelesen. Der Connector bestaetigt die Einstellungsaktualisierung, gibt Root-, Install-, Build- und Output-Felder beim Lesen jedoch nicht zurueck. Der erste bewusst gestartete Preview-Build ist inzwischen erfolgreich abgeschlossen; echte Expo-HTML- und Asset-Dateien werden ausgeliefert.

SSO bleibt fuer `all_except_custom_domains` aktiv. Keine Custom Domains oder zusaetzlichen kostenpflichtigen Ressourcen wurden eingerichtet.

## Umgebungsvariablen

Diese drei Konfigurationsvariablen wurden fuer **Preview und Development**, nicht fuer Production, gespeichert und ihre Zielumgebungen erneut geprueft:

- `EXPO_PUBLIC_APP_ENV=staging`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Der aktive moderne Publishable-Key stammt direkt vom bestaetigten Supabase-Testprojekt. Es wurde kein privilegierter Secret- oder Service-Role-Key verwendet. `EXPO_PUBLIC_*` wird in Client-Bundles eingebaut und darf niemals privilegierte Zugangsdaten enthalten. Rechte muessen durch Supabase-Authentifizierung, Grants und RLS begrenzt sein.

Expo liest lokale Werte in `apps/app/.env.local`; Vorlagen liegen dort und in der Repository-Wurzel. Die lokale Datei setzt `EXPO_PUBLIC_APP_ENV=local` und enthaelt nur oeffentliche Testprojekt-Konfiguration. Lokale Bearbeitung muss auch mit leeren Supabase-Werten funktionieren. `.env.local` niemals committen. Ein spaeteres `vercel env pull` ueberschreibt Dateien und kann `EXPO_PUBLIC_APP_ENV=staging` eintragen; lokale Betriebsart danach bewusst pruefen.

## Bewusste Veroeffentlichung

`vercel.json` muss `git.deploymentEnabled: false` enthalten. Damit werden automatische Git-Deployments verhindert. Keine Produktionsfreigabe durch einen normalen Push nach `main`. Ein Ignored-Build-Kommando ist kein gleichwertiger Ersatz, weil abgebrochene Builds weiterhin Deployment-Kontingente belegen.

1. Lokal `npm ci`, die Projektpruefungen und `npm run build:web` ausfuehren.
2. Sicherstellen, dass der gepruefte Commit die Git-Deployment-Sperre enthaelt und keine `.env.local`/`.vercel`-Dateien versioniert sind.
3. Erst danach ausdruecklich ein **Preview** fuer diesen Commit erzeugen. Beim hier verwendeten Deployment-API-Aufruf ist `target: "staging"` der akzeptierte Wert. Keine Production-Promotion und kein `--prod`.
4. Status und Build-Logs kontrollieren; Preview unter bestehendem SSO-Schutz testen. Datenbankrechte separat pruefen.
5. Commit, Deployment-ID, Testresultate und die letzte funktionierende Preview als Rueckfallstand dokumentieren. Supabase-Migrationen nicht durch einen Web-Rollback rueckgaengig machen.

Die lokale Vercel-CLI 41.6.2 konnte bei der Bestandspruefung keinen Benutzer laden. Die bestehende Connector-Verbindung funktioniert; CLI-Deployments setzen eine funktionierende Anmeldung voraus. Keine Tokens in Befehlsargumente oder Logs schreiben.

## Bereitgestellter und gepruefter Stand

- App-Quellcommit: `0a8d962749f4a551657f7ce5c5075efe72655779`, gepusht; [Draft-PR #1](https://github.com/MisterMinni/ChoreoFlow/pull/1).
- Manuell erzeugte Preview: `dpl_CatNxFUoK1L9Q87osSw7EZ61jdtC`, **READY**, Builddauer 56 Sekunden, exakt dieser Commit.
- [Unveraenderliche Deployment-URL](https://choreoflow-q6ve5bfpw-bastian-minnichs-projects.vercel.app).
- [Stabiler Branch-Alias](https://choreoflow-git-codex-project-setup-bastian-minnichs-projects.vercel.app), weiterhin Supabase Auth Site URL.
- [GitHub-Linux-CI 38875139539](https://github.com/MisterMinni/ChoreoFlow/actions/runs/38875139539): erfolgreich. Lokale Abnahme: 86 Fachtests, 14 Browserablaeufe. Der simulierte Viewer wird in CI ohne Cloudkonfiguration ausgelassen.
- Spaetere reine Test-/Dokumentationskorrekturen veraendern den bereitgestellten Appstand nicht.
- Vorheriger funktionierender Rueckfallstand: `669e38f` / `dpl_4p8z7E4cwNAcegbZrQWUsrgSwkwu`.

Authentifizierte Abrufe von `/` und `/share` liefern HTTP 200 mit echten Expo-Dateien. Vercel-SSO bleibt unveraendert aktiv, auch vor dem auf App-Ebene anonymen Viewer. Die reale Login-/Freigabe-/Widerrufpruefung fand lokal gegen das echte Supabase-Testprojekt statt; diese HTTP-Abrufe sind kein weiterer vollstaendiger Online-Browsertest. Die Production-Domain wurde nicht aktualisiert.

Das Deployment verwendet `target: "staging"`, den von dieser API akzeptierten Preview-Wert. Git-Autodeploy bleibt deaktiviert.

## Ausgangszustand und Pruefgrenzen

Das zuvor vorhandene Production-Deployment `dpl_2JMXpUyse8dV2Lhm7KP4roTAvHzD` stammt vom Initial Commit `35b42e3871c83e152a556e7c4f85aa3840d6a3b4`. Es meldet zwar READY, erzeugte laut Build-Log aber keine veroeffentlichbaren Dateien. Es ist kein Nachweis fuer eine funktionierende App.

Die Produktionsdomain `choreoflow.vercel.app` wurde nicht aktualisiert und ist keine Vorschau dieses Entwicklungsstands. Brevo-SMTP und die deutsche Registrierungsbestaetigungsvorlage sind im Supabase-Testprojekt gespeichert. Registrierung, protokollierte Mailzustellung und E-Mail-Bestaetigung eines echten Testkontos waren erfolgreich; die spätere App-Anmeldung einschließlich Sitzung nach Reload und echter Cloud-Freigabeprüfung ist inzwischen erfolgreich. Diese End-to-End-Prüfung lief lokal gegen das echte Supabase-Testprojekt. Das Brevo-Log zeigt weiterhin aktives Klick-/Oeffnungstracking. Dessen Umgang ist vor Produktion zu klaeren; die auch von einem anderen Projekt verwendeten Kontoeinstellungen blieben unveraendert. Native Apple-Anmeldung, EAS-Signierung, Store-Produkte und Produktions-Supabase gehoeren zu getrennten Freigabeschritten.

## Primaerquellen

- [Vercel Git-Konfiguration](https://vercel.com/docs/project-configuration/git-configuration)
- [Vercel Build-Konfiguration](https://vercel.com/docs/builds/configure-a-build)
- [Vercel-Projekteinstellungen und Ignored Build Step](https://vercel.com/docs/project-configuration/project-settings)
- [Supabase-API-Schluessel](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase mit Expo](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth)
