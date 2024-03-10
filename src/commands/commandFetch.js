import { fetchGiornateCartellino, fetchGiornateCartellinoRAW } from '../presenze/fetch.js';
import { minutiFormatter, isDateInRange, isYYYYMMDDToday, getTodayDateAsYYYYMMDD } from '../commons/date.js';
import { readGiornate, writeGiornate, findUncoveredIntervals, creaIntervalloGiornateBlank } from '../presenze/cachedGiornate.js';

import { createFormatter, createGrid, createGridColumn} from '../commons/grid.js'

import chalk from 'chalk';

import configurationSingleton from '../commons/config.js'
const config = configurationSingleton.getInstance();

/**
 * Recupera e restituisce le Giornate nell'intervallo specificato
 */
async function fetchGiornate({
    dataInizio,
    dataFine,
    noCache = false,
    fetchTodayAlways = true,
    onlyCache = false,
    fillGaps = false
} = {}){

    const fetchGiornateFromApi = async (inizio, fine) => {
        const cookieHeader = config.getCookieHeader();
        const idDipendente = config.getIdDipendente();
        return await fetchGiornateCartellino(idDipendente, cookieHeader, inizio, fine);
    };

    let giornate;

    if(noCache){
        giornate = await fetchGiornateFromApi(dataInizio, dataFine);
        forceUpdateCache(giornate);
    }else{
        const options = { dataInizio, dataFine, fetchTodayAlways, fillGaps };
        if(!onlyCache)
            options.apiFetch = fetchGiornateFromApi;
        giornate = await fetchGiornateWithCache(options);
    }

    return giornate;
}

/**
 * Riscrive le giornate in cache aggiungendo le giornate passate (che esistessero già o no in cache)
 */
function forceUpdateCache(giornate){
    let giornateCached = readGiornate();
    for(let dataGiornata in giornate){
        giornateCached[dataGiornata] = giornate[dataGiornata];
    }
    writeGiornate(giornate);
}

/**
 * Recupera e restituisce le Giornate nell'intervallo specificato
 * (Guarda in cache prima di interrogare l'api, che evita di fare se apiFetch è undefined)
 */
async function fetchGiornateWithCache({dataInizio, dataFine, apiFetch, fetchTodayAlways = true, fillGaps = false} = {}){

    //recupera le giornate dalla cache
    let giornate = readGiornate();

    //se è stata passata una callback per il fetch remoto, recupera gli intervalli mancanti per coprire il gap della cache
    if(apiFetch){
        //scova gli intervalli non coperti dalla cache rispetto al range dataInizio-dataFine
        let uncoveredIntervals = findUncoveredIntervals(giornate, dataInizio, dataFine);
        //e per ognuno individuato,
        for(let [inizio, fine] of uncoveredIntervals){
            //interroga l'api con l'intervallo
            const nuoveGiornate = await apiFetch(inizio, fine);
            //correda il set giornate con il nuovo subset recuperato
            giornate = {...giornate, ...nuoveGiornate};
        }

        //serve ad aggiornare la giornata di today che potrebbe essere ancora soggetta a cambiamenti
        //!attenzione la stessa cosa vale per giornate passate prima di oggi che potrebbero aver subito anche loro cambiamenti (vedi BP)
        if(fetchTodayAlways){
            const today = getTodayDateAsYYYYMMDD();
            if (isDateInRange(today, [dataInizio, dataFine])){
                const todayGiornata = await apiFetch(today, today);
                giornate[today] = todayGiornata[today];
            }
        }

        //se ci sono intervalli non coperti, scrive in cache le nuove giornate recuperate
        if(uncoveredIntervals.length > 0 || fetchTodayAlways)
            writeGiornate(giornate);
    }
    else if(fillGaps){
        let uncoveredIntervals = findUncoveredIntervals(giornate, dataInizio, dataFine);
        //e per ognuno individuato,
        for(let [inizio, fine] of uncoveredIntervals){
            //crea le giornate blank nell'intervallo
            const giornateBlank = creaIntervalloGiornateBlank(inizio, fine);
            //correda il set giornate con il nuovo subset recuperato
            giornate = {...giornate, ...giornateBlank};
        }
    }

    //ora dal set complessivo di giornate, recupera quelle richieste dall'intervallo dataInizio-dataFine
    const subsetDate = Object.keys(giornate).filter( dataGiornata => isDateInRange(dataGiornata, [dataInizio, dataFine]) );

    //costruisce il set di giornate richiesto
    let subsetGiornate = {};
    for(let dataGiornata of subsetDate){
        subsetGiornate[dataGiornata] = giornate[dataGiornata];
    }

    //e lo restituisce
    return subsetGiornate;
}

