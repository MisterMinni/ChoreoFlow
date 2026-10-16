# Cloud-Testumgebung

Stand: 16. Oktober 2026. Der Nutzer hat das vorhandene, zuvor leere Projekt ausdrücklich als **Testumgebung** freigegeben. Keine Produktionsfreigabe; keine neuen Projekte oder kostenpflichtigen Ressourcen angelegt.

- Projekt: `zhuslvtfktpclopkoqtf`, Name `ChoreoFlow`, Frankfurt (`eu-central-1`).
- Verifizierter Organisationstarif: **Free**. Die Pro-Annahme im Ausgangsdokument trifft auf diese Organisation derzeit nicht zu.
- Angewandte Migration: `supabase/migrations/20261016063110_initial_cloud.sql`.
- Folge-Migration: `supabase/migrations/20261016064646_align_core_contract.sql` (200-Zeichen-Titel und Audio-MIME-Typen an Core angeglichen).
- Team-Migration: `supabase/migrations/20261016090240_project_invitations.sql` (Einladungen, Zugriffsauskunft, Mitgliederverwaltung und `audio/aiff`).
- Storage-Korrektur: `supabase/migrations/20261016091914_storage_service_quota.sql` (interne Storage-Service-Schreibphase bei unveränderten RLS- und Quotalimits).
- Migrationsdateien wurden mit `supabase migration new` erzeugt. Bei Anwendung über den Connector wurden die lokalen Dateinamen an die anschließend mit `list_migrations` verifizierten Serverstempel angeglichen; der SQL-Inhalt blieb unverändert.
- Generierte Datenbanktypen: `supabase/database.types.ts`.

## Daten und Zugriffsmodell

`projects` enthält einen JSONB-Snapshot mit numerischem `schemaVersion: 1`, eine unabhängige Serverrevision und eine UUID als Cloud-ID. Die interne `snapshot.id` bleibt die Core-ID. Der Client speichert die Zuordnung getrennt. Ein Projekt-Snapshot ist auf 4 MiB begrenzt; ein Besetzungs-Snapshot auf 1 MiB. Die vollständige fachliche Core-Validierung erfolgt derzeit im Client; SQL prüft Objektform, Version und Größe, nicht alle Bewegungsinvarianten.

Die sieben Anwendungstabellen in `public` und die Einladungstabelle in `private` haben RLS und explizite Privilegien. Clients haben nur die vorgesehenen Leserechte; Schreibzugriffe laufen über atomare RPCs. Exponierte RPCs sind `SECURITY INVOKER`; privilegierte Implementierungen liegen im nicht exponierten Schema `private`, mit festem leerem `search_path`, begrenzten EXECUTE-Rechten und Identitätsprüfung. Die absichtlich anonyme Ausnahme `read_share` prüft eine zufällige Capability.

Eigentümer dürfen ihre Projekte bearbeiten. Eingeladene Leser dürfen das Projekt einschließlich seines Entwurfs lesen. Bearbeiter dürfen nur bei einem gültigen, serverseitig eingetragenen Pro-Anspruch des Eigentümers speichern; maximal vier zusätzliche Bearbeiter sind zulässig. Mitgliedschaften dürfen ausschließlich Eigentümer ändern. Das vorhandene `rls_auto_enable()` hat keine EXECUTE-Rechte für PUBLIC, anon oder authenticated mehr.

`entitlements` ist für Clients unveränderlich. Der Client darf ausschließlich den eigenen Anspruch lesen. Es existiert **kein Kauf-Verifizierer und keine freigeschaltete Produktions-Testumgehung**. `test_fixture` wird ausschließlich von zurückgerollten SQL-Tests als Quelle verwendet. Vor Produktion muss ein verifizierender Apple-Backendpfad implementiert und die akzeptierte Quelle auf die jeweilige Umgebung begrenzt werden.

## RPC-Vertrag

Alle IDs in RPC-Parametern sind Cloud-UUIDs, sofern nicht ausdrücklich anders angegeben.

