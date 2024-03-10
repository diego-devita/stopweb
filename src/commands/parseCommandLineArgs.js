import configurationSingleton from '../commons/config.js'

import chalk from 'chalk';

const config = configurationSingleton.getInstance();

function startsWithSingleHyphen(str) {
    return (str.length > 1) && str.startsWith('-') && str[1] !== '-';
}

function startsWithDoubleHyphen(str) {
    return (str.length > 2) && str.startsWith('--') && str[2] !== '-';
}

function isArgumentName(str){
    return startsWithSingleHyphen(str) || startsWithDoubleHyphen(str)
}

export function parseCommandLineArgs(){

    // Rimuove i primi due argomenti (node e il nome dello script)
    const args = process.argv.slice(2);
    let command = "";

    let options = {};

    //command è il primo argomento
    command = args[0];

    if(command !== 'clear')
        config.appendToLog('commands', `${command} ${args.slice(1).join(' ')}`);

    //quelli che poi seguono sono le opzioni
    for (let i = 1; i < args.length; i++) {
        const opzioneNome = args[i];
        const isShort = startsWithSingleHyphen(opzioneNome);
        const isLong = startsWithDoubleHyphen(opzioneNome);
        if (isLong || isShort) {
            const type = (isLong) ? 'long' : 'short';
            let key = opzioneNome.substring((isLong) ? 2 : 1);
            if (key in options)
                throw new Error(`L\'opzione ${chalk.yellow(opzioneNome)} è ripetuta.`);
            //se l'arg successivo esiste e non inizia anche lui con -- o -
            if (i + 1 < args.length && !isArgumentName(args[i + 1])) {
                //conserva l'opzione e il suo valore
                options[key] = args[i + 1];
                /*
                options[key] = {
                    type: type,
                    value: args[i + 1]
                };
                */
                //sposta il cursore all'opzione successiva dopo il valore di questa
                i++;
            }
            //altrimenti considerane il valore = true
            else {
                options[key] = true;
                /*
                options[key] = {
                    type: type,
                    value: true
                }
                */
            }
        } else {
            throw new Error(`L'opzione ${chalk.yellow(opzioneNome)} non è valida! Le opzioni devo usare ${chalk.yellow('-')} o ${chalk.yellow('--')}.`);
        }
    }

    return { command, options };
}

