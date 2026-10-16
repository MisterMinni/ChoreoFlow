# Cloud-Testumgebung

Stand: 16. Oktober 2026. Der Nutzer hat das vorhandene, zuvor leere Projekt ausdrücklich als **Testumgebung** freigegeben. Keine Produktionsfreigabe; keine neuen Projekte oder kostenpflichtigen Ressourcen angelegt.

- Projekt: `zhuslvtfktpclopkoqtf`, Name `ChoreoFlow`, Frankfurt (`eu-central-1`).
- Verifizierter Organisationstarif: **Free**. Die Pro-Annahme im Ausgangsdokument trifft auf diese Organisation derzeit nicht zu.
- Angewandte Migration: `supabase/migrations/20261016063110_initial_cloud.sql`.
- Folge-Migration: `supabase/migrations/20261016064646_align_core_contract.sql` (200-Zeichen-Titel und Audio-MIME-Typen an Core angeglichen).
- Die Datei wurde mit `supabase migration new initial_cloud` erzeugt und nach Anwendung über den Connector an den tatsächlichen Server-Migrationsstempel angeglichen.
- Generierte Datenbanktypen: `supabase/database.types.ts`.

## Daten und Zugriffsmodell

`projects` enthält einen JSONB-Snapshot mit numerischem `schemaVersion: 1`, eine unabhängige Serverrevision und eine UUID als Cloud-ID. Die interne `snapshot.id` bleibt die Core-ID. Der Client speichert die Zuordnung getrennt. Ein Projekt-Snapshot ist auf 4 MiB begrenzt; ein Besetzungs-Snapshot auf 1 MiB. Die vollständige fachliche Core-Validierung erfolgt derzeit im Client; SQL prüft Objektform, Version und Größe, nicht alle Bewegungsinvarianten.

Alle sieben Anwendungstabellen haben RLS und explizite Privilegien. Clients haben nur die vorgesehenen Leserechte; Schreibzugriffe laufen über atomare RPCs. Exponierte RPCs sind `SECURITY INVOKER`; privilegierte Implementierungen liegen im nicht exponierten Schema `private`, mit festem leerem `search_path`, begrenzten EXECUTE-Rechten und Identitätsprüfung. Die absichtlich anonyme Ausnahme `read_share` prüft eine zufällige Capability.

Eigentümer dürfen ihre Projekte bearbeiten. Eingeladene Leser dürfen das Projekt einschließlich seines Entwurfs lesen. Bearbeiter dürfen nur bei einem gültigen, serverseitig eingetragenen Pro-Anspruch des Eigentümers speichern; maximal vier zusätzliche Bearbeiter sind zulässig. Mitgliedschaften dürfen ausschließlich Eigentümer ändern. Das vorhandene `rls_auto_enable()` hat keine EXECUTE-Rechte für PUBLIC, anon oder authenticated mehr.

`entitlements` ist für Clients unveränderlich. Der Client darf ausschließlich den eigenen Anspruch lesen. Es existiert **kein Kauf-Verifizierer und keine freigeschaltete Produktions-Testumgehung**. `test_fixture` wird ausschließlich von zurückgerollten SQL-Tests als Quelle verwendet. Vor Produktion muss ein verifizierender Apple-Backendpfad implementiert und die akzeptierte Quelle auf die jeweilige Umgebung begrenzt werden.

## RPC-Vertrag

Alle IDs in RPC-Parametern sind Cloud-UUIDs, sofern nicht ausdrücklich anders angegeben.

| RPC | Parameter | Ergebnis |
|---|---|---|
| `create_project` | `p_title`, `p_snapshot`, optional `p_project_id` | Projektzeile, Serverrevision 1 |
| `save_project` | `p_project_id`, `p_base_revision`, `p_command_id`, `p_snapshot` | `{project_id, revision, duplicate}` |
| `archive_project` | `p_project_id`, `p_archived` | Projektzeile |
| `set_project_member` | `p_project_id`, `p_user_id`, `p_role` (`reader`, `editor` oder NULL zum Entfernen) | void |
| `save_cast` | `p_cast_id`, `p_title`, `p_snapshot` (mit `schemaVersion:1`), `p_base_revision` (0 bei Anlage) | Besetzungszeile |
| `publish_project` | `p_project_id`, `p_base_revision`, optional `p_include_media` (false) | Unveränderliche Publikation |
| `create_share_link` | `p_publication_id`, optional `p_expires_at` (30 Tage) | `{id, token, expires_at, publication_id}` |
| `revoke_share_link` | `p_link_id` | void |
| `read_share` | `p_token` | Öffentliche Publikation oder NULL; auch anonym |

