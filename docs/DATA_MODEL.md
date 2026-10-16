# Gemeinsames Fachmodell

`packages/core` ist reines TypeScript ohne Laufzeit-Abhängigkeiten. React, Browser und Native sind nicht Teil des Moduls. `schemaVersion: 1` bezeichnet das portable Projektformat. Unbekannte Versionen werden abgewiesen; künftige Migrationen müssen ausdrücklich vor der Validierung laufen. Ein JSON-Export enthält die vollständigen Fachwerte, aber noch kein ZIP-Paket mit Mediendateien.

## Koordinaten und Identität

Alle Positionen sind Meter: x seitlich nach rechts, y in die Bühnentiefe, z über dem Boden. Der Ursprung liegt in der Bühnenmitte. Das Publikum liegt bei negativem y. Eine Blickrichtung von 0° zeigt zum Publikum; positive Winkel drehen um die vertikale z-Achse gegen den Uhrzeigersinn. Renderer dürfen ihre Achsen abbilden, aber keine Fachpositionen verändern. Winkel bleiben unnormalisiert: +360°, -360° und 720° tragen verschiedene Bewegungsaussagen.

Personen haben stabile IDs, Namen, Kürzel, Farbe und einen modellierten Körperradius. Formationen ordnen diesen IDs Positionen und Blickrichtungen zu. Eine Person wird nie für einen kürzeren Laufweg stillschweigend umnummeriert. Projekte enthalten eine Besetzungskopie; `castSource` kann ID und Revision der ursprünglichen Besetzung festhalten. Das Ändern einer wiederverwendbaren Besetzung verändert keine bestehenden Projekte.

## Zeit und Bewegungen

Die geordnete Formationsliste enthält `holdSeconds`. Genau ein Übergang verbindet jedes benachbarte Paar. Die Gesamtdauer ist die Summe von Haltephasen und Übergängen. Zeiten sind Sekunden als endliche Zahlen; `roundTime` quantisiert eine bewusste Eingabe auf 0,01 s. Die Auswertung rundet keine Frames. Tempomarken beginnen bei Sekunde 0, sind streng geordnet und haben einen Count-Offset. `secondsToCounts` integriert die Tempoabschnitte analytisch, `countsToSeconds` invertiert sie. Counts sind intern nullbasiert.

`evaluateScene(project, timeSeconds)` ist die einzige Bewegungswahrheit. Es liefert Position und Blickrichtung jeder Person sowie Formation, Übergang und Fortschritt. Negative Zeiten werden auf 0 und Zeiten nach dem Ende auf das Ende begrenzt. An einer Grenze gilt der folgende Abschnitt. Ohne expliziten Bewegungsbefehl läuft eine Person geradlinig zwischen den Formationen.

Individuelle Wege sind Geraden, quadratische Bézierbögen (`arc`), kubische Bézierkurven oder Mehrpunktlinien. Kurven verwenden eine adaptive Weglängentabelle mit 0,1 mm lokalem Sehnenfehler und maximaler Teilungstiefe 14. Das ist eine numerische Näherung für gleichmäßige Geschwindigkeit, keine analytisch exakte Bogenlänge. Der Standard ist lineare Zeit; `ease-in-out` ist ausdrücklich wählbar. Blickrichtung bleibt separat fest, wegtangential oder als expliziter unnormalisierter Winkelverlauf.

Gruppenbewegungen speichern Personen-IDs, ursprüngliches Drehzentrum, expliziten Gesamtwinkel, Verschiebung, Skalierung und optional Fächerwinkel, Mittelpunktweg und personenspezifische Startversätze. Die Auswertung leitet jeden Zwischenpunkt aus der ursprünglichen Formationsposition ab, niemals aus dem vorherigen Frame. Einheitsskalierung ohne Fächer hält die Gruppe starr. Gruppen-Endpositionen müssen innerhalb von 1 mm zur Zielformation passen. Startversatz und Dauer müssen in den Übergang passen. Zurzeit ist je Person und Übergang höchstens ein Bewegungsbefehl zulässig; überlappende Befehle werden abgewiesen. Eine freie Kombination mehrerer sequenzieller Bewegungssegmente innerhalb eines einzigen Übergangs ist noch nicht modelliert.

## Hebefiguren und Requisiten

