# Lokale Daten und optionale Cloud

`getRepository()` liefert einen lokalen Entwicklungsbereich. Browser verwenden IndexedDB; iOS/Android verwenden ausschließlich `expo-sqlite`. Es gibt keinen flüchtigen Fallback bei Speicherfehlern. `MemoryStore` ist ein expliziter Testadapter.

## UI-Vertrag

```ts
const repository = await getRepository();
const histories = await repository.list();
await repository.save(updatedHistory);
await repository.remove(projectId);
await repository.setSetting('theme', 'dark');
const theme = await repository.getSetting<'system' | 'light' | 'dark'>('theme');
```

`save` speichert Projekt, Undo/Redo und Outbox gemeinsam in einer Transaktion. Nach einer Core-Bearbeitung steigt die Projekt-Revision genau um eins. Veraltete Ansichten lösen `LocalConflictError` aus; die UI muss die noch nicht gespeicherte Arbeit erhalten und darf sie nicht durch ein Neuladen verwerfen. Ein unveränderter Wiederholungsaufruf erzeugt keinen zweiten Outbox-Eintrag.

Der Seed wird ausschließlich beim erstmaligen Anlegen eines lokalen Speicherbereichs erzeugt. Auch eine bewusst geleerte Projektliste bleibt nach Neustarts leer. Unbekannte Speicherversionen werden nicht zurückgesetzt. Die erste SQLite-Migration legt Tabelle und Versionsnummer in einer Transaktion an. Native Migration und SecureStore benötigen weiterhin einen echten iPhone-Test.

## Cloud

`getCloudService()` gibt ohne öffentliche Supabase-Konfiguration `null` zurück. `CloudService.signIn/signUp/signOut` verwenden echte Supabase-E-Mail-Authentifizierung. Browser-Sitzungen liegen getrennt in IndexedDB; native Sitzungen liegen in SecureStore, aufgeteilt in kleine Einträge mit zuletzt geschriebenem Manifest. Es werden ausschließlich moderne Publishable-Keys akzeptiert.

Ein angemeldetes Konto erhält über `getRepository({identity:{kind:'cloud',userId}})` einen **getrennten** Speicherbereich. Lokale Testdaten werden nicht automatisch in diesen Bereich übernommen. Eine bewusste Projektkopie darf anschließend mit `service.sync(repository)` übertragen werden.

Die Outbox erhält stabile UUIDs. Lokale Core-Projektkennungen werden auf separate Cloud-UUIDs abgebildet. Serverrevisionen sind getrennt von den lokalen Undo/Redo-Revisionen. Die RPCs `create_project`, `save_project` und `archive_project` werden seriell aufgerufen. Bei Netzwerkfehlern bleibt die Outbox für einen idempotenten Wiederholungsversuch erhalten; bei `REVISION_CONFLICT` bleiben Entwurf und Outbox erhalten und der Konflikt wird gespeichert. Lokale Identitäten oder ein falsches Konto können nicht synchronisieren.

Der erste Adapter überträgt zusammengefasste Projektstände nach gespeicherten Bearbeitungen. Er implementiert noch keine Live-Präsenz, automatische Zusammenführung, Dateiuploads, Gerätemedienverwaltung oder eine Konfliktauflösungsoberfläche. Snapshots in der Cloud-Outbox werden erst nach Bestätigung entfernt. Native Offline-/Neustart- und Auth-Tests sind auf einem echten Gerät erforderlich. Simulierte Tests belegen ausschließlich das getestete Speicher- und RPC-Verhalten.

`publishProject` veröffentlicht ohne Medien; `createShareLink/readShare/revokeShareLink` bilden die getrennte Zuschauerfreigabe ab. Tokens dürfen weder in Logs noch in URL-Query-Parametern gespeichert werden.

## Tests

`test/repository.test.ts` prüft die Vertragslogik gegen MemoryStore und fake-indexeddb: Persistenz, Wiederöffnen, einmaliges Seeding, getrennte Konten, atomare Fehler, veraltete Bearbeitungen und Versionsschutz. `test/cloud.test.ts` prüft RPC-Verträge mit kontrollierten Antworten: Identitätsgrenzen, CAS-Reihenfolge, idempotente Netzwerk-Wiederholung und Konflikterhalt. Diese Tests ersetzen keine echten Supabase-Anmelde- oder Gerätetests.

Offizielle SQLite-API: https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/
