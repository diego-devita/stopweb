import { chromium } from 'playwright';
import configurationSingleton from '../commons/config.js'
import chalk from 'chalk';
import stringWidth from 'string-width';
import inquirer from 'inquirer';
import path from 'path';

import { printHeader } from './commandHelp.js';

import fs from 'fs';

const config = configurationSingleton.getInstance();

const maxCols = 78;

// #region style

const style = {};

style.titolo = chalk.blueBright.bold;
style.white = chalk.white;
style.success = chalk.green;
style.danger = chalk.red;
style.warning = chalk.hex('#FF7500');
style.neutral = chalk.gray;
style.highlight = chalk.yellow;
style.comment = chalk.green;
style.dim = chalk.dim;

style.bgSuccess = chalk.bgGreen.bold;
style.bgDanger = chalk.bgRed.bold;
style.bgWarning = chalk.bgHex('#FF7500').bold;
style.bgNeutral = chalk.bgGray.bold;

style.bgSuccessDarkText = chalk.bgGreen.bold.black;
style.bgDangerDarkText = chalk.bgRed.bold.black;
style.bgWarningDarkText = chalk.bgHex('#FF7500').bold.black;
style.bgNeutralDarkText = chalk.bgGray.bold.black;

// #endregion

// #region badge

function createBadge(label, width, style){
    const labelWidth = label.length;
    const padding = width - labelWidth;
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    const content = `${' '.repeat(leftPad)}${label}${' '.repeat(rightPad)}`;
    return style(content);
}

const badge = {};

badge.ASSENTE = createBadge('ASSENTE!', 10, style.bgDanger);
badge.PRESENTE = createBadge('PRESENTE', 10, style.bgSuccess);
badge.OK = createBadge('OK', 10, style.bgSuccess);
badge.FOUND = createBadge('FOUND!', 10, style.bgSuccess);
badge.NOTFOUND = createBadge('NOTFOUND', 10, style.bgDanger);
badge.NOTSET = createBadge('NOTSET', 10, style.bgDanger);
badge.FROMENV = createBadge('FROM ENV', 10, style.bgSuccess);
badge.FALLBACK = createBadge('FALLBACK', 10, style.bgWarning);
badge.VALIDO = createBadge('VALIDO', 10, style.bgSuccess);
badge.NONVALID = createBadge('NONVALID', 10, style.bgDanger);
badge.LOADED = createBadge('LOADED', 10, style.bgSuccess);
badge.DAFILE = createBadge('DA FILE', 10, style.bgSuccessDarkText);
badge.DEFAULT = createBadge('DEFAULT!', 10, style.bgNeutralDarkText);
badge.CONFIGFOUND = createBadge('CONFIG FOUND', 18, style.bgSuccess);
badge.CONFIGNOTFOUND = createBadge('CONFIG NOT FOUND', 18, style.bgDanger);
badge.INSTALLATO = createBadge('INSTAL.', 10, style.bgSuccess);
badge.NONINSTALLATO = createBadge('NONINST.', 10, style.bgDanger);

// #endregion

// #region sezioni

