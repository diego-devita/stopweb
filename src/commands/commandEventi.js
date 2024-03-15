import configurationSingleton from '../commons/config.js'
import chalk from 'chalk';
import { formatTimestamp, getTodayDateAsYYYYMMDD } from '../commons/date.js';

import { fetchGiornate } from './commandFetch.js';
import { fetchRubrica } from '../presenze/rubrica.js';

import readline from 'readline';

import express from 'express';
import { commandFetchOriginalJson } from './commandFetch.js';

const config = configurationSingleton.getInstance();

const style = {};

style.success = chalk.green.bold;

style.oggi = chalk.blueBright;
style.domani = chalk.blueBright;
style.true = chalk.green.bold;
style.false = chalk.red.bold;
style.null = chalk.magenta;
style.freccia = chalk.blueBright;
style.chiave = chalk.yellow;
style.colon = chalk.dim;
style.separator = chalk.dim;

style.eventName = chalk.blueBright;
style.timestamp = chalk.yellow;
style.nominativo = chalk.dim;

style.presente = chalk.greenBright.bold;
style.assente = chalk.redBright.bold;

style.dim = chalk.dim;
style.stress = chalk.yellow;

function printEventi(eventi){

    eventi.forEach(evento => {

        const payload = evento.payload;

        const timestamp = new Date(evento.timestamp);
        const timestampFormatted = formatTimestamp(timestamp);
        const eventName = style.eventName(evento.evento.padEnd(40, '-'));

        const header = `${style.timestamp(timestampFormatted)} ${eventName}`;
        let id, nominativo;
        if(evento.evento.startsWith('Pref_')){
            id = payload.idDipendente.toString().padEnd(4,' ');
            nominativo = style.nominativo (payload.nominativo.padEnd(30, '-'));
        }

        function formatStatoPresenza(stato){
            return (stato == 'P') ? style.presente.bold(stato) : style.assente.bold(stato);
        }

        function formatGiust(g){
            if(g=='NULL')
                return style.null('    ' + g + '   ');
            function parseString(input) {
                const parts = input.split(';');
                let result = [];
                parts.forEach(part => {
                    if(part) {
                        const [key, value] = part.split(':');
                        result.push({key, value});
                    }
                });
                return result;
            }
            const p = parseString(g);
            let styled = [];
            p.forEach(part =>
                styled.push(
                    style.chiave(part.key)
                    /*+ ':'*/
                    + ( (part.value == '1') ? style.true(part.value) : style.false(part.value) )
                    /*+ style.separator('/')*/
                )
            );
            return styled.join(style.separator('|'));
        }

        switch(evento.evento){
            case 'Timbr_NuovoGiorno':
                console.log(`${header} ${payload.giorno} ${payload.timbrature}`);
                break;
            case 'Timbr_Cambio':
                console.log(`${header} ${payload.giorno} ${payload.dopo}`);
                break;
            case 'Pref_Nuovo':
            case 'Pref_Reset':
                const macrostato = formatStatoPresenza(payload.macrostato);
                console.log(`${header} ${id} ${nominativo} ${macrostato} ${style.oggi('OGG')}${style.colon(':')}${formatGiust(payload.oggi)} ${style.domani('DOM')}${style.colon(':')}${formatGiust(payload.domani)}`);
                break;
            case 'Pref_CambioStato':
                const statoPrecedente = formatStatoPresenza(payload.precedente);
                const statoAttuale = formatStatoPresenza(payload.attuale);
                console.log(`${header} ${id} ${nominativo} ${statoPrecedente} => ${statoAttuale}`);
                break;
            case 'Pref_CambioGiust_Oggi-DomaniDiIeri':
            case 'Pref_CambioGiust_Oggi-OggiDiOggi':
            case 'Pref_CambioGiust_Domani-DomaniDiOggi':
                console.log(`${header} ${id} ${nominativo} ${formatGiust(payload.precedente)} => ${formatGiust(payload.attuale)}`);
                break;
            default:
        }
    });

}

export function printCodaEventi(){
    const eventi = config.readEventi();
    printEventi(eventi);
}

export function printStoriaEventiDelGiorno(YYYYMMDD){
    const eventiByDipendente = config.readStoriaEventiDelGiorno(YYYYMMDD);
    Object.keys(eventiByDipendente)
        .forEach(idDipendente => {
            console.log('-'.repeat(130));
            printEventi(eventiByDipendente[idDipendente]);
        })
}

export function storicizzaCodaEventi(){
    const eventi = config.readEventi();
    const eventiByDay = config.storicizza(eventi);
    Object.keys(eventiByDay)
        .forEach(day => {
            const storiaEventiDelGiorno = eventiByDay[day];
            const YYYYMMDD = day.replace(/-/g, '');
            config.appendToStoriaEventiDelGiorno(YYYYMMDD, storiaEventiDelGiorno)
        });
    //svuota lista eventi
}

export function startApiServer({ port = 3000 }={}){

    const idDipendente = config.getIdDipendente();
    const cookieHeader = config.getCookieHeader();

    const app = express();
    app.use(express.json());

    app.get('/api/timbrature/:dataInizio/:dataFine', async (req, res) => {
        const { dataInizio, dataFine } = req.params;
        const json = await fetchGiornateCartellinoRAW(idDipendente, cookieHeader, dataInizio, dataFine);
        res.json( json );
    });

    app.get('/api/preferiti', async (req, res) => {
        const { dataInizio, dataFine } = req.params;
        const json = await fetchRubrica({ cookieHeader, idDipendente: -2 });
        res.json( json );
    });

    // Avvio del server
    app.listen(port, () => {});
}

