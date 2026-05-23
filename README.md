# FootballÍQ

App statica in italiano per seguire i Mondiali 2026.

## Contenuti

- Calendario completo delle 104 partite con filtri per fase, girone e squadra.
- Gironi A-L con classifica prevista tramite modello interno.
- Schede squadra con ranking FIFA, confederazione, titoli e indicatori modello.
- AnalisiIQ suggerite per le 72 partite della fase a gironi.

## File principali

- `index.html`: struttura dell'app.
- `styles.css`: interfaccia e responsive layout.
- `data.js`: squadre, calendario, fonti.
- `app.js`: filtri, proiezioni gironi e algoritmo AnalisiIQ.

## Fonti iniziali

- FIFA match schedule 2026
- FIFA/Coca-Cola Men's World Ranking, aggiornamento 1 aprile 2026
- DIRECTV schedule per orari ET e stadi
- ESPN ranking FIFA top 50 del 1 aprile 2026

## Note sul modello

AnalisiIQ e' un indice suggerito, non una quota bookmaker. Usa ranking FIFA, forma stimata,
attacco/difesa derivati dal ranking, titoli mondiali e vantaggio casa per Canada, Messico e Stati Uniti.
