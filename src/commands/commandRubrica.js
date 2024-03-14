import { fetchRubrica } from '../presenze/rubrica.js';

import configurationSingleton from '../commons/config.js'
const config = configurationSingleton.getInstance();

import chalk from 'chalk';

const styles = {
    short1: {
        stileAssente: chalk.redBright.bold,
        stilePresente: chalk.greenBright.bold,
        stileEsente: chalk.yellowBright.bold,
        stileX: chalk.cyanBright.bold,
        stileTrue: chalk.greenBright.bold,
        stileFalse: chalk.redBright.bold,
        stileMissing: chalk.magenta.bold,
        stileNull: chalk.magenta.bold,
        stileInfo: chalk.blueBright.bold,
        styleVoceAssente: chalk.cyanBright,
    },
    short2: {
        stileAssente: chalk.redBright.bold,
        stilePresente: chalk.greenBright.bold,
        stileEsente: chalk.yellowBright.bold,
        stileX: chalk.cyanBright.bold,
        stileBGTrue: chalk.bgGreenBright.bold,
        stileBGFalse: chalk.bgRedBright.bold,
        stileBGMissing: chalk.bgMagentaBright.bold,
        stileBGNull: chalk.magentaBright.bold,
        styleVoceAssente: chalk.cyanBright,

        stileBGHeader: chalk.bgHex('#444'),
        stileBGHeader2: chalk.underline.bgHex('#444'),
    },
    short3: {
        stileHeader: chalk.bold.white.bgGray, //chalk.bold.black.bgHex('#444'),
        stileSmart: chalk.bgBlue.bold,
        stileMissione: chalk.bgMagenta.bold,
        stileAltro: chalk.bgYellow.bold,
        stileNull: chalk.greenBright.bold,
        stileError: chalk.redBright.bold,

        stileNome: chalk.yellow.dim.bold,
        stileCognome: chalk.yellow.bold,
        stileTelefono: chalk.dim,
        stileId: chalk.yellow.dim.bold,

        stileAssente: chalk.redBright.bold,
        stilePresente: chalk.greenBright.bold,
        stileEsente: chalk.yellowBright.bold,
        stileX: chalk.cyanBright.bold,

        styleVoceAssente: chalk.cyanBright,
    },
    long: {
        stileAssente: chalk.redBright.bold,
        stilePresente: chalk.greenBright.bold,
        stileEsente: chalk.yellowBright.bold,
        stileX: chalk.cyanBright.bold,
        styleVoceAssente: chalk.cyanBright,
    },
    gruppi: {
        styleGruppo: chalk.bgBlue.bold,
        styleMapped: chalk.green.bold,
        styleMissing: chalk.red.bold,
    }
}