// SINTESI
async function printProblematiche(){
    //printTitolo('SINTESI', maxCols);

    if(config.isTosAccepted())
        console.log('  1) ' + style.success('Le condizioni di utilizzo sono state accettate.'));
    else{
        console.log('  1) ' + style.danger('Le condizioni di utilizzo non sono state ancora accettate.'));
        console.log('     ' + style.dim('Per accettarle: ') + style.highlight(`${config.nome} condizioni --accetta`));
    }

    const chromiumInstallato = await verificaChromiumInstallato();
    if(chromiumInstallato){
        console.log('  2) ' + style.success('Il browser Chromium per la login risulta installato.'));
    }else{
        console.log('  2) ' + style.danger('Il browser Chromium per la login non risulta installato.'));
        console.log('     ' + style.dim('Per installarlo: ') + style.highlight(`npx playwright install chromium`));
    }

    if(config.YAML.valid){
        console.log('  3) ' + style.success('Il file di configurazione esiste ed è formalmente valido.'));
        //console.log('     ' + style.success('(La configurazione è stata caricata dal file con successo)'));
    }
    else{
        if(config.YAML.found){
            console.log('  3) ' + style.danger('Il file di configurazione esiste ma presenta un problema.'));
            console.log('     ' + style.danger('Per conoscere il problema: ') + style.highlight(`${config.nome} profilo --yaml`));
        }
        else{
            console.log('  3) ' + style.danger('Il file di configurazione non esiste.'));
            console.log('     ' + style.dim('Per inizializzare il file yaml: ') + style.highlight(`${config.nome} profilo --init`));
            //console.log('     ' + style.warning('(La configurazione è stata caricata con i valori di default)'));
        }
    }

    const parametri = getParametri();
    const countProblemi = countProblemiSuParametri(parametri);
    //se il file yaml esiste
    if(config.YAML.found){
        //ed è valido
        if(config.YAML.valid){
            //console.log('  4) ' + style.success('Il file di configurazione esiste ed è valido.'));
            console.log('  4) ' + style.success('La configurazione è stata caricata dal file.'));
            if(countProblemi.defaults === 0){
                console.log('     ' + style.success('Tutti i parametri di configurazione provengono dal file.'));
            }else{
                console.log('     ' + style.warning(`${countProblemi.defaults} parametri di configurazione NON provengono dal file`));
            }
            if(countProblemi.nonvalidi === 0){
                console.log('     ' + style.success('Tutti i parametri di configurazione sono validi.'));
            }else{
                console.log('     ' + style.danger(`${countProblemi.nonvalidi} parametri di configurazione NON sono validi`));
            }
            if(countProblemi.defaults > 0 || countProblemi.nonvalidi > 0)
                console.log('     ' + style.dim('Lo strumento può avere capacità limitate a queste condizioni.'));
        }
        else{
            //console.log('  4) ' + style.warning('Il file di configurazione esiste ma non è valido.'));
            //console.log('     ' + style.warning('Sono stati caricati i valori di default.'));
            console.log('     ' + style.warning('La configurazione è stata caricata coi valori di default.'));
            //console.log('     ' + style.warning('Per valutare i suoi parametri, prima risolvere la validità.'));
            console.log('     ' + style.warning('Risolvere la validità del file yaml prima di valutarne i parametri.'));
            console.log('     ' + style.dim('Lo strumento ha capacità limitate a queste condizioni.'));
        }
    }
    else{
        //console.log('  4) ' + style.warning('Il file di configurazione non esiste.'));
        //console.log('     ' + style.warning('Sono stati caricati i valori di default.'));
        console.log('  4) ' + style.warning('La configurazione è stata caricata coi valori di default.'));
        console.log('     ' + style.dim('Lo strumento ha capacità limitate a queste condizioni.'));
    }
}

// 1) Condizioni
function printCondizioni(accettate = false){
    const colWidth = 21;
    const accettateStatus = (accettate) ? badge.PRESENTE : badge.ASSENTE;
    printTitolo('1) CONDIZIONI DI UTILIZZO', maxCols);
    console.log(`  Per la versione corrente (${style.highlight(config.version)}) di ${style.highlight(config.nome)},`);
    console.log(('  La chiave di accettazione delle condizioni è: ').padEnd(maxCols - colWidth) + accettateStatus);
}

// 2) Browser
async function printBrowser(){
    printTitolo('2) BROWSER CHROMIUM', maxCols);

    const installato = await verificaChromiumInstallato();
    const chromiumStatus = (installato) ?badge.INSTALLATO : badge.NONINSTALLATO ;
    const browserPath = (installato) ? chromium.executablePath() : '';

    const colWidth = 22;
    const pad = maxCols - colWidth;

    printConfigDetail('Il path del browser Chromium:', pad, chromiumStatus, browserPath, true);
}

