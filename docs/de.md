# ORES für Gladys Assistant

Diese Integration überwacht das **ORES**-Verteilnetz (Wallonien, Belgien) an Ihrem Zuhause und
optional an einer zweiten Adresse: laufende Störungen, geplante Arbeiten mit
Stromunterbrechung, angekündigte Verzögerungen. Sie liest die öffentliche ORES-Störungskarte
([Pannes et interruptions](https://www.ores.be/pannes-et-interruptions/)).

> **Inoffizielle** Integration, nicht mit ORES verbunden. Sie nutzt den Webdienst ohne
> Anmeldung hinter der öffentlichen Störungskarte von ores.be, den ORES jederzeit ändern kann.

Tag: **cloud** (die Integration fragt die ORES-Website ab, lokal wird nichts gelesen).

## Konfiguration

### Zuhause

Standardmäßig ist das Zuhause **Ihr Gladys-Haus** (Einstellungen → Häuser, mit seiner Position
auf der Karte). Die Integration fragt Gladys nach dem Standort der Häuser (eine bei der
Installation angezeigte Berechtigung). Gladys liefert nur GPS-Koordinaten; die Integration
wandelt sie **einmal** über
[OpenStreetMap Nominatim](https://operations.osmfoundation.org/policies/nominatim/) in eine
Postadresse um und speichert das Ergebnis unter `/data`. Die Koordinaten werden nirgendwo
anders hin gesendet, nie an ORES.

| Feld                 | Zweck                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| Adresse des Zuhauses | „Standort des Gladys-Hauses“ (Standard) oder „Unten eingegebene Adresse“. |
| Gladys-Haus          | Name des Hauses, falls Gladys mehrere hat (leer: das erste verortete).    |

Die Schaltfläche **ORES-Störungskarte testen** zeigt die gefundene Adresse: Prüfen Sie sie. Ist
sie falsch (ungenaue Position, Haus an einer Straßenecke...), wählen Sie „Unten eingegebene
Adresse“ und füllen Sie die Felder aus.

Sie kommen von Version 0.1? Solange Sie die Konfiguration nicht speichern, wird die bereits
eingegebene Adresse weiter verwendet.

### Manuell eingegebene Adresse

| Feld         | Zweck                                                                            |
| ------------ | -------------------------------------------------------------------------------- |
| Postleitzahl | Im manuellen Modus erforderlich: die überwachte Gemeinde.                        |
| Ortschaft    | Nur wenn sich mehrere Ortschaften dieselbe Postleitzahl teilen.                  |
| Straße       | Um zu wissen, ob **Ihre** Straße betroffen ist, nicht nur die Gemeinde.          |
| Hausnummer   | Grenzt auf Ihre Straßenseite ein (ORES veröffentlicht gerade/ungerade Bereiche). |

Ohne Straße gilt die ganze Gemeinde als „Ihre Adresse“. Straßennamen werden ohne Akzente,
Groß-/Kleinschreibung und Satzzeichen verglichen: „Rue de l'Église“ entspricht
„RUE DE L EGLISE“.

### Zweite Adresse (optional)

Eine weitere zu überwachende Adresse: Zweitwohnung, Eltern, Arbeitsplatz... Geben Sie ihr einen
**Namen** (z. B. „Eltern“) und mindestens ihre Postleitzahl an. Sie erhält ein eigenes Gerät,
und die Szenen-Auslöser, die Szenen-Aktion und das Widget können sie ansprechen. Leeren Sie die
Postleitzahl, um sie zu deaktivieren.

### Weitere Einstellungen

- **Vorschau geplanter Arbeiten (Tage)**: später angekündigte Arbeiten werden ignoriert
  (standardmäßig 7).
- **Aktualisierungsintervall (s)**: wie oft die Karte gelesen wird (standardmäßig 300 s,
  mindestens 60 s).

## Die Geräte „ORES network status“

Erstellen Sie sie im Reiter **Entdecken**: eines für das Zuhause, eines für die zweite Adresse.
Jedes bietet vier binäre Sensoren (0/1):

- **Störung an meiner Adresse**: eine ungeplante Störung betrifft die Adresse;
- **Arbeiten an meiner Adresse**: geplante Arbeiten mit Unterbrechung laufen dort;
- **Bevorstehende Arbeiten an meiner Adresse**: Arbeiten sind im gewählten Zeitraum angekündigt;
- **Vorfall in meiner Gemeinde**: mindestens eine Störung oder Baustelle läuft dort.

## Szenen-Auslöser

| Auslöser                             | Wann                                             |
| ------------------------------------ | ------------------------------------------------ |
| ORES-Störung oder Arbeiten begonnen  | eine Störung oder Baustelle beginnt              |
| ORES-Störung oder Arbeiten beendet   | eine laufende Störung oder Baustelle ist beendet |
| ORES-Störung oder Arbeiten verzögert | ORES kündigt ein späteres Ende an                |
| Geplante ORES-Arbeiten angekündigt   | neue geplante Arbeiten erscheinen auf der Karte  |

Filter: **Adresse** (Zuhause / zweite Adresse), **Art** (Störung / geplante Arbeiten) und
**Wo** (an der Adresse / anderswo in der Gemeinde). Variablen für die folgenden Aktionen:
`{{triggerEvent.data.reference}}`, `city`, `start_time`, `end_time` (ISO-Daten, UTC) und
`customers` (betroffene Kunden).

Die erste Abfrage nach der Installation (oder einer Adressänderung) dient als Referenz: bereits
laufende Vorfälle lösen nichts aus. Der Zustand wird unter `/data` gespeichert, ein Neustart
wiederholt oder verpasst also keinen Übergang.

## Szenen-Aktionen

- **Adresse im ORES-Netz prüfen**: eine beliebige, in der Szene eingegebene Adresse. Ausgaben:
  `outage`, `planned_interruption`, `upcoming_interruption`, `commune_incidents`, `reference`,
  `end_time`, `next_start_time`.
- **ORES-Netzstatus abrufen**: der letzte bekannte Status des Zuhauses oder der zweiten Adresse
  (Feld **Adresse**), ohne Netzwerkabfrage, mit denselben Ausgaben.

## Widget

Das Widget **ORES-Netzstatus** zeigt die Live-Sensoren, den Status der Adresse, die Anzahl der
Vorfälle in der Gemeinde, die Liste der Störungen und Arbeiten (Details per Tippen) und eine
Schaltfläche **Aktualisieren**. Seine Einstellung **Adresse** wählt das Zuhause oder die zweite
Adresse: Fügen Sie zwei Widgets hinzu, um beide zu sehen.

## Gas- und Stromverbrauch

Noch nicht verfügbar. Das Portal my.ores.be hat keine öffentliche API, und die Anmeldung per
itsme / eID lässt sich nicht automatisieren. Eine nächste Version wird sie über die
E-Mail-/Passwort-Anmeldung von my.ores.be hinzufügen, sofern diese es erlaubt.

## Datenschutz

- Bei ORES wird nur die öffentliche Liste der Vorfälle heruntergeladen. Ihre Adressen verlassen
  Ihr Gladys nie: der Abgleich erfolgt lokal.
- Im Modus „Gladys-Haus“ werden die Koordinaten des Hauses einmal an OpenStreetMap Nominatim
  gesendet (danach bei jedem Umzug des Hauses). Geben Sie Ihre Adresse manuell ein, um dies zu
  vermeiden.
- Die Adressen werden nie in die Logs geschrieben.
