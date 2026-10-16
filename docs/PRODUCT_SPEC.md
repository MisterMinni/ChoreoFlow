# Codex-Auftrag: Eigenständige iPhone-App für Choreografieplanung

Stand der Produktentscheidungen: 16. Oktober 2026.
Dieses Dokument ist der verbindliche Entwicklungsauftrag, keine bloße Ideensammlung. Die enthaltenen Tarifgrenzen, Jahrespreise und Leistungsziele sind bewusst gewählte Produktvorgaben, keine bereits gemessenen Werte oder Marktbeweise.

## 1. Auftrag und Arbeitsweise

Entwickle eine eigenständige, tatsächlich bedienbare Choreografie-App. Beginne in einem neuen Projekt; übernimm keinen Code aus ChoreoFlow und ändere keine anderen Projekte. Arbeitstitel: „Choreografie“. Halte Name, Produktkennungen und Branding zentral austauschbar. Registriere keine Namen oder Domains eigenmächtig.

Ziel ist zuerst eine iPhone-App für Showtanz, Karneval, Garde, Hip-Hop, Cheerleading und vergleichbare Bühnenchoreografien. Android bleibt architektonisch möglich, ist aber kein Abnahmekriterium der ersten Veröffentlichung. Die Browserfassung dient der dauerhaften Entwicklung und der freigegebenen Zuschaueransicht, nicht als Ersatz für die native iPhone-App.

Entwickle konkrete Dateien und funktionierende Abläufe, nicht nur Architekturtexte, Screenshots oder eine Landingpage. Liefere schrittweise integrierte, testbare Funktionen. Das gesamte Dokument beschreibt den Verkaufs-MVP; ein erster technischer Zwischenstand erfüllt noch nicht den gesamten Auftrag.

Oberste Prioritäten: einfache und konsistente Bedienung, Datenintegrität, flüssige Interaktion, verständliche Bewegungen und geringer laufender Ressourcenverbrauch. Die bisher besprochenen Mock-ups sind nur visuelle Inspiration. Bei Widersprüchen gelten dieses Dokument und der daraus abgeleitete einheitliche UI-Leitfaden.

**Keine KI im Produkt:** keine Modell-API, kein Chat, kein KI-Assistent, keine Sprachsteuerung, keine generative Choreografie, kein Sprachmodell auf dem Gerät, keine Videoanalyse und kein KI-SDK. Auch keine leeren KI-Schaltflächen oder vorsorglich aufwendige KI-Infrastruktur. Geometrie, Vorlagen, Regelprüfung und deterministische Audioanalyse sind normale Programmlogik. Codex wird ausschließlich als Entwicklungswerkzeug verwendet.

Erledige eigenständig alle innerhalb der verfügbaren Arbeitsumgebung möglichen Schritte. Prüfe zuerst den tatsächlichen Repository-Zustand und vorhandene Werkzeuge. Halte notwendige Annahmen schriftlich fest, statt bereits entschiedene Produktfragen erneut zu stellen. Behaupte weder Tests noch Builds oder Deployments, die nicht stattgefunden haben. Externe Zugangsdaten, physische Gerätetests, kostenpflichtige Ressourcen und Store-Freigaben sind ausdrücklich getrennte Voraussetzungen.

## 2. Verbindliches Produkt- und Tarifmodell

Veröffentlichung als kostenlose App mit optionalem Pro-Abo. Zielpreis für den deutschen Store: **1,99 € monatlich**, ergänzend als Arbeitsvorgabe **19,99 € jährlich**. Verwende in der App immer die lokalisierten tatsächlichen Store-Produktpreise, nicht fest einprogrammierte Preistexte. Keine Werbung, keine erzwungene Bewertung, kein automatischer Testabo-Abschluss.

Der kostenlose Tarif soll eine vollständige kleine Choreografie inklusive Musik, 3D, Gruppenwegen, Hebefiguren und Freigabe ermöglichen. Verkaufe vor allem mehr Projekte, Teamarbeit und komfortablere Ausgaben, nicht elementare Verständlichkeit oder Hinweise auf Bewegungskonflikte.

| Funktion | Kostenlos | Pro |
|---|---|---|
| Eigene gleichzeitig aktive Projekte | 3 | Keine tarifliche Projektanzahlgrenze; Speichergrenzen gelten |
| Eigene wiederverwendbare Besetzungen | 3 | Keine tarifliche Anzahlgrenze |
| Personen, Gruppen, Formationen pro Projekt | Gleiche technischen Grenzen wie Pro | Gleiche technischen Grenzen wie kostenlos |
| Vollständiger 2D-Editor und stilisierte 3D-Ansicht | Ja | Ja |
| Individuelle Wege, Gruppenmuster, Drehungen und Kombinationen | Ja | Ja |
| Geometrische Konflikthinweise und Hebefigurenplanung | Ja | Ja |
| Musikimport, Counts, Tempo, grundlegender Musikschnitt | Ja | Ja |
| Lokale Offline-Bearbeitung und Synchronisierung | Ja | Ja |
| Freigegebene Probenansicht und persönliches Hervorheben | Ja; Zuschauer benötigen kein Pro | Ja; Zuschauer benötigen kein Pro |
| Gleichzeitige Bearbeitung durch mehrere Trainer | Ein Bearbeiter, der Eigentümer | Eigentümer plus bis zu 4 eingeladene Bearbeiter je Projekt |
| PNG und einfache PDF-Formationsübersicht | Ja, ohne Wasserzeichen | Ja, ohne Wasserzeichen |
| Videoexport | 720p, dezente Kennzeichnung außerhalb wichtiger Inhalte | Bis 1080p, ohne Kennzeichnung |
| Detaillierte PDF-Probenpläne und individuelle Laufwegpakete | Nein | Ja |
| Wiederherstellung früherer synchronisierter Projektstände | Aktueller Stand plus lokale Wiederherstellung | Zusätzlich 30 Tage Verlauf |
| Portabler Export eigener Projektdaten und Wiederimport | Immer möglich | Immer möglich |
| Cloud-Speicher für eigene Medien und Projekte | 100 MB | 1 GB |

Diese Grenzen stehen zentral in einer getesteten Tarifkonfiguration. Keine verstreuten `isPro`-Sonderfälle. Für Tests werden beide Tarife unterstützt, ohne echte Zahlungen auszulösen. In Produktion werden Berechtigungen serverseitig aus verifizierten Abos abgeleitet.

Zielbelastung beider Tarife: Projekte mit bis zu 100 Personen, 200 Formationen und 10 Minuten Musik testen. Das ist eine Entwicklungs- und Prüfgröße, keine Zusicherung unbegrenzter Leistung auf jedem Gerät. Technische Import-/Größenlimits müssen in beiden Tarifen transparent und gleich sein, soweit sie nicht ausdrücklich den Cloud-Speicher betreffen.