// 3) Configuration
function printConfiguration(){

    const status = {};

    /*
    if(config.isEnvBaseDirNotSet()){
        status.variabileAmbiente = badge.NOTSET;
    }else{
        if(config.isEnvBaseDirSetAndNotFound()){
            status.variabileAmbiente = badge.FOUND;
        }else{
            status.variabileAmbiente = badge.NOTFOUND;
        }
    }
    */

    //Object.assign(values, getPercorsiProfilo());
    const percorsi = getPercorsiProfilo();

    status.basedir = badge.OK;/*( config.isEnvBaseDirSetAndNotFound() ) ? badge.FROMENV : badge.FALLBACK;*/
    status.configurationDirectory = ( config.isConfigDirFound() ) ? badge.FOUND : badge.NOTFOUND;

    status.yamlFound = (config.YAML.found) ? badge.FOUND : badge.NOTFOUND;
    status.yamlValid = (config.YAML.valid) ? badge.VALIDO : ( (config.YAML.found) ? badge.NONVALID : '' );
    status.yamlLoaded = (config.YAML.loaded) ? badge.LOADED : '';

    printTitolo('3) PATH CONFIGURAZIONE', maxCols);

    const colWidth = 22;
    const pad = maxCols - colWidth;

    //printConfigDetail('Il path di installazione:', pad, /*badge.OK*/'', config.getProjectDir());
    //printConfigDetail(`La var d'ambiente ${style.highlight(config.ambienteVarNome)}:`, pad, status.variabileAmbiente, config.getEnvBaseDir());
    //printConfigDetail(`La ${style.highlight('basedir profilo')} decisa dalle condizioni:`, pad, /*status.basedir*/'', percorsi.abbreviati.profiloDir);
    //printConfigDetail(`Il path ${style.highlight('config')}:`, pad, status.configurationDirectory, percorsi.abbreviati.configDir);
    //printConfigDetail(`Il path ${style.highlight('userdata')}:`, pad, badge.OK, config.getUserDataDir());
    printConfigDetail(`Il file di configurazione ${style.highlight('.yaml')}:`, pad, `${status.yamlFound} ${status.yamlValid}`, percorsi.completi.configFile, true);

}

// 4) Parametri
function printParametri(){

    printTitolo('4) PARAM. CONFIGURAZIONE', maxCols);

    switch(config.loaded.type){
        case 'empty':
            console.log('  Non è stato trovato il file di configurazione o non è valido.');
            console.log('  Sono quindi stati caricati i valori di default per tutti i parametri.');
            break;
        case 'yaml':
            console.log('  Il file di configurazione è stato caricato con successo.');
            console.log();
            console.log('  Seguono i valori dei parametri ' + style.comment('*se assenti nel file hanno valore default'));
            break;
        default:
    }

    console.log();

    const parametri = getParametri();
    console.log(' ' + style.dim('-'.repeat(maxCols-1)));
    const pObjects = Object.keys(parametri);
    pObjects.forEach( (nomeParametro, i) => {

            function provenienzaParametroBadge(chiave){
                return (config.isKeyOnFile(chiave)) ? badge.DAFILE : badge.DEFAULT;
            }

            let key = (style.highlight(nomeParametro) + ':');
            key += ' '.repeat( maxCols - 22 - 2 - stringWidth(key) );
            const value = style.dim(config.get(nomeParametro));
            const sourceBadge = provenienzaParametroBadge(nomeParametro);
            let validBadge;
            if ('default' in parametri[nomeParametro])
                validBadge = parametri[nomeParametro].default;
            else
                validBadge = (parametri[nomeParametro].isValid(config.get(nomeParametro))) ? badge.VALIDO : badge.NONVALID;
            console.log(`  ${key} ${sourceBadge} ${validBadge}`);
            console.log('  ' + value);
            console.log('');
            console.log(style.comment(parametri[nomeParametro].comment.split('\n').map(line => '  ' + line).join('\n')));
            if(i < pObjects.length - 1 )
                console.log(' ' + style.dim('-'.repeat(maxCols-1)));
        });
}

// #endregion