export async function listen({
    //default 10 min
    delayInSeconds = 600,
    //random range default tra -3m e +6m
    randomOffsetRange = [-180, 360],
    serveApi = true,
    port = 3000
} = {}){

    const cookieHeader = config.getCookieHeader();

    if(serveApi)
        startApiServer();

    function processRubricaDataForEvents(dipendenteRubrica){
        config.updateStatoEventiPreferiti({
            idDipendente: dipendenteRubrica.id,
            nominativo: dipendenteRubrica.nominativo,
            macrostato: dipendenteRubrica.macrostato,
            oggi: dipendenteRubrica.oggi,
            domani: dipendenteRubrica.domani,
        });
    }

    function processGiornataDataForEvents(today, giornate){
        const giornata = giornate[today];
        const timbrature =
            giornata.aspettativa.uscita.hhmm + ' [' + giornata.timbrature.map( t => t.versoU1 + t.hhmm).join(' ') + ']';
        config.updateStatoEventiTimbrature({ giorno: today, timbrature });
    }

    function getRandomOffset(min, max) {
        return Math.random() * (max - min) + min;
    }

    //console.log('-'.repeat(45));
    console.log(style.dim('-'.repeat(78)));
    console.log(style.stress(` [stopweb v.`) + style.dim(config.version) + style.stress(']') + style.dim(' - Ascolto degli eventi'));
    console.log(style.dim('-'.repeat(78)));
    console.log(style.dim(` delaySeconds: ${delayInSeconds}`));
    console.log(style.dim(` randomOffsetRange: ${randomOffsetRange}`));
    console.log(style.dim('-'.repeat(78)));
    let labelServer = '';
    if(!serveApi)
        labelServer = style.false.dim(' [Api Server non attivo]');
    else
        labelServer = style.true.dim(` [Api Server attivo su: http://localhost:${port}]\n`) + ' /api/timbrature/dataInizioYYYYMMDD/dataFineYYYYMMDD\n /api/preferiti';
    console.log(labelServer);
    console.log(style.dim('-'.repeat(78))+'\n');

    let interrogazioni = 0;
    let prevEventiCount = 0;

    while (true) {

        //recupera le voci rubrica dei preferiti
        //e le processa per aggiornare lo stato interno che ne scova le differenze e farà scatenare eventuali eventi
        process.stdout.write(` Sto interrogando la rubrica preferiti...`);
        let rubrica = await fetchRubrica({ cookieHeader, idDipendente: -2 });
        rubrica.forEach(dipendenteRubrica => processRubricaDataForEvents(dipendenteRubrica));
        process.stdout.write(style.true(`OK`));
        console.log();

        //come sopra per recuperare la giornata di oggi e scovare eventuali differenze
        process.stdout.write(` Sto interrogando le timbrature...`);
        const today = getTodayDateAsYYYYMMDD();
        const giornate = await fetchGiornate({ dataInizio: today, dataFine: today, noCache: true, fetchTodayAlways: true });
        processGiornataDataForEvents(today, giornate);
        process.stdout.write(style.true(`OK`));
        console.log();

        //salva lo stato solo se hanno finito entrambi i giri (rubrica e giornate)
        config.saveStatoEventi();

        interrogazioni += 1;
        console.log(style.success(` Lo stato è stato aggiornato!`));

        const eventi = config.readEventi();

        async function countdown(delayInSeconds) {

            // Attiva la modalità raw per process.stdin
            readline.emitKeypressEvents(process.stdin);
            process.stdin.setRawMode(true);

            let isRunning = true;

            process.stdin.on('keypress', (str, key) => {
                // Esce dall'applicazione se viene premuto Ctrl+C
                if (key.ctrl && key.name === 'c') {
                    process.exit();
                }
                // altrimenti segnala isRunning false
                else {
                    isRunning = false;
                }
            });

            for (let i = delayInSeconds; i >= 0 && isRunning; i--) {

                if (i < delayInSeconds) {
                    process.stdout.write("\x1b[1A\x1b[2K");
                    process.stdout.write("\x1b[1A\x1b[2K");
                    process.stdout.write("\x1b[1A\x1b[2K");
                }

                let diffEventiLabel = '';
                if(interrogazioni > 1)
                    diffEventiLabel = ` (+${(eventi.length - prevEventiCount)})`;

                console.log(` Tentativi svolti: ${style.stress(interrogazioni)} - Eventi in coda: ${style.stress(eventi.length)}${diffEventiLabel}`);
                console.log(` Prossimo tentativo: ${style.stress(i)} second(i) rimasti`);
                console.log(style.dim(` (Premere un tasto per saltare l'attesa o CTRL-C per interrompere)`));

                //Attende 1 secondo
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            //resetta la linea alla fine dei giochi di rewrite
            process.stdout.write("\x1b[1A\x1b[2K");
            process.stdout.write("\x1b[1A\x1b[2K");
            process.stdout.write("\x1b[1A\x1b[2K");
            process.stdout.write("\x1b[1A\x1b[2K");
            process.stdout.write("\x1b[1A\x1b[2K");
            process.stdout.write("\x1b[1A\x1b[2K");

            process.stdin.setRawMode(false); // Disattiva la modalità raw quando hai finito
        }

        function getRandomOffset(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        //applica strategie di camuffamento per il gusto di
        const offsetInSeconds = getRandomOffset(...randomOffsetRange);
        let nextDelayInSeconds = delayInSeconds + offsetInSeconds;
        //30 sec minimo di sicurezza
        nextDelayInSeconds = Math.max(30, nextDelayInSeconds);

        //aspetta
        await countdown(nextDelayInSeconds);

        prevEventiCount = eventi.length;
    }

}