„Keine tarifliche Anzahlgrenze“ bedeutet nicht unbegrenzten Cloud-Speicher oder beliebigen Traffic. Medien wiederverwenden, lokal cachen und Downloads begrenzen, wenn technisch notwendig; dokumentiere Verbrauchsregeln verständlich. Archivierbare Projekte bleiben lesbar und exportierbar, zählen weiter zum Speicher und können nur innerhalb der aktiven Projektgrenze reaktiviert werden. Fremde Projekte, zu denen man eingeladen wurde, zählen nicht als eigene Projekte.

Nach einem Pro-Ablauf nichts löschen. Biete die Auswahl von drei weiterhin aktiven eigenen Projekten an. Andere bleiben lesbar, archivierbar und als eigene Projektdatei exportierbar. Bereits lokal gespeicherte Dateien und freigegebene Stände bleiben erhalten. Stelle Mehrbearbeiterprojekte kontrolliert auf Eigentümerbearbeitung um. Bei überschrittenem Cloud-Speicher nur neue Uploads begrenzen, keine heimliche Entfernung vorhandener Daten. Entwürfe, Offline-Änderungen und Wiederherstellung sind nie eine Erpressungs-Paywall.

## 3. Dauerhafte Entwicklungsumgebung – höchste Priorität

Der Auftraggeber arbeitet unter Windows mit VS Code, PowerShell und npm. Setze weder einen lokalen Mac noch einen funktionierenden Docker-Daemon voraus. Prüfe die vorhandene Node-Version und dokumentiere eine mit dem gewählten Stack kompatible unterstützte Version, ohne die übrige Rechnerkonfiguration ungefragt umzubauen.

Vorhanden beziehungsweise vorgesehen: Vercel Pro, Supabase Pro und das vorhandene Pro-Kontingent für Codex. Zusätzliche kostenpflichtige Dienste nicht ohne Zustimmung einführen. Das Codex-Kontingent ist kein Bestandteil der App-Laufzeit.

### 3.1 Architektur

Nutze React Native mit Expo, Expo Router und TypeScript im strikten Modus. Prüfe aktuelle offizielle Dokumentation und Kompatibilität vor der Paketwahl, installiere kompatible Versionen, versioniere den Lockfile und vermeide experimentelle Grundlagen ohne nachgewiesenen Bedarf.

Bevorzugte schlanke Struktur mit npm-Workspaces:

- `apps/app`: dieselbe Expo-Anwendung für iPhone und Browser einschließlich der read-only Freigaberoute.
- `packages/core`: UI-unabhängiges Datenmodell, Geometrie, Zeitmodell, Bewegungen, Befehle, Validierung und Konfliktprüfung.
- `packages/data`: gemeinsame Repository-Verträge und getrennte lokale/Cloud-Adapter.
- `packages/ui`: tatsächlich wiederverwendete Design-Tokens und Komponenten; kein zweites unabhängiges UI-System.
- `supabase`: nachvollziehbare Migrationen, Tests und serverseitige Funktionen.
- `docs` und `scripts`: kompakte Betriebs-, Test- und Entwicklungsanleitungen.

Erzeuge nur sinnvolle Paketgrenzen; keine Microservices, kein Kubernetes, keine zusätzliche Next.js-Editorimplementierung. Browser und iPhone müssen dieselbe Bewegungsberechnung, dieselben Serialisierungsformate und dieselben fachlichen Befehle verwenden. Plattformspezifische Audio-, Speicher- und Exportadapter sind zulässig und erforderlich.

Für 2D nutze eine auf Touch und Web getestete Lösung. Für 3D prüfe Three.js und React Three Fiber, auf Native mit dessen Native-Integration und Expo GL. Belege die Kompatibilität früh durch einen funktionsfähigen 3D-Render-/Interaktions-Test. Ein Browsererfolg beweist keine iPhone-Kompatibilität. Sollte eine Bibliothek im gewählten Stack scheitern, dokumentiere den Befund und wähle eine begründete, getestete Alternative, ohne den geteilten Kern aufzugeben.

### 3.2 Betriebsarten

1. **Lokale Entwicklung:** ohne Cloud-Schlüssel, ohne Konto beim Dienst und ohne Docker startbar. Echte lokale Testprojekte mit denselben Schemas wie in Produktion, nicht fest verdrahtete Bildschirmzustände. Testdaten werden einmal angelegt und bleiben nach Neustarts erhalten.
2. **iPhone-Entwicklungsbuild:** eigene Entwicklungs-App, die den lokalen Entwicklungsserver lädt. Native Abhängigkeiten erfordern gelegentlich einen neuen signierten Build; normale JS-/TS- und UI-Änderungen nicht. Cloud-Build-Konfiguration für Expo/EAS vorbereiten. Kein iOS-Simulator auf Windows versprechen.
3. **Staging:** bewusst veröffentlichte, geschützte Vercel-Testfassung und getrenntes Supabase-Testprojekt. Ausschließlich Testkonten und synthetische Daten.
4. **Produktion:** eigene App-Kennung, eigene Umgebungsvariablen, eigenes Supabase-Projekt, keine Demo-Berechtigungsumgehung und keine Testdaten.

Die Entwicklungsumgebung bleibt auch nach der Store-Veröffentlichung funktionsfähig. Entwicklung und Kunden-App müssen gleichzeitig auf dem iPhone installierbar sein. Setze nicht voraus, dass eine einzelne signierte Testdatei unbegrenzt gültig bleibt; dokumentiere Erneuerungen und TestFlight-Grenzen.

Web lokal: persistente IndexedDB-basierte Speicherung. Native: lokale SQLite-Datenbank mit getesteten Migrationen und lokaler Mediendateiverwaltung. Keine ungetestete Web-SQLite-Abhängigkeit als zwingende Grundlage. Browserdaten und iPhone-Daten haben dasselbe Fachschema, aber nicht automatisch denselben physischen Speicher. Austausch über denselben Projektimport/-export oder die bewusst aktivierte Test-Synchronisierung.

### 3.3 Einfache Startbefehle und begrenzte Tokens

Implementiere und teste Root-Skripte wie:

```text
npm run dev:web
npm run dev:iphone
npm run test
npm run test:e2e
npm run typecheck
npm run lint
npm run check
npm run build:web
```

Die Skripte sind hier Anforderungen und werden von dir tatsächlich angelegt. `dev:iphone` startet den Entwicklungsserver für einen bereits installierten Entwicklungsbuild, nicht einen neuen Cloud-Build bei jedem Start. Ergänze eine Windows-taugliche Startverknüpfung oder ein PowerShell-Skript. Kein Setzen einer global unsicheren Execution Policy.

`npm run dev:web` darf kein Modell, keinen kostenpflichtigen Build und kein Deployment aufrufen. Änderungen sollen automatisch in der laufenden Vorschau erscheinen. Binde keine Agenten-Laufzeit in die App oder Vorschau ein.