export async function commandRubrica({
    idsRequested = '-2',
    delayms = 1000,
    printMode = 'short3',
    showTotal = true,
    group = {},
    filter,
    sortBy
} = {}){

    const validModes = ['short1','short2', 'short3', 'long', 'raw', 'json'];
    if (!validModes.includes(printMode))
        throw new Error(`printMode: ${printMode} non valido! Le opzioni valide sono: ${validModes.join(', ')}`);

    if (sortBy && !['stato','descrizione','nome','cognome','id'].includes(sortBy))
        throw new Error(`l\'argomento sortBy non può avere il valore ${sortBy} per un gruppo`);

    if(sortBy === 'stato')  sortBy = 'macrostato';
    if(sortBy === 'descrizione')  sortBy = 'descrstato';

    const cookieHeader = config.getCookieHeader();

    const ids = idsRequested.split(',');

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    let countRisultati = 0;

    let i = 0;
    for(let id of ids){
        if(++i > 1)
            await sleep(delayms);
        let rubrica = await fetchRubrica({ cookieHeader, idDipendente: id });
        //rubrica.forEach(dipendenteRubrica => processDataForEvents(dipendenteRubrica));

        switch(filter){
            case 'presentiAdesso':
                rubrica = filterRubricaPresentiAdesso(rubrica);
                break;
            case 'presentiOggi':
                rubrica = filterRubricaPresentiOggi(rubrica);
                break;
            case 'presentiDomani':
                rubrica = filterRubricaPresentiDomani(rubrica);
                break;
            default:
                if (filter !== '' && filter !== undefined)
                    throw new Error('L\'argomento filter può avere come valori possibili solo presentiOggi, presentiDomani o stringa vuota o undefined');
        }

        countRisultati += rubrica.length;

        //in generale il risultato del fetch è uno soltanto (l'id richiesto),
        //ma id=-1 e id=-2 restituiscono rispettivamente: tutti i dipendenti e i dipendenti tra i preferiti
        //qui ho mischiato la logica di scenari diversi!
        //se ids.length > 0 devo fare un fetch alla volta (i gruppi non sono supportati) e il total lo stampa alla fine
        //se ids.length == 1 faccio un solo fetch (i gruppi sono supportati ma è poco ragionevole)
        //se id = -2 faccio un solo fetch, il total è specifico di quello scenario (i gruppi sono supportati)
        //se id = -1 faccio un solo fetch, il total è il solito

        if(printMode == 'json'){
            printRubricaJSON({ rubrica });
        }else{
            let printDipendente;
            let printHeader;
            switch (printMode){
                case 'short1':
                    printHeader = (customConsole = console)=>{ printDipendenteInRubricaShort1({ isHeader: true, customConsole }) };
                    printDipendente = printDipendenteInRubricaShort1;
                    break;
                case 'short2':
                    printHeader = (customConsole = console)=>{ printDipendenteInRubricaShort2({ isHeader: true, customConsole }) };
                    printDipendente = printDipendenteInRubricaShort2;
                    break;
                case 'short3':
                    printHeader = (customConsole = console)=>{ printDipendenteInRubricaShort3({ isHeader: true, customConsole }) };
                    printDipendente = (obj) => { printDipendenteInRubricaShort3({ ...obj, sortBy }); }
                    break;
                case 'long':
                    printDipendente = printDipendenteInRubricaLong;
                    break;
                case 'raw':
                    printDipendente = printDipendenteInRubricaRaw;
                    break;
                default:
                    printDipendente = printDipendenteInRubricaRaw;
            }

            if(Object.keys(group).length > 0){
                const rubricaById = rubrica.reduce((acc, obj) => {
                    acc['id_' + obj.id.toString()] = obj;
                    return acc;
                }, {});
                const countersGruppo = printGroup(group, rubricaById, printHeader, printDipendente, undefined, undefined, undefined, sortBy);

                if(showTotal){
                    console.log(`\n[Risultati: ${countRisultati}][Mappa: ${styles.gruppi.styleMapped(countersGruppo.found)}/${styles.gruppi.styleMissing(countersGruppo.notFound)}]`);
                }
            }
            else{
                if(printHeader && i == 1)
                   printHeader();
                if(sortBy)
                   rubrica = sortByProperty(rubrica, sortBy);
                rubrica.forEach(result => printDipendente({ result }));
            }

            if(Object.keys(group).length == 0 && showTotal){
                console.log(`\n[Risultati: ${countRisultati}]`);
            }
        }
    }
}

/*
function processDataForEvents(dipendenteRubrica){
    config.updateStatoEventiPreferiti({
        idDipendente: dipendenteRubrica.id,
        nominativo: dipendenteRubrica.nominativo,
        macrostato: dipendenteRubrica.macrostato,
        oggi: dipendenteRubrica.oggi,
        domani: dipendenteRubrica.domani,
    });
}
*/

function filterRubricaPresentiAdesso(rubrica){
    return rubrica.filter(dip => dip.macrostato == 'P');
}

function filterRubricaPresentiOggi(rubrica){
    return rubrica.filter(dip =>
            dip.macrostato == 'P' || !dip.oggi || (dip.oggi.misstrasf === false && dip.oggi.telelavoro === false && dip.oggi.altro === false)
        );
}

