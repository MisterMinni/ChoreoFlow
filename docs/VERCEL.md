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

- Quellcommit: `669e38fb9cea36ab55ed2fb63abed5962a3b8467`, gepusht; [Draft-PR #1](https://github.com/MisterMinni/ChoreoFlow/pull/1).
- Manuell erzeugtes Preview-Deployment: `dpl_4p8z7E4cwNAcegbZrQWUsrgSwkwu`, **READY**, Builddauer 49 Sekunden, exakt dieser Commit.
- [Unveraenderliche Deployment-URL](https://choreoflow-75cbckwvz-bastian-minnichs-projects.vercel.app).
- [Stabiler Branch-Alias](https://choreoflow-git-codex-project-setup-bastian-minnichs-projects.vercel.app), auch als Supabase Auth Site URL gesetzt. Fuer Browserdaten ist dieser gleichbleibende Origin gegenueber wechselnden Deployment-URLs vorzuziehen.
- [GitHub-Linux-CI 38867122082](https://github.com/MisterMinni/ChoreoFlow/actions/runs/38867122082): erfolgreich; 50/50 Tests sowie 10 bestandene Browserpruefungen und ein ausdruecklich uebersprungener Cloud-Viewer-Test ohne Cloudkonfiguration.

Der normale Browserzugriff landet weiterhin bei Vercel Login. Authentifizierte Abrufe von `/` und `/share` lieferten jeweils HTTP 200 mit echter Expo-HTML und Assets. Das belegt die Bereitstellung, ersetzt aber keinen vollstaendigen Online-Auth- oder Zuschauertest. Auch der auf App-Ebene anonyme Viewer bleibt auf dieser Preview durch Vercel-SSO geschuetzt.

Ein vorheriger API-Versuch mit `target: "preview"` wurde mit HTTP 400 abgewiesen und erzeugte kein Deployment. Das erfolgreiche Deployment verwendete `target: "staging"`.

## Ausgangszustand und Pruefgrenzen

Das zuvor vorhandene Production-Deployment `dpl_2JMXpUyse8dV2Lhm7KP4roTAvHzD` stammt vom Initial Commit `35b42e3871c83e152a556e7c4f85aa3840d6a3b4`. Es meldet zwar READY, erzeugte laut Build-Log aber keine veroeffentlichbaren Dateien. Es ist kein Nachweis fuer eine funktionierende App.

Die Produktionsdomain `choreoflow.vercel.app` wurde nicht aktualisiert und ist keine Vorschau dieses Entwicklungsstands. SMTP, native Apple-Anmeldung, EAS-Signierung, Store-Produkte und Produktions-Supabase gehoeren zu getrennten Freigabeschritten.

## Primaerquellen

- [Vercel Git-Konfiguration](https://vercel.com/docs/project-configuration/git-configuration)
- [Vercel Build-Konfiguration](https://vercel.com/docs/builds/configure-a-build)
- [Vercel-Projekteinstellungen und Ignored Build Step](https://vercel.com/docs/project-configuration/project-settings)
- [Supabase-API-Schluessel](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase mit Expo](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth)