Halte `AGENTS.md` kurz und verweise auf kleine thematische Dokumente. Pflege `docs/STATUS.md` mit fertigen, angefangenen, blockierten und nächsten Aufgaben. Bei Folgesitzungen zunächst Status und betroffene Dateien lesen, nicht ständig alle Dokumente neu laden oder das gesamte Projekt umplanen. Führe gezielte Tests bei kleinen Änderungen aus; vor Meilensteinen die vollständigen Checks. Berichte Ergebnisse knapp mit konkreten Dateien und Testresultaten.

### 3.4 Deployments und Kosten

Standard ist lokale Vorschau. Keine Cloud-Veröffentlichung nach jeder Codeänderung. Keine automatischen kostenpflichtigen Supabase-Branches pro Pull Request. Keine Produktionsmigrationen oder Store-Einreichung ohne ausdrückliche Freigabe.

Bereite einen manuellen, nachvollziehbaren Staging- und Release-Workflow mit Prüfschritten vor. Verhindere, dass eine Standard-Git-Verknüpfung unbeabsichtigt `main` automatisch live schaltet. Produktionsfreigabe muss bewusst erfolgen. Liefere eine Rückfallstrategie für Web-Releases und ein kompatibles Datenmigrationskonzept.

Der Nutzer muss Projektkennungen und Geheimnisse selbst in geschützte Umgebungen eintragen. Keine Konten, Team-IDs, Domains oder vorhandenen Projekte raten; keine Geheimnisse in Chats, Logs, Screenshots oder öffentlichen Builds.

## 4. Einheitliche Navigation und Erscheinungsbild

Die App soll ruhig, modern und sofort verständlich wirken: heller und dunkler Modus, Systemumschaltung plus manueller Einstellung, ein klarer blauer Interaktionsakzent, kaum Leuchteffekte. Tänzer-/Gruppenfarben dürfen nicht mit Warnungen oder Navigation verwechselt werden. Keine Neon-Bühne, Marketingbanner, unnötigen Glasflächen oder dekorativen Menschenfotos als Standard-Editor.

Nutze ein gemeinsames Abstands-, Schrift-, Radius-, Icon- und Komponentensystem. Native Schriftarten, lesbare Beschriftungen und großzügige Trefferflächen. Ziel: mindestens 44 × 44 pt für häufige Touch-Aktionen. Farben nicht allein zur Bedeutungsvermittlung verwenden. VoiceOver-Beschriftungen, größere Schrift, ausreichende Kontraste und reduzierte Bewegung unterstützen. Bedienelemente dürfen bei kleinen iPhones und geöffneter Tastatur nicht unzugänglich werden.

### 4.1 Globale Struktur

Nach Anmeldung gibt es drei Hauptbereiche: **Projekte**, **Besetzungen**, **Vorlagen**. Konto, Darstellung, Hilfe und Abo liegen konsistent hinter dem Profilzugang. Keine Community, keine Lernwelt und kein zusätzlicher KI-Tab.

Projekte zeigt Suchfeld, zuletzt bearbeitete Einträge, Ordner und eine eindeutige Erstellen-Aktion. Ein Projekt öffnet direkt den Editor, nicht erst ein weiteres Dashboard. Neu anlegen: Name, Besetzung und Bühne mit brauchbaren Vorgaben; Musik kann direkt hinzugefügt oder später ergänzt werden.

### 4.2 Projekt-Editor

Im Editor wird die globale untere Navigation ausgeblendet. Die Anordnung bleibt in 2D, 3D und bei verschiedenen Auswahlzuständen gleich:

- Kopfzeile: Zurück, Projektname als eindeutig erkennbarer Zugang zum Projektmenü, Rückgängig und Wiederholen. Autospeicher-/Synchronisierungszustand dezent, aber überprüfbar.
- Projektmenü: **Bühne**, **Besetzung**, **Musik**, **Notizen**, **Freigaben**, **Export**, **Projekteinstellungen**. Jede Funktion hat hier einen festen Heimatort. Kontextuelle Abkürzungen öffnen dieselbe Ansicht, keine Parallelimplementierung.
- Große Bühne in der Bildschirmmitte; konstanter 2D/3D-Schalter. Spezielle Kamerawinkel erst in 3D anbieten.
- Darunter Wiedergabe und kompakte Zeitleiste mit Formationskarten, klar erkennbaren Übergängen, Musikposition und Counts/Sekunden. Vergrößern öffnet dieselbe Timeline ausführlicher, keinen konkurrierenden Zeitachsen-Editor.
- Unten höchstens vier direkte kontextabhängige Werkzeuge, übrige Aktionen unter „Mehr“. Nicht gleichzeitig alle möglichen Werkzeuge zeigen.

Beispiele für Werkzeuggruppen: Person → Position/Weg/Blickrichtung/Mehr; Gruppe → Bewegen/Drehen/Muster/Mehr; Formation → Anordnen/Dauer/Duplizieren/Mehr; Übergang → Wege/Dauer/Gruppenbewegung/Prüfen. Aktionen müssen zur tatsächlichen Auswahl passen. Löschen nicht als ständig exponierte Hauptaktion. Eine aussagekräftige Auswahlbeschriftung erklärt immer den aktuellen Zustand.

Settings und Eigenschaften werden in einem konsistenten, von unten aufziehbaren Bereich oder einer passenden Vollbild-Unterseite gezeigt. Bei kleinen Einstellungen bleibt die Bühne sichtbar. Zurückkehrende Nutzer sehen dieselbe Auswahl, denselben Zeitpunkt und dieselbe Kameraposition.

### 4.3 Interaktion

Antippen wählt aus, Ziehen bewegt, Pinch zoomt. Kamera-Navigation darf nicht versehentlich Personen verschieben. Mehrfachauswahl ist sichtbar aktivierbar und unterstützt Antippen sowie einen Auswahlrahmen. Dicht stehende Personen bekommen eine vergrößerte Auswahlhilfe oder eindeutige Auswahlliste. Wichtige Funktionen nie nur hinter undokumentierten Gesten verstecken.

Gruppen erhalten gut greifbare Anfasser und ein verschiebbares Drehzentrum. Biete für genaue Werte zusätzlich Zahleneingaben, Winkelvorgaben und Plus/Minus an. Pfade lassen sich direkt an ihrer Linie und über ausreichend große Kontrollpunkte verändern. Verhindere versehentliche Mikrosprünge beim Anfassen.

Unterscheide klar zwischen **„Formation verändern“** und **„Bewegung im Übergang“**. Wird während eines Zwischenzeitpunkts eine Positionsänderung versucht, erkläre, ob Start, Ziel oder der Weg bearbeitet wird. Erzeuge nicht heimlich neue Formationen. Eine vollständig ausgeführte Geste ist genau eine rückgängig machbare Aktion.

