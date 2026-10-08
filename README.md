# Spielraum · Open Browser Game Lib

Deutschsprachige Browser-Spielesammlung mit 51 Katalogeinträgen, 14 eigenen Spielen und 10 Spielen mit echten Mehrspieler-Räumen für getrennte Geräte. Eigener Code, Illustrationen und Regeltexte stehen unter der MIT-Lizenz.

Repository: https://github.com/xLordTime/Open-Browser-Game-Lib

## Im selben Netzwerk spielen

Voraussetzung: Node.js 20 oder neuer. Keine zusätzlichen Pakete und kein Build erforderlich.

1. Repository herunterladen oder klonen.
2. Unter Windows `Start-Spielraum.cmd` öffnen; alternativ im Projektordner `npm start` ausführen.
3. Am Gastgeber-Gerät `http://localhost:5173` öffnen. Andere Geräte im selben Netzwerk öffnen die im Startfenster angezeigte Netzwerkadresse mit Port 5173.
4. Bei einem unterstützten Spiel den Tab **Mehrspieler** öffnen, einen Raum erstellen und den Einladungslink teilen. Gäste treten mit ihrem Namen bei; der Gastgeber startet, sobald alle Plätze besetzt sind.

Der Gastgeber muss den Server laufen lassen. Falls andere Geräte ihn nicht erreichen, Node.js für das private Netzwerk in der Firewall zulassen und prüfen, dass das WLAN keine Geräteisolation verwendet. Die IP-Adresse kann sich beim Netzwerkwechsel ändern.

## Eigene Spiele

| Spiel | Alleine / gleiches Gerät | Getrennte Geräte |
| --- | --- | --- |
| Tic-Tac-Toe | Computer oder zu zweit | 2 |
| Vier gewinnt | Computer oder zu zweit | 2 |
| Mühle | Computer oder zu zweit | 2 |
| Klassisches Laufspiel | 2–4 Plätze, bis zu 3 Bots | 2–4 |
| Crazy Eights / Mau-Mau | Computer oder Kartenübergabe | 2 |
| Memory | 4–24 Paare, 1–6 Plätze mit Bots | 2–6 |
| Würfelbecher | Freie Wertung | 2–6 |
| Zeichenatelier | Zeichnen und PNG-Export | 2–8, gemeinsame Leinwand |
| Klanglabor | Acht synthetisierte Töne | 2–8, geteilte Tonereignisse |
| Schach | 2 Plätze, 3 Bot-Stärken, alle Sonderzüge | 2 |
| Rommé | 2–6 Plätze, bis zu 5 Bots, Hausregeln ohne Joker | — |
| Stadt & Straßen | 2–6 Plätze, bis zu 5 Bots, eigene Grundstücksspiel-Variante | — |
| 2048 | Spielstand, Rekord, Rückgängig | — |
| Minesweeper | Sicherer erster Klick, Flaggenmodus | — |

Die Handbücher beschreiben die tatsächlich implementierten Hausregeln. Würfelbecher verwendet freie Wertung; Klanglabor ist wegen der Netzwerklatenz kein synchroner Musiksequenzer.

Skat und die aufgeführten kommerziellen Spiele sind über die jeweiligen Anbieter erreichbar. Rommé und Schach haben jetzt eigene spielbare Umsetzungen; zusätzlich bleiben externe Alternativen verlinkt. Anbieter regeln ihre eigenen Konten, Preise und Mehrspieler-Räume. Hidden Folks ist eine Anbieterinformation ohne zugesicherte Web-Demo; Card Hunter setzt keine historische Browser-Version voraus.

## Oberfläche

Illustrierte Kategorie- und Spielkacheln, Suche, Modi-Filter, Favoriten, Zufallsauswahl und Spieleabend-Planer. Jeder der 51 Einträge besitzt einen **Handbuch**-Tab. Eigene Spiele zeigen ihre Regeln auch während des Spiels. **Einstellungen** enthält sechs Designs (Wald hell/dunkel, Ozean, Lavendel, Sonnenuntergang, Mitternacht) plus Systemwahl, Bot-Stärke (Leicht/Mittel/Schwer), Vorgaben für Menschen und Bots, Memory-Paarzahl, Lautstärke, Ton, reduzierte Bewegung, größere Bedienelemente, Anzeigename, externe Links und die Mehrspieler-Serveradresse.

## Online selbst hosten