// #region print helpers

function printBox(content, width, paddingLeft = 1){
    const borderTL = style.dim('╔');
    const borderTR = style.dim('╗');
    const borderBL = style.dim('╚');
    const borderBR = style.dim('╝');
    const borderH  = style.dim('═');
    const borderV  = style.dim('║');

    console.log(borderTL + borderH.repeat(width+paddingLeft*2) + borderTR);
    const contentFramed = content.split('\n').map( line => borderV + ' '.repeat(paddingLeft) + line + ' '.repeat(width-stringWidth(line)) + ' '.repeat(paddingLeft) + borderV).join('\n');
    console.log(contentFramed);
    console.log(borderBL + borderH.repeat(width+paddingLeft*2) + borderBR);
}

function printTitolo(title, width){
    //console.log(style.neutral.bold('-') + style.bgNeutral(` ${title} `) + style.neutral.bold('-'.repeat(width-title.length-2-1)));

    const borderL = style.highlight.bold('[');
    const borderR = style.highlight.bold(']');
    const left = style.white(` ${borderL}${style.white.bold.dim(title/*.padEnd(25)*/)} ${borderR}`);

    console.log(left + style.dim('='.repeat(width-stringWidth(title)-5)) );
    //console.log(left + style.dim('='.repeat(width-25-5)) );
    console.log('');
}

function printConfigDetail(label, width, badge, value, newline = false){
    const leftPad = '  ';
    const labelFormatted =  leftPad + label + ' '.repeat(width - stringWidth(label) - leftPad.length);
    console.log(`${labelFormatted} ${badge}`);
    if(newline)
        console.log('');
    console.log(`${leftPad}${style.dim(value)}`);
    console.log('');
}

function printPercorsiProfilo(){
    const percorsi = getPercorsiProfilo();

    function stylePath(path){
        const index = path.indexOf('>') + 1;
        const baseDir = path.substring(0, index);
        const restOfPath = path.substring(index);

        const styledBaseDir = style.neutral(baseDir);
        const styledRestOfPath = style.dim(restOfPath);

        return styledBaseDir + styledRestOfPath;
    }

    const lines = [];
    lines.push(style.highlight('Profili (basedir)') + ': ' + stylePath(percorsi.completi.basedir));
    lines.push(style.highlight('Profilo corrente') + ': ' + stylePath(percorsi.abbreviati.profiloDir));
    lines.push(style.highlight('File di config') + ': ' + stylePath(percorsi.abbreviati.configFile));

    /*
    console.log();
    console.log(' ' + style.highlight('Profili') + ': ' + stylePath(percorsi.completi.basedir));
    console.log(' ' + style.highlight('Profilo corrente') + ': ' + stylePath(percorsi.abbreviati.profiloDir));
    console.log(' ' + style.highlight('File di config') + ': ' + stylePath(percorsi.abbreviati.configFile));
    console.log();
    */
    printBox(lines.join('\n'), 78-4);

    return percorsi;

}

// #endregion

// #region helpers

function isValidUrl(urlString) {
    try {
        new URL(urlString);
        return true;
    } catch (e) {
        return false;
    }
}