Leere Zustände, Laden, fehlende Medien, Offline-Modus, Konflikte, Speichergrenzen und Fehler erhalten verständliche Zustände mit brauchbarer Handlungsmöglichkeit. Kein Button darf nur einen Erfolg vortäuschen.

## 5. Gemeinsames Daten-, Zeit- und Bewegungsmodell

Nutze ein versioniertes, validierbares Fachschema für Projekte, Ordner, Besetzungen, Personen, Gruppen, Bühne, Requisiten, Formationen, Übergänge, Bewegungssegmente, Audiodateien/-clips, Tempomarken, Hebefiguren, Notizen, Veröffentlichungen und Zugriffsrechte.

Personen besitzen stabile IDs, Anzeigenamen beziehungsweise Kürzel, Farbe und optionale Gruppenzuordnungen. Besetzungen sind projektübergreifend wiederverwendbar. Änderungen einer Besetzung dürfen bestehende Choreografien nicht unbemerkt umnummerieren oder verändern; kontrollierte Übernahme und Projekt-Snapshots vorsehen.

Ein einziges Weltkoordinatensystem, dokumentierte Einheiten in Metern sowie reproduzierbare Zeitwerte. Empfohlene Fachkoordinaten: x seitlich, y Bühnentiefe, z Höhe. Renderer übernehmen die nötige Achsenabbildung. Bühnenrichtung, Bildschirmkoordinaten und Perspektive dürfen keine Fachposition verändern.

Trenne Formationspositionen, Laufwege, zeitlichen Verlauf und Blickrichtung. Eine Formation besteht nicht nur aus Pixelkoordinaten. Eine Bewegung ist mehr als die kürzeste Verbindung von Start und Ziel.

Implementiere eine zentrale pure Auswertung, sinngemäß `evaluateScene(project, time)`, die in 2D, 3D, Export und Konfliktprüfung denselben Zustand erzeugt. Positionswerte dürfen nicht aus dem aktuell gerenderten Bildschirm zurückgerechnet werden. Keine unterschiedlichen Animationswahrheiten in Web und iPhone.

Zeitmodell: Formations-Haltephasen, Übergänge, Startversatz, Dauer, Tempoabschnitte, musikalischer Offset und Marker. Präzise Zeitbearbeitung mindestens in 0,01-Sekunden-Schritten, ohne Genauigkeit zu suggerieren, die Audioausgabe nicht garantiert. Sekunden und Achter/Counts umschaltbar beziehungsweise parallel darstellbar. Keine kumulative Rundung von Counts in Frame-Schleifen.

### 5.1 Formationen

Vorlagen: Linie, mehrere Reihen, Block, Kreis, Halbkreis, V, umgekehrtes V, Diagonale, zwei Diagonalen und frei gesetzte Anordnung. Direkt auf der Bühne Breite, Tiefe, Abstand und Orientierung ändern. Gleichmäßige Abstände, Hilfslinien, optionales Einrasten, Zentrieren, Spiegeln, Drehen, Skalieren und Ausrichten.

IDs und zugewiesene Positionen bleiben nachvollziehbar. Kein stiller Personentausch zugunsten eines kürzeren Wegs. Eine ausdrückliche Neuzuordnung benötigt eine Vorschau. Eigene Formationen speichern, duplizieren und wiederverwenden. Mitgelieferte Beispielchoreografien und Vorlagen müssen eigene beziehungsweise nachweislich lizenzierte Inhalte sein; keine ungefragte Übernahme fremder Bibliotheken.

### 5.2 Einzelwege

Gerade, Bogen, editierbare Kurve und Mehrpunktweg mit dokumentierten Eigenschaften. Richtungspfeile, Start-/Zielkontur und selektive Pfadanzeige. Gleichmäßige Geschwindigkeit entlang einer Kurve erfordert Weglängenparametrisierung oder eine gleichwertig getestete Lösung, nicht bloß lineares Durchlaufen des Kurvenparameters.

Zeitprofile ausdrücklich wählbar; keine dekorative Standardbeschleunigung, die die Planung verfälscht. Blickrichtung separat: fest, entlang des Weges oder ausdrücklich gesetzter Richtungsverlauf.

### 5.3 Gruppenbewegungen

Gemeinsame Verschiebung, Drehung in der Bodenebene um eine vertikale Achse, Öffnen/Schließen, Fächern, Abstandsskalierung, Bewegung einer ganzen Formation entlang eines Wegs und zeitversetztes Starten von Personen/Teilgruppen. Kombinieren von Verschiebung und Drehung muss möglich sein.

Drehzentrum: Gruppenmitte, Linienende oder frei gesetzter Punkt. Eine starre Linie muss während der Drehung eine Linie bleiben; Teilnehmer laufen auf Kreisbögen. Hinterlege unveränderte Ausgangsversätze und leite Zwischenzustände daraus ab. Bei starrer Bewegung bleiben Abstände erhalten; bewusstes Öffnen/Skalieren ist ein anderes Bewegungssegment.

Speichere Drehsinn, Winkel und volle Umdrehungen ausdrücklich. +360°, -360° oder 720° dürfen nicht zu „keine Bewegung“ zusammenfallen. Keine implizite Kürzestwinkel-Interpolation. Eine Person im Drehzentrum bleibt bei reiner Drehung an ihrem Ort. Überschneidende Gruppenbefehle für dieselbe Person müssen validiert und eindeutig aufgelöst werden, statt vom Zufall der Renderreihenfolge abzuhängen.

## 6. Zeitbezogene Konfliktprüfung

Prüfe geplante Abstände zur selben Zeit, Bühnenränder, Requisiten und Grenzen der modellierten Bewegungsflächen. Zwei sich zeichnerisch kreuzende Pfade sind allein noch kein Konflikt. Berücksichtige Startversatz, Dauer und Geschwindigkeitsprofil.

Verwende eine effiziente räumliche Vorauswahl plus geeignete kontinuierliche beziehungsweise konservativ adaptive Prüfung. Schnelle Bewegungen dürfen nicht zwischen groben Abtastpunkten hindurch unbemerkt kollidieren. Dokumentiere Näherungen, Toleranzen und nicht abgedeckte Fälle. Beginne bei Bedarf mit konservativen Körperhüllen; das ist keine realistische Körperphysik.

Hinweise enthalten betroffene Personen/Objekte, Zeitintervall, modellierten Mindestabstand und einen Sprung zur Stelle. Veränderungen nur nach Nutzerbestätigung: geeignete deterministische Alternativen wie ein anderer Weg oder Startversatz als Vorschau anbieten. Auch „Keine passende Alternative innerhalb der Vorgaben gefunden“ ist ein korrektes Ergebnis. Keine zufällige ungeprüfte Pfadverschiebung als Problemlösung ausgeben.

