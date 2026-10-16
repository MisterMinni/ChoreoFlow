# Abhängigkeiten: Prüfstand 16. Oktober 2026

Der installierte Stack verwendet Expo 58.0.12, Expo Router 58.0.21, React Native 0.88.0, React 19.3.0 und Node 22.14 lokal. Native SDK-Abhängigkeiten wurden über Expo aufgelöst. Der Lockfile ist die reproduzierbare Paketbasis.

## Sicherheitsprüfung

`npm audit --json` wurde gegen die offizielle npm-Registry ausgeführt. Nach dem passenden Expo-Patchupdate meldet die erneute Prüfung **28 betroffene Paketknoten**, davon **20 high, 8 moderate, 0 critical** (zuvor 27/19/8). Dies sind überwiegend transitive Meldungen entlang der Expo-/Metro-Buildwerkzeuge, nicht 28 unabhängige Sicherheitslücken. Der erste Sandbox-Lauf scheiterte an DNS; der freigegebene Netzwerklauf lieferte den Bericht. Es wurde kein automatischer Fix ausgeführt.

| Ursprung | Installierter Pfad / Bereich | Befund und Bewertung |
| --- | --- | --- |
| `braces@3.0.3` | `node_modules/braces`; `micromatch@4.0.8` → Metro-Dateisuche → Expo-CLI | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): tief verschachtelte Muster können den Node-Prozess beenden. Laut Advisory aktuell kein Patch. Betrifft die Entwicklung-/Build-Werkzeugkette; keine Verwendung als Projektimport-Parser im App-Code. |
| `node-forge@1.4.0` | `node_modules/node-forge`; `@expo/cli@58.1.10` und `@expo/code-signing-certificates` | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv): fehlerhafte RSA-Signaturprüfung. Laut Advisory aktuell kein Patch. Relevant für Expo-Zertifikats-/Signierwerkzeuge; vor signiertem Native-Release erneut bewerten. |
| `uuid@7.0.3` | `node_modules/uuid`; `xcode@3.0.1` → Expo-Config-Plugins | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): Buffer-Grenzen bei `v3/v5/v6`; gepatchte Versionen unter anderem 11.1.1. `node_modules/xcode/lib/pbxProject.js:90` verwendet `uuid.v4()`, der konkret geprüfte Aufruf ist nicht die betroffene API. Ein Major-Override ist trotzdem kein ungeprüfter sicherer Ersatz. |

Die Anzahl ergibt sich durch weitergereichte Betroffenheit unter anderem in Expo, Expo-CLI, Config-Plugins, Metro, React Native und Reanimated. Ein Produktionsbundle wurde durch diese Paketprüfung nicht automatisch als angreifbar oder sicher bewiesen. Native Signierung und tatsächliche Exposition der Buildwerkzeuge bleiben eigene Prüfbereiche.

`npm audit` schlägt unter anderem Expo 44.0.6 und React Native 0.72.17 als Major-Wechsel vor. **Kein `npm audit fix --force` ausführen**: Diese Downgrades passen nicht zum Expo-58-Stack. Stattdessen passende Upstream-Patches prüfen, gezielte kompatible Updates mit Lockfile durchführen und Build-/Gerätetests wiederholen. Bis dahin die offenen Meldungen als Release-Prüfpunkt erhalten. Es wurde kein Sicherheitsbefund durch ein willkürliches Override ausgeblendet.

## Worklets-Peer-Abweichung durch SDK-Patch behoben

Unter Expo 58.0.11 widersprachen sich die installierten Primärmetadaten:

- `node_modules/expo/bundledNativeModules.json`: `react-native-worklets=0.13.0`, `react-native-reanimated=4.7.1`, `react-native=0.88.0`.
- `react-native-reanimated@4.7.1`: Peer `react-native-worklets: 0.13.x`; React Native `0.86 - 0.88`.
- `expo-modules-core@58.0.19`: optionaler Worklets-Peer nur `^0.7.4 || ^0.8.0 || ^0.9.0 || ^0.10.0`.

`npm ls` markierte deshalb Worklets 0.13.0 als `invalid`. Die [offizielle Expo-58-Dokumentation](https://docs.expo.dev/versions/v58.0.0/sdk/reanimated/) empfiehlt Reanimated 4.7.1 und Installation beider Pakete über `expo install`.

Das passende Update auf Expo 58.0.12 installiert `expo-modules-core@58.0.20`; dessen lokales `package.json` verlangt jetzt optional `react-native-worklets >=0.13.0`. Der Metadatenwiderspruch ist damit behoben, ohne Worklets-Downgrade oder Override. Reproduzierbares `npm ci`, Expo-Checks und der echte iPhone-Build bleiben getrennte Prüfungen. Korrekte Peer-Metadaten ersetzen keinen Gerätetest.

## Datenadapter-Prüfung

`packages/data` verwendet die installierten Expo-58-Schnittstellen für SQLite und SecureStore. Zum dokumentierten Prüfzeitpunkt: 19/19 gezielte Datenadaptertests bestanden, ESLint für `packages/data` bestanden, gemeinsamer TypeScript-Lauf bestanden. Native SQLite/SecureStore-Tests auf einem physischen iPhone stehen aus. Browser-/Mock-Ergebnisse ersetzen diese Tests nicht.

## Audio: implementierter Umfang und Grenzen

`apps/app/src/audio` importiert echte Audiodateien nach Metadatenprüfung bis 20 MiB und 600 Sekunden. Browser speichern die Originaldatei als Blob in IndexedDB; iOS/Android kopieren sie in das Dokumentverzeichnis der App. Projektmetadaten speichern eine stabile lokale Kennung. Datei und Projekt müssen auf demselben Gerät vorhanden sein; JSON-Export und Cloud-Sync übertragen die Musikdatei noch nicht. Fehlende lokale Dateien werden sichtbar gemeldet, lautlose Wiedergabe bleibt möglich. Entfernte/ersetzte Clips behalten die Datei für Undo; automatische Bereinigung alter Dateien ist noch offen.

Ein aktiver Clip unterstützt Trim, Projekt-Startzeit, Lautstärke und lineare Ein-/Ausblenden. Während des Clips steuert die tatsächliche `expo-audio`-Position die Choreografie; davor/danach läuft eine monotone Uhr. Die Ansicht aktualisiert sich mit maximal ungefähr 30 Hz. Pause, Sprung, 0,5–2-fache Geschwindigkeit und App-Unterbrechung werden berücksichtigt. Mehrere Clips und Teilen sind noch nicht umgesetzt. Browser können Autoplay oder Formate ablehnen; iOS Safari erlaubt keine programmgesteuerte Lautstärke, daher die native App für verlässliche Blenden verwenden.

Die Browser-Wellenform stammt aus dekodiertem Audiomaterial und wird aus Speichergründen nur bis 6 MiB/180 Sekunden berechnet. Größere Dateien bleiben abspielbar; native Wellenformen sind noch nicht implementiert. Drei isolierte Tests prüfen Zeitabbildung, Blenden und Importgrenzen. Ein gesonderter Browser-E2E-Test verwendet eine erzeugte WAV-Datei, echten Decoder/Player, Persistenz nach Reload und Clip-Trim. Native Datei-/Decoder-/Unterbrechungstests auf iPhone sind noch offen.