function getParametri(){
    return {
        'login.url':                {
            isValid: isValidUrl,
            comment: `(es.: ${chalk.dim('https://nomesito/')})\n\nViene visitato per eseguire il login sul portale (comando login).\nSe inesatto, le api non sono interrogabili.`
        },
        'cartellino.url' :          {
            isValid: isValidUrl,
            comment: `(es.: ${chalk.dim('https://nomesito/rpc/Cartellino.aspx')})\n\nViene interrogato per conoscere le timbrature (comando fetch).\nSe inesatto, il comando funziona solo quando cache.`
        },
        'rubrica.url':              {
            isValid: isValidUrl,
            comment: `(es.: ${chalk.dim('https://nomesito/rpc/Rubrica.aspx')})\n\nViene interrogato per conoscere le voci rubrica (comandi rubrica ed elenco).\nSe inesatto, il comando rubrica NON funziona mai\ne il comando elenco solo quando cache.`
        },
        'preferiti.url':            {
            isValid: isValidUrl,
            comment: `(es.: ${chalk.dim('https://nomesito/rpc/Preferiti.aspx')})\n\nViene interrogato per leggere e modificare i preferiti (comando preferiti).\nSe inesatto, il comando NON funziona mai.`
        },
        'login.headless':           {
            isValid: (value)=>{return typeof value === 'boolean';},
            comment: 'Un valore true/false\nche nasconde/mostra la finestra del browser durante login.'
        },
        'login.timeoutSeconds':     {
            isValid: (value)=>{return typeof value === 'number' && value > 1 && value < 300;},
            comment: 'È il tempo max (sec) che la login attende per conoscere il token 2FA.\nSe inesatto la login non funziona.',
        },
        'login.landingPage':        {
            default: '',
            /*isValid: (value)=>{return true;},*/
            comment: 'È l\'indirizzo (glob pattern) della pagina dopo login.\nSe inesatto la login non funziona.'
        },
        'login.username':           {
            default: ''/*styleIndifferente(' INDIFFERENTE ')*/,
            comment: 'La username per automatizzare il processo di login.\nSe il valore è vuoto, viene richiesta al momento dell\'azione.'
        },
        'login.password':           {
            default: ''/*styleIndifferente(' INDIFFERENTE ')*/,
            comment: 'La password per automatizzare il processo di login.\nSe il valore è vuoto, viene richiesta al momento dell\'azione.'
        },
        'rubrica.gruppi':{
            default: ''/*styleIndifferente('   SCOPRILO   ')*/,
            comment: 'È un oggetto che mappa i dipendenti in un albero organizzato a gruppi.\nI gruppi possono contenere id dipendente e altri gruppi a loro volta.\nServe al comando rubrica con l\'opzione --gruppo.'
        },
        'cartellino.minutiPresenzaRichiesti' :{
            isValid: (value)=>{return (typeof value === 'number' && value >= 240 && value <= 600)},
            comment: `(es.: ${chalk.dim('432 -corrispondenti a 7.12')})\n\nIl numero di minuti richiedo in una giornata lavorativa`
        },
        'cartellino.minutiPausaPranzoObbligatoria' :{
            isValid: (value)=>{return (typeof value === 'number' && value >= 0 && value <= 180)},
            comment: `(es.: ${chalk.dim('30')})\n\nIl numero di minuti richiesto per la pausa pranzo obbligatoria`
        }
    };
}

function countProblemiSuParametri(parametri){
    let problemi = { nonvalidi: 0, defaults: 0};
    Object.keys(parametri)
        .forEach(nome => {
            const p = parametri[nome];
            if(!config.isKeyOnFile(nome))
                problemi.defaults += 1;
            //se esiste una funzione di validazione per il parametri
            if (p.isValid)
                //se il valore del parametro ha errore di validazione
                if (!p.isValid(config.get(nome)))
                    problemi.nonvalidi += 1;
        })
    return problemi;
}

function getPercorsiProfilo(){

    const profiloDir = config.getBaseDir();
    const basedir = path.dirname(profiloDir);
    const configDir = config.getConfigDir();
    const configFile = config.YAML.path;

    const AbbrProfiloDir = profiloDir.replace(basedir, '<profili>');
    const AbbrConfigDir = configDir.replace(profiloDir, '<profilo>');
    const AbbrConfigFile = configFile.replace(profiloDir, '<profilo>');

    return {
        abbreviati: {
            profiloDir: AbbrProfiloDir,
            configDir: AbbrConfigDir,
            configFile: AbbrConfigFile
        },
        completi:   { basedir, profiloDir, configDir, configFile }
    };
}

async function verificaChromiumInstallato() {
    try {
      const browser = await chromium.launch();
      await browser.close();
      return true;
    } catch (error) {
        return false;
        if (error.message.includes('browserType.launch: Failed to launch')) {
            console.log('Chromium non è installato.');
        } else {
            console.log('Errore durante il lancio di Chromium:', error.message);
        }
    }
}