`create_project` ist mit identischer UUID, identischem Titel und Snapshot wiederholbar. Eine andere Payload auf dieselbe ID schlägt fehl. `save_project` prüft die Basisrevision unter Sperre. Ein identischer wiederholter Befehl liefert sein ursprüngliches Revisionsergebnis; eine wiederverwendete Befehls-ID mit anderer Payload wird abgelehnt. Veraltete oder fehlende Basisrevisionen liefern SQLSTATE `40001` / `REVISION_CONFLICT`. Der Titel folgt beim Speichern `snapshot.name`.

Dies ist ein Konflikt-erkennender Snapshot-Abgleich. Ein serverseitiges Zusammenführen unabhängiger Fachbefehle, ein Zwei-Geräte-Teamtest, Objektsperren und 30 Tage wiederherstellbare historische Snapshots sind **noch nicht implementiert**. `project_commands` speichert Idempotenzbelege und Hashes, keine vollständigen historischen Projektstände. Es gibt noch keinen automatischen Aufbewahrungsjob für diese Belege.

Der Datenadapter verifiziert das für eine Aktion erfasste Zugriffstoken serverseitig und bindet seine authentifizierten PostgREST-Aufrufe an dieses Token. Kontoabmeldung oder Kontowechsel stoppen weitere Schritte; ein Tokenrefresh desselben Kontos bleibt zulässig. Veröffentlichungs- und Linkaktionen prüfen zusätzlich die erwartete Nutzer-ID. Kontospeicher und Outbox bleiben nach Nutzer-ID getrennt. Verspätete Downloads dürfen weder einen inzwischen bestätigten neueren Stand noch bei gleicher Serverrevision lokale Medienreferenzen und Undo-Historie ersetzen. Diese Fälle sowie Wiederanmeldung, Retry und CAS sind durch die am 16. Oktober bestandenen **29 Datenpakettests** abgedeckt; sie ersetzen keinen echten Test mit zwei Konten oder Geräten.

## Veröffentlichungen und Dateien

Eine Veröffentlichung kopiert den ausdrücklich ausgewählten, bereits gespeicherten Serverstand. Der Server verwendet eine v1-Feld-Allowlist, entfernt unbekannte Metadaten, setzt Projektnotizen auf `[]` und Hebefigurnotizen auf `""`. Lokale Medien-URIs werden immer entfernt. Ohne ausdrückliche Medienfreigabe enthält der Snapshot `audio: {assets: [], clips: []}`. Änderungen am Entwurf verändern Veröffentlichungen nicht.

Linktokens enthalten 256 zufällige Bits. Die Datenbank speichert ausschließlich SHA-256-Hashes. Die Klartext-Capability wird nur einmal beim Erstellen zurückgegeben. Gültigkeit maximal 365 Tage; widerrufene oder abgelaufene Links liefern NULL. Der Viewer verwendet `/share#token=…`: das Fragment wird nicht im HTTP-Request oder Referer übertragen. Keine Tokens in Logs oder Telemetrie schreiben.

Der private Bucket `project-media` akzeptiert Audio-MIME-Typen und höchstens 20 MiB je Datei. Pfad: `<owner UUID>/<cloud project UUID>/<filename>`. Nur Eigentümer schreiben, Mitglieder lesen. INSERT, SELECT und UPDATE sind für korrekt berechtigte Upserts abgedeckt. Ein Datenbanktrigger serialisiert Upload- und Projektquota-Prüfungen pro Eigentümer. Free: 100 MiB, Pro: 1 GiB; gezählt werden aktuelle Projekt-/Besetzungs-Snapshots, veröffentlichte Snapshots und Storage-Metadaten `size`. Das ist die Anwendungsspeicherquote, nicht eine Zusicherung der gesamten PostgreSQL-Disk- oder Traffic-Kosten. Bei Überschreitung werden nur positive Zuwächse abgelehnt, nichts gelöscht.