Den gleichen Node-Server auf einem öffentlich erreichbaren Rechner hinter einem HTTPS-Reverse-Proxy bereitstellen; dessen Ziel ist Port 5173. Ein einzelner Serverprozess hält alle Räume im Arbeitsspeicher. Mehrere unabhängige Prozesse benötigen eine zusätzliche gemeinsame Raumverwaltung.

Mit Docker:

```sh
docker build -t spielraum .
docker run --rm -p 5173:5173 spielraum
```

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| HOST | 0.0.0.0 | Netzwerk-Schnittstelle |
| PORT | 5173 | HTTP-Port |
| ALLOWED_ORIGINS | leer | Zusätzliche erlaubte Frontend-Ursprünge, durch Kommas getrennt |

Bei getrenntem Hosting in den Einstellungen die öffentliche **HTTPS**-Adresse des Servers eintragen und deren Frontend-Ursprung in ALLOWED_ORIGINS erlauben. Beispiel: `ALLOWED_ORIGINS=https://spielraum-webgames.lord-time.chatgpt.site`. Eine HTTPS-Seite kann keinen HTTP-LAN-Server verbinden; im LAN deshalb die lokale Serveradresse direkt öffnen.

Die Sites-Veröffentlichung enthält die statische Oberfläche. Der Node-Mehrspielerserver wird dort nicht mitgehostet. Ein öffentlicher Internet-Server ist in diesem Projekt nicht automatisch bereitgestellt.

## Daten und Räume

Keine Konten oder Datenbank. Räume verfallen nach zwei Stunden ohne Zugriff und gehen beim Serverneustart verloren. Einstellungen, Favoriten, 2048 und die Spieleabend-Auswahl liegen lokal im Browser. Raumzugangstoken liegen im sessionStorage des jeweiligen Tabs; der Raumcode allein gewährt keine Kontrolle über einen belegten Platz. Der Gastgeber kann Plätze im Wartebereich freigeben. Eigene Kartenhände werden nur an ihren jeweiligen Sitz gesendet; verdeckte Karten und Memory-Felder bleiben serverseitig verborgen.

Der Server prüft Spielzüge, Sitzrechte, Reihenfolge und Spielstandversionen. Eingabegrößen und Anfrageraten sind begrenzt. Er ist für kleine private Spielrunden gedacht; öffentlicher Betrieb benötigt HTTPS und eine passende Serverumgebung. Zwei Google Fonts werden extern geladen, Systemschriften dienen als Fallback.

## Prüfung

```sh
npm test
```

Prüfungen umfassen Spielregeln, Gewinnbedingungen, verdeckte Informationen, Zugrechte, Konflikte bei gleichzeitigen Spielzügen, Raumabläufe mit getrennten HTTP-Clients, Handbuch-Vollständigkeit und Kategorie-Bilder. GitHub Actions führt dieselben Tests aus. Browser-Stichproben prüfen Tabs, Einstellungen und die Raumoberfläche. Externe Anbieterpartien werden nicht getestet.

## Lizenz

Siehe LICENSE und THIRD_PARTY_NOTICES.md. Die MIT-Lizenz gilt für die eigene Sammlung und ihre Implementierungen. Sie erteilt keine Rechte an Marken, Bildern oder Software der verlinkten Drittanbieter.

## Bots und neue Hausregeln

Vorgaben unter **Einstellungen → Spiele & Bots** setzen. Memory, Laufspiel, Rommé, Schach und Stadt & Straßen haben außerdem eine eigene Platz- und Stärkeauswahl im Spiel. Änderungen dort starten eine neue Runde. Rommé, Memory und Stadt & Straßen erlauben bis zu sechs Plätze (maximal fünf Bots bei einer Person); Laufspiel vier Plätze (maximal drei Bots); Schach und die anderen Duelle zwei Plätze. Bots laufen lokal im Browser. Netzwerk-Räume werden von Menschen besetzt.

Memory-Bots merken sich ausschließlich aufgedeckte Karten. Schach-Bots verwenden Zufall, Materialbewertung oder begrenzte Suche über drei Halbzüge; sie sind keine Meisterschach-Engine. Rommé spielt mit 104 Karten ohne Joker und mindestens 30 Punkten bei der ersten Auslage. Stadt & Straßen nutzt 20 Felder, Kauf, Miete, Farbgruppen, bis zu drei Häuser, automatische Liquidation und ein 200-Züge-Limit; Auktionen, Hypotheken und Handel sind nicht enthalten. Details stehen in jedem Handbuch.

Die enthaltene Schach-Regelbibliothek chess.js 1.4.0 steht unter BSD-2-Clause; siehe THIRD_PARTY_NOTICES.md und dist/vendor/chess-LICENSE.txt.