// #endregion

// #region commands

export async function commandShowInfo(dettagli = false){

    printHeader(maxCols);
    printPercorsiProfilo();

    console.log('-'.repeat(maxCols));
    console.log(style.titolo(' Situazione del profilo:'));
    console.log('-'.repeat(maxCols));

    console.log();
    await printProblematiche();
    console.log();
    console.log('-'.repeat(maxCols));
    if(dettagli)
        console.log(' Per una vista sintetica senza dettagli, usare: ' + style.highlight(`${config.nome} profilo`));
    else
        console.log(' Per esplodere i punti della sintesi, usare: ' + style.highlight(`${config.nome} profilo --dettagli`));
    console.log('-'.repeat(maxCols));
    console.log();
    if(dettagli){
        console.log(' Seguono i dettagli della sintesi:\n');
        printCondizioni(config.isTosAccepted());
        console.log();
        await printBrowser();
        printConfiguration();
        printParametri();
        console.log('-'.repeat(maxCols));
    }
}

export async function commandInitConfig(){

    const question = [
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Continuare con l\'operazione?',
          default: false,
        },
    ];

    printHeader(maxCols);
    printPercorsiProfilo();

    console.log('-'.repeat(maxCols));
    console.log(style.titolo(' Profilo - Inizializza Configurazione:'));
    console.log('-'.repeat(maxCols));

    if(config.YAML.found){
        console.log(' Esiste già un file di configurazione. Ne verrà fatto un backup.');
        console.log(' Poi sarà sostituito da un nuovo file con i valori di default.\n')
        const answers = await inquirer.prompt(question);
        if (answers.proceed) {
            const configPaths = config.resetConfiguration({ makeBackup: true });
            console.log();
            console.log(' Il nuovo file ha sostituito il precedente.');
            const backupPath = configPaths.backupPath;
            const backupDir =  path.dirname(backupPath);;
            const backupFilename = path.basename(backupPath);
            console.log(` Il backup si trova nella dir: ${style.dim(backupDir)}`);
            console.log(` Il filename del backup è: ${style.dim(backupFilename)}`);
            console.log('-'.repeat(maxCols));
            return;
        }
        //se la risposta è no
        else {
            console.log();
            console.log(' Operazione annullata.');
            console.log('-'.repeat(maxCols));
            return;
        }
    }
    else{
        console.log(' Verrà creato un file di configurazione con i valori di default.\n');
        const answers = await inquirer.prompt(question);
        if (answers.proceed) {
            config.resetConfiguration({ makeBackup: true });
            console.log();
            console.log(` Il file è stato creato.`);
            console.log('-'.repeat(maxCols));
            return;
        }
        //se la risposta è no
        else {
            console.log();
            console.log(' Operazione annullata.');
            console.log('-'.repeat(maxCols));
            return;
        }
    }
}

export async function commandCreaProfilo(nomeprofilo){

    printHeader(maxCols);
    printPercorsiProfilo();

    console.log('-'.repeat(maxCols));
    console.log(style.titolo(' Crea Profilo:'));
    console.log('-'.repeat(maxCols));

    try{
        const path = config.creaNuovoProfilo(nomeprofilo);
        console.log((' Il nuovo profilo è stato creato:'));
        console.log(' ' + chalk.dim(path));
        console.log();
        console.log(' Per scegliere questo nuovo profilo:');
        console.log(' ' + style.highlight(`${style.highlight(config.nome)} profilo --cambia ${nomeprofilo}`));
    }
    catch(e){
        console.log((' Il profilo scelto o non è valido o esiste già, quindi non può essere creato.'));
    }

    console.log('-'.repeat(maxCols));
    /*
    console.log(' Per creare un nuovo profilo, usare: ' + style.highlight(`${config.nome} profilo --crea <nomeprofilo>`));
    console.log(' Per cambiare profilo, usare: ' + style.highlight(`${config.nome} profilo --cambia <nomeprofilo>`));
    console.log('-'.repeat(maxCols));
    */
}