function filterRubricaPresentiDomani(rubrica){
    return rubrica.filter(dip => !dip.domani || (dip.domani.misstrasf === false && dip.domani.telelavoro === false && dip.domani.altro === false));
}

function sortByProperty(array, propertyName) {
    return array.sort((a, b) => {
        if (a[propertyName] < b[propertyName]) {
            return -1;
        }
        if (a[propertyName] > b[propertyName]) {
            return 1;
        }
        return 0;
    });
}

function printGroup(
    group,
    rubricaById,
    printHeader,
    printDipendente,
    indent = 1,
    customConsole = console,
    counters = { found: 0, notFound: 0 },
    sortBy
){

    const indentSpaces = 4;
    const leftPadding = ' '.repeat(indent*indentSpaces);

    const s = styles.gruppi;

    //questo è stato aggiunto a posteriori per il count stretto del gruppo (solo i suoi id e non dei gruppi nested)
    let foundInMapOfThisGroup = 0;
    if(group.ids.length > 0){
        group.ids.forEach(
            (id) => {
                if ( Object.keys(rubricaById).includes('id_' + id.toString()) )
                    foundInMapOfThisGroup++;
            });
    }
    const labelCounter = (group.ids.length > 0) ? `(${foundInMapOfThisGroup}/${group.ids.length})` : '';

    const groupLabel =  labelCounter + ' GRUPPO' + ': ' + group.name + ' ';
    customConsole.log('\n' + s.styleGruppo(groupLabel)  + '\n');

    if(group.ids.length > 0){
        if(printHeader)
            printHeader(customConsole);
        let gruppoRubrica =
            group.ids
                .map(id => {
                    if ( Object.keys(rubricaById).includes('id_' + id.toString()) ){
                        counters.found++;
                        return rubricaById['id_' + id.toString()];
                    }else{
                        counters.notFound++;
                        return {
                            _invalid: true,
                            oggi: null,
                            domani: null,
                            macrostato: 'X',
                            nominativo: 'VOCE ASSENTE!',
                            id,
                            descrstato: 'VOCE ASSENTE!',
                            cognome: '',
                            nome: '',
                            telefono: ''
                        };
                        //throw new Error('!!!!!' + id.toString())
                    }
                })
                //.forEach(result => printDipendente({ result, customConsole }));
        if(sortBy)
            gruppoRubrica = sortByProperty(gruppoRubrica, sortBy);
        gruppoRubrica.forEach(result => printDipendente({ result, customConsole }));
    }

    const nextCustomConsole = {
        _leftPadding: '',
        log: function(...content){
            const indented =
                content
                    .join(' ')
                    .split('\n')
                    .map(line => leftPadding + this._leftPadding + line)
                    .join('\n');
            console.log(indented);
        }
    }

    if(group.groups)
        group.groups.forEach( group => printGroup(group, rubricaById, printHeader, printDipendente, indent + 1, nextCustomConsole, counters, sortBy) );

    return counters;
}

