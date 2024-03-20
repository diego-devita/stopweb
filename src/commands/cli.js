#!/usr/bin/env node

import {
    parseCommandLineArgs,
    validateArgs
} from './parseCommandLineArgs.js';

import {
    commandHelp,
    commandVersione,
    commandGuida } from './commandHelp.js';

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

import {
    commandFetch,
    commandFetchOriginalJson
} from './commandFetch.js';

import {
    commandInit,
    commandManifesto
} from './commandInit.js';

import {
    commandGetPreferitiDipendenti,
    commandAddPreferitiDipendenti,
    commandRemovePreferitiDipendenti,
    commandGetOrari
} from './commandPreferiti.js';

import { commandClear } from './commandClear.js';
import { commandLogin } from './commandLogin.js';
import { commandElenco } from './commandElenco.js';
import { commandRubrica } from './commandRubrica.js';

import {
    printCodaEventi,
    storicizzaCodaEventi,
    printStoriaEventiDelGiorno,
    listen
} from './commandEventi.js';

import { valutaDate } from '../commons/date.js';
import { MissingLoginError, ExpiredLoginError } from '../commons/errors.js';

import readlineSync from 'readline-sync';
import chalk from 'chalk';

import configurationSingleton from '../commons/config.js'

import { startWebSocket, startApiServer } from './commandApi.js';

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

//temporaneamente aggiunta a tutti i comandi per fare prima (da rivedere.. intanto ha il default in config)
if(args.options.mock === true || args.options.mock === 'replay'){
    config.setExtra({mock: true, mockRecord: false})
}
else if(args.options.mock === 'record'){
    config.setExtra({mock: false, mockRecord: true})
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

        const fetchOptions = {};
        fetchOptions.excludeTodayFromSurplus = !(args.options.includiOggiInTotali === true);
        fetchOptions.fetchTodayAlways = !(args.options.oggiNoRefetch === true);
        fetchOptions.onlyCache = (args.options.cacheonly === true);
        fetchOptions.colTimbratureSize = args.options.colTimbratureSize;
        fetchOptions.showCacheStatus = (args.options.showCacheStatus === true);
        fetchOptions.fillGaps = (args.options.fillGaps === true);

        try{
            //se l'intervallo data non è stato specificato, per default è oggi
            const dateIntervallo = valutaDate(args.options);

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

        if(list === false && add === false && remove === false)
            list = true;

        try{

            if(args.options.orari === true){
                if(args.options.json === true)
                    await commandGetOrari({ asJson: true });
                else
                    await commandGetOrari();
                process.exit();
            }

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

            let filters = [];

            if(args.options.tel){
                filters.push('tel:' + args.options.tel);
            }

            if(args.options.nominativo){
                filters.push('nominativo:' + args.options.nominativo);
            }

            if(args.options.presenti){
                switch(args.options.presenti){
                    case 'adesso':
                    case 'now':
                        filters.push('presentiAdesso');
                        break;
                    case 'oggi':
                        filters.push('presentiOggi');
                        break;
                    case 'domani':
                        filters.push('presentiDomani');
                        break;
                    default:
                        filters.push('presentiAdesso');
                }
            }

            if(!errorFlag)
                await commandRubrica({
                    idsRequested: idsRequested,
                    delayms: args.options?.delayms,
                    printMode: args.options?.print,
                    showTotal: showRubricaTotal,
                    group,
                    filters,
                    sortBy: args.options.sortby,
                    noIndent:  (args.options.noindent === true)
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
    case 'eventi':

        async function lanciaServer({api = false, ws = false} = {}){

            const msgSuccess_auth = chalk.green(` ●  L'autenticazione è accesa rispetto alle API keys valide`);
            const msgFail_auth = chalk.red(` ●  L'autenticazione è spenta!\n`) + '    Verificare i file: ' + chalk.yellow('validapikeys') + ', ' + chalk.yellow('key.pem') + ' e ' + chalk.yellow('cert.pem') + ' su ' + chalk.yellow('<profilo>/config/');
            const msgSuccess2_auth = chalk.green(' ●  L\'autenticazione è accesa!\n') + '    Ma la login non è disponibile.. solo cookie preimpostati';

            if(!api && !ws)
                return;

            console.log('------------------------------------------------------------------------------');
            let esitoApi;
            if(api){
                if(api === true){
                    esitoApi = await lanciaApi(3000);
                }else{
                    const port = parseInt(args.options.api);
                    esitoApi = await lanciaApi(port);
                }
            }
            let esitoWS;
            if(ws){
                if(ws === true){
                    esitoWS = await lanciaWebSocket(3080);
                }else{
                    const port = parseInt(ws);
                    esitoWS = await lanciaWebSocket(port);
                }
            }

            const esito = (esitoApi) ? esitoApi : esitoWS;

            if (esito.auth && esito.https)
                if(!api)
                    console.log(msgSuccess2_auth)
                else
                    console.log(msgSuccess_auth);
            else
                console.log(msgFail_auth);
        }


        async function lanciaApi(port){
            try{
                const esito = await startApiServer({ port });
                return esito;
                //console.log(chalk.green(`api json attive - visitare http://localhost:${port}/stopweb/api/ per i dettagli`));
            }catch(e){
                process.exit(1);
                //console.log(chalk.red(`Il server web per le api json non è in piedi (errore sulla porta ${port})`));
            }
        }

        async function lanciaWebSocket(port){
            try{
                const esito = await startWebSocket({ port });
                return esito;
                //console.log(chalk.green(`websocket eventi attivo - aprire una connessione con ws://localhost:${port}/ per gli eventi`));
            }
            catch(e){
                process.exit(1);
                //console.log(chalk.red(`Il web socket non è in piedi (errore sulla porta ${port})`));
            }
        }

        if(args.options.storicizza){
            storicizzaCodaEventi();
        }
        else if(args.options.storia){
            const YYYYMMDD = args.options.storia;
            printStoriaEventiDelGiorno(YYYYMMDD);
        }
        else if(args.options.listen){
            //await listen({delayInSeconds: 10,randomOffsetRange: [0,0]});

            await lanciaServer({api: args.options.api, ws: args.options.ws});

            await listen({
                delayInSeconds: args.options.delay,
                randomOffsetRange: args.options.offset,
                /*serveApi: args.options.serveApi === true*/
            });

        }
        else if( args.options.apionly ){
            await lanciaServer({api: true, ws: false});
        }
        else{
            printCodaEventi();
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