export async function commandCambiaProfilo(nomeprofilo){

    printHeader(maxCols);
    printPercorsiProfilo();

    console.log('-'.repeat(maxCols));
    console.log(style.titolo(' Cambia Profilo:'));
    console.log('-'.repeat(maxCols));

    try{
        if(config.profileName == nomeprofilo){
            console.log(` Il profilo scelto ${style.highlight(config.profileName)} era già quello selezionato.`);
        }
        else{
            const path = config.cambiaProfilo(nomeprofilo);
            console.log(` Il profilo corrente ora punta su: ${chalk.dim(path)}`);
        }
    }
    catch(e){
        console.log(' Il profilo scelto o non è valido o non esiste,\n quindi non può essere selezionato.');
        console.log();
        console.log(' Per crearlo prima, usare: ' + style.highlight(`${style.highlight(config.nome)} profilo --crea ${nomeprofilo}`));
    }
    console.log('-'.repeat(maxCols));
    console.log(' Per vedere lista dei profili, usare: ' + style.highlight(`${config.nome} profilo --lista`));
    console.log('-'.repeat(maxCols));
}

export async function commandListaProfili(){

    printHeader(maxCols);
    printPercorsiProfilo();

    console.log('-'.repeat(maxCols));
    console.log(style.titolo(' Lista Profili:'));
    console.log('-'.repeat(maxCols));

    const percorsi = getPercorsiProfilo();
    const profili = config.listaProfili();

    for(let profilo of profili){
        //qui mi sono accollato l'onere di sapere che la config sta in ./config/configuration.yaml e non sto usando path.join!! argh!
        const configFile = `${percorsi.completi.basedir}/${profilo}/config/configuration.yaml`;
        const specificYaml = config.loadYamlConfiguration(configFile);
        const statusFound = (specificYaml.found) ? badge.CONFIGFOUND : badge.CONFIGNOTFOUND;
        let statusValid = (specificYaml.valid) ? badge.VALIDO : badge.NONVALID;
        if(!specificYaml.found) statusValid = '';
       //44
        console.log(' ' + `${style.neutral('<profili>')}${style.dim('/'+profilo.padEnd(32+5,' '))} ${statusFound} ${statusValid}`);
    }
    console.log('-'.repeat(maxCols));
    console.log(' Per creare un nuovo profilo, usare: ' + style.highlight(`${config.nome} profilo --crea <nomeprofilo>`));
    console.log(' Per cambiare profilo, usare: ' + style.highlight(`${config.nome} profilo --cambia <nomeprofilo>`));
    console.log('-'.repeat(maxCols));
}

export async function commandShowYamlProblems(){

    printHeader(maxCols);
    printPercorsiProfilo();

    console.log('-'.repeat(maxCols));
    console.log(style.titolo(' Profilo - Validità file di configurazione:'));
    console.log('-'.repeat(maxCols));

    if(config.YAML.valid){
        console.log(' Il file di configurazione yaml ' + style.success('non ha problemi') + ' di validazione formale.');
        console.log('-'.repeat(maxCols));
        console.log(' Per verificarne i parametri, usare: '+ style.highlight(`${config.nome} profilo --dettagli`));
        console.log('-'.repeat(maxCols));
    }
    else{
        if(config.YAML.found){
            console.log(style.danger(' Il file di configurazione presenta un problema.'));
            console.log();
            console.log(' Seguono i dettagli:');
            console.log();
            const error = config.YAML.error.split('\n').map( line => ' ' + line ).join('\n');
            console.log(style.dim(error));
            console.log('-'.repeat(maxCols));
        }else{
            console.log(style.danger(' Il file di configurazione non esiste.'));
            console.log('-'.repeat(maxCols));
            console.log(' Per inizializzare il file yaml: ' + style.highlight(`${config.nome} profilo --init`));
            console.log('-'.repeat(maxCols));
        }
    }
}