/**
 * Recupera le Giornate nell'intervallo specificato - Stampa su console il json originale ricevuto dall'api
 */
export async function commandFetchOriginalJson({dataInizio, dataFine}={}){

    const cookieHeader = config.getCookieHeader();
    const idDipendente = config.getIdDipendente();

    const json = await fetchGiornateCartellinoRAW(idDipendente, cookieHeader, dataInizio, dataFine);

    console.log(JSON.stringify(json, null, 2));
}

/**
 * Stampa su targetConsole le Giornate nell'intervallo specificato
 */
export async function commandFetch({
    dataInizio,
    dataFine,
    targetConsole = console,
    noCache = false,
    onlyCache = false,
    asJson = false,
    excludeTodayFromSurplus = true,
    fetchTodayAlways = true,
    colTimbratureSize = 8,
    showCacheStatus = false,
    fillGaps = false,
} = {}){

    const giornate = await fetchGiornate({dataInizio, dataFine, noCache, onlyCache, fetchTodayAlways, fillGaps});

    if(asJson){
        targetConsole.log(JSON.stringify(giornate, null, 2));
        return;
    }else{
        printGiornateTab({targetConsole, giornate, excludeTodayFromSurplus, colTimbratureSize, showCacheStatus});
    }
}

function printGiornateTab({
    giornate,
    targetConsole = console,

    ignoreLines = false,
    excludeTodayFromSurplus = true,
    showHeader = true,
    colTimbratureSize = 8,
    showCacheStatus = false,
} = {}){

    if(colTimbratureSize < 4 || colTimbratureSize > 8){
        throw new Error(`La dimensione della colonna Timbrature non può ospitarne meno di 4 o più di 8 -richiesto ${colTimbratureSize}`);
    }

    const grid = createGridGiornate({ excludeTodayFromSurplus, colTimbratureSize, showCacheStatus });

    for(const dataDelGiorno in giornate){
        const giornata = giornate[dataDelGiorno];
        addGiornataToGrid(grid, giornata);
    }

    const gridFormatter = createFormatter({
        showHeader: showHeader,
        ignoreLines: ignoreLines,
        liner: '-',
        outerSpacer: '$',
        outerBorder: true,
        headerSeparator: '|',
        rowSeparator: '|',
        paddingLeft: 1,
        paddingChar: ' ',
    });

    gridFormatter.printGrid({ grid });
}

