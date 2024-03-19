# Changelog

Tutte le modifiche significative a questo progetto verranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), e questo progetto aderisce a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-03-19

### Added
- config supporta gli eventi che occupano un nuovo spazio in userdata
- creato nuovo comando `eventi` con varie opzioni
- `eventi` - opzione `--listen`: interroga presenze per aggiornare lo stato e scatenare gli eventi
- `eventi` - opzione `--api`: usato insieme a `--listen`, espone le api web
- `eventi` - opzione `--ws`: usato insieme a `--listen`, espone un web socket con gli eventi in tempo reale
- `eventi` - opzione `--apionly`: espone solo le api web senza mai riaggiornare lo stato eventi
- `eventi` - (senza opzione): mostra gli eventi nella coda degli eventi
- `eventi` opzione `--storicizza`, svuota la code eventi e la calendarizza
- `eventi` opzione `--storia`, interroga la storia degli eventi
- `rubrica` - opzione `--noindent`: da usare insieme a `--gruppo`
- `rubrica` - aggiunto somma di filtri multipli e nuove opzioni `--tel` `--nominativo`
- In generale - nuova opzione `--mock` per registrare e riprodurre chiamate api
- Per il supporto a ssl (per le api e il ws) è necessario avere i file pem in `./config`

## [1.2.0] - 2024-03-12

### Changed
- Comando Rubrica - La modalità `print` di default è diventata `short3` invece di `short2`

### Added
- Comando Rubrica - Aggiunta opzione `--sortby` `(nome|cognome|id|stato|descrizione)` valida anche per i gruppi
- Comando Rubrica - Aggiunto valore `short3` all'opzione `--print` che garantisce migliore leggibilità

## [1.1.0] - 2024-03-11

### Changed
- Comando Fetch - Le opzioni `--dataInizio` e `--dataFine` supportano anche il formato `DD-MM-YYYY`

### Added
- Comando Fetch - Aggiunta opzione `--data` che applica il filtro alla data specificata `(YYYYMMDD|DD-MM-YYYY)`

### Fixed
- In caso di errore di validazione sulle date, l'eccezione è gestita in senso ampio con il classico errore generico (graceful).

## [1.0.1] - 2024-03-11

### Added
- Comando Preferiti - Aggiunta opzione `--orari` che mostra il dump (tabellare) delle voci orari disponibili.
- Comando Preferiti - L'opzione `--orari` aggiunta, se usata con `--json`, restituisce il json originale dal fetch.

## [1.0.0] - 2024-03-10

### Added
- Lancio iniziale del software con tutte le funzionalità di base implementate.