export async function commandSetUrls(nomesito){

    printHeader(maxCols);
    printPercorsiProfilo();

    console.log('-'.repeat(maxCols));
    console.log(style.titolo(' Profilo - Imposta api url:'));
    console.log('-'.repeat(maxCols));

    const regex = /^([a-zA-Z0-9-]+)\.([a-zA-Z0-9-]+)(\.[a-zA-Z]{2,11})?$/;
    if(!regex.test(nomesito)){
        console.log(` Il nome sito ${style.highlight(nomesito)} non è valido.`);
        console.log(` Un nome valido può essere invece: ${style.highlight('presenze.sito.it')}`);
        console.log('-'.repeat(maxCols));
        return;
    }

    function printUrlsReplaced(nomesito){
        console.log(` ${style.highlight('login.url')}: ${style.dim('https://') + style.neutral(nomesito) + style.dim('/')}`);
        console.log(` ${style.highlight('cartellino.url')}: ${style.dim('https://') + style.neutral(nomesito) + style.dim('/rpc/Cartellino.aspx')}`);
        console.log(` ${style.highlight('rubrica.url')}: ${style.dim('https://') + style.neutral(nomesito) + style.dim('/rpc/Rubrica.aspx')}`);
        console.log(` ${style.highlight('preferiti.url')}: ${style.dim('https://') + style.neutral(nomesito) + style.dim('/rpc/Preferiti.aspx')}`);
        console.log();
    }

    const question = [
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Continuare con l\'operazione?',
          default: false,
        },
    ];

    if(config.YAML.found){

        console.log(' Esiste già un file di configurazione. Ne verrà fatto un backup.');
        console.log(' Il file sarà poi sostituito da quello nuovo.')
        console.log(' Il nuovo file avrà gli stessi valori ma le url personalizzate.\n')

        printUrlsReplaced(nomesito);

        const answers = await inquirer.prompt(question);
        if (answers.proceed) {
            const configPaths = config.setUrls(nomesito);
            console.log();
            console.log(` Il nuovo file ha sostituito il precedente.`);
            const backupPath = configPaths.backupPath;
            const backupDir =  path.dirname(backupPath);
            const backupFilename = path.basename(backupPath);
            console.log(` Il backup si trova nella dir: ${style.dim(backupDir)}`);
            console.log(` Il filename del backup è: ${style.dim(backupFilename)}`);
            console.log('-'.repeat(maxCols));
            return;
        }
        //se la risposta è no
        else {
            console.log();
            console.log(' Operazione annullata.');
            console.log('-'.repeat(maxCols));
            return;
        }
    }
    else{
        console.log('Non esiste ancora un file di configurazione.');
        console.log('Prima di personalizzare gli url, creare un file di configurazione del profilo.');
        console.log('Per crearne uno con i valori di default, usare: ' + style.highlight(`${config.nome} profilo --init`));
        console.log('-'.repeat(maxCols));
    }
}

export async function commandCheckUrls(){

    async function checkResponseStatus(url) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            return response.status;
          } else {
            return response.status;
          }
        } catch (error) {
            return false;
        }
    }

    printHeader(maxCols);
    printPercorsiProfilo();

    console.log('-'.repeat(maxCols));
    console.log(style.titolo(' Profilo - Test interrogazione api url:'));
    console.log('-'.repeat(maxCols));

    const urlsName = ['login.url', 'cartellino.url', 'rubrica.url', 'preferiti.url'];

    for(const urlName of urlsName) {
        const url = config.get(urlName);
        let responseCode = await checkResponseStatus(url);
        if(responseCode === false){
            responseCode = style.danger.bold('ERR');
        }
        else if(responseCode == 200){
            responseCode = style.success.bold(responseCode + ' OK!');
        }
        else{
            responseCode = style.warning.bold(responseCode);
        }
        console.log(` ${style.highlight(urlName)}: ${style.dim(url)} => ${responseCode}`);
    }

    console.log('-'.repeat(maxCols));

}

// #endregion