Die Storage-Regeln wurden über Metadaten-Transaktionen geprüft. Ein echter Audio-Upload/Download, Inhaltsprüfung anhand der Dateibytes, signierte URLs für anonyme Medienfreigaben sowie Medienbackup und Kontolöschungsbereinigung sind noch offen. Der Web-Viewer ist deshalb derzeit lautlos. Bereits ausgegebene signierte URLs können bis zu ihrem Ablauf funktionieren; spätere Implementierungen müssen kurze Laufzeiten verwenden.

Private Realtime-Kanäle müssen `project:<cloud UUID>` heißen und mit `private:true` abonniert werden. RLS erlaubt Projektmitgliedern Senden und Lesen. Der Autorisierungspredikat-Test besteht; echte WebSocket-Sitzungen, Widerruf bei bestehender Verbindung und Presence wurden noch nicht Ende-zu-Ende geprüft.

## Ausgeführte Datenbanktests

`supabase/tests/isolation.sql` wurde erfolgreich gegen das bestätigte Testprojekt ausgeführt. Der Test erstellt drei synthetische Auth-Identitäten innerhalb einer Transaktion und rollt alle Daten zurück. Er verschickt keine E-Mails und lädt keine externen Dateien hoch.

Geprüft: fremde Projekte/Besetzungen/Publikationen/Medien unsichtbar; direkte Writes und Abo-/Mitgliedschafts-Eskalation abgelehnt; fehlende/falsch typisierte Schema-Version; CAS, Wiederholung und widersprüchliche Befehls-ID; Null-Basisrevision; Free-Projekt-, Reaktivierungs-, Besetzungs- und Speicherlimits; Storage-Upsert und Größenlimit; Leserrechte; Pro-Bearbeiter und Pro-Ablauf; Veröffentlichung ohne private Notizen/URIs; unveränderlicher Probenstand; anonymer Tokenzugriff, ungültiges Token und Widerruf.

Zusätzlich wurden die vollständigen Core-Testprojekte „Reihe“ und „Show“ durch die tatsächlich installierte SQL-Veröffentlichungsfunktion geschickt. Beide Medienmodi bestanden anschließend `assertValidProject`; die Szenen bei jedem 0,25-Sekunden-Schritt waren identisch zum Original, einschließlich voller Drehung und Hebefiguren. Private Notizen und lokale URIs waren entfernt. Reproduzierbarer Prüfhelfer: `supabase/tests/viewer-roundtrip.ts`.

Unmittelbar nach den damaligen SQL-Tests erneut bestätigt: **0 Auth-Nutzer, 0 Projekte, 0 Publikationen, 0 Medienobjekte**. Dies ist ausschließlich der historische Stand nach dem Rollback, vor der echten Registrierung und den unten beschriebenen Cloudtests. Auch **keine Security-Advisor-Befunde** und zwei Performance-INFO-Hinweise auf damals ungenutzte Fremdschlüsselindizes beziehen sich auf diesen früheren Prüfzeitpunkt.

Die spätere lesende Prüfung am 16. Oktober bestätigt weiterhin RLS auf allen sieben Anwendungstabellen, die beiden angewandten Migrationen und fehlende direkte Schreibrechte auf `projects` für `anon`/`authenticated`. Der aktuelle Security-Advisor meldet **WARN: `auth_leaked_password_protection` deaktiviert**. Supabase bietet den Schutz gegen bekannte kompromittierte Passwörter ab Pro an; die Testorganisation bleibt Free. Es wurde kein kostenpflichtiges Upgrade vorgenommen. Dieser Befund bleibt offen und darf nicht als aktueller Nullbefund dargestellt werden.

Wiederholung: Inhalt der Testdatei im SQL-Editor des ausdrücklich benannten Testprojekts ausführen oder über den Supabase-Connector `execute_sql` ausführen. Die Datei enthält `BEGIN` und `ROLLBACK`. Nicht gegen Produktion ausführen. Migrationen erfolgen manuell und nur nach Review; es gibt keine automatischen Produktionsmigrationen.