| RPC | Parameter | Ergebnis |
|---|---|---|
| `create_project` | `p_title`, `p_snapshot`, optional `p_project_id` | Projektzeile, Serverrevision 1 |
| `save_project` | `p_project_id`, `p_base_revision`, `p_command_id`, `p_snapshot` | `{project_id, revision, duplicate}` |
| `archive_project` | `p_project_id`, `p_archived` | Projektzeile |
| `get_project_access` | `p_project_id` | `{role, can_edit, owner_id, owner_has_pro}` für den aufrufenden Berechtigten |
| `get_project_team` | `p_project_id` | Nur Eigentümer: `{members:[{user_id,email,role}], invitations:[{id,email,role,expires_at,accepted_at,revoked_at}]}`; Mitgliederliste enthält den Eigentümer |
| `create_project_invitation` | `p_project_id`, `p_email`, `p_role` (`reader` oder `editor`) | `{id, token, expires_at}`; sieben Tage gültig |
| `accept_project_invitation` | `p_token` | `{project_id}`; passende bestätigte Konto-E-Mail erforderlich |
| `revoke_project_invitation` | `p_invitation_id` | void; offene Einladung widerrufen |
| `set_project_member` | `p_project_id`, `p_user_id`, `p_role` (`reader`, `editor` oder NULL zum Entfernen) | void; ändert ausschließlich bereits bestehende Mitgliedschaften |
| `save_cast` | `p_cast_id`, `p_title`, `p_snapshot` (mit `schemaVersion:1`), `p_base_revision` (0 bei Anlage) | Besetzungszeile |
| `publish_project` | `p_project_id`, `p_base_revision`, optional `p_include_media` (false) | Unveränderliche Publikation |
| `create_share_link` | `p_publication_id`, optional `p_expires_at` (30 Tage) | `{id, token, expires_at, publication_id}` |
| `revoke_share_link` | `p_link_id` | void |
| `read_share` | `p_token` | Öffentliche Publikation oder NULL; auch anonym |

`create_project` ist mit identischer UUID, identischem Titel und Snapshot wiederholbar. Eine andere Payload auf dieselbe ID schlägt fehl. `save_project` prüft die Basisrevision unter Sperre. Ein identischer wiederholter Befehl liefert sein ursprüngliches Revisionsergebnis; eine wiederverwendete Befehls-ID mit anderer Payload wird abgelehnt. Veraltete oder fehlende Basisrevisionen liefern SQLSTATE `40001` / `REVISION_CONFLICT`. Der Titel folgt beim Speichern `snapshot.name`.

Dies ist ein Konflikt-erkennender Snapshot-Abgleich. Ein serverseitiges Zusammenführen unabhängiger Fachbefehle, ein Zwei-Geräte-Teamtest, Objektsperren und 30 Tage wiederherstellbare historische Snapshots sind **noch nicht implementiert**. `project_commands` speichert Idempotenzbelege und Hashes, keine vollständigen historischen Projektstände. Es gibt noch keinen automatischen Aufbewahrungsjob für diese Belege.

Der Datenadapter verifiziert das für eine Aktion erfasste Zugriffstoken serverseitig und bindet seine authentifizierten PostgREST- und Storage-Aufrufe an dieses Token. Kontoabmeldung oder Kontowechsel stoppen weitere Schritte; ein Tokenrefresh desselben Kontos bleibt zulässig. Veröffentlichungs-, Link-, Team- und Medienaktionen prüfen zusätzlich die erwartete Nutzer-ID. Kontospeicher und Outbox bleiben nach Nutzer-ID getrennt. Verspätete Downloads dürfen weder einen inzwischen bestätigten neueren Stand noch bei gleicher Serverrevision lokale Medienreferenzen und Undo-Historie ersetzen. Regressionsnachweise zu diesen Fällen, Wiederanmeldung, Retry und CAS stehen in `ACCEPTANCE.md`; sie ersetzen keinen echten Test mit zwei Konten oder Geräten.

## Projekte gemeinsam nutzen