Gesperrte Ziele, Musikmarker, Besetzungszuordnungen und starre Gruppenbewegungen respektieren. Nicht jede geometrische Optimierung ist choreografisch sinnvoll. Kein „100 % kollisionsfrei“, kein Sicherheitszertifikat. Benenne Ergebnisse als modellierte Abstands-/Bewegungskonflikte, nicht als physische Sicherheitsfreigabe.

## 7. Bühne, Requisiten und 3D

Basisbühne rechteckig mit Breite, Tiefe, Vorderkante/Publikum, Raster, Hinterbühne, Seitenbereichen und gekennzeichneten Ein-/Ausgangszonen. Startwert beispielsweise 12 × 10 m, frei änderbar. Requisiten als wiederverwendbare Grundkörper mit Position, Größe, Orientierung, Höhe und zeitlicher Anwesenheit. Einfache Podeste als klar modellierte Flächen können integriert werden; keine ungetestete automatische Treppen-/Mehrstockwerksnavigation behaupten.

Ändern von Bühnenmaßen zeigt eine Vorschau. Wahlweise Positionen behalten oder bewusst skalieren; keine stille Verkleinerung von Personenabständen. Bewegung außerhalb der aktiven Bühne in erlaubten Seitenzonen von unbeabsichtigtem Verlassen unterscheiden.

3D: hochwertige, leicht lesbare stilisierte menschliche Figuren mit klarer Blickrichtung, Gruppenfarbe und auswählbarem Kürzel. Dezente Schatten und Bühnenkante, kein aufwendiges Showlicht als Grundvoraussetzung. Kameras: Oben, Schräg, Publikum, freie Ansicht und Zurücksetzen. Auswahl und Zeit beim Wechsel erhalten.

Grundlegendes Verschieben und Drehen auch in 3D; präzise Planung bleibt in 2D besonders gut zugänglich. Keine willkürlichen Tanzschritte, die nicht im Datenmodell existieren. Rendering und Assets austauschbar halten, aber Fotorealismus, Motion Capture und detaillierte Körperchoreografie nicht in den MVP hineinziehen.

## 8. Hebefiguren als zeitliche, schematische Planung

Vorlagenfamilien: Schultersitz, Schulterstand, T-Hebung, waagerechte Hebung/Flat Back, Prep, Extension und sitzende beziehungsweise Straddle-Varianten. Begriffe vor Implementierung gegen das offizielle ICU-Glossar prüfen. Diese Auswahl ist eine Produktbibliothek, keine belegte Rangliste der häufigsten oder sichersten Figuren.

Jede Instanz hat konkrete Personenrollen, zum Beispiel tragend, gehoben und sichernd; optional mehrere gehobene Personen bei einer passend modellierten eigenen Figur. Phasen: Aufbau, Anheben, Halten, Absetzen. Höhen und Dauern sind Planungsparameter, keine automatisch empfohlenen Sicherheitswerte. Eigene Figur mit Notiz, Rollen und schematischer Darstellung ermöglichen.

Zeige verständliche schematische Posen; kein einzelner frei schwebender Avatar, während Träger an anderer Stelle stehen. Zusammenhängende Bewegung der Hebegruppe ist zeitlich modellierbar. Prüfe Kontaktbeziehungen nur in den ausdrücklich markierten Phasen. Beabsichtigten Kontakt innerhalb der Figur nicht ständig warnen; Kontakt zu anderen Gruppen und Requisiten weiterhin prüfen. Eine gesamte Hebegruppe darf nicht pauschal aus der Konfliktprüfung verschwinden.

Keine praktischen Schritt-für-Schritt-Hebeübungen, keine biomechanische Freigabe, keine Tragfähigkeitsberechnung, keine automatischen Personenersetzungen und keine „Sicher“-Kennzeichnung. Hinweis: Visualisierung ersetzt keine fachkundige Planung und Absicherung. Automatische Wurf-, Salto- und Wettkampfregel-Freigaben sind nicht Teil des MVP.

## 9. Musik, Counts und nicht destruktiver Schnitt

Import lokaler unterstützter Audiodateien über den System-Dateidialog; Formate und Gerätesupport tatsächlich testen. Keine Spotify-/Apple-Music-Downloads oder DRM-Umgehung. Musik nie ohne Kenntnis des Eigentümers in öffentlich abrufbaren Dateien veröffentlichen.

Wellenform, Abspielen, Pause, Scrubbing, Loop eines Abschnitts, Lautstärke, Tempoeingabe, Tap-Tempo, Count-Offset und manuell korrigierbare Beatmarker. Optional eine kleine getestete deterministische Beat-Vorschlagsfunktion; kein ML-Dienst. Falsche Beatvorschläge dürfen manuelle Bedienung nicht blockieren.

Grundlegender Schnitt: Anfang/Ende trimmen, teilen, Abschnitte entfernen, Clips anordnen und Ein-/Ausblenden. Alle Operationen nicht destruktiv; Original bleibt erhalten. Eine Audiospur mit mehreren Clips genügt; keine komplette Mehrspur-DAW.

Beim Entfernen oder Verschieben eines Zeitabschnitts ausdrücklich unterscheiden: nachfolgende Choreografie mitverschieben oder ihre Zeitposition behalten. Tempoänderungen dürfen je nach dokumentierter Verankerung Counts oder Sekunden erhalten. Vor potenziell weitreichenden Änderungen Vorschau und Rückgängig ermöglichen.

Master-Zeitbasis mit Audioausgabe synchronisieren. Nicht die Zeichenschleife als unkontrolliert driftende Musikuhr verwenden. Unterbrechungen, Hintergrund/Vordergrund, Kopfhörerwechsel, stummgeschaltete Wiedergabe, fehlende Audiodateien und Export-Synchronität prüfen.

## 10. Konten, Datenhaltung und Zusammenarbeit

### 10.1 Anmeldung und Rechte

In der veröffentlichten Editor-App ist ein Konto Standard. Biete Supabase-Anmeldung per E-Mail und eine passende native Apple-Anmeldung an, mit echten Fehler-, Bestätigungs-, Abmelde- und Löschabläufen. Der lokale Entwicklungsmodus hat eine separat isolierte Testidentität. Zuschauer dürfen ausdrücklich freigegebene Links ohne eigenes Pro-Abo und optional ohne Konto ansehen.

Nutze Supabase in einer konkret ausgewählten EU-Region, bevorzugt Frankfurt. Keine vorhandenen Projekte ungefragt umbauen. Produktions- und Testprojekte streng trennen. Beachte aktuelle Supabase-Änderungen, insbesondere explizite API-Freigaben und RLS; „public“ bedeutet nicht automatisch berechtigt oder API-exponiert.