## Gespeicherte Auth-URLs

Im angemeldeten Supabase-Dashboard gespeichert und in einem neuen Tab erneut verifiziert:

- Site URL: `https://choreoflow-git-codex-project-setup-bastian-minnichs-projects.vercel.app`.
- Redirect-Allowlist ausschließlich: `http://localhost:8081`, `http://127.0.0.1:8082` und `https://choreoflow-git-codex-project-setup-bastian-minnichs-projects.vercel.app`.
- Keine Wildcards. Die Vercel-Preview ist unter diesem Branch-Alias bereitgestellt und vollständig durch Vercel-SSO geschützt.

Die URL-Konfiguration ist kein Nachweis eines erfolgreichen Auth-Mail-Roundtrips. Der Eigentümer hat Brevo-SMTP inzwischen gespeichert. Nach erneutem Laden zeigte Supabase den SMTP-Schalter aktiv (`aria-checked=true`) und „Save changes“ deaktiviert. Ein frischer Brevo-Tab bestätigte den aktiven eigenen Key „ChoreoFlow Test“; der andere vorhandene Key blieb unverändert. Persönliche Adresse, SMTP-Login und Schlüsselwerte werden nicht im Repository dokumentiert.

Die deutsche Registrierungsbestätigung ist gespeichert: Betreff „ChoreoFlow: E-Mail-Adresse bestätigen“, Linkvariable `ConfirmationURL` unverändert. **Registrierung, E-Mail-Bestätigung und anschließende Anmeldung in der echten App sind erfolgreich.** Der Eigentümer bestätigte die Mail; die Registrierung speicherte `confirmation_sent_at=07:56:25 UTC` und `email_confirmed_at=07:56:40 UTC`. Die spätere aggregierte Auth-Prüfung am 16. Oktober 2026 ergab **ein Konto, ein bestätigtes Konto und ein Konto mit erfolgreicher Anmeldung**. Nach erneutem Laden der App blieb die Sitzung angemeldet. Persönliche Konto-/Mailadressen und Zugriffstokens werden nicht im Repository gespeichert.

Nach ausdrücklicher Freigabe geprüftes Brevo-Log: „ChoreoFlow: E-Mail-Adresse bestätigen“ wurde am 16. Oktober 2026 um 09:56 Uhr Europe/Berlin als „Versendet“ und „Zugestellt“ erfasst. Die Ersatzabsenderdomain `brevosend.com` ist im Log bestätigt. „Angeklickt“ um 09:56/09:57 Uhr und „Von Proxy geladen“ zeigen aktives Klick-/Öffnungstracking. Es besteht keine Trackingfreiheit; der Umgang damit ist vor Produktion zu klären. Die Kontoeinstellungen blieben wegen eines weiteren Projekts unverändert.

## Noch benötigte externe Einrichtung

- Umgang mit dem protokollierten Klick-/Öffnungstracking vor Produktion klären. Eigene Domain folgt später. Die persönliche Adresse bleibt außerhalb des Repositorys. Siehe `MAIL_SETUP.md`.
- Native Apple-Anmeldung, Bundle-/Team-IDs und Apple-Kaufverifikation.
- Getrenntes, bewusst freigegebenes Produktionsprojekt und passende Umgebungsvariablen; keine Testdaten oder `test_fixture`-Berechtigungen übertragen.
- Passwortreset, Accountlöschung, echter Zwei-Konto-Webtest und Mehrgeräte-Synchronisation. Ein bestätigtes Konto mit wiederhergestellter App-Sitzung ist belegt; weitere Konten oder Geräte wurden nicht real geprüft.
- Cloud-Wiederherstellung über eine Benutzeroberfläche sowie echte Medien-Uploads/-Downloads; der aktuelle Editor bietet bewusstes Sichern, aber noch keine Auswahl und Wiederherstellung gespeicherter Serverprojekte.
- Kostenwarnungen, tatsächliche Verbrauchsmessung, Datenbank- und separate Medienbackups mit Wiederherstellungstest.