function printDipendenteInRubricaShort1({ result, isHeader = false, customConsole = console }){

    const s = styles.short1;

    function propToString(obj, { propertyName, abbr }){
        if(propertyName in obj){
            return obj[propertyName] === true ? s.stileInfo(abbr) + ':' + s.stileTrue('T') : s.stileInfo(abbr) + ':' + s.stileFalse('F');
        }
        return s.stileInfo(abbr) + ':' + s.stileMissing('M');
    }

    function propsToString(obj, props){
        if(obj)
            return props
                .map( prop => propToString(obj, prop))
                .join(', ');
        else
            return s.stileNull('       NULL        ');
    }

    const props = [
        { propertyName: 'telelavoro', abbr: 'SW' },
        { propertyName: 'misstrasf', abbr: 'MT' },
        { propertyName: 'altro', abbr: 'ALTRO' }
    ];

    const statoWidth = 1;
    const nominativoWidth = 30;

    if(isHeader){
        customConsole.log(' NOMINATIVO'.padEnd(statoWidth + nominativoWidth) + '[       OGGI        ][      DOMANI       ][ ID ]');
    }else{
        if (result === undefined)
            return;
        const oggi = propsToString(result.oggi, props);
        const domani = propsToString(result.domani, props);
        //const macrostato = ( result.macrostato === 'A' ) ? s.stileAssente(result.macrostato) : s.stilePresente(result.macrostato);
        let macrostato;
        switch(result.macrostato){
            case('A'):
                macrostato = s.stileAssente(result.macrostato);
                break;
            case('P'):
                macrostato = s.stilePresente(result.macrostato);
                break;
            case('E'):
            case('N'):
                macrostato = s.stileEsente(result.macrostato);
                break;
            case('X'):
                macrostato = s.stileX(result.macrostato);
                break;
            default:
                macrostato = result.macrostato;
        }
        let nominativo = result.nominativo.padEnd(nominativoWidth,'-');
        if(result._invalid)
            nominativo = s.styleVoceAssente(nominativo);
        const id = result.id.toString().padStart(4, ' ');

        customConsole.log(`${macrostato}${nominativo}[${oggi}][${domani}][${id}]`);
    }
}

