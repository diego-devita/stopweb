#!/usr/bin/env node

import { parseCommandLineArgs, validateArgs } from './parseCommandLineArgs.js';

import { commandHelp, commandVersione, commandGuida } from './commandHelp.js';
import {
    commandShowInfo,
    commandShowYamlProblems,
    commandInitConfig,
    commandCambiaProfilo,
    commandCreaProfilo,
    commandSetUrls,
    commandCheckUrls,
    commandListaProfili
} from './commandShowInfo.js';
import { commandClear } from './commandClear.js';
import { commandLogin } from './commandLogin.js';
import { commandFetch, commandFetchOriginalJson} from './commandFetch.js';
import { commandElenco } from './commandElenco.js';
import { commandRubrica } from './commandRubrica.js';
import { commandInit, commandManifesto } from './commandInit.js';

import {
    commandGetPreferitiDipendenti,
    commandAddPreferitiDipendenti,
    commandRemovePreferitiDipendenti,
    commandGetOrari
} from './commandPreferiti.js';

import { valutaDate } from '../commons/date.js';

import readlineSync from 'readline-sync';
import chalk from 'chalk';

import configurationSingleton from '../commons/config.js'
import { MissingLoginError, ExpiredLoginError } from '../commons/errors.js';

const config = configurationSingleton.getInstance();

//a memento: mando a capo perché l'errore si può sollevare in un momento in cui il cursore era a metà linea (vedi login che scrive in before e after)
const errorMessage = '\nSi è verificato un errore.\nConsultare il log degli errori per maggiori dettagli.';

let args;

try{
    args = parseCommandLineArgs();
    validateArgs(args.command, args.options)
}catch(e){
    console.log(e.message); //non è console.error perché quello è riservato agli errori non gestiti (e loggati)
    process.exit();
}

if (args.options.nocolor)
    chalk.level = 0;

console.time('Tempo speso');

if(
    !config.isTosAccepted()
    && !['help', '', undefined, 'profilo', 'maniavanti', 'manifesto', 'condizioni', 'eula'].includes(args.command)
){
    console.log(`È possibile disporre solo dei comandi: ${chalk.dim('help')}, ${chalk.dim('profilo')} e ${chalk.dim('condizioni')};\nfinchè non siano state accettate le condizioni di utilizzo.`);
    process.exit();
}