function createGridGiornate({
    excludeTodayFromSurplus = true,
    colTimbratureSize = 4,
    showCacheStatus = false
} = {}){

    const stileOrarioSurplus = chalk.green.bold;
    const stileOrarioDeficit = chalk.red.bold;

    // #region transformers

    const ignoreIfToday = (id)=>{
        const isToday = isYYYYMMDDToday(id);
        return (isToday && excludeTodayFromSurplus);
    }

    const orarioToScalar = (orario)=>{
        const regexOrario = /([+-])?(\d+):(\d+)/g;
        let lastMatch = null;
        let match;
        while (match = regexOrario.exec(orario)) {
            lastMatch = match;
        }
        if (lastMatch) {
            const [orario, sign, hours, minutes] = lastMatch;
            let minutesAmount = parseInt(hours)*60 + parseInt(minutes);
            if(sign === '-')
                minutesAmount *= -1;
            return minutesAmount;
        }
        return 0;
    }

    const minutesToString = (minutesAmount)=>{
        const hours = Math.floor(Math.abs(minutesAmount) / 60);
        const minutes = Math.abs(minutesAmount) % 60;
        return `${hours.toString()}:${minutes.toString().padStart(2, '0')}`;
    }

    const transfomerSurplus = {
        doIgnore: ignoreIfToday,
        toScalar: orarioToScalar,
        toString: (value)=>{
            let orario = minutesToString(value);
            if (value >= 0){
                orario = '+' + orario;
                return stileOrarioSurplus(orario);
            } else {
                orario = '-' + orario;
                return stileOrarioDeficit(orario);
            }
        }
    };

    const transformerPresenza = {
        doIgnore: ignoreIfToday,
        toScalar: orarioToScalar,
        toString: (value)=>{
            return minutesToString(value)
        }
    };

    const transformerPermessi = {
        doIgnore: ignoreIfToday,
        toScalar: orarioToScalar,
        toString: (value)=>{
            return minutesToString(value)
        }
    };

    const transformerBuoniPasto = {
        doIgnore: ignoreIfToday,
        toScalar: (value)=>{ if(value == 'BP') return 1; else return 0;},
        toString: (value)=>{ return value.toString(); }
    };

    // #endregion

    //le colonne sono tutte definite con la proprietà length che ne esprime la larghezza fissa
    //quel numero tiene conto della dimensione del dato che deve contenere (spesso con un formato fisso dove la lunghezza varia in un range chiaro)
    //inoltre deve tener conto anche del paddingLeft imposto dal formatter a valle, dove se il padding è 1, la lunghezza colonna è dimensione fissa del dato + 2 (per avere lo stesso padding a destra)

    const timbraturaLength = 6; //es.: E00:00
    //moltiplica la lunghezza della timbratura per il numero di timbrature da ospitare..
    //a cui somma la quantità di separatori a dividerli E il paddingLeft+Right
    const lengthTimbrature = colTimbratureSize * 6 + (colTimbratureSize-1) + 2;

    const minutiPresenzaRichiesti = parseInt(config.get('cartellino.minutiPresenzaRichiesti'));
    const minutiPausaPranzoObbligatoria = parseInt(config.get('cartellino.minutiPausaPranzoObbligatoria'));

    const labelOrarioOrdinario = Math.floor(minutiPresenzaRichiesti/60).toString() + ':' + (minutiPresenzaRichiesti % 60).toString();

    const columns = [
        createGridColumn({name: 'data', length: 18, header: 'DATA', styleDataRow: { paddingLeft: 1, paddingChar: ' ', overflow: 'trim' }}),
        createGridColumn({name: 'uscita', length: 15, header: `USCITA (${labelOrarioOrdinario})`, transformer: transfomerSurplus}),
        createGridColumn({name: 'presenza', length: 11, header: 'PRESENZA', transformer: transformerPresenza}),
        createGridColumn({name: 'timbratureValideSuTotali', length: 5, header: 'V/T'}),
        createGridColumn({name: 'assenza', length: 10, header: 'ASSENZA'}),
        createGridColumn({name: 'buonoPasto', length: 4, header: 'BP', transformer: transformerBuoniPasto}),
        createGridColumn({name: 'permessi', length: 6, header: 'PERM', transformer: transformerPermessi}),
        createGridColumn({name: 'timbrature', length: lengthTimbrature, header: `TIMBRATURE (${colTimbratureSize})`}),
    ];

    if(showCacheStatus)
        columns.unshift(createGridColumn({name: 'cache', length: 1, header: '', styleDataRow: { paddingLeft: 0, paddingChar: ' ', overflow: 'trim' }}));

    const grid = createGrid();
    grid.addColumns(columns);

    return grid;
}

