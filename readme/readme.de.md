## webuntis adapter for ioBroker

Adapter to get data from WebUntis

Dieser Adapter bezieht Daten aus Webuntis.
Es ist ein Fork von https://github.com/Newan/ioBroker.webuntis - dort befindet sich auch eine Anleitung zur Einstellung.

## Warum diese spezielle Version

Diese spezielle Variante ist vermutlich nur bei unserer Schule erforderlich und in erster Linie von persönlichen Interesse.

Leider ist es bei unserer Schule erforderlich, die Daten per anonymen Login und persönlichen Login abzuholen und diese Daten dann zu kombinieren.

Bei der Datenabfrage mit Login erhält man seinen persönlichen Stundenplan, allerdings fehlen sämtliche Informationen zum Ausfall oder Vertretung - nicht mal der Lehrer wird übertragen.

Bei der anonymen Abfrage bekommt man die Daten zum Ausfall, Vertretung oder Raumwechsel. Dabei werden auch der ursprüngliche Raum bzw. Lehrer mit übertragen.

Allerdings werden alle möglichen Unterrichtsfächer an dem jeweiligen Tag übertragen, also auch Kurse, die gleichzeit stattfinden und nicht vom Schüler gewählt wurden.

Das ist naturlich sehr unübersichtlich.

Aus diesen Gründen wurden jetzt beide Loginverfahren kombiniert.
Erst wird eine persönliche Abfrage durchgeführt und alle Daten erzeugt. Dabei werden die Unterrichtsfächer zwischengespeichert.
Dann erfolgt mit kurzer Verzögerung eine anonyme Abfrage. Dabei werden alle Unterrichtsfächer, die zuvor nicht gelesen wurden, übersprungen.

So erhält man komplette Information über den eigenen Stundenplan.

## Login mit Username & Secret

Die Schüler melden sich bei unserer Schule über IServ bei Webuntis an. D.h. es gibt keine Logindaten in der Form Username/Passwort.

In Webuntis kann man die einen QR anzeigen lassen und dort kann man auch ein Secret erhalten.
Es gibt jetzt die Möglichkeit bei den Adaptereinstellungen mit Username/Secret anstelle Username/Passwort anzumelden.

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

## Anpassungen für die speziellen Anforderung an unserer Schule (2022-10-06)

- (inbux) login two times - anonymous and using a password/secret to get all needed data
- (inbux) added login using username & secret
- (inbux) added some more states

### 0.3.4 (2022-05-08)

- change log-level for error messages

### 0.3.3 (2022-04-03)

- Add errorhandling for timetable

### 0.3.2 (2022-03-02)

- Add errorhandling for inbox & mesage center

### 0.3.1 (2022-01-30)

- Bug fixes in timetable

### 0.3.0 (2022-01-29)

- Add Inbox peview data

### 0.2.0 (2022-01-27)

- Add anonymous login

### 0.1.0 (2022-01-25)

- Add nextDay
- Add code element

### 0.0.1 (2022-01-25)

- (Newan) initial release

## License

MIT License

Copyright (c) 2022 Newan <info@newan.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