function printDipendenteInRubricaShort2({ result, isHeader = false, customConsole = console  }){

    if(result && result?._invalid === true)
        return;

    const s = styles.short2;

    function propToString(obj, { propertyName, abbr }){
        if(propertyName in obj){
            return obj[propertyName] === true ? s.stileBGTrue('  T  ') : s.stileBGFalse('  F  ');
        }
        return s.stileBGMissing('  M  ');
    }

    function propsToString(obj, props){
        if(obj)
            return props.map( prop => propToString(obj, prop)).join('|');
        else
            return s.stileBGNull('      NULLO      ');
    }

    const columns = {
        presente: {
            header:  ['S'],
            width: 1,
            borderLeft: '|',
            borderRight: '|',
            headerStyle: s.stileBGHeader,
            paddingChar: '-',
        },
        descrizione: {
            header:  ['DESCR.'],
            paddingChar: '-',
            width: 6,
            // borderLeft: '[',
            borderRight: '|',
            headerStyle: s.stileBGHeader
        },
        nominativo: {
            header: ['NOMINATIVO'],
            align: 'left',
            paddingChar: '-',
            width: 30,
            headerStyle: s.stileBGHeader
            //borderLeft: '[',
            //borderRight: ']'
        },
        oggi: {
            header: ['OGGI', 'SMART|MISTR|ALTRO'],
            align: 'center',
            width: 17,
            borderLeft: '|',
            headerStyle: s.stileBGHeader2
            //borderRight: ']'
        },
        domani: {
            header: ['DOMANI', 'SMART|MISTR|ALTRO'],
            align: 'center',
            width: 17,
            borderLeft: '|',
            borderRight: '|',
            headerStyle: s.stileBGHeader2
        },
        telefono: {
            header: ['TELEFONO'],
            align: 'center',
            width: 14,
            //borderLeft: '|',
            borderRight: '|',
            headerStyle: s.stileBGHeader2
        },
        id: {
            header: ['ID'],
            align: 'center',
            width: 5,
            //borderLeft: '|',
            borderRight: '|',
            headerStyle: s.stileBGHeader2
        },
    };

    const props = [
        { propertyName: 'telelavoro', abbr: 'SW' },
        { propertyName: 'misstrasf', abbr: 'MT' },
        { propertyName: 'altro', abbr: 'ALTRO' }
    ];

    function printHeaders(columns, layers){

        for(let iHeader = 0; iHeader < layers; iHeader++){
            const header = Object.values(columns)
                .map( col => {
                    let processedHeader;

                    const bL = (col?.borderLeft) ? col.borderLeft : '';
                    const bR = (col?.borderRight) ? col.borderRight : '';
                    const padChar = (col?.paddingChar) ? col.paddingChar : ' ';
                    let content = col.header[iHeader];
                    if(!content) content = padChar;
                    switch(col?.align){
                        case 'left':
                            processedHeader = content.padEnd(col.width, padChar);
                            break;
                        case 'center':
                            const paddingLength = col.width - content.length;
                            const shorterPaddingLength = Math.floor(paddingLength / 2);
                            const longerPaddingLength = paddingLength - shorterPaddingLength;
                            const paddingLeft = padChar.repeat(longerPaddingLength);
                            const paddingRight = padChar.repeat(shorterPaddingLength);
                            processedHeader = paddingLeft + content + paddingRight;
                            break;
                        case 'right':
                            processedHeader = content.padStart(col.width, padChar);
                            break;
                        default:
                            processedHeader = content.padEnd(col.width, padChar);
                    }
                    if(col.headerStyle)
                        processedHeader = col.headerStyle(processedHeader);
                    return bL + processedHeader + bR;
                })
                .join('');
            customConsole.log(header);
        }
    }

    function printRow(columns, row){
        let rowProcessed = '';
        for(let colName in row){
            const col = columns[colName];
            const bL = (col?.borderLeft) ? col.borderLeft : '';
            const bR = (col?.borderRight) ? col.borderRight : '';
            const padChar = (col?.paddingChar) ? col.paddingChar : ' ';
            let currentCell = row[colName].padStart(col.width);
            if(result._invalid && colName == 'nominativo')
                currentCell = s.styleVoceAssente(currentCell);
            rowProcessed += bL + currentCell + bR;
        }
        customConsole.log(rowProcessed);
    }

    if(isHeader){
        printHeaders(columns, 2);
    }else{
        if (result === undefined)
            return;
        const oggi = propsToString(result.oggi, props);
        const domani = propsToString(result.domani, props);
        //const macrostato = ( result.macrostato === 'A' ) ? s.stileAssente(result.macrostato) : s.stilePresente(result.macrostato);
        let macrostato;
        switch(result.macrostato){
            case('A'):
                macrostato = s.stileAssente(result.macrostato);
                break;
            case('P'):
                macrostato = s.stilePresente(result.macrostato);
                break;
            case('E'):
            case('N'):
                macrostato = s.stileEsente(result.macrostato);
                break;
            case('X'):
                macrostato = s.stileX(result.macrostato);
                break;
            default:
                macrostato = result.macrostato;
        }
        let descrizione = result.descrstato;
        switch(descrizione){
            case 'ASSENTE':
                descrizione = s.stileAssente('ASSENT');
                break;
            case 'ASSENTE GIUSTIFICATO':
                descrizione = s.stileAssente('ASS.GI');
                break;
            case 'ASSENTE NON GIUSTIFICATO':
                descrizione = s.stileAssente('ASS.NG');
                break;
            case 'ASSENTE PREVISTO':
                descrizione = s.stileAssente('ASS.PR');
                break;
            case 'ESENTE':
                descrizione = s.stileEsente('ESENTE');
                break;
            case 'PRESENTE':
                descrizione = s.stilePresente('PRESEN');
                break;
            default:
                descrizione = descrizione.substring(0,5) + '.';
        }
        descrizione = descrizione.padEnd(columns.descrizione.width,columns.descrizione.paddingChar);
        const nominativo = result.nominativo.padEnd(columns.nominativo.width,columns.nominativo.paddingChar);
        const telefono = result.telefono.padStart(columns.telefono.width,columns.telefono.paddingChar);
        const id = result.id.toString().padStart(columns.id.width, columns.id.paddingChar);
        const row = {
            presente: macrostato,
            descrizione: descrizione,
            nominativo: nominativo,
            oggi: oggi,
            domani: domani,
            telefono: telefono,
            id: id
        };

        printRow(columns, row);
        //console.log(`${macrostato}${nominativo}${oggi}${domani}`);
    }
}

