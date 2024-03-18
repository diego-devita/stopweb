import configurationSingleton from '../commons/config.js'
import eventEmitterSingleton from '../commons/eventEmitter.js';

import chalk from 'chalk';
import { formatTimestamp, getTodayDateAsYYYYMMDD } from '../commons/date.js';

import { fetchGiornate } from './commandFetch.js';
import { fetchRubrica } from '../presenze/rubrica.js';

import readline from 'readline';
import fs from 'fs';

const config = configurationSingleton.getInstance();

let websocket;

const style = {};

style.success = chalk.green.bold;
style.danger = chalk.red.bold;

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
style.white = chalk.whiteBright;

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

export async function listen({
    //default 10 min
    delayInSeconds = 600,
    //random range default tra -3m e +6m
    randomOffsetRange = [-180, 360],
} = {}){

    function getRandomOffset(min, max) {
        return Math.random() * (max - min) + min;
    }

    //console.log('-'.repeat(45));
    console.log(style.white('-'.repeat(78)));
    console.log(style.stress(` [stopweb v.`) + style.dim(config.version) + style.stress(']') + style.dim(' - Ascolto degli eventi'));
    console.log(style.white('-'.repeat(78)));
    console.log(style.dim(` delaySeconds: ${delayInSeconds}`));
    console.log(style.dim(` randomOffsetRange: ${randomOffsetRange}`));
    console.log(style.white('-'.repeat(78))+'\n');

    let interrogazioni = 0;
    let fallimenti = 0;
    let prevEventiCount = 0;

    while (true) {

        let noerror = true;
        let newlines = 0;
        try{
            //qui alla fine dei giochi sono 2 linee con a capo
            //ma se va storto subito a rubrica, c'è una linea sola senza a capo
            //e se va storto dopo a timbrature, ci sono 2 linee senza a capo
            await aggiornaStato();
            newlines = 2;
        }
        catch(e){
            //modo buzzurro di capire se si è fermato al primo o al secondo step
            if(e.message === 'Rubrica'){
            }else{
                newlines = 1;
            }
            noerror = false;
            //se è scaduta la login, l'aggiornamento dello stato può accusare
        }

        let eventi = [];
        //se non ci sono stati errori
        if(noerror){
            interrogazioni += 1;
            //questa viene dopo l'a capo che segue un aggiornaStato senza errori
            console.log(style.success(` Lo stato è stato aggiornato!`));
            newlines += 1;
            //vengono letti gli eventi dallo stato
            eventi = config.readEventi();
        }
        //altrimenti
        else{
            //gli eventi non vengono letti
            //a questo punto emerge la necessità di avere eventi nel dominio listen!
            fallimenti += 1;
            //qui sta continuando la riga iniziata da "interrogando blabla..." dopo cui andrà a capo
            console.log(style.danger(` Login scaduta!`));
            newlines += 1;
            console.log(style.danger(` Risolvere il problema prima dello scadere del countdown!`));
            newlines += 1;
        }

        function getRandomOffset(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        //applica strategie di camuffamento per il gusto di
        const offsetInSeconds = getRandomOffset(...randomOffsetRange);
        let nextDelayInSeconds = delayInSeconds + offsetInSeconds;
        //30 sec minimo di sicurezza
        nextDelayInSeconds = Math.max(30, nextDelayInSeconds);

        //ma verifica prima che l'ora attuale non ricada nella finestra di timeout (19pm-7am)
        //questa cosa sarebbe da parametrizzare in config
        const { rientra, ore, minuti } = calcolaTempoMancante(14, 7);
        //se si,
        if(rientra){
            //ricalcola il prossimo delay = al tempo mancante fino alla fine del timeout
            nextDelayInSeconds = (ore*60*60) + (minuti*60) + 60;
            console.log(style.danger(` ATTENZIONE! FINESTRA PAUSA RAGGIUNTA. La pausa sarà terminata alle 7am.`));
            newlines += 1;
        }

        //aspetta col countdown
        await countdown(nextDelayInSeconds, interrogazioni, fallimenti, eventi, prevEventiCount);

        //sposta il cursore in alto un numero di newlines
        process.stdout.write("\x1b[1A\x1b[2K".repeat(newlines));

        prevEventiCount = eventi.length;
    }

}

async function aggiornaStato(){

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
            giornata.aspettativa?.uscita?.hhmm + ' [' + giornata.timbrature.map( t => t.versoU1 + t.hhmm).join(' ') + ']';
        config.updateStatoEventiTimbrature({ giorno: today, timbrature });
    }

    //recupera le voci rubrica dei preferiti
    //e le processa per aggiornare lo stato interno che ne scova le differenze e farà scatenare eventuali eventi
    process.stdout.write(` Sto interrogando la rubrica preferiti...`);
    let rubrica;
    try{
        rubrica = await fetchRubrica({ cookieHeader: config.cookieHeader, idDipendente: -2 });
    }
    catch(e){
        //qui avrei fatto meglio a puntare su MissingLogin
        throw new Error('Rubrica');
    }
    rubrica.forEach(dipendenteRubrica => processRubricaDataForEvents(dipendenteRubrica));
    process.stdout.write(style.true(`OK`));
    console.log();

    //come sopra per recuperare la giornata di oggi e scovare eventuali differenze
    process.stdout.write(` Sto interrogando le timbrature...`);
    const today = getTodayDateAsYYYYMMDD();

    let giornate;
    try{
        giornate = await fetchGiornate({ dataInizio: today, dataFine: today, noCache: true, fetchTodayAlways: true });
    }
    catch(e){
        //qui avrei fatto meglio a puntare su MissingLogin
        throw new Error('Giornate');
    }
    processGiornataDataForEvents(today, giornate);
    process.stdout.write(style.true(`OK`));
    console.log();

    //salva lo stato solo se hanno finito entrambi i giri (rubrica e giornate)
    config.saveStatoEventi();
}

async function countdown(delayInSeconds, interrogazioni, failures, eventi, prevEventiCount) {

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

        //se esiste il file che ordina il force update
        const forceupdate = config.getFile('eventi', 'forceupdate');
        if (fs.existsSync(forceupdate)) {
            fs.unlinkSync(forceupdate);
            isRunning = false;
        }

        if (i < delayInSeconds) {
            process.stdout.write("\x1b[1A\x1b[2K".repeat(3));
        }

        let diffEventiLabel = '';
        if(interrogazioni > 1)
            diffEventiLabel = ` (+${(eventi.length - prevEventiCount)})`;

        console.log(` Tentativi svolti: ${style.stress(interrogazioni)} - Fallimenti: ${style.stress(failures)} - Eventi in coda: ${style.stress(eventi.length)}${diffEventiLabel}`);
        console.log(` Prossimo tentativo: ${style.stress(i)} second(i) rimasti`);
        console.log(style.dim(` (Premere un tasto per saltare l'attesa o CTRL-C per interrompere)`));

        //Attende 1 secondo
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    //resetta la linea alla fine dei giochi di rewrite
    process.stdout.write("\x1b[1A\x1b[2K".repeat(3));

    process.stdin.setRawMode(false); // Disattiva la modalità raw quando hai finito
}

//oraFine (es.: 7 .. sarebbero le 7 di mattina, quando finisce la pausa polling)
//oraInizio (es.: 19 .. sarebbero le 19 di pome, quando inizia la pausa polling)
function calcolaTempoMancante(oraInizio, oraFine) {

    const oraAttuale = new Date();
    const oraDiFine = new Date(
      oraAttuale.getFullYear(),
      oraAttuale.getMonth(),
      oraAttuale.getDate(),
      oraFine, 0, 0, 0
    );

    // Se l'ora attuale è dopo le 19:00, impostiamo l'ora di fine al giorno successivo
    if (oraAttuale.getHours() >= oraInizio) {
      oraDiFine.setDate(oraDiFine.getDate() + 1);
    } else if (oraAttuale.getHours() < 7) {
      // L'ora di fine è già impostata correttamente per oggi
    } else {
      // Non siamo nell'intervallo richiesto
      return { rientra: false, ore: 0, minuti: 0 };
    }

    // Calcola il tempo mancante in millisecondi
    const tempoMancante = oraDiFine - oraAttuale;

    // Converti in ore e minuti
    const ore = Math.floor(tempoMancante / (1000 * 60 * 60));
    const minuti = Math.floor((tempoMancante % (1000 * 60 * 60)) / (1000 * 60));

    return { rientra: true, ore, minuti };
  }