Der Eigentümer kann in der Teamansicht einen Link für eine bestimmte E-Mail-Adresse und die Rolle Lesen oder Bearbeiten erstellen. **Dabei wird keine E-Mail versendet.** Der Link wird einmalig angezeigt und kann bewusst weitergegeben werden; sein Token bleibt nicht im lokalen Projektspeicher. Im Browser liegt es im Fragment `/#invite=…`. Die Annahme erfordert eine Anmeldung mit genau der bestätigten Adresse, für die der Eigentümer den Link erstellt hat. Ein öffentlicher Probenlink ist davon unabhängig und gewährt keine Mitgliedschaft.

Der Server normalisiert die Einladungsadresse und vergleicht sie bei der Annahme mit `auth.users.email` und `email_confirmed_at`, nicht mit frei bearbeitbaren Metadaten oder einer E-Mail aus dem JWT. Die betreffende Auth-Zeile bleibt während der Annahme mit `FOR SHARE` gesperrt. Tokens enthalten 256 Zufallsbits; `private.project_invitations` speichert nur SHA-256-Hashes. Die Tabelle hat keine direkten Client-Leserechte, auch nicht für Eigentümer. Nur die eigentümergebundene Team-RPC gibt die notwendigen E-Mail-Adressen und Statuswerte aus, niemals Tokens oder Hashes. Andere Projektmitglieder erhalten nur ihre eigene Zugriffsauskunft.

Einladungen gelten genau sieben Tage. Abgelaufene, widerrufene oder bereits angenommene Tokens können keine neue Mitgliedschaft erzeugen; insbesondere stellt ein alter Link ein entferntes Mitglied nicht wieder her. Ein erneuter Accept nach erfolgreichem Commit liefert `INVITATION_UNAVAILABLE`. Eine offene Einladung an dieselbe Adresse wird mit `INVITATION_PENDING` abgelehnt; zum Ersetzen wird die bisherige Einladung widerrufen. Bestehende Rollen werden über `set_project_member` geändert oder entfernt, nicht durch erneute Einladung oder direkten UUID-Upsert.

Leseeinladungen benötigen kein Pro. Für Bearbeitung muss der Eigentümer bei Erstellung, Annahme und Rollenänderung aktives Pro haben. Bestehende Bearbeiter und noch gültige offene Bearbeiter-Einladungen belegen gemeinsam höchstens vier Plätze. Alle diese Änderungen verwenden dieselbe Eigentümersperre; Herabstufung, Entfernung, Widerruf oder Ablauf gibt den betreffenden Platz frei. Nach Pro-Ablauf bleiben Mitglieder und Leserechte erhalten, aber `can_edit` wird für Bearbeiter falsch und serverseitiges Speichern wird abgewiesen. Bei archivierten Projekten werden neue Einladungen und Annahmen abgewiesen; die Zugriffsauskunft meldet keine Bearbeitung.

Die Backendabläufe wurden mit synthetischen Identitäten auf Staging geprüft. Zusätzlich wurde mit dem echten Eigentümerkonto über die Oberfläche eine Leseeinladung an eine synthetische Adresse unter `example.invalid` erstellt und widerrufen. Die lesende SQL-Prüfung bestätigte eine Einladung, einen Widerruf und keine Annahme; es wurde keine E-Mail verschickt. Eine Einladung an eine tatsächliche weitere Person wurde nicht versendet oder angenommen; ein realer Zwei-Konto-Teamtest und Mehrgeräte-Konfliktauflösung sind weiterhin offen.

## Veröffentlichungen und Dateien

Eine Veröffentlichung kopiert den ausdrücklich ausgewählten, bereits gespeicherten Serverstand. Der Server verwendet eine v1-Feld-Allowlist, entfernt unbekannte Metadaten, setzt Projektnotizen auf `[]` und Hebefigurnotizen auf `""`. Lokale Medien-URIs werden immer entfernt. Ohne ausdrückliche Medienfreigabe enthält der Snapshot `audio: {assets: [], clips: []}`. Änderungen am Entwurf verändern Veröffentlichungen nicht.

Linktokens enthalten 256 zufällige Bits. Die Datenbank speichert ausschließlich SHA-256-Hashes. Die Klartext-Capability wird nur einmal beim Erstellen zurückgegeben. Gültigkeit maximal 365 Tage; widerrufene oder abgelaufene Links liefern NULL. Der Viewer verwendet `/share#token=…`: das Fragment wird nicht im HTTP-Request oder Referer übertragen. Keine Tokens in Logs oder Telemetrie schreiben.

Der private Bucket `project-media` akzeptiert höchstens 20 MiB je Datei und die MIME-Typen `audio/mpeg`, `audio/mp4`, `audio/aac`, `audio/wav`, `audio/x-wav`, `audio/ogg`, `audio/flac`, `audio/webm` und `audio/aiff`. Der aktuelle Client verwendet den Pfad `<owner UUID>/<cloud project UUID>/<asset ID>`. Nur Eigentümer schreiben, berechtigte Mitglieder lesen. Ein Datenbanktrigger serialisiert Upload- und Projektquota-Prüfungen pro Eigentümer. Free: 100 MiB, Pro: 1 GiB; gezählt werden aktuelle Projekt-/Besetzungs-Snapshots, veröffentlichte Snapshots und Storage-Metadaten `size`. Das ist die Anwendungsspeicherquote, nicht eine Zusicherung der gesamten PostgreSQL-Disk- oder Traffic-Kosten. Bei Überschreitung werden nur positive Zuwächse abgelehnt, nichts gelöscht.