function printDipendenteInRubricaShort3({ result, isHeader = false, customConsole = console, sortBy  }){

    if(result && result?._invalid === true)
        return;

    const s = styles.short3;

    function propToString(obj){
        if(obj.telelavoro + obj.altro + obj.misstrasf > 1)
            return styles.short3.stileError(" ERROR ");
        if(!obj.telelavoro && !obj.altro && !obj.misstrasf)
            return styles.short3.stileNull(' PRES?!');
        if(obj.telelavoro)
            return styles.short3.stileSmart(" SMART ");
        if(obj.altro)
            return styles.short3.stileAltro(" ALTRO ");
        if(obj.misstrasf)
            return styles.short3.stileMissione(" MISS. ");
    }

    function propsToString(obj, props){
        if(obj)
            return propToString(obj);
        else
            //return s.stileNull(' NULLO ');
            return s.stileNull(' PRES? ');
    }

    const columns = {
        presente: {
            header:  ['S'],
            width: 1,
            borderLeft: '|',
            borderRight: '|',
            headerStyle: s.stileHeader,
            paddingChar: '-',
            borderStyle: chalk.gray.bold,
        },
        descrizione: {
            header:  ['DESCR.'],
            paddingChar: '-',
            width: 6,
            // borderLeft: '[',
            borderRight: '|',
            headerStyle: s.stileHeader,
            borderStyle: chalk.gray.bold,
        },
        nominativo: {
            header: ['NOMINATIVO'],
            align: 'left',
            paddingChar: '-',
            width: 30,
            headerStyle: s.stileHeader
            //borderLeft: '[',
            //borderRight: ']'
        },
        oggi: {
            header: ['OGG.'],
            align: 'center',
            width: 7,
            borderLeft: '|',
            headerStyle: s.stileHeader,
            //borderRight: ']'
            borderStyle: chalk.gray.bold
        },
        domani: {
            header: ['DOM.'],
            align: 'center',
            width: 7,
            borderLeft: '|',
            borderRight: '|',
            headerStyle: s.stileHeader,
            borderStyle: chalk.gray.bold,
        },
        telefono: {
            header: ['TELEFONO'],
            align: 'center',
            width: 14,
            //borderLeft: '|',
            borderRight: '|',
            headerStyle: s.stileHeader,
            borderStyle: chalk.gray.bold,
        },
        id: {
            header: ['ID'],
            align: 'center',
            width: 5,
            //borderLeft: '|',
            borderRight: '|',
            headerStyle: s.stileHeader,
            borderStyle: chalk.gray.bold,
        },
    };

    const props = [
        { propertyName: 'telelavoro', abbr: 'SW' },
        { propertyName: 'misstrasf', abbr: 'MT' },
        { propertyName: 'altro', abbr: 'ALTRO' }
    ];

    function printHeaders(columns, layers){

        for(let iHeader = 0; iHeader < layers; iHeader++){
            const header = Object.values(columns)
                .map( col => {
                    let processedHeader;

                    let bL = (col?.borderLeft) ? col.borderLeft : '';
                    let bR = (col?.borderRight) ? col.borderRight : '';
                    if(col.borderStyle){
                        bL = col.borderStyle(bL);
                        bR = col.borderStyle(bR);
                    }
                    const padChar = (col?.paddingChar) ? col.paddingChar : ' ';
                    let content = col.header[iHeader];
                    if(!content) content = padChar;
                    switch(col?.align){
                        case 'left':
                            processedHeader = content.padEnd(col.width, padChar);
                            break;
                        case 'center':
                            const paddingLength = col.width - content.length;
                            const shorterPaddingLength = Math.floor(paddingLength / 2);
                            const longerPaddingLength = paddingLength - shorterPaddingLength;
                            const paddingLeft = padChar.repeat(longerPaddingLength);
                            const paddingRight = padChar.repeat(shorterPaddingLength);
                            processedHeader = paddingLeft + content + paddingRight;
                            break;
                        case 'right':
                            processedHeader = content.padStart(col.width, padChar);
                            break;
                        default:
                            processedHeader = content.padEnd(col.width, padChar);
                    }
                    processedHeader = bL + processedHeader + bR;
                    if(col.headerStyle)
                        processedHeader = col.headerStyle(processedHeader);
                    //return bL + processedHeader + bR;
                    return processedHeader;
                })
                .join('');
            customConsole.log(header);
        }
    }

    function printRow(columns, row){
        let rowProcessed = '';
        for(let colName in row){
            const col = columns[colName];
            let bL = (col?.borderLeft) ? col.borderLeft : '';
            let bR = (col?.borderRight) ? col.borderRight : '';
            if(col.borderStyle){
                bL = col.borderStyle(bL);
                bR = col.borderStyle(bR);
            }
            const padChar = (col?.paddingChar) ? col.paddingChar : ' ';
            let currentCell = row[colName]?.padStart(col.width, padChar);
            if(result._invalid && colName == 'nominativo')
                currentCell = s.styleVoceAssente(currentCell);
            rowProcessed += bL + currentCell + bR;
        }
        customConsole.log(rowProcessed);
    }

    if(isHeader){
        printHeaders(columns, 1);
    }else{
        if (result === undefined)
            return;
        const oggi = propsToString(result.oggi, props);
        const domani = propsToString(result.domani, props);
        //const macrostato = ( result.macrostato === 'A' ) ? s.stileAssente(result.macrostato) : s.stilePresente(result.macrostato);
        let macrostato;
        switch(result.macrostato){
            case('A'):
                macrostato = s.stileAssente(result.macrostato);
                break;
            case('P'):
                macrostato = s.stilePresente(result.macrostato);
                break;
            case('E'):
            case('N'):
                macrostato = s.stileEsente(result.macrostato);
                break;
            case('X'):
                macrostato = s.stileX(result.macrostato);
                break;
            default:
                macrostato = result.macrostato;
        }
        let descrizione = result.descrstato;
        switch(descrizione){
            case 'ASSENTE':
                descrizione = s.stileAssente('ASSENT');
                break;
            case 'ASSENTE GIUSTIFICATO':
                descrizione = s.stileAssente('ASS.GI');
                break;
            case 'ASSENTE NON GIUSTIFICATO':
                descrizione = s.stileAssente('ASS.NG');
                break;
            case 'ASSENTE PREVISTO':
                descrizione = s.stileAssente('ASS.PR');
                break;
            case 'ESENTE':
                descrizione = s.stileEsente('ESENTE');
                break;
            case 'PRESENTE':
                descrizione = s.stilePresente('PRESEN');
                break;
            default:
                descrizione = descrizione.substring(0,5) + '.';
        }

        function formattaTelefono(numeroTelefono, separaUltimeTre = false) {
            let baseFormattata;
            let parteFinale = "";
            numeroTelefono = numeroTelefono.replace(/\D/g, '');//numeroTelefono.trim();

            //se Roma o Milano
            if (numeroTelefono.startsWith('02') || numeroTelefono.startsWith('06'))
                baseFormattata = numeroTelefono.substring(0, 2) + " " + numeroTelefono.substring(2);
            else
                if(numeroTelefono.startsWith('0871'))
                    baseFormattata = numeroTelefono.substring(0, 4) + " " + numeroTelefono.substring(3);
                else
                    //pretende che tutti gli altri prefissi siano a 3 cifre (mi sento fortunato)
                    baseFormattata = numeroTelefono.substring(0, 3) + " " + numeroTelefono.substring(3);

            if (separaUltimeTre) {
                const indiceSeparazione = baseFormattata.length - 3;
                parteFinale = baseFormattata.substring(0, indiceSeparazione) + " " + baseFormattata.substring(indiceSeparazione);
            } else
                parteFinale = baseFormattata;

            return parteFinale;
        }

        function formattaNominativo(result){
            const cognome = s.stileNome(/*toTitleCase(*/result.cognome/*)*/);
            const nome = s.stileCognome(toTitleCase(result.nome));
            if(sortBy && sortBy == 'nome')
                return nome + ' ' + cognome;
            else
                return cognome + ' ' + nome ;
        }

        function toTitleCase(str) {
            return str.toLowerCase().split(' ').map(function(word) {
                return word.charAt(0).toUpperCase() + word.slice(1);
            }).join(' ');
        }

        descrizione = descrizione.padEnd(columns.descrizione.width,columns.descrizione.paddingChar);
        //const nominativo = result.nominativo.padEnd(columns.nominativo.width,columns.nominativo.paddingChar);
        const nominativo = formattaNominativo(result) +  columns.nominativo.paddingChar.repeat(columns.nominativo.width-result.nominativo.length)
        const telefono = result.telefono.padStart(columns.telefono.width,columns.telefono.paddingChar);
        const id = result.id.toString().padStart(columns.id.width, columns.id.paddingChar);
        const row = {
            presente: macrostato,
            descrizione: descrizione,
            nominativo: nominativo,
            oggi: oggi,
            domani: domani,
            telefono: s.stileTelefono( formattaTelefono(telefono, true).padStart(columns.telefono.width,columns.telefono.paddingChar) ),
            id: s.stileId(id)
        };

        printRow(columns, row);
        //console.log(`${macrostato}${nominativo}${oggi}${domani}`);
    }
}

function printDipendenteInRubricaLong({ result, customConsole = console }){

    const s = styles.long;

    //const macrostato = ( result.macrostato === 'A' ) ? s.stileAssente(result.macrostato) : s.stilePresente(result.macrostato);
    let macrostato;
    let statoStyle;
    let nominativoStyle;
    switch(result.macrostato){
        case('A'):
            statoStyle = s.stileAssente;
            nominativoStyle = (m) => { return m; };
            macrostato = s.stileAssente(result.macrostato);
            break;
        case('P'):
            statoStyle = s.stilePresente;
            nominativoStyle = (m) => { return m; };
            macrostato = s.stilePresente(result.macrostato);
            break;
        case('E'):
        case('N'):
            statoStyle = s.stileEsente;
            nominativoStyle = (m) => { return m; };
            macrostato = s.stileEsente(result.macrostato);
            break;
        case('X'):
            statoStyle = s.stileX;
            nominativoStyle = s.styleVoceAssente;
            macrostato = s.stileX(result.macrostato);
            break;
        default:
            statoStyle = (m) => { return m; };
            nominativoStyle = (m) => { return m; };
            macrostato = result.macrostato;
    }
    //const descrstato = ( result.descrstato.toUpperCase().startsWith('ASSENTE') ) ? s.stileAssente(result.descrstato) : s.stilePresente(result.descrstato);
    const descrstato = statoStyle(result.descrstato);

    const pad = 13; //propertyName max length

    customConsole.log(`\n[${nominativoStyle(result.nominativo)}]\n`);
    customConsole.log(' id: '.padEnd(pad, ' '), result.id);
    customConsole.log(' macrostato: '.padEnd(pad, ' '), macrostato);
    customConsole.log(' descrstato: '.padEnd(pad, ' '), descrstato);
    customConsole.log(' cognome: '.padEnd(pad, ' '), result.cognome);
    customConsole.log(' nome: '.padEnd(pad, ' '), result.nome);
    customConsole.log(' telefono: '.padEnd(pad, ' '), result.telefono);
    customConsole.log(' oggi: '.padEnd(pad, ' '), JSON.stringify(result.oggi));
    customConsole.log(' domani: '.padEnd(pad, ' '), JSON.stringify(result.domani));
    //console.log('------------------------------------------------');
}

function printDipendenteInRubricaRaw({ result }){
    console.log('------------------------------------------------');
    console.log(`[id: ${result.id}] ${result.nominativo}`);
    console.log('------------------------------------------------');
    console.log(JSON.stringify(result, null, 2));
}

function printRubricaJSON({ rubrica }){
    console.log(JSON.stringify(rubrica, null, 2));
}