switch (args.command) {
    case undefined:
    case "":
    case 'help':
        if(args.options.guida === true)
            commandGuida();
        else if(args.options.versione === true){
            commandVersione();
        }else{
            if(!config.isTosAccepted()){
                commandGuida();
                console.log('\n');
            }else{
                const showSintesi = !(args.options.dettagli);
                const comando = (args.options.dettagli && args.options.dettagli.length > 0) ? args.options.dettagli : undefined;
                const asgrid = (args.options.asgrid === true);
                await commandHelp({ showSintesi, comando, grid: asgrid });
            }
        }
        process.exit();
        break;
    case 'guida':
        commandGuida();
        process.exit();
        break;
    case 'clear':
        try{
            commandClear(args.options);
        }
        catch(e){
            handleError(e);
        }
        process.exit();
        break;
    case 'login':

        const loginUrl = config.get('login.url');

        if(!loginUrl){
            console.log('Per effettuare la login è prima necessario aggiungere l\'url alla configurazione.');
        }
        else{
            //l'espressione in () è vera solo se strettamente uguale false, altrimenti true
            const headless = !(config.get('login.headless') === false || args.options.noheadless === true);
            const landingPage = config.get('login.landingPage');
            const timeoutSeconds = config.get('login.timeoutSeconds');

            let username = config.get('login.username');
            let password = config.get('login.password');

            if(!username){
                username = readlineSync.question('Inserisci la username (es.: utente@host.it): ');
                if(!password)
                    password = readlineSync.question('Inserisci la password: ', { hideEchoBack: true });
            }
            try{
                await commandLogin({
                    headless: headless,
                    url: loginUrl,
                    username: username,
                    password: password,
                    expectedLandingPage: landingPage,
                    timeoutSeconds
                });
            }
            catch(e){
                if(e?.details == 'login'){
                    //sono le eccezioni sollevate da login.js subito dopo aver emesso l'evento corrispondente e ascoltato da commandLogin
                    //il quale ha già risposto sulla console nel merito.. qui mi limito a dire che la login si conclude
                }
                else
                    handleError(e);
            }
        }

        process.exit();
        break;
    case 'fetch':

        //se l'intervallo data non è stato specificato, per default è oggi
        const dateIntervallo = valutaDate(args.options);

        const fetchOptions = {};
        fetchOptions.excludeTodayFromSurplus = !(args.options.includiOggiInTotali === true);
        fetchOptions.fetchTodayAlways = !(args.options.oggiNoRefetch === true);
        fetchOptions.onlyCache = (args.options.cacheonly === true);
        fetchOptions.colTimbratureSize = args.options.colTimbratureSize;
        fetchOptions.showCacheStatus = (args.options.showCacheStatus === true);
        fetchOptions.fillGaps = (args.options.fillGaps === true);

        try{
            if(args.options.json == true || args.options.json == 'originale' || args.options.json == 'o' ){
                await commandFetchOriginalJson(dateIntervallo);
            }
            else{
                if(args.options.json == 'trasformato' || args.options.json == 't'){
                    await commandFetch({ ...dateIntervallo, asJson: true, ...fetchOptions });
                }
                else{
                    if(args.options.nocache)
                        await commandFetch({ ...dateIntervallo, noCache: true, ...fetchOptions });
                    else
                        await commandFetch({ ...dateIntervallo, ...fetchOptions });
                }
            }
        }
        catch(e){
            handleError(e);
        }

        if(args.options.dump === true){
            //console.log( JSON.stringify(config.globalDump.vociElaborate, null, 2) );
            console.log('\nSEGUE IL DUMP...\n');
            console.log( config.getDumps({styleComment: chalk.green, styleStressed: chalk.yellow}).join('\n') );
        }

        process.exit();
        break;
    case 'profilo':
        const dettagli = (args.options.dettagli === true);
        if(args.options.yaml)
            await commandShowYamlProblems();
        else if(args.options.init)
            await commandInitConfig();
        else if(args.options.cambia)
            await commandCambiaProfilo(args.options.cambia);
            else if(args.options.crea)
            await commandCreaProfilo(args.options.crea);
        else if(args.options.seturls)
            await commandSetUrls(args.options.seturls);
        else if(args.options.checkurls)
            await commandCheckUrls();
        else if(args.options.lista)
            await commandListaProfili();
        else
            await commandShowInfo(dettagli);
        process.exit();
        break;
    case 'elenco':
        const useCache = (args.options.cache === true);
        const showElencoTotal = !(args.options.notot === true);
        const sortBy = (!args.options.sortby) ? 'id' : args.options.sortby;

        const asTransformedJson =  (args.options.json === 'trasformato' || args.options.json === 't');
        const asOriginalJson =  (args.options.json === 'originale' || args.options.json === 'o' || args.options.json === true);

        try{
            await commandElenco({ useCache, showTotal: showElencoTotal, sortBy, asTransformedJson, asOriginalJson });
        }
        catch(e){
            handleError(e);
        }
        process.exit();
        break;
    case 'preferiti':

        const showPreferitiTotal = !(args.options.notot === true);
        const json = (args.options.json === true);

        let list = (args.options.list === true);
        let add = (args.options.add?.length > 0);
        let remove = (args.options.remove?.length > 0);

        if(args.options.orari === true){
            if(args.options.json === true)
                await commandGetOrari({ asJson: true });
            else
                await commandGetOrari();
            process.exit();
        }

        if(list === false && add === false && remove === false)
            list = true;

        try{
            //se --list esiste (ha la priorità)
            if(list)
                await commandGetPreferitiDipendenti({ showTotal: showPreferitiTotal, asJson: json });
            else{
                //altrimenti se add esiste (ha la priorita)
                if(args.options.add?.length > 0){
                    if (/^[0-9]+$/.test(args.options.add)){
                        await commandAddPreferitiDipendenti({ id: parseInt(args.options.add) });
                    }
                    else{
                        await commandAddPreferitiDipendenti({ query: args.options.add });
                    }
                }
                //altrimenti è remove
                else{
                    await commandRemovePreferitiDipendenti({ id: parseInt(args.options.remove) });
                }
            }
        }
        catch(e){
            handleError(e);
        }
        process.exit();
    case 'rubrica':
        const showRubricaTotal = !(args.options.notot === true);
        try{
            let idsRequested;
            if(args.options.tutti === true)
                idsRequested = '-1';
            else if(args.options.preferiti === true)
                idsRequested = '-2';
            else if(args.options.id)
                idsRequested = args.options.id;
            else if(args.options.ids)
                idsRequested = args.options.ids;
            else
                idsRequested = '-2';

            let group;
            let errorFlag = false;

            if(args.options.gruppo){
                const gruppiRubrica = config.get('rubrica.gruppi');
                if(args.options.gruppo in gruppiRubrica)
                    group = gruppiRubrica[args.options.gruppo];
                else{
                    errorFlag = true;
                    console.log(`Il gruppo rubrica ${args.options.gruppo} non esiste nella configurazione.`);
                }
            }

            let filter = undefined;
            if(args.options.presenti){
                switch(args.options.presenti){
                    case 'adesso':
                    case 'now':
                        filter = 'presentiAdesso';
                        break;
                    case 'oggi':
                        filter = 'presentiOggi';
                        break;
                    case 'domani':
                        filter = 'presentiDomani';
                        break;
                    default:
                        filter = 'presentiAdesso';
                }
            }

            if(!errorFlag)
                await commandRubrica({
                    idsRequested: idsRequested,
                    delayms: args.options?.delayms,
                    printMode: args.options?.print,
                    showTotal: showRubricaTotal,
                    group,
                    filter
                });

            //mostra il tempo speso solo se l'opzione print non è 'json' e se non è stata usata l'opzione noTimeSpent
            if(args.options?.print !== 'json' && args.options.noTimeSpent !== true){
                console.log('');
                console.timeEnd('Tempo speso');
            }
        }
        catch(e){
            handleError(e);
        }
        process.exit();
        break;
    case 'manifesto':
    case 'maniavanti':
    case 'condizioni':
    case 'eula':
        if(args.options.stacce === true || args.options.accetta === true){
            await commandInit();
        }else{
            commandManifesto();
        }
        break;
    default:
        console.log("Comando non riconosciuto:", args.command);
}

function handleError(error){
    if (error instanceof MissingLoginError
        || error instanceof ExpiredLoginError) {
        console.log(error.message);
    }else{
        config.appendToErrors('cli', error);
        console.error(errorMessage);
    }
    //in sviluppo scommentare la prossima riga per vedere gli errori a schermo
    //throw error;
}