export function validateArgs(command, options){

    const isStringNonEmpty = (value) => {
        return (typeof(value) === 'string' && value.length > 0);
    }

    const isBooleanTrueValue = (value) => {
        return (value === true);
    }

    const isStringDateAsYYYYMMDD = (value) => {
        return typeof(value)==='string' &&  /^(19|20)\d\d(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/.test(value);
    }

    const isStringYearAsYYYY = (value) => {
        return typeof(value) === 'string' &&  /^(19|20)\d\d$/.test(value);
    }

    const isStringMonthAsMM = (value) => {
        return typeof(value) === 'string' &&  /^(0[1-9]|1[0-2])$/.test(value);
    }

    const isStringTimeSpan = (value) => {
        return typeof(value) === 'string' &&  /^\d+[dwmgs]$/.test(value);
    }

    const isStringNumber = (value) => {
        return typeof(value) === 'string' && /^\d+$/.test(value);
    }

    const commandsRules = {
        '*': {
            'nocolor': isBooleanTrueValue,
        },
        'help': {
            //'cols': (value) => { return ( isStringNumber(value) && parseInt(value) >= 74 ); },
            'dettagli': (value) => { return ( ['help','clear','login','fetch','profilo','elenco','rubrica','preferiti'].includes(value) || isBooleanTrueValue(value) ); },
            'versione': isBooleanTrueValue,
            'asgrid': isBooleanTrueValue,
        },
        'guida': {
        },
        'clear': {
            'domain': isStringNonEmpty,
            'conferma': isBooleanTrueValue,
        },
        'login': {
            'username': isStringNonEmpty,
            'password': isStringNonEmpty,
            'noheadless': isBooleanTrueValue,
        },
        'fetch': {
            'dataInizio': isStringDateAsYYYYMMDD,
            'dataFine': isStringDateAsYYYYMMDD,
            'mese': (value) => { return ( isStringMonthAsMM(value) || isBooleanTrueValue(value) ); },
            'anno': isStringYearAsYYYY,
            'oggi': isBooleanTrueValue,
            'ieri': isBooleanTrueValue,
            'daOggiMeno': isStringTimeSpan,
            'nocache': isBooleanTrueValue,
            'json': (value) => { return ( ['originale', 'trasformato', 'o', 't'].includes(value) || isBooleanTrueValue(value) ); },
            'includiOggiInTotali': isBooleanTrueValue,
            'oggiNoRefetch': isBooleanTrueValue,
            'cacheonly': isBooleanTrueValue,
            'colTimbratureSize': (value) => { const n = parseInt(value); return ( isStringNumber(value) && n >= 4 && n <= 8 ); },
            'showCacheStatus': isBooleanTrueValue,
            'fillGaps': isBooleanTrueValue,
            'dump': isBooleanTrueValue
        },
        'profilo': {
            'yaml': isBooleanTrueValue,
            'dettagli': isBooleanTrueValue,
            'init': isBooleanTrueValue,
            'cambia': isStringNonEmpty,
            'crea': isStringNonEmpty,
            'seturls': isStringNonEmpty,
            'checkurls': isBooleanTrueValue,
            'lista' : isBooleanTrueValue,
        },
        'elenco': {
            'cache': isBooleanTrueValue,
            'notot': isBooleanTrueValue,
            'sortby': (value) => { return ['nome', 'cognome', 'id'].includes(value) },
            'json': (value) => { return ['originale', 'trasformato', 'o', 't'].includes(value) || isBooleanTrueValue(value) },
        },
        'rubrica': {
            'id': isStringNumber,
            'ids': (value) => { return /^[0-9]+(,[0-9]+)*$/.test(value); },
            'tutti': isBooleanTrueValue,
            'preferiti': isBooleanTrueValue,
            'delayms': (value) => { const n = parseInt(value); return ( isStringNumber(value) && n >= 100 ); },
            'print': (value) => { return ['short1', 'short2', 'long', 'raw', 'json'].includes(value) },
            'notot': isBooleanTrueValue,
            'gruppo': isStringNonEmpty,
            'presenti': (value) => { return [true, 'now', 'adesso', 'oggi', 'domani'].includes(value) },
            'noTimeSpent': isBooleanTrueValue,
        },
        'preferiti': {
            'list': isBooleanTrueValue,
            'add': isStringNonEmpty,
            'remove': isStringNumber,
            'notot': isBooleanTrueValue,
            'json': isBooleanTrueValue,
            'dumporari': isBooleanTrueValue,
        },
        'maniavanti': {
            'stacce': isBooleanTrueValue,
            'accetta': isBooleanTrueValue,
        },
        'manifesto': {
            'stacce': isBooleanTrueValue,
            'accetta': isBooleanTrueValue,
        },
        'condizioni': {
            'stacce': isBooleanTrueValue,
            'accetta': isBooleanTrueValue,
        },
        'eula': {
            'stacce': isBooleanTrueValue,
            'accetta': isBooleanTrueValue,
        }
    }

    if(command && isArgumentName(command))
        throw new Error(`Le opzioni devono seguire un comando. Se si desiderava vedere l\'aiuto, usare il comando ${chalk.yellow('help')}.`);

    if(!command || command.trim() === '')
        return true;

    if( command === '*')
        throw new Error(`Comando ${chalk.yellow(command)} non riconosciuto.`);

    if (!commandsRules.hasOwnProperty(command)) {
        throw new Error(`Comando ${chalk.yellow(command)} non riconosciuto.`);
    }

    const commandRules = commandsRules[command];
    const globalRules = commandsRules['*'];

    for (const option in options) {
        if (!commandRules.hasOwnProperty(option) && !globalRules.hasOwnProperty(option)) {
            throw new Error(`Opzione ${chalk.yellow(option)} non riconosciuta per il comando ${chalk.yellow(command)}.`);
        }

        let validator;
        if (!commandRules.hasOwnProperty(option))
            validator = globalRules[option];
        else
            validator = commandRules[option];

        const value = options[option];
        const isValid = validator(value);

        if (!isValid) {
            throw new Error(`Valore ${chalk.yellow(value)} non ammesso per l'opzione ${chalk.yellow(option)} del comando ${chalk.yellow(command)}.`);
        }
    }
}