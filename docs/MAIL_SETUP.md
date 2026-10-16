# Brevo für Supabase-Auth-Mails

Stand 16. Oktober 2026: Brevo ist vom Eigentümer gewählt. Die Einrichtung betrifft zunächst das **Testprojekt `zhuslvtfktpclopkoqtf`**. Vorläufiger Absender ist die **vom Eigentümer benannte Gmail-Adresse**; die persönliche Adresse wird nicht im Repository gespeichert. Eine eigene Maildomain folgt später. Brevo-Zugang, SMTP-Konfiguration und Zustellprüfung sind noch offen; keine echte Mail wurde versendet.

`gmail.com` lässt sich durch diesen Brevo-Nutzer nicht authentifizieren. Brevo ersetzt bei solchen Absendern den Domainteil beim Versand durch eine Adresse unter `brevosend.com`; Empfänger sehen daher nicht zwingend die eingegebene Gmail-Adresse als Absender. Dies ist für den vorläufigen Test einzuplanen. **Für diesen Schritt ist kein Domainkauf erforderlich.** [Brevo: Ersatz von Absenderadressen](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication)

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

## Noch auszuführen

1. **Benannten Absender in Brevo bestätigen und Zugriff herstellen.** Die Gmail-Adresse als Absender verwenden und ihren Verifizierungsstatus prüfen; nicht versuchen, `gmail.com` als eigene Domain zu authentifizieren. Zugriff auf Brevos Absender- und SMTP-Verwaltung ist erforderlich.
2. **SMTP-Key bereitstellen.** Vorhandenen geeigneten Key verwenden oder im Brevo-Konto einen eigenen Key für ChoreoFlow-Test erstellen und sicher verwahren. Key-Erstellung kann eine Identitätsprüfung und eine Benachrichtigung an den Kontoinhaber auslösen. [Brevo-SMTP-Keys](https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys)
3. **Tracking für Auth-Mails abschalten.** Supabase empfiehlt das Abschalten, weil Tracking die Auth-Links verändern kann. Die tatsächliche Brevo-Einstellung muss mit Kontozugang geprüft werden; falls keine Abschaltung verfügbar ist, deren Möglichkeit vom Brevo-Support bestätigen lassen. **„Anonymous email tracking“ reicht nicht:** Dabei werden Öffnungen/Klicks weiterhin erfasst. Es wurde kein nicht verifizierter Dashboard-Schalter angenommen. Quellen: [Supabase: Email tracking](https://supabase.com/docs/guides/auth/auth-email-templates#email-tracking), [Brevo: anonymisiertes Tracking](https://help.brevo.com/hc/en-us/articles/11643306229906-Can-I-anonymize-the-tracking-of-opens-and-clicks-for-my-emails)
4. **Supabase speichern und Rückwege prüfen.** Obige SMTP-Werte eintragen; Site URL und Redirect-Allowlist auf die bestätigte Testadresse abstimmen. E-Mail-Bestätigung aktiviert lassen. Supabase setzt bei Custom SMTP zunächst 30 Mails/Stunde; Brevos eigenes Kontolimit gilt zusätzlich. Keine Limits oder Tarife automatisch erhöhen. [Supabase Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
5. **Zustellung später ausdrücklich testen.** Nach Freigabe an eine bestätigte eigene Testadresse: Registrierung/Bestätigung, Anmeldung und gegebenenfalls Passwort-Reset prüfen. Tatsächlich sichtbaren Brevo-Ersatzabsender, DKIM/DMARC, unveränderten Bestätigungslink, Redirect und Brevo-Zustelllog kontrollieren. Ein gespeichertes SMTP-Formular allein ist kein Zustellnachweis. Bis dahin bleibt Mail-E2E offen.

## Später: eigene Maildomain

Nach Auswahl einer eigenen Domain in Brevo unter Settings → Senders, Domains, IPs → Domains hinzufügen. Genau die erzeugten DNS-Werte übernehmen, insbesondere Brevo-Code, DKIM und DMARC; bestehende Einträge erhalten und Änderungen abstimmen. Anschließend „Authenticated“ und den neuen Absenderstatus prüfen, Supabase-Absender umstellen und Zustellung erneut testen. DNS kann bis zu 48 Stunden benötigen. [Brevo-Domainauthentifizierung](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC)

Expo-Nutzer und Projekt sind inzwischen benannt; native Rücksprunglinks werden nach Projektverknüpfung und Festlegung der Bundle-ID gesondert geprüft. Diese Anleitung erstellt keine Accounts, DNS-Einträge, Keys oder Nachrichten.
