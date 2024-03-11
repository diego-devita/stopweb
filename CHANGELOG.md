# Changelog

Tutte le modifiche significative a questo progetto verranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), e questo progetto aderisce a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

