# Brevo für Supabase-Auth-Mails

Stand 16. Oktober 2026: Brevo ist vom Eigentümer gewählt. Die Einrichtung betrifft zunächst das **Testprojekt `zhuslvtfktpclopkoqtf`**. Vorläufiger Absender ist die **vom Eigentümer benannte Gmail-Adresse**; persönliche Absender- und Testkonto-Adressen werden nicht im Repository gespeichert. Eine eigene Maildomain folgt später. Brevo-Zugang und verifizierter Absender wurden im Dashboard geprüft. Der Eigentümer hat den eigenen Schlüssel `ChoreoFlow Test` erstellt und direkt in Supabase gespeichert. Ein neu geladener Supabase-Tab bestätigt aktiviertes SMTP ohne ungespeicherte Änderungen; Brevo zeigt den neuen Schlüssel aktiv. Der Schlüssel wurde nicht ausgelesen. Die tatsächliche Registrierung, Zustellung und E-Mail-Bestätigung sind erfolgreich nachgewiesen; die anschließende App-Anmeldung ist noch offen.

Die deutsche Registrierungsbestätigung ist im Testprojekt gespeichert: Betreff `ChoreoFlow: E-Mail-Adresse bestätigen`, Inhalt aus `supabase/templates/confirmation.html`. Die Supabase-Linkvariable `{{ .ConfirmationURL }}` bleibt unverändert. Für ein neues Projekt wird diese Datei manuell unter Authentication → Emails → Confirm sign up übernommen; es gibt keine automatische Übertragung von Auth-Dashboard-Einstellungen durch SQL-Migrationen.

`gmail.com` lässt sich durch diesen Brevo-Nutzer nicht authentifizieren. Brevo ersetzt bei solchen Absendern den Domainteil beim Versand durch eine Adresse unter `brevosend.com`; Empfänger sehen daher nicht zwingend die eingegebene Gmail-Adresse als Absender. Dies ist für den vorläufigen Test einzuplanen. **Für diesen Schritt ist kein Domainkauf erforderlich.** [Brevo: Ersatz von Absenderadressen](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication)

Der reale Test vom 16. Oktober bestätigt diesen Ersatzabsender im Brevo-Protokoll. Für `ChoreoFlow: E-Mail-Adresse bestätigen` stehen dort **Versendet** und **Zugestellt** um 09:56 Uhr (Europe/Berlin). Der Eigentümer bestätigte den Empfang/Link; Supabase speichert `confirmation_sent_at` 07:56:25 UTC und `email_confirmed_at` 07:56:40 UTC. Es besteht ein echtes bestätigtes Testkonto. Brevo zeigt außerdem **Angeklickt** und **Von Proxy geladen**: Tracking ist weiterhin aktiv. Der erfolgreiche Linktest ist kein Nachweis abgeschalteten Trackings oder vollständiger Produktionsreife. Private Mail-URLs, Nachrichtentokens, SMTP-Login und Schlüssel wurden nicht in Git übernommen.

## Werte für Supabase

Unter [Authentication → Emails → SMTP Settings](https://supabase.com/dashboard/project/zhuslvtfktpclopkoqtf/auth/smtp) „Enable custom SMTP“ verwenden:

| Feld | Einzutragender Wert |
| --- | --- |
| Host | `smtp-relay.brevo.com` |
| Port | `587` mit STARTTLS |
| Username | Exakt **Login** aus Brevo → Settings → SMTP & API → SMTP |
| Password | Brevo **SMTP-Key**; weder API-Key noch Brevo-Anmeldepasswort |
| Sender email | Vom Eigentümer benannte Gmail-Adresse; ihren Absenderstatus in Brevo bestätigen |
| Sender name | `ChoreoFlow` |
| Minimum interval per user | Zunächst `60` Sekunden beibehalten |

Der SMTP-Login kann eine generierte Adresse wie `[ID]@smtp-brevo.com` sein. Deshalb nicht einfach die Account-Mail übernehmen. Den SMTP-Key direkt in Supabase hinterlegen; niemals in Git, Chat-Ausgaben, Vercel oder `EXPO_PUBLIC_*`. Für diese SMTP-Anbindung braucht die App keine neue Bibliothek. Quellen: [Brevo-SMTP-Zugangsdaten](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP), [Brevo-Supabase-Anleitung](https://developers.brevo.com/docs/supabase-smtp-integration).

## Einrichtung und verbleibende Prüfung

1. **Absender bereits geprüft.** Die benannte Gmail-Adresse ist in Brevo verifiziert. Der vorhandene Absender wird auch für ein anderes Projekt genutzt und wurde nicht umbenannt; Supabase verwendet den Anzeigenamen `ChoreoFlow`. Nicht versuchen, `gmail.com` als eigene Domain zu authentifizieren.
2. **Eigener SMTP-Key gespeichert.** Der zuvor vorhandene Schlüssel gehört zu einem anderen Projekt und wurde weder wiederverwendet noch geändert. Der Eigentümer hat nach Brevos E-Mail-Identitätsprüfung `ChoreoFlow Test` erstellt und direkt im Supabase-Formular gespeichert. Der Schlüssel gehört in den Passwortmanager und Supabase, nicht in dieses Repository. [Brevo-SMTP-Keys](https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys)
3. **Tracking für Auth-Mails klären.** Supabase empfiehlt das Abschalten, weil Tracking die Auth-Links verändern kann. Brevo dokumentiert keine isolierte Abschaltung je SMTP-Key oder Absender. Ein eigener Schlüssel trennt Zugangsdaten und Widerruf, nicht nachweislich Tracking-Einstellungen. **„Anonymous email tracking“ reicht nicht:** Öffnungen/Klicks werden weiterhin erfasst. Die dokumentierte Consent-Funktion wirkt bei Aktivierung auf alle Versandkanäle und vorhandenen Kontakte; deshalb wurde sie im bereits anderweitig genutzten Konto nicht umgestellt. Der einzelne HTTP-API-Parameter `contactPixelTrackingConsent: false` ist kein dokumentierter SMTP-Header und setzt diese kontoweite Funktion voraus. Vor Freigabe die tatsächlich zugestellte Auth-Mail auf umgeschriebene Links prüfen und gegebenenfalls eine gezielte Ausnahme mit Brevo klären. Quellen: [Supabase: Email tracking](https://supabase.com/docs/guides/auth/auth-email-templates#email-tracking), [Brevo: anonymisiertes Tracking](https://help.brevo.com/hc/en-us/articles/11643306229906-Can-I-anonymize-the-tracking-of-opens-and-clicks-for-my-emails), [Brevo: Tracking-Consent und API](https://help.brevo.com/hc/en-us/articles/37114679474706-About-email-tracking-pixels-and-the-CNIL-recommendation-in-Brevo), [Brevo: SMTP-Referenz](https://developers.brevo.com/docs/smtp-integration)
4. **Supabase gespeichert, Rückwege konfiguriert.** SMTP-Aktivierung wurde nach Neuladen bestätigt. Site URL und exakte Redirect-Allowlist sind auf die Testvorschau und lokalen Adressen abgestimmt, siehe `CLOUD.md`. E-Mail-Bestätigung bleibt aktiviert. Supabase setzt bei Custom SMTP zunächst 30 Mails/Stunde; Brevos eigenes Kontolimit gilt zusätzlich. Keine Limits oder Tarife automatisch erhöhen. [Supabase Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
5. **Registrierung und Zustellung geprüft; restliche Auth-Flows offen.** Der Eigentümer hat sich im lokalen Appformular registriert und den Mail-Link bestätigt; die eigene Empfängeradresse und Einsicht in ihr Zustellprotokoll wurden ausdrücklich freigegeben. Die tatsächlichen Nachweise stehen oben. Anschließende App-Anmeldung, Sessionwiederherstellung, Passwort-Reset und Kontolöschung separat abnehmen. DKIM/DMARC und die genaue Linkumschreibung wurden nicht anhand vollständiger Mailheader untersucht. Der Rückweg führt zum konfigurierten Preview-Alias mit vorgeschaltetem Vercel-SSO; die Bestätigung ist schon vor diesem Redirect wirksam, die lokale App benötigt anschließend eine eigene Anmeldung.

## Später: eigene Maildomain

Nach Auswahl einer eigenen Domain in Brevo unter Settings → Senders, Domains, IPs → Domains hinzufügen. Genau die erzeugten DNS-Werte übernehmen, insbesondere Brevo-Code, DKIM und DMARC; bestehende Einträge erhalten und Änderungen abstimmen. Anschließend „Authenticated“ und den neuen Absenderstatus prüfen, Supabase-Absender umstellen und Zustellung erneut testen. DNS kann bis zu 48 Stunden benötigen. [Brevo-Domainauthentifizierung](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC)

Expo-Nutzer und Projekt sind verknüpft; native Rücksprunglinks werden nach Festlegung der Bundle-ID gesondert geprüft. Diese Anleitung enthält keine Zugangsdaten und löst selbst keine externen Aktionen aus.