Rollen: Eigentümer, eingeladener Bearbeiter, eingeladener Leser und eingeschränkter Freigabelink. Pro-Berechtigung des Eigentümers aktiviert bis zu vier zusätzliche Bearbeiter im betreffenden Projekt, ohne dass jeder Mittrainer selbst Pro kaufen muss. Ordnerrechte mit klarer Vererbung und sichtbaren Projekt-Ausnahmen unterstützen. Änderungen von Freigaben sind bewusst und nachvollziehbar.

Personen in einer Besetzung sind keine verpflichtenden App-Konten. Kürzel statt Klarnamen erlauben; keine Fotos, Geburtsdaten, biometrischen Daten oder gesundheitlichen Angaben verlangen. Bei Gruppen mit Minderjährigen besonders sparsame Standarddaten und private Freigaben.

### 10.2 Sicherheit

RLS und Tests für alle exponierten Tabellen, Storage-Objekte und Realtime-Kanäle. Authentifizierung alleine ist keine Berechtigung. Private Buckets und zeitlich begrenzte URLs. Serverseitige Upload-/Tarifgrenzen, Dateigrößenprüfung und Typvalidierung. Nutzer dürfen weder ihr Abo noch Projektmitgliedschaften durch selbst bearbeitbare Metadaten aufwerten.

Keine Service-Role-/Secret-Schlüssel im Client. Privilegierte Funktionen möglichst vermeiden; falls zwingend, eng begrenzen, Berechtigungen intern prüfen und nicht als beliebig aufrufbare Hintertür veröffentlichen. Datenbank-Views dürfen RLS nicht unbemerkt umgehen. SQL-Änderungen müssen in reproduzierbaren Migrationen landen. Keine Debug-Auth oder Zahlungsumgehung in Produktionsbundles.

Öffentliche Links besitzen ausreichend zufällige, serverseitig nur gehasht gespeicherte Tokens, beschränkten Umfang und Widerrufsmöglichkeit. Keine Link-Tokens in Telemetrie oder Referrer-Lecks. Ein Link liefert nur veröffentlichte Inhalte, keine Entwurfsdaten, Mitgliederlisten oder private Notizen. Widerruf verhindert zukünftige Zugriffe; bereits heruntergeladene Kopien können nicht magisch zurückgeholt werden.

### 10.3 Offline und Synchronisierung

Bearbeitungen zuerst lokal atomar speichern; Outbox und versionierte Befehle für Synchronisierung nutzen. Projekt-Snapshots plus begrenztes Änderungsprotokoll; keine vollständige Projektdatei bei jedem Frame neu hochladen. Nur echte, zusammengefasste Bearbeitungen übertragen. Drag-Preview/Präsenz sind begrenzte flüchtige Nachrichten, keine dauerhaften Datenbankwrites mit Bildwiederholrate.

Jeder Befehl trägt eindeutige ID, Akteur, Basisrevision und betroffene Objekte. Serverseitige Berechtigungsprüfung, atomare Anwendung und Idempotenz. Unabhängige Änderungen dürfen zusammengeführt werden; widersprechende Änderungen bleiben sichtbar und auflösbar. Kein blindes Last-Write-Wins für das gesamte Projekt. Nicht synchronisierte Änderungen niemals verlieren.

Bei parallelem Ziehen desselben Objekts Eigentümerschaft/temporäre Bearbeitungssperre oder einen gleichwertigen klaren Konfliktmechanismus implementieren. Lokales Undo im Team darf fremde Änderungen nicht heimlich rückgängig machen. Bei offline entzogenem Zugriff sichere Kopie beziehungsweise Export der eigenen noch nicht übertragenen Arbeit anbieten, statt diese in ein fremdes Projekt zurückzuzwingen.

## 11. Freigaben, Wiedergabe und Exporte

Trainer bearbeiten einen **Entwurf**. „Probenstand veröffentlichen“ erstellt einen unveränderlichen, versionierten Snapshot mit referenzierten Medien. Spätere Entwurfsänderungen verändern den freigegebenen Stand nicht. Eine neue Version muss ausdrücklich veröffentlicht werden. Offline-Entwürfe dürfen erst nach erfolgreicher Synchronisierung als gemeinsamer Serverstand freigegeben werden.

Zuschaueransicht im Browser und in der App: 2D/3D, Abspielen, Abschnitt wiederholen, Geschwindigkeit ändern, persönliche Person markieren und deren Weg hervorheben. Keine Bearbeitungsrechte durch versteckte URL-Parameter. Keine Pro-Paywall für eingeladene Tänzer. Bei nicht freigegebener Musik eine verständliche lautlose Wiedergabe ermöglichen.

Exports gemäß Tarif:

- PNG einer Formation sowie einfache PDF-Gesamtübersicht mit eindeutigen Namen/Kürzeln, Bühnenrichtung und Zeitangaben.
- Pro: lesbare mehrseitige Probenunterlagen einschließlich Counts, Übergängen, Notizen und persönlichen Laufwegplänen; nicht alle Informationen unlesbar auf eine Seite pressen.
- Video: 2D/3D, Musik soweit zulässig, wählbarer Ausschnitt und Kamera; tatsächliche exportierte Auflösung und Audio-/Bildsynchronität testen. 720p kostenlos, bis 1080p Pro.
- Versioniertes portables Projektpaket mit validierbarem Manifest, Fachschema und optionalen rechtmäßig weitergegebenen Medien. Rohdatenexport eigener Daten bleibt unabhängig vom Tarif verfügbar. CSV-Import/-Export für Besetzungen ergänzen.

Rendering und Encodierung möglichst lokal auf dem Gerät, kein Cloud-Video-Rendering als versteckte Pflicht. Native Exportadapter und eine passende Browserlösung dürfen sich technisch unterscheiden, müssen aber dieselbe Szene auswerten. Unterstützt eine Entwicklungsplattform einen nativen Export nicht, dies ehrlich anzeigen und auf dem iPhone testen; keine Dummy-Datei oder umbenannte Videodatei liefern.

Projektimport prüft Schema-Version, IDs, Größen, Medienreferenzen und ungültige Werte. Ein Export-/Import-Rundlauf muss Bewegungen, volle Umdrehungen, Timing, Hebefiguren und Personenidentitäten erhalten. Keine Ausführung eingebetteten Codes. Kein behaupteter Choreographic-Import ohne tatsächlich bekanntes, erlaubtes und getestetes Austauschformat.

## 12. Abos, Betrieb und Veröffentlichungsreife

Für den ersten Release Apple In-App Purchase verwenden. Bevorzugt eine gepflegte, mit StoreKit 2 kompatible Integration ohne zusätzlichen zwingenden Bezahlservice. RevenueCat oder ein anderer Dienst darf nicht stillschweigend zusätzliche Vertrags-/Betriebsvoraussetzung werden.

Serverseitige Transaktionsprüfung und Verarbeitung von Kauf, Verlängerung, Ablauf, Rückerstattung, Widerruf, Zahlungsproblem und Wiederherstellung. Apple-Servermeldungen verifizieren und idempotent behandeln. Sandbox und Produktion getrennt. Entitlements nicht aus einem Client-Boolean ableiten. Offline-Berechtigungen mit dokumentiert begrenzter Gültigkeit; beim Ablaufen niemals den Zugriff auf eigene Daten und lokale Sicherungen zerstören.

Tarifübersicht nennt Gesamtpreis, Abrechnungszeitraum, Verlängerung und Kündigung verständlich. „Käufe wiederherstellen“ und Abo-Verwaltung leicht erreichbar. Kaufabbruch bleibt ein normaler Zustand. Verknüpfung von Apple-Transaktion und App-Konto nachvollziehbar, keine unberechtigte Übertragung zwischen Nutzern.

Vor Release aktuelle Apple-Anforderungen prüfen: Kontolöschung, Datenschutzangaben, Abo-Metadaten, Wiederherstellung, Alters-/Zielgruppenangaben, notwendige Berechtigungsbegründungen, Supportkontakt, Händlerangaben und Review-Zugang. Rechts-/Unternehmensdaten nicht erfinden. Fehlende Konfigurationen als echte Release-Blocker dokumentieren.

Supabase-Standard-E-Mailversand nicht als Produktionslösung behandeln: eigenen geeigneten SMTP-Versand mit authentifizierter Domain vorbereiten. Kostenwarnungen, serverseitige Quoten, Logging ohne private Inhalte, Wiederherstellungsplan für Datenbank UND Medien sowie Einblick in tatsächlichen Verbrauch bereitstellen. Prüfen, welche Anbieter-Sicherungen Medien tatsächlich abdecken; Datenbanksicherung ist nicht gleich Medienbackup.

Kein Tracking zur Werbung, kein Verkauf von Tanz-/Teilnehmerdaten. EU-Datenbankstandort allein nicht als vollständige Datenschutzkonformität darstellen. Externe Dienste, Datenflüsse, Löschung und Aufbewahrung dokumentieren. Rechtliche Texte als überprüfungsbedürftige Vorlage kennzeichnen, nicht als rechtsverbindliche Garantie.

## 13. Tests und überprüfbare Abnahme

Lege synthetische, reproduzierbare Testprojekte an: einfache Reihe mit 8 Personen; Showprojekt mit 24 Personen, mehreren Gruppen und Hebefigur; Belastungsprojekt mit 100 Personen und 200 Formationen. Verwende selbst erzeugte Testtöne oder rechtmäßig nutzbare Musik.

Pflichtprüfungen:

1. Ein frischer Checkout startet nach dokumentierter Installation lokal ohne Supabase, Docker, Modell-API und Deployment. Änderungen und Testprojekte überleben Browser-/App-Neustarts.
2. Gruppe als starre Linie um die Mitte drehen: Abstände bleiben über den gesamten Verlauf gleich; Mittelpunkt bleibt korrekt. Drehungen +360°, -360° und 720° werden vollständig ausgeführt.
3. Verschiebung plus Drehung, Fächern und zeitversetzte Teilgruppen ergeben reproduzierbare Zwischenzustände. Keine IDs werden getauscht.
4. Identischer Projektzeitpunkt in 2D, 3D, Export und Konfliktprüfung liefert dieselben Positionen innerhalb definierter numerischer Toleranz.
5. Zwei Pfade kreuzen sich zu unterschiedlichen Zeiten: keine falsche gleichzeitige Kollision. Gleichzeitige Nähe wird erkannt. Schnelle Bewegungen dürfen nicht durch das Prüfraster fallen.
6. Genehmigte Kontaktbeziehungen einer Hebefigur sind phasenbezogen; fremde Personen und Requisiten bleiben in der Prüfung. Keine Sicherheitsfreigabe wird behauptet.
7. Rückgängig/Wiederholen fasst Gesten zusammen, verändert keine fremde Teamarbeit und erhält Daten nach Neustart.
8. Audioimport, Counts, Schnitt, Seek, Loop und Export bleiben nachvollziehbar synchron. Fehlende Dateien und App-Unterbrechungen sind beherrscht.
9. Flugmodus bearbeiten, App schließen, neu öffnen, wieder verbinden: keine verlorenen Änderungen. Doppelt gesendete Befehle werden nur einmal angewendet.
10. Zwei echte Testkonten bearbeiten parallel. Unabhängige Änderungen bleiben erhalten, gleiche Objekte erzeugen einen verständlichen Konflikt. Simulierte lokale Tests ersetzen diese Integrationstests nicht.
11. Nutzer A kann weder Entwürfe, Storage-Dateien, Realtime-Nachrichten noch Abozustand von Nutzer B unberechtigt lesen/verändern. Freigabelink sieht nur den veröffentlichten Snapshot.
12. Entwurf nach Freigabe ändern: Zuschauerstand bleibt unverändert. Widerruf blockiert neue Zugriffe. Ordnerrechte und Projekt-Ausnahmen sind geprüft.
13. Free/Pro-Grenzen inklusive Offline-Konflikt, Speicherüberschreitung, Kaufabbruch, Wiederherstellung und Pro-Ablauf verlieren keine Daten. Kein Pro-Konto für reine Zuschauer erforderlich.
14. PNG, PDF, Video und portables Projektpaket sind echte nutzbare Dateien. Rundlauf des Projektpakets erhält die komplette Choreografie.
15. Kleine iPhones, größere Schrift, Light/Dark, VoiceOver-Kernaktionen, Tastatur und Bildschirmränder: keine abgeschnittenen Hauptaktionen. Gleiche Funktionen bleiben immer am gleichen Ort.
16. Ein echtes iPhone prüft Touch, 3D, Audio, Native-Export und Käufe im Sandboxmodus. Browsertests sind hierfür kein Ersatz.

Leistung: Ziel mindestens flüssige 60-fps-2D-Interaktion und 30-fps-3D-Vorschau bei einem repräsentativen 32-Personen-Projekt auf einem definierten Referenzgerät, zunächst iPhone 12 als Prüfziel. Anschließend 64/100 Personen messen und Qualitätsstufen/Fallbacks dokumentieren. Das sind Zielwerte, keine ungemessenen Erfolgsmeldungen. Keine 60 globalen React-State-Neuberechnungen oder Cloud-Writes pro Sekunde erzwingen. Messgerät, Betriebssystem, Projektgröße, Dauer und tatsächliche Ergebnisse festhalten.

Automatisiere Kernmathematik, Serialisierung, Import-/Exportmodelle, Rechte, Tarifregeln, Datenmigrationen und zentrale Web-Interaktionen. Nutze geeignete Property-Tests für Transformationen und Roundtrips. Visuelle Prüfungen an Light/Dark und kleinen/normalen Ansichten. Native Tests und nicht durchführbare Prüfungen separat als offen markieren.

## 14. Umsetzungsreihenfolge – kleine fertige Schritte