Nur Publishable-Key und Projekt-URL gehören in `EXPO_PUBLIC_*`. Service-/Secret-Schlüssel dürfen niemals im Client oder Repository stehen.

Produktionsbuilds sind in `apps/app/app.config.ts` derzeit gesperrt. Separat geprüft wurden `APP_VARIANT=production`, `EXPO_PUBLIC_APP_ENV=production` und `VERCEL_ENV=production`: jeweils erwarteter Abbruch; lokale Development-Konfiguration lädt. Ein bereits gebautes Previewartefakt darf nicht per Promotion oder `--prebuilt --prod` veröffentlicht werden, da dabei kein neuer Buildguard ausgeführt wird.

## Bedienung der aktuellen Browserintegration

Im Editor unter **Freigaben** kann ein Testkonto per E-Mail/Passwort angelegt oder angemeldet werden. Die Anmeldung wechselt die lokale Projektliste nicht. **Im Testkonto sichern** überträgt bewusst eine Projektkopie über einen getrennten, persistenten Kontospeicher und eine Outbox. Der Button kann nach Offlinearbeit wiederholt werden; Konflikte bleiben als solche sichtbar. Der Projektdatei-Export bleibt erreichbar.

**Probenstand veröffentlichen** ist erst für den bestätigten aktuellen Cloudstand möglich. Der dabei angelegte Link wird einmalig angezeigt und kann kopiert werden. Seine nicht geheime Verwaltungs-ID bleibt im lokalen Kontospeicher, damit er auf diesem Gerät widerrufen werden kann. Eine geräteübergreifende Linkverwaltung fehlt noch. Unter `localhost` erstellte Links funktionieren nur auf dem eigenen Computer. Die manuell bereitgestellte Test-URL ist erreichbar, verlangt aber weiterhin Vercel-SSO-Zugang.

`/share#token=…` zeigt den unveränderlichen Stand ohne Supabase-Konto: 2D, Wiedergabe, Positionsregler, Geschwindigkeit, Wiederholung und persönliche Hervorhebung. **Auf der aktuellen Preview bleibt vorher Vercel-SSO erforderlich.** Der Viewer ist dort daher noch kein frei öffentlich erreichbarer Freigabelink. Es gibt keine Bearbeitungsaktionen. Musik, 3D im Viewer und native Deep Links sind noch offen. Automatisierte UI-Tests nutzen synthetische Antworten; die nachfolgend beschriebenen Prüfungen verwendeten zusätzlich das echte Testkonto und die echte Supabase-Datenbank.

## Echter Cloudablauf am 16. Oktober 2026

Nach Anmeldung des Eigentümers wurde eine separate synthetische Projektkopie mit acht Personen verwendet. Ein erster bewusster Upload legte Serverrevision 1 an. Die Veröffentlichung kopierte diesen Stand mit einer Formation und vier Sekunden Dauer. Ein Viewer auf einem getrennten lokalen Origin ohne Supabase-Anmeldung lud den Link und zeigte die acht Personen.

Anschließend wurde im Entwurf eine weitere Formation hinzugefügt und als Serverrevision 2 gesichert. Der Viewer zeigte nach erneutem Laden weiterhin den ursprünglichen Probenstand. Eine lesende SQL-Prüfung bestätigte den Unterschied: Entwurf mit zwei Formationen und Revision 2, Publikation mit einer Formation und `source_revision=1`. Damit ist die Unveränderlichkeit dieser tatsächlichen Veröffentlichung nachgewiesen.

Nach Widerruf in der App zeigte ein erneuter Linkabruf „ungültig, abgelaufen oder widerrufen“. Ein App-Reload erhielt die angemeldete Sitzung, die Metadaten zu Serverstand 2 und den lokalen Widerrufstatus. Dies belegt den Ablauf mit einem echten Konto und getrenntem anonymen Viewer-Origin; es belegt weder zwei Bearbeiterkonten noch geräteübergreifende Linkverwaltung. Mailadressen, Klartext-Linktokens und Zugangsdaten sind nicht Bestandteil dieser Dokumentation.