Hebefiguren besitzen Rollen (tragend, gehoben, sichernd), zeitliche Phasen, ausdrücklich gesetzte Zielhöhen und phasenbezogene Kontaktpaare. Anheben und Absetzen interpolieren die Höhe aus der vorherigen Phase. Nur das konkrete Kontaktpaar in der aktiven Phase wird von der Personenabstandsprüfung ausgenommen. Fremde Personen und Requisiten bleiben prüfbar. Es gibt keine biomechanische Berechnung, praktische Hebeanleitung, Wurf- oder Sicherheitsfreigabe. Die Beispiel-Hebegruppe ist synthetisch; eine geprüfte Bibliothek benannter Sportfiguren ist noch nicht vorhanden.

Requisiten sind gedrehte Boxen mit Position, Abmessungen und Anwesenheitsintervall. Erlaubte seitliche Bühnenzonen, Treppen und automatisch begehbare Podeste sind noch nicht modelliert.

## Konfliktprüfung

`checkConflicts` betrachtet dieselbe `evaluateScene`-Ausgabe wie der Editor. Es verwendet konservative Geschwindigkeitsgrenzen, räumliche Vorauswahl über überstrichene Kugelhüllen und adaptive Intervallteilung. Zeitgrenzen von Formation, Bewegung, Hebephase und Requisitenanwesenheit teilen die Prüfung. Dadurch verschwinden schnelle Bewegungen nicht zwischen groben Frames. Standardmäßig wird bis 2 ms verfeinert. Ein nicht sicher ausgeschlossener Restbereich erhält `conservative: true`; das ist ein möglicher Konflikt, kein beobachteter Kontakt. Rückgaben enthalten Personen, Zeitintervall, kleinsten geprüften Abstand und gegebenenfalls Requisite.

Menschen werden als Kugeln um ihre Fachposition angenähert; dies ist keine anatomische Körperhülle. Höhen werden nur schematisch berücksichtigt. Requisiten sind orientierte Boxen, Bühnenkanten ein Rechteck. Für die Ausgabe gilt standardmäßig eine Grenze von 500 Hinweisen; eine große Belastungsprüfung kann mehr Konflikte enthalten. Deterministische Änderungsvorschläge, breite UI-Auswertung der Unsicherheitsintervalle und reale Geräte-Performance sind noch offen. Geometrische Hinweise sind keine physische Sicherheitsbescheinigung.

## Validierung und Grenzen

`validateProject(unknown)` liefert feldbezogene Probleme. `importProject(string)` wirft bei Fehlern `ProjectValidationError`; `exportProject` validiert ebenfalls. Geprüft werden Version, unbekannte Felder, IDs und Duplikate, Referenzen, vollständige Formationspositionen, endliche Werte, Größen, Übergangsreihenfolge, Bewegungsüberschneidungen, Gruppen-Endpunkte, Temporeihenfolge, Audio-Clips und Hebephasen. Es wird kein eingebetteter Code ausgeführt.

Technische Grenzen gelten in Free und Pro gleich: 100 Personen, 200 Formationen, 10 MiB Projekt-JSON, maximal 60 Minuten Fachzeit. Das 100-Personen-/200-Formationen-Beispiel dauert 598 Sekunden und entspricht der 10-Minuten-Prüfgröße. Der separate Cloud-Speicher beträgt 100 MiB beziehungsweise 1 GiB. `PLAN_LIMITS` hält die Tarifregeln zentral. Client-Regeln sind keine Autorisierung; Berechtigungen müssen serverseitig verifiziert werden. Rohdatenexport, Lesen und lokale Wiederherstellung bleiben bei einem Tarifablauf möglich.

## Befehle und Rückgängig

`ProjectHistory` enthält `present`, `undoStack` und `redoStack` und kann vollständig serialisiert werden. Eine abgeschlossene Geste wird einmal über `commitProject` übernommen. Ein Befehl enthält Version, ID, Akteur, Basisrevision, Zeitstempel, betroffene Objekte sowie Vorher-/Nachher-Patches mit expliziten Existenzflags. Array-Einträge werden über `@<id>` statt Index angesprochen. Das verhindert eine stille Neuzuordnung nach Umordnung.