function addGiornataToGrid(grid, giornata){

    const dataDelGiorno = giornata.data.YYYYMMDD;
    const intervalli = giornata.intervalli;
    const aspettativa = giornata.aspettativa;
    const valide = intervalli.timbratureValide;

    const presenza = intervalli.presenza.hhmm;
    const presenzeCount = intervalli.presenze.length;
    const assenza = intervalli.assenza.hhmm;
    const assenzeCount = intervalli.assenze.length;
    const anomalia = intervalli.anomalia;

    // #region stili

    const stileDataGiorno = chalk.bold.cyanBright
    const stileDataGiornoSAB = chalk.bold.yellowBright;
    const stileDataGiornoDOM = chalk.bold.yellowBright;

    const stileMarkerToday = chalk.bgBlue;
    const stileMarkerTodayL = chalk.bgBlueBright.bold;
    const stileMarkerTodayR = chalk.bgBlueBright.bold;
    const stileMarkerFuturo = chalk.bgGray;

    const stileUscitaSurplus = chalk.green;
    const stileUscitaDeficit = chalk.red;
    const stileUscitaConPermesso = chalk.bgBlue.white.bold;

    const stilePresenzeCountNonValido = chalk.red;
    const stilePresenzeCountValido = chalk.green;
    const stilePresenzeStatoNonValido = chalk.bgRed.white.bold;

    const stileTimbratureCountValido = chalk.green;
    const stileTimbratureCountNonValido = chalk.red;

    const stileBuonoPastoSi = chalk.green.bold;
    const stileBuonoPastoNo = chalk.red.bold;

    const stileTimbraturaVersoE = chalk.cyan.bold;
    const stileTimbraturaVersoU = chalk.yellow.bold;
    const stileTimbraturaEntrataRitardo = chalk.magenta.underline;
    const stileTimbraturaNonValida = chalk.red;
    const stileTimbraturaSmartWorking = chalk.blue.bold;
    const stileTimbraturaFerie = chalk.cyan.bold;
    const stileTimbraturaTrasferta = chalk.blue.bold;
    const stileTimbraturaSabato = chalk.yellow.bold;
    const stileTimbraturaDomenica = chalk.yellow.bold;
    const stileTimbraturaFestivo = chalk.magenta.bold;

    const stileStatusCached = chalk.bgRed;
    const stileStatusFetched = chalk.bgGreen;
    const stileStatusBlank = chalk.bgWhite;

    // #endregion

    // #region cache - es.: 'C' | 'B' | 'F'
    let cacheLabel;
    if(giornata.origin)
        if(giornata.origin == 'CACHE')
            cacheLabel = stileStatusCached.bold('C');
        else if(giornata.origin == 'BLANK')
            cacheLabel = stileStatusBlank.black.bold('B');
        else
            cacheLabel = stileStatusBlank.black.bold('?');
    else
        cacheLabel = stileStatusFetched.bold('F');
    // #endregion

    // #region timbrature - es.: 'E09:08 U12:37 E13:17 U17:05 E13:17 U17:05' (len: 41)
    let timbratureLabel =
        giornata.timbrature
            .map((timbratura, i) => {
                const verso = (timbratura.versoU1 == 'E') ? stileTimbraturaVersoE('E') : stileTimbraturaVersoU('U');
                let hhmm = timbratura.hhmm;
                if(i==0 && timbratura.minutiCalcolato > 570)
                    hhmm = stileTimbraturaEntrataRitardo(hhmm);
                if(i>=valide)
                    hhmm = stileTimbraturaNonValida(hhmm);
                return `${verso}${hhmm}`;
            })
            .join(' ');

    if (giornata.smartWorking)
        timbratureLabel = stileTimbraturaSmartWorking('SMART WORKING');
    else if(giornata.ferie)
        timbratureLabel = stileTimbraturaFerie('FERIE');
    else if(giornata.trasferta)
        timbratureLabel = stileTimbraturaTrasferta('TRASFERTA');
    else if(giornata.tipoGiorno !== 'Ordinario'){
        timbratureLabel = giornata.tipoGiorno.toUpperCase();
        switch(timbratureLabel){
            case 'SABATO':
                timbratureLabel = stileTimbraturaSabato(timbratureLabel);
                break;
            case 'DOMENICA':
                timbratureLabel = stileTimbraturaDomenica(timbratureLabel);
                break;
            case 'FESTIVO':
                timbratureLabel = stileTimbraturaFestivo(timbratureLabel);
                break;
        }
    }
    // #endregion

    // #region presenza - es.: '07:55(2)!' (len: 9)
    let presenzaLabel = '';
    if(giornata.timbrature.length > 0){
        if(anomalia)
            presenzaLabel = `${presenza}(${stilePresenzeCountNonValido(presenzeCount)})${stilePresenzeStatoNonValido('!')}`;
        else
            presenzaLabel = `${presenza}(${stilePresenzeCountValido(presenzeCount)})`;
    }
    // #endregion

    // #region assenza - es.: '00:47(1)' (len: 8)
    let assenzaLabel = '';
    if(giornata.timbrature.length > 0)
        assenzaLabel = `${assenza}(${assenzeCount})`;
    // #endregion

    // #region valida - es.: '4/6' (len: 3)
    let validaLabel = '';
    if(giornata.timbrature.length > 0){
        validaLabel = `${valide}/${giornata.timbrature.length}`;
        if(valide !== giornata.timbrature.length)
            validaLabel = stileTimbratureCountNonValido(validaLabel);
        else
            validaLabel = stileTimbratureCountValido(validaLabel);
    }
    // #endregion

    // #region aspettativa - es.: '17:25(+0:36)P' (len: 13)
    let aspettativaLabel;
    if(!aspettativa.uscita || !aspettativa.deficit){
        aspettativaLabel = '';
    }else{
        let surplusGiorno;
        if(aspettativa.deficit.isNegative || aspettativa.deficit.minutiTotali == 0)
            surplusGiorno = stileUscitaSurplus(aspettativa.deficit.hmm_signed_surplus);
        else
            surplusGiorno = stileUscitaDeficit(aspettativa.deficit.hmm_signed_surplus);
        aspettativaLabel = `${aspettativa?.uscita?.hhmm}(${surplusGiorno})`;
    }
    if(giornata.minutiPermessi > 0){
        aspettativaLabel += stileUscitaConPermesso('P');
    }
    // #endregion

    // #region buonoPasto - es.: 'BPY' (len: 3)
    let buonoPastoLabel = '';
    if(giornata.tipoGiorno == 'Ordinario' && !giornata.ferie && giornata.minutiLavorati > 0){
        if(giornata.buonoPasto)
            buonoPastoLabel = stileBuonoPastoSi('BP');
        else
            buonoPastoLabel = stileBuonoPastoNo('NO');
    }
    // #endregion

    // #region data - es.: '[01-02-2024 GIO]' (len: 16)
    let data = giornata.data.DDMMYYYY_dash;
    let giorno = giornata.data.giornoSettimanaU3;
    switch (giorno){
        case 'SAB':
            giorno = stileDataGiornoSAB(giorno);
            break;
        case 'DOM':
            giorno = stileDataGiornoDOM(giorno);
            break;
        default:
            giorno = stileDataGiorno(giorno);
    }
    let dataLabel = `[${data} ${giorno}]`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if(giornata.data.date.getTime() == today.getTime()){
        dataLabel = stileMarkerToday(dataLabel);
        //const marker = stileMarkerTodayL.bold('*');
        const markerL = stileMarkerTodayL.bold('>');//marker;
        const markerR = stileMarkerTodayR.bold('<');//marker;
        dataLabel = `${markerL}${dataLabel}${markerR}`
    }
    if(giornata.data.date.getTime() > today.getTime())
        dataLabel = stileMarkerFuturo(dataLabel);
    // #endregion

    // #region permessi - es.: '0:36' (len: 4)
    let permessiLabel = '';
    if(giornata.minutiPermessi > 0){
        const permessiTime = minutiFormatter(giornata.minutiPermessi);
        permessiLabel = permessiTime.hmm;
    }
    // #endregion

    grid.addRow({
        values: {
            cache: cacheLabel,
            data: dataLabel,
            uscita: aspettativaLabel,
            presenza: presenzaLabel,
            timbratureValideSuTotali: validaLabel,
            assenza: assenzaLabel,
            buonoPasto: buonoPastoLabel,
            permessi: permessiLabel,
            timbrature: timbratureLabel,
        },
        id: dataDelGiorno,
        data: giornata
    });
}