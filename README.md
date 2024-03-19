# Stopweb (CLI)

## Variabili d'ambiente
Il progetto utilizza le seguenti variabili d'ambiente:

| Nome                          | Descrizione                         | Valore Default                                 |
| ----------------------------- | ------------------------------------| -----------------------------------------------|
| STOPWEB_PROFILI_BASEDIR_PATH  | Il path dei profili                 | ~/.stopweb/profili                             |


## Pre-requisiti
- Installa [Node.js](https://nodejs.org/en/) versione v18.19.1

## Per iniziare
- Clona il repository
```
git clone https://github.com/diego-devita/stopweb.git
```
- Installa le dipendenze
```
cd <stopweb directory>
sudo npm install
```
- Crea il symlink *stopweb* allo script entry point (./src/cli.js)
```
sudo npm link
```

- Installare Chromium (verrà usato con Playwright alla login)

per maggiori dettagli: https://playwright.dev/docs/browsers

```
sudo npx playwright install chromium

#oppure per forzare le dipendenze
sudo npx playwright install --with-deps chromium
```

## Creare la configurazione profilo

- Inizializzare la configurazione del profilo corrente
```
stopweb profilo --init
```
- Impostare le api url usando il proprio sito aziendale
```
stopweb profilo --seturls <nomesito>
```
- Consultare le condizioni di utilizzo
```
stopweb condizioni
```
- Accettare le condizioni di utilizzo
```
stopweb condizioni --accetta
```
## License and Attributions

The license for this project can be found in the [LICENSE](./LICENSE.txt) file.
Attributions for third-party components used by this project are located in [legal/ATTRIBUTIONS.md](./legal/ATTRIBUTIONS.md).