Arbeite in folgenden überprüfbaren Meilensteinen, ohne daraus isolierte Wegwerf-Demos zu machen:

**M0 – Grundlage:** Repository, kurze Architektur-/UI-Spezifikation, Scripts, persistente lokale Entwicklung, beide Themes, Navigation, initiales Testprojekt und echter früher 3D-Kompatibilitätstest.

**M1 – Nutzbarer Editor:** Besetzungen, Bühne, Formationen, Auswahl, direktes Verschieben, Undo/Redo, individuelle Wege, zentrale Zeit-/Szenenauswertung, 2D/3D mit demselben Zustand und portable Speicherung.

**M2 – Bewegungen:** Gruppenmuster und Kombinationen, exakte volle Drehungen, Konfliktprüfung und bestätigungspflichtige deterministische Änderungsvorschläge, Hebefiguren mit Phasen.

**M3 – Musik und Planung:** Audio, Counts, Wellenform, grundlegender Schnitt, Vorschau, Requisiten, Notizen, Vorlagen und gut verständliche Zeitbearbeitung.

**M4 – Cloud und Team:** echte Supabase-Integration, Auth, RLS/Storage-Tests, Offline-Sync, parallele Bearbeitung, Ordner-/Projektrechte und getrennte veröffentlichte Zuschauerstände.

**M5 – Verkauf und Ausgaben:** alle Exportarten, verifizierte Store-Abos, Tarife, Wiederherstellung, Kontolöschung, SMTP, Quoten, Website-/Freigaberouten und Releasekonfiguration.

**M6 – Abnahme:** echte iPhone-Tests, Performance, Sicherheits-/Rechteprüfungen, reproduzierbare TestFlight-Vorbereitung, Datenschutz-/Store-Checkliste und dokumentierte externe Restschritte.

Ein Meilenstein ist nur abgeschlossen, wenn die betreffenden Abläufe tatsächlich funktionieren und geprüft wurden. Ein bestandener M0 oder M1 ist noch kein verkaufsfertiger MVP. Fehlende schwerere Funktionen nicht heimlich auf „später“ verschieben und dann trotzdem Vollständigkeit behaupten. Arbeite so weit wie im aktuellen Lauf möglich und hinterlasse einen präzisen Status für die Fortsetzung, ohne Hintergrundarbeit zu versprechen.

## 15. Dokumente, Vergleich und Abschlussbericht

Lege an und halte aktuell:

- `README.md`: Start unter Windows, lokaler Testmodus, iPhone-Entwicklungsbuild und häufige Startprobleme.
- `AGENTS.md`: kurze verbindliche Regeln und Verweise, keine Kopie dieses gesamten Dokuments.
- `docs/ARCHITECTURE.md`, `docs/UI_SPEC.md`, `docs/DATA_MODEL.md`: schlanke, konsistente Entscheidungen.
- `docs/STATUS.md` und `docs/ACCEPTANCE.md`: echte Fortschritte, Tests, Blocker und nächster ausführbarer Schritt.
- `docs/FEATURE_PARITY.md`: bekannte Choreographic-Basisfunktionen mit Quellen, Nachweisdatum und eigenem Umsetzungsstatus.
- `docs/OPERATIONS.md`: Test/Produktion, Backups, SMTP, Kosten, Quoten, Release/Rollback und Schlüsselverwaltung.
- `docs/STORE_RELEASE.md`: Kennungen, Apple/EAS-Schritte, echte Sandboxprüfung und noch manuell auszufüllende Angaben.
- `.env.example` sowie getestete Test-/Build-/Startskripte ohne Geheimnisse.

Vergleiche mindestens: Formationen und Vorlagen, individuelle Kurvenwege, Gruppen/Besetzungen, 3D, Musik-/Timingsteuerung, Offline, Zusammenarbeit, Ordnerrechte, Requisiten, Wiederverwendung und Weitergabe. Behaupte nicht, jede bezahlte Choreographic-Funktion getestet zu haben, wenn nur eine öffentliche Beschreibung verfügbar ist. Unklare Tarifzuordnungen als unklar kennzeichnen. Nutze Wettbewerberinhalte ausschließlich als Funktionsreferenz, kopiere weder Branding noch proprietäre Assets oder Quellcode.

Der Abschlussbericht jedes größeren Arbeitsstands nennt: tatsächlich implementierte Abläufe, ausgeführte Tests und Ergebnisse, bekannte Einschränkungen, genaue Startanweisung und notwendige externe Konfiguration. Keine erfundenen Demo-URLs, Build-IDs oder Testresultate. Formuliere „bereit für lokale Erprobung“, „auf iPhone geprüft“ und „bereit zur Store-Einreichung“ nur, wenn jeweils die entsprechenden Kriterien erfüllt sind.

**Beginne jetzt mit Bestandsprüfung und M0, lege einen knappen Umsetzungsplan an und implementiere unmittelbar den ersten durchgängigen Editorablauf. Stoppe nicht nach dem Plan.**

## Referenzquellen für die Implementierung

Primärquellen; prüfe die jeweils aktuellen relevanten Abschnitte statt neue Bibliotheks- oder Store-Fakten aus dem Gedächtnis zu behaupten. Diese Liste ist keine Aufforderung, vor jeder kleinen Änderung alle Seiten erneut einzulesen.

- Choreographic, deutsche App-Store-Beschreibung: `https://apps.apple.com/de/app/choreographic-tanzformationen/id1608391996`
- Expo Development Builds: `https://docs.expo.dev/develop/development-builds/introduction/`
- Expo Entwicklungsbuild verwenden: `https://docs.expo.dev/develop/development-builds/use-development-builds/`
- Expo App-Varianten: `https://docs.expo.dev/tutorial/eas/multiple-app-variants/`
- Expo Web-Veröffentlichung: `https://docs.expo.dev/guides/publishing-websites/`
- React Three Fiber / Native: `https://r3f.docs.pmnd.rs/getting-started/installation`
- Supabase Changelog: `https://supabase.com/changelog`
- Supabase Sicherheits- und Produktionsdokumentation: `https://supabase.com/docs/guides/deployment/going-into-prod`
- Supabase Regionen: `https://supabase.com/docs/guides/platform/regions`
- Supabase SMTP: `https://supabase.com/docs/guides/auth/auth-smtp`
- Supabase Kostenkontrolle: `https://supabase.com/docs/guides/platform/cost-control`
- Vercel Deployments: `https://vercel.com/docs/deployments`
- Apple App Review: `https://developer.apple.com/app-store/review/guidelines/`
- Apple In-App-Abos: `https://developer.apple.com/app-store/subscriptions/`
- Apple EU-Bedingungen: `https://developer.apple.com/support/apps-in-the-eu/`
- ICU-Begriffe für schematische Hebefiguren: `https://cheerunion.org/cheerleading-glossary/`