Ein veralteter Befehl kann nur angewendet werden, wenn jedes betroffene Feld noch dem ursprünglichen Wert entspricht. Unabhängige Personenänderungen können zusammengeführt werden. Eine konkurrierende Änderung desselben Feldes erzeugt `CommandConflictError`. Undo erzeugt ein kompensierendes lokales Kommando und weigert sich, fremde oder inzwischen veränderte Felder zu überschreiben. Änderungen an der Struktur einer Liste werden zurzeit als ganzer Listenpatch behandelt und können deshalb konservativ Konflikte erzeugen.

Der Datenadapter ist für atomare Speicherung, Outbox, Befehls-ID-Deduplizierung und Revisionsabgleich zuständig. Der reine Kern behauptet keine Server-Idempotenz oder getestete echte Mehrbenutzer-Synchronisierung. Historien sind auf 100 lokale Undo-Einträge begrenzt. Die Datenadapter dürfen die lokale Sicherung nicht wegen eines Tarifablaufs verwerfen.

Cloud-Wiederherstellung legt ausdrücklich eine neue lokale Arbeitskopie an. `settings[origin:<localId>]` enthält Konto-ID, Cloudprojekt-UUID, ursprüngliche portable Projekt-ID und geladene Serverrevision. Der ausgehende Snapshot verwendet die ursprüngliche portable ID; lokale Projekt-/Undo-Daten behalten ihre neue ID. Ein optionaler Pending-Eintrag speichert Befehl-UUID, Basisrevision und exakten Snapshot vor dem Request. `compareAndSetSetting` vergleicht und ändert den vollständigen Origin in einer IndexedDB-/SQLite-Transaktion. Dadurch können parallele Tabs weder fremde Pending-Befehle entfernen noch eine neue Basisrevision still übernehmen. Ein Konflikt lässt beide Entwürfe und den Pending-Eintrag erhalten; es gibt keinen automatischen Snapshot-Merge.

Private Audiodateien liegen unter `<ownerUUID>/<cloudProjectUUID>/<audioAssetId>` im privaten Storagebucket. Geräte-URIs werden nicht übertragen. Die ursprünglichen Bytes und Asset-IDs werden beim Download erhalten, lokal geprüft und gecacht. Andere Bytes unter derselben Kennung werden abgewiesen. Öffentliche Publikationen enthalten derzeit bewusst keine Musik; das private Teammedium ist kein öffentlicher Downloadlink.

## Kernprüfungen

`packages/core/test/core.test.ts` prüft vollständige +360°/-360°/720°-Drehungen, starre Abstände, bewegte Zentren, Fächer und Versätze, Kurvengeschwindigkeit, Vorlagen, Count-Umrechnung, Haltephasen, JSON-Rundläufe, fehlerhafte Importe, zeitlich getrennte und schnelle gleichzeitige Kreuzungen, phasenbezogene Kontakte, serialisierbares Undo und Konflikte mit fremden Änderungen. Ausführung und tatsächliche Ergebnisse stehen im Arbeitsstatus. Diese Kernprüfungen ersetzen weder reale iPhone- noch Supabase-Integrationstests.

## PDF-Adapter

`apps/app/src/export/buildPdf.ts` erzeugt eine echte Vektor-PDF aus derselben Szenenauswertung: eine A4-Querformatseite je Formation und zusätzliche lesbare Besetzungsseiten. Browser-Download und Native-Datei/Teilen nutzen identische Bytes. Die unverändert eingebettete DejaVu-Sans-Schrift unterstützt die getesteten Umlaute sowie griechische und kyrillische Namen; Lizenz liegt im Exportordner. Nicht unterstützte Glyphen führen zu einer verständlichen Fehlermeldung statt still beschädigter Namen. Farben erhalten abhängig von ihrer Helligkeit helle oder dunkle Beschriftung. Gleiche Bodenpositionen werden gemeinsam beschriftet und ausdrücklich aufgelistet. Die Nummerierung bleibt über alle PDF-Seiten konstant und ordnet sich in der Besetzungsliste den unveränderten Namen/Kürzeln zu. Der PDF-Adapter enthält noch keine detaillierten Pro-Probenpläne oder individuellen Laufwegpakete. Ein tatsächlicher nativer Teilen-Vorgang bleibt auf dem iPhone zu prüfen.