Supabase Storage prüft zunächst als aufrufender Nutzer die RLS-Berechtigung und schreibt nach dem Upload die endgültigen Metadaten intern als `service_role`. Der Quotatrigger unterstützt beide Phasen: Projekt-Eigentümer, Pfad-Eigentümer und `owner_id` müssen immer übereinstimmen. Ausschließlich der tatsächliche PostgreSQL-Rollenkontext `service_role` darf ohne Nutzer-`sub` finalisieren; ein gleichnamiger JWT-Claim gewährt diese Ausnahme nicht. Diese Finalisierung verlangt eine Größe von 1 Byte bis 20 MiB und prüft weiterhin die Eigentümerquote. Die zurückgerollte RLS-Vorabprüfung darf noch keine Größenmetadaten haben. Archivierte Projekte und Änderungen des Objektpfads/Buckets werden abgewiesen. Die Migration erweitert keine Grants oder RLS-Policies. Grundlage des Ablaufs ist der offizielle [Storage-Quelltext für v1.80.2](https://github.com/supabase/storage/blob/v1.80.2/src/storage/uploader.ts).

Die Oberfläche bietet bewusstes **Musik privat sichern** und **Musik auf dieses Gerät laden**. Zunächst müssen die Musikangaben des Projektstands auf dem Server gesichert sein. Die Übertragung prüft diese Angaben gegen den Serverstand und bindet jeden Storage-Aufruf an das aktuelle Konto. Uploads verwenden `upsert:false`; existiert die Asset-ID schon, gilt ein Retry nur bei exakt gleichen vorhandenen Bytes als erfolgreich. Andere Bytes überschreiben die Datei nicht. Die vorhandene Eigentümer-UPDATE-Policy bleibt bestehen; die Unveränderlichkeit ist hier eine Regel des aktuellen Clients, keine neue serverseitige UPDATE-Sperre.

Dateigröße und zugelassener MIME-Typ werden serverseitig durch den Bucket begrenzt. Die Prüfung von Container-/Dateiheadern, Dateiendung, MIME-Konsistenz sowie die Decoderprüfung von Abspielbarkeit und Dauer findet **im Client** statt. Der Server führt keine Inhaltsprüfung oder Malwareanalyse der Audio-Bytes durch. Der Browser speichert heruntergeladene Musik im lokalen Cache; das ist kein vollständiges Medienbackup. Storage-Isolation sowie ein tatsächlicher Browser-Upload/-Download mit demselben Konto und Gerät sind geprüft; der konkrete Ablauf steht unten und in `ACCEPTANCE.md`. Native Übertragung, Zwei-Konto-Medienzugriff, Medienbackup und Kontolöschungsbereinigung bleiben offen.

Öffentliche Probenlinks enthalten weiterhin keine Musik. Die aktuelle Veröffentlichung setzt `p_include_media:false`, und der Viewer ist lautlos. Es werden keine signierten URLs für anonyme Medienfreigaben erstellt; dieser Ablauf ist noch nicht implementiert.

Private Realtime-Kanäle müssen `project:<cloud UUID>` heißen und mit `private:true` abonniert werden. RLS erlaubt Projektmitgliedern Senden und Lesen. Der Autorisierungspredikat-Test besteht; echte WebSocket-Sitzungen, Widerruf bei bestehender Verbindung und Presence wurden noch nicht Ende-zu-Ende geprüft.

## Ausgeführte Datenbanktests

`supabase/tests/isolation.sql` wurde erfolgreich gegen das bestätigte Testprojekt ausgeführt. Der Test erstellt drei synthetische Auth-Identitäten innerhalb einer Transaktion und rollt alle Daten zurück. Er verschickt keine E-Mails und lädt keine externen Dateien hoch.

Geprüft: fremde Projekte/Besetzungen/Publikationen/Medien unsichtbar; direkte Writes und Abo-/Mitgliedschafts-Eskalation abgelehnt; fehlende/falsch typisierte Schema-Version; CAS, Wiederholung und widersprüchliche Befehls-ID; Null-Basisrevision; Free-Projekt-, Reaktivierungs-, Besetzungs- und Speicherlimits; Storage-Upsert und Größenlimit; Leserrechte; Pro-Bearbeiter und Pro-Ablauf; Veröffentlichung ohne private Notizen/URIs; unveränderlicher Probenstand; anonymer Tokenzugriff, ungültiges Token und Widerruf.

Nach Anwendung der Einladungsmigration bestanden `supabase/tests/invitations.sql` und die auf den Einladungsablauf angepasste `isolation.sql` erneut gegen das tatsächliche Stagingprojekt. Die neuen Tests prüfen falsches Konto, nicht bestätigte Adresse, gefälschte E-Mail-Claims, anonyme Zugriffe, Hash-/E-Mail-Isolation, Wiederverwendung, Widerruf, Ablauf, archivierte Projekte, Rollenänderungen und die gemeinsame Vierergrenze für Mitglieder und reservierte Einladungen. Herabstufung, anschließende Promotion, Widerruf und Ablauf werden dabei berücksichtigt; Pro-Ablauf wird auch bei Annahme und Speichern geprüft. Alle synthetischen Nutzer und Mitgliedschaften wurden zurückgerollt. Es gab keine externen E-Mails oder tatsächlichen zusätzlichen Teammitglieder. Vorher bestand derselbe SQL-Lauf lokal in PGlite mit Schema-Stubs; dieser lokale Vorlauf wird nicht als Ersatz für den Stagingnachweis gewertet.

Nach Anwendung der Storage-Korrektur bestanden `supabase/tests/storage-service.sql` und die aktuelle `isolation.sql` ebenfalls gegen Staging. Der neue Test bildet die zurückgerollte Nutzerprüfung und die anschließende interne Service-Finalisierung ohne Nutzer-`sub` ab. Er prüft falsche oder fehlende Eigentümer-/Pfadangaben, fehlende, nullgroße, negative, übergroße und ungültige Größen, Quotaüberschreitung, verbotene Pfadwechsel, gefälschte Service-JWT-Claims, Mitgliederleserechte und archivierte Projekte. Die unabhängige Abschlussabfrage fand **0 synthetische Testnutzer, Projekte, Besetzungen, Entitlements, Mitgliedschaften, Einladungen und Medienobjekte** aus den SQL-Fixtures. Das echte Testkonto, die bewusst angelegten Browser-Testdaten und die tatsächlich hochgeladene Testdatei blieben erhalten.

Zusätzlich wurden die vollständigen Core-Testprojekte „Reihe“ und „Show“ durch die tatsächlich installierte SQL-Veröffentlichungsfunktion geschickt. Beide Medienmodi bestanden anschließend `assertValidProject`; die Szenen bei jedem 0,25-Sekunden-Schritt waren identisch zum Original, einschließlich voller Drehung und Hebefiguren. Private Notizen und lokale URIs waren entfernt. Reproduzierbarer Prüfhelfer: `supabase/tests/viewer-roundtrip.ts`.

Unmittelbar nach den damaligen SQL-Tests erneut bestätigt: **0 Auth-Nutzer, 0 Projekte, 0 Publikationen, 0 Medienobjekte**. Dies ist ausschließlich der historische Stand nach dem Rollback, vor der echten Registrierung und den unten beschriebenen Cloudtests. Auch **keine Security-Advisor-Befunde** und zwei Performance-INFO-Hinweise auf damals ungenutzte Fremdschlüsselindizes beziehen sich auf diesen früheren Prüfzeitpunkt.

Die spätere Prüfung am 16. Oktober bestätigt weiterhin RLS auf den sieben öffentlichen Anwendungstabellen und der privaten Einladungstabelle sowie fehlende direkte Schreibrechte auf `projects` für `anon`/`authenticated`. Die Migrationsliste bestätigt inzwischen vier angewandte Migrationen einschließlich der Storage-Korrektur. Der nach der Storage-Korrektur erneut abgefragte Security-Advisor meldet ausschließlich den bestehenden **WARN: `auth_leaked_password_protection` deaktiviert**. Supabase bietet den [Schutz gegen bekannte kompromittierte Passwörter](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) ab Pro an; die Testorganisation bleibt Free. Es wurde kein kostenpflichtiges Upgrade vorgenommen. Dieser Befund bleibt offen und darf nicht als aktueller Nullbefund dargestellt werden.

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
- Reale Mehrgeräte-/Recovery-Abnahme der Cloud-Wiederherstellung sowie Zwei-Konto-Medienzugriff und native Übertragung; ein privater Dateitransfer ersetzt keine vollständige Wiederherstellung von Datenbank und Medien.
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

Danach wurde eine synthetische WAV-Datei mit zwei Sekunden Dauer und **88.244 Byte** im Browser privat gesichert. Nach der Storage-Korrektur meldete die App „1 Musikdatei privat in der Cloud gesichert.“ und beim anschließenden Laden „1 Musikdatei auf diesem Gerät verfügbar.“ Eine lesende Datenbankabfrage bestätigte genau ein Objekt mit 88.244 Byte im weiterhin privaten Bucket `project-media`. Dieser Nachweis gilt für **dasselbe bestätigte Konto und dasselbe Gerät**. Er belegt keinen zweiten Benutzer, keine native Übertragung und keine Wiederherstellung auf einem anderen Gerät.

Anschließend wurde über **Cloud & Team → Cloud-Projekte laden → Mit Musik als Arbeitskopie öffnen** eine eigene neue lokale Projekt-ID erzeugt. Die Arbeitskopie enthielt Serverstand 4 mit acht Personen, drei Formationen und der zweisekündigen WAV-Datei samt Wellenform. Nach erneutem Laden blieben die Arbeitskopie, ihre geladene Basisrevision 4 und das Eigentümerrecht erhalten. Das bewusste **Arbeitskopie im Teamprojekt sichern** bestätigte Serverstand 5. Eine unabhängige lesende SQL-Abfrage bestätigte weiterhin genau ein Serverprojekt mit Revision 5 und eine zum ursprünglichen veröffentlichten Snapshot identische `snapshot.id`. Damit sind Öffnen mit Musik, lokale Persistenz und Zurückspeichern dieser Arbeitskopie für dasselbe Konto und Gerät belegt; die bereits genannten Mehrgeräte- und Zwei-Konto-Grenzen bleiben bestehen.
