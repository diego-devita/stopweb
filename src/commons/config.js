import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import yaml from 'js-yaml';

import { getNowTimestamp, isDateToday, isDateYesterday } from './date.js';

import { MissingLoginError } from '../commons/errors.js';

import { load, change } from './profile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Config {

    /**
     *  .nome
     *  .version
     *  .releaseDate
     *  .chiaveTOS
     *
     *  .profiloPath
     *  .cursoreProfilo
     *  .profileName
     *
     *  .YAML = {
     *      type: 'yaml',
     *      path: this.configPath/configuration.yaml
     *      found:
     *      loaded:
     *      valid:
     *      attempted:
     *      error:
     *      data:
     *  };
     *
     *  ._config        //oggetto configurazione (YAML.data) o {}
     *  .loaded         //punta a .YAML (se caricato) o {type: 'empty', data: {}};
     *
     */

    globalDump = {};

    loadCurrentProfiloPath(profiliBaseDirInfo){

        //carica le variabili d'ambiente eventualmente presenti nel file env (usando profile.js)
        //ma da la priorità alle stesse variabili d'ambiente reali se sono settate
        const ambiente = load();

        //determina profiliBaseDir
        //se non è settato su var ambiente, usa il valore di default
        let profiliBaseDir = ambiente[profiliBaseDirInfo.ENV_VAR_NAME];
        if(!profiliBaseDir) profiliBaseDir = profiliBaseDirInfo.DEFAULT_PROFILI;

        function resolveRelativePath(pathToResolve, basedir){
            let resolvedPath = '';
            if (!path.isAbsolute(pathToResolve) ){
                //se il path è rispetto alla home dir
                if(pathToResolve.startsWith('~')) {
                    resolvedPath = path.join(os.homedir(), pathToResolve.slice(1));
                }else{
                    //se però basedir è undefined, solleva un'eccezione se il pathToResolve è relativo
                    if(!basedir)
                        throw new Error('Il path ${profiliBaseDir} non può essere relativo!');
                    //Risolve il path rispetto a basedir (passare this.getProjectDir() a basedir per risolvere rispetto a dir progetto)
                    resolvedPath = path.resolve(basedir, pathToResolve);
                }
            }
            return resolvedPath;
            //return {pathToResolve, resolvedPath};
        }

        //path risolto dei profili
        const profiliPath = resolveRelativePath(profiliBaseDir);
        //path del file profilo selezionato
        const fileProfiloSelezionatoPath = path.join(profiliPath, profiliBaseDirInfo.PROFILO_SELEZIONATO);
        //path del default profilo
        const defaultProfiloPath = path.join(profiliPath, profiliBaseDirInfo.DEFAULT_PROFILO);
        //path del profilo selezionato (che è quello che ci interessa alla fine dei giochi)
        let profiloPath;

        function esisteProfili(){ return fs.existsSync(profiliPath); }
        function esisteProfiloDefault(){ return fs.existsSync(defaultProfiloPath); }
        function esisteFileProfiloSelezionato(){ return fs.existsSync(fileProfiloSelezionatoPath); }
        function creaDirProfiliDefault(){ fs.mkdirSync(profiliPath, { recursive: true }); }
        function creaDirProfiloDefault(){ fs.mkdirSync(defaultProfiloPath, { recursive: true }); }
        function creaFileProfiloDefaultSelezionato(){ fs.writeFileSync(fileProfiloSelezionatoPath, profiliBaseDirInfo.DEFAULT_PROFILO); }
        function leggiFileProfiloSelezionato(){ return fs.readFileSync(fileProfiloSelezionatoPath, 'utf-8'); }

        //se non esiste la dir dei profili
        if(!esisteProfili()){
            //crea la dir profili
            creaDirProfiliDefault();
            //crea la dir profilo default
            creaDirProfiloDefault();
            //crea il file profilo selezionato (punta a profilo default)
            creaFileProfiloDefaultSelezionato();
            profiloPath = defaultProfiloPath;
        }
        //se esiste la dir dei profili
        else{
            //se non esiste il file profilo selezionato
            if(!esisteFileProfiloSelezionato()){
                //crea il file profilo selezionato (punta a profilo default)
                creaFileProfiloDefaultSelezionato();
                //se non esiste il profilo default
                if(!esisteProfiloDefault())
                    //crea il profilo default
                    creaDirProfiloDefault();
                profiloPath = defaultProfiloPath;
            }
            //se esiste il file profilo selezionato
            else{
                const profiloSelezionato = leggiFileProfiloSelezionato(fileProfiloSelezionatoPath);
                const profiloSelezionatoValido = this.isNomeProfiloValido(profiloSelezionato);
                //se contiene un nome profilo non valido
                if(!profiloSelezionatoValido){
                    //sovrascrive il file profilo selezionato (punta a profilo default)
                    creaFileProfiloDefaultSelezionato();
                    //se non esiste il profilo default
                    if(!esisteProfiloDefault())
                        //crea il profilo default
                        creaDirProfiloDefault();
                    profiloPath = defaultProfiloPath;
                }
                //se contiene un nome profilo valido
                else{
                    profiloPath = path.join(profiliPath, profiloSelezionato);
                    //se non esiste il profilo selezionato
                    if(!fs.existsSync(profiloPath))
                        //crea il profilo selezionato
                        fs.mkdirSync(profiloPath, { recursive: true });
                }
            }
        }

        return profiloPath;
    }

    constructor(nome, version, releaseDate, chiaveTOS, profiliBaseDir) {

        if (!Config.instance) {

            if(!profiliBaseDir
                || !profiliBaseDir.ENV_VAR_NAME
                || !profiliBaseDir.DEFAULT_PROFILI
                || !profiliBaseDir.DEFAULT_PROFILO
                || !profiliBaseDir.PROFILO_SELEZIONATO
            )
                throw new Error('Config è stato istanziato con un oggeto profiliBaseDir non valido');
            if(!version || !version.match(/^(\d+)\.(\d+)\.(\d+)$/) )
                throw new Error(`Config è stato istanziato con una versione non valida: ${version}`);
            if(!chiaveTOS || chiaveTOS.length !== 32)
                throw new Error(`Config è stato istanziato con una chiave TOS non valida: ${chiaveTOS}`);

            /**
             * Determina il percorso del profilo corrente.
             *
             * Che dipende intanto dalla dir profili che...
             * Se settata vale la variabile d'ambiente ENV_VAR_NAME,
             * Altrimenti la variabile d'ambiente ENV_VAR_NAME dal file env,
             * Altrimenti il valore di default DEFAULT_PROFILI.
             *
             * Poi dipende dal profilo scritto nel file in DirProfili/PROFILO_SELEZIONATO
             */
            this.profilePath = this.loadCurrentProfiloPath(profiliBaseDir);
            this.cursoreProfilo = profiliBaseDir.PROFILO_SELEZIONATO;
            this.profileName = path.basename(this.profilePath);

            this.nome = nome;
            this.releaseDate = releaseDate;
            this.version = version;
            this.chiaveTOS = chiaveTOS;

            //prova a caricare la configurazione dallo yaml e si segna l'oggetto configurazione ricevuto
            //se lo yaml esiste ed è valido, l'oggetto è lo yaml {type: 'YAML' ...} altrimenti è un oggetto {type: 'empty', data: {}}
            //l'effetto collaterale è che this.YAML conservi tutte le informazioni dello YAML (che sia stato trovato o no, valido o meno)
            this.loaded = this._loadConfiguration();

            //contrassegna l'oggetto ricevuto come loaded (che se era lo YAML, ora this.YAML.loaded = true)
            this.loaded.loaded = true;

            //si segna i dati della configurazione caricata in this._config
            this._config = this.loaded.data;

            this.loadStatoEventi();

            Config.instance = this;
        }
        return Config.instance;
    }

    getInstance() {
        return Config.instance;
    }

    loadYamlConfiguration(path){

        const loadYaml = function(configPath){
            const configData = fs.readFileSync(configPath, 'utf8');
            return yaml.load(configData);
        };

        const config = {
            type: 'yaml',
            path: path,
            found: false,
            loaded: false,
            valid: false,
            attempted: false,
            error: undefined,
            data: undefined
        };

        if(fs.existsSync(path)){
            config.found = true;
            try{
                config.attempted = true;
                config.data = loadYaml(path);
                config.valid = true;
            }catch(e){
                config.valid = false;
                config.error = e.message;
            }
        }

        return config;
    }

    _loadConfiguration() {

        const yamlPath = path.join(this.getConfigDir(), 'configuration.yaml');
        const config = this.loadYamlConfiguration(yamlPath);

        this.YAML = config;

        //se lo yaml era valido
        if(config.valid)
            //ritorna l'oggetto
            return config;
        else
            //altrimenti ritorna un oggetto che rappresenti una configurazione vuota
            return {type: 'empty', data: {}};
    }

    _saveConfiguration(config) {

        function replaceUndefinedWithNull(obj) {
            Object.keys(obj).forEach(key => {
                if (obj[key] === undefined) {
                    obj[key] = null;
                }
                else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    replaceUndefinedWithNull(obj[key]);
                }
            });
            return obj;
        }

        replaceUndefinedWithNull(config);
        const yamlStr = yaml.dump(config);
        const filePath = `${this.getConfigDir()}/configuration.yaml`;

        fs.writeFileSync(filePath, yamlStr);

        return filePath;
    }

    _getDefaults() {
        return {
            //url necessario e obbligatorio per il comando login
            //quindi l'utilizzo di presenza funzionerebbe finchè i cookie non scadono
            'login.url': undefined,
            //url necessario e obbligatorio per il comando fetch (quando non è coinvolta la cache)
            //fetch utilizza cache ma solo quando:
            //  gli intervalli richiesti sono tutti in cache
            //  nell'intervallo c'è oggi ed è stata usata l'opzione todayNoRefetch
            //  in generale non è stata usata l'opzione nocache, o è stata usata l'opzione cacheonly
            'cartellino.url': undefined,
            //url necessario e obbligatorio per il comando rubrica e elenco
            //rubrica NON utilizza cache
            'rubrica.url': undefined,
            //url necessario e obbligatorio per il comando preferiti
            //preferiti NON utilizza cache
            'preferiti.url': undefined,

            //parametri opzionali che vanno a default per garantire il funzionamento anche in caso di assenza nel config
            'login.timeoutSeconds': 60,
            'login.landingPage': '**/default.aspx*',
            'login.headless': true,
            'login.username': undefined,
            'login.password': undefined,

            'cartellino.minutiPresenzaRichiesti': 432,
            'cartellino.minutiPausaPranzoObbligatoria': 30,

            'rubrica.gruppi': {},
        }
    }

    isKeyOnFile(key){
        if (key in this._config)
            return true;
        else if(key in this._getDefaults())
            return false;
        else
            throw new Error(`La chiave ${key} non esiste nella configurazione.`);
    }

    get(key) {
        if (key in this._config)
            return this._config[key];
        else if(key in this._getDefaults())
            return this._getDefaults()[key];
        else
            throw new Error(`La chiave ${key} non esiste nella configurazione.`);
    }

    backupConfiguration(){

        function getCurrentTimestampWithMillis() {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
            return `${year}${month}${day}_${hours}${minutes}${seconds}${milliseconds}`;
        }

        if(this.YAML.found){
            const filenameBackup = 'BKP_' + getCurrentTimestampWithMillis() + '_configuration.yaml'
            const pathBackup = path.join(this.getConfigDir(), filenameBackup);
            fs.copyFileSync(this.YAML.path, pathBackup);
            return pathBackup;
        }

        return false;
    }

    resetConfiguration({ config, makeBackup = true }){
        //fs.rmSync(this.getConfigDir(), { recursive: true, force: true });
        const existedAlready = this.createPathIfDoesntExist( this.getConfigDir() );
        let backupPath;
        if(makeBackup){
            backupPath = this.backupConfiguration();
        }
        let filePath;
        if(config){
            filePath = this._saveConfiguration(config);
        }else{
            const defaultConfig = this._getDefaults();
            filePath = this._saveConfiguration(defaultConfig);
        }
        return { filePath, backupPath } //backupPath può essere undefined, false o una stringa
    }

    acceptTos(version){
        if(!version)
            version = this.version;
        if (!version.match(/^(\d+)\.(\d+)\.(\d+)$/))
            return false;
        const filename = version.replace(/\./g, "_");
        const tosDir = this.getTosDir();
        const tosFilePath = path.join(tosDir, filename);
        this.createPathIfDoesntExist( tosDir );
        fs.writeFileSync(tosFilePath, this.chiaveTOS);
        return true;
    }

    setUrls(nomesito){

        const regex = /^([a-zA-Z0-9-]+)\.([a-zA-Z0-9-]+)(\.[a-zA-Z]{2,11})?$/;
        if(!regex.test(nomesito))
            return false;

        this._config['login.url'] = `https://${nomesito}/`;
        this._config['cartellino.url'] = `https://${nomesito}/rpc/Cartellino.aspx`;
        this._config['rubrica.url'] = `https://${nomesito}/rpc/Rubrica.aspx`;
        this._config['preferiti.url'] = `https://${nomesito}/rpc/Preferiti.aspx`;

        return this.resetConfiguration({ config: this._config, makeBackup: true });
    }

    isTosAccepted(version){
        if(!version)
            version = this.version;
        if (!version.match(/^(\d+)\.(\d+)\.(\d+)$/))
            return false;
        const filename = version.replace(/\./g, "_");
        const tosFile = path.join(this.getTosDir(), filename);
        if (!fs.existsSync(tosFile))
            return false;
        const content = fs.readFileSync(tosFile, 'utf8');
        return content === this.chiaveTOS;
    }

    // #region path related

    /*
    getEnvBaseDir(){
        return process.env[this.ambienteVarNome];
    }

    isEnvBaseDirNotSet(){
        if(this.getEnvBaseDir())
            return false;
        else
            return true;

    }

    isEnvBaseDirSetAndNotFound(){
        if(this.getEnvBaseDir() && fs.existsSync(this.getEnvBaseDir()))
            return true;
        else
            return false;
    }
    */

    isConfigDirFound(){
        return fs.existsSync(this.getConfigDir());
    }

    // PROJECTDIR - $projectDir - dir dove risiede lo script
    getProjectDir(){
        //return `${__dirname}/../..`;
        return path.resolve(__dirname, '..', '..');
    }

    // PROFILO/ - $basedir usata per ./userdata e ./config e ./tos
    getBaseDir(){
        return this.profilePath;
    }

    // PROFILO/USERDATA/ - $userdata - $basedir/userdata
    getUserDataDir(){
        return path.join(this.getBaseDir(), 'userdata');
    }

    // PROFILO/CONFIG/ - $config - $basedir/config
    getConfigDir(){
        return path.join(this.getBaseDir(), 'config');
    }

    // PROFILO/TOS/ - $tos - $basedir/tos
    getTosDir(){
        return path.join(this.getBaseDir(), 'tos');
    }

    // PROFILO/USERDATA/[DOMAIN]/ - $userdata/$domain
    getPathByDomain({ domain = '' } = {}){
        return path.join(this.getUserDataDir(), domain);
    }

    // PROFILO/USERDATA/[DOMAIN]/ - $userdata/$domain
    domainExists({ domain } = {}){
        const basedir = this.getPathByDomain({ domain });
        return fs.existsSync(basedir);
    }

    createPathIfDoesntExist(dirpath){
        if (!fs.existsSync(dirpath)){
            fs.mkdirSync(dirpath, { recursive: true });
            return true;
        }
        return false;
    }

    // #endregion

    // #region getter/setter ./[domain]/[name]

    setContent(domain, name, content, append = false){
        const basedir = this.getPathByDomain({ domain });
        this.createPathIfDoesntExist(basedir);
        const file = path.join(basedir, name);
        if(append)
            fs.appendFileSync(file, content, 'utf8');
        else
            fs.writeFileSync(file, content, 'utf8');
    }

    getContent(domain, name){
        const basedir = this.getPathByDomain({ domain });
        const file = path.join(basedir, name);
        return fs.readFileSync(file, 'utf8');
    }

    // #endregion

    // #region getter/setter ./cache/giornate

    setGiornate(giornate){
        this.setContent('cache', 'giornate', giornate);
    }

    getGiornate() {
        return this.getContent('cache', 'giornate');
    }

    // #endregion

    // #region getter/setter ./cache/elenco

    setElenco(elenco){
        this.setContent('cache', 'elenco', elenco);
    }

    getElenco() {
        return this.getContent('cache', 'elenco');
    }

    // #endregion

    // #region getter/setter ./auth/cookie

    setCookieHeader(cookieHeader) {
        this.setContent('auth', 'cookie', cookieHeader);
    }

    getCookieHeader() {
        try{
            return this.getContent('auth', 'cookie');
        }catch(e){
            throw new MissingLoginError();
        }
    }

    // #endregion

    // #region getter/setter ./auth/id_dipendente

    setIdDipendente(idDipendente){
        this.setContent('auth', 'id_dipendente', idDipendente);
    }

    getIdDipendente(){
        try{
            return this.getContent('auth', 'id_dipendente');
        }catch(e){
            throw new MissingLoginError();
        }
    }

    // #endregion

    // #region setter ./logs/log_[name] ([event] with timestamp)

    appendToLog(name, event){
        const line = `[${getNowTimestamp()}] ` + event + '\n';
        this.setContent('logs', `log_${name}`, line, true);
    }

    // #endregion

    // #region setter ./logs/errors_[name] ([error] with timestamp)

    appendToErrors(name, error){
        try{
            const line = `[${getNowTimestamp()}]\n` + error + '\n\n';
            this.setContent('logs', `errors_${name}`, line, true);
        }
        catch(e){
            //qui sto nascondendo l'eccezione al chiamante perché stiamo già nell'ultimo baluardo,
            //dove stiamo appunto loggando un errore.. se si rompe pure qui, poi salirebbe sullo stack
        }
    }

    // #endregion

    // #region rimuove ./[domain]/

    clear({ domain = '' } = {}){
        const dirpath = this.getPathByDomain({ domain });
        fs.rmSync(dirpath, { recursive: true, force: true });
    }

    // #endregion

    // #region profilo related

    getPathProfili(){
        return path.dirname(this.getBaseDir());
    }

    isNomeProfiloValido(nomeProfilo){
        return /^[A-Za-z0-9\-_.]{1,32}$/.test(nomeProfilo);
    }

    cambiaProfilo(nomeProfilo){

        if (!this.isNomeProfiloValido(nomeProfilo)){
            throw new Error(`Il nome profilo: ${nomeProfilo} non è valido.`);
        }

        const profiliPath = this.getPathProfili();
        const newProfiloPath = path.join(profiliPath, nomeProfilo);
        const profiliPathCurrent = path.join(profiliPath, this.cursoreProfilo);
        if(!fs.existsSync(newProfiloPath)){
            throw new Error('Il percorso del profilo a cui si vuole puntare, non esiste.');
        }
        //aggiorna il cursore al nuovo profilo (lo crea se non esiste)
        fs.writeFileSync(profiliPathCurrent, nomeProfilo);

        return newProfiloPath;
    }

    creaNuovoProfilo(nomeProfilo){
        if (!this.isNomeProfiloValido(nomeProfilo)){
            throw new Error(`Il nome profilo: ${nomeProfilo} non è valido.`);
        }

        const profiliPath = this.getPathProfili();
        const newProfiloPath = path.join(profiliPath, nomeProfilo);
        const profiliPathCurrent = path.join(profiliPath, this.cursoreProfilo);
        if(fs.existsSync(newProfiloPath)){
            throw new Error('Il percorso del nuovo profilo che si vuole creare, esiste già.');
        }

        fs.mkdirSync(newProfiloPath);

        return newProfiloPath;
    }

    listaProfili(){
        const profiliPath = this.getPathProfili();
        const items = fs.readdirSync(profiliPath);
        const directories = items.filter(item => {
            const fullPath = path.join(profiliPath, item);;
            return this.isNomeProfiloValido(item) && fs.statSync(fullPath).isDirectory();
        });
        return directories;
    }

    // #endregion

    // #region dump related

    /**
     * Tiene traccia di informazioni con un sistema che permette ad ogni modulo di interagire
     * Crea un proprietà %value% sull'oggetto this.globalDump, valorizzata come array (vuoto se la proprietà non esisteva già)
     * dove pusha un nuovo oggetto avente come proprietà %key% e come valore %obj%
     *
     * %value% : [
     *   { %key%: [%value%,..] },
     * ],
     *
     * @param {*} target dominio del dump (eg.: 'vociElaborate')
     * @param {*} value il valore per cui si sta raggruppando (eg.: 'FESTIVO')
     * @param {*} key la chiave a cui si vuole ricondurre lo specifico dump nel gruppo (eg.: 'DD-MM-YYYY')
     * @param {*} obj l'oggetto che si vuole associare alla chiave
     * @returns {isNew, count}
     */
    pushEntryInDump(target, value, key, obj){

        const dumpObj = {};
        dumpObj[key] = obj;

        if(!this.globalDump[target])
            this.globalDump[target] = {};

        let isNew = false;
        if(!Object.keys(this.globalDump[target]).includes(value)){
            this.globalDump[target][value] = [];
            isNew = true;
        }
        this.globalDump[target][value].push(dumpObj);
        return {isNew, count: this.globalDump[target][value].length};
    }

    pushEntriesInDump(target, entries, key, indexForValueInEntry){
        entries.forEach( entry =>{
            const descrizione = entry[indexForValueInEntry];
            this.pushEntryInDump(target, descrizione, key, entry);
        });
    }

    //restituisce la lista di target per i quali si sia fatto un push
    getDumpTargets(){
        return Object.keys(this.globalDump);
    }

    getDumps({
        styleComment = (text) => { return text; },
        styleStressed = (text) => { return text; }
    }){
        return this.getDumpTargets().map(
            target => this.getDump({ target, styleComment, styleStressed })
        );
    }

    //recupera lo stringify (custom) di un dump target
    getDump({
        target,
        styleComment = (text) => { return text; },
        styleStressed = (text) => { return text; }
    }){
        let cols = 70;
        let buffer = '';
        const dumpTarget = this.globalDump[target];
        if(!dumpTarget)
            return;
        //console.log('{');
        const dumpTitle = `Target[${target}]`;
        buffer += styleComment('\\\\' + dumpTitle + '-'.repeat(cols-dumpTitle.length-2)) + '\n';
        buffer += '{' + '\n';
        Object.keys(dumpTarget).forEach( voce => {
            const keys = dumpTarget[voce];
            //console.log(`  "${voce}" : [`);
            buffer += `  "${styleStressed(voce)}" : [` + '\n';
            keys.forEach( dumpedObj => {
                const dataDelGiornoYYYYMMDD = Object.keys(dumpedObj)[0];
                const entry = dumpedObj[dataDelGiornoYYYYMMDD];
                //console.log(`    { "${dataDelGiornoYYYYMMDD}": ${JSON.stringify(entry)} },`);
                buffer += `    { "${dataDelGiornoYYYYMMDD}": ${JSON.stringify(entry)} },` + '\n';
            });
            //console.log(`  ],`);
            buffer += `  ],` + '\n';
        });
        //console.log('}');
        buffer += '}' + '\n';
        buffer += styleComment('\\\\' + '-'.repeat(cols-2)) + '\n';
        return buffer;
    }

    // #endregion

    // #region event related

    loadStatoEventi(){
        try{
            const statoEventiJSON = this.getContent('eventi', 'stato_eventi');
            this.statoEventi = JSON.parse(statoEventiJSON);
            if(this.statoEventi.timestamp)
                this.statoEventi.timestamp = new Date(this.statoEventi.timestamp);
            Object.values(this.statoEventi.preferiti).forEach(dip => {
                dip.timestamp = new Date(dip.timestamp);
            });
            this.statoEventi.changed = false;
        }catch(e)
        {
            this.statoEventi = { preferiti: {} };
        }
    }

    saveStatoEventi(){
        if(this.statoEventi.changed){
            this.statoEventi.timestamp = new Date();
            const statoEventiJSON = JSON.stringify(this.statoEventi, null, 2);
            this.setContent('eventi', 'stato_eventi', statoEventiJSON, false);
        }
    }

    appendEvento(event){
        //serializza su una riga
        const eventJSON = JSON.stringify(event) + '\n';
        this.setContent('eventi', 'eventi', eventJSON, true);
    }

    readEventi(){
        try{
            const eventiContent = this.getContent('eventi', 'eventi').trim();
            const eventi =
                eventiContent
                    .split('\n')
                    .map( eventoJSON => JSON.parse(eventoJSON) );
            return eventi;
        }
        catch(e){
            return [];
        }
    }

    updateStatoEventiPreferiti({ idDipendente, nominativo, macrostato, oggi, domani }){

        function serializzaGiustificativo(diGiornata){
            if(!diGiornata)
                return 'NULL';
            //c'è la possibilità che io stia trascurando gli undefined che mi pare mi siano capitati
            const telelavoro = (diGiornata.telelavoro === true) ? 'TL:1;' : 'TL:0;';
            const misstrasf = (diGiornata.misstrasf === true) ? 'MT:1;' : 'MT:0;';
            const altro = (diGiornata.altro === true) ? 'AL:1;' : 'AL:0;';
            return `${telelavoro}${misstrasf}${altro}`;
        }

        const chiave = 'id_' + idDipendente;

        const oggiS = serializzaGiustificativo(oggi);
        const domaniS = serializzaGiustificativo(domani);

        //se il dipendente dell'evento esiste in statoEventi.preferiti
        if( this.statoEventi.preferiti[chiave] ){
            //recupera il dipendente corrispondente
            const dip = this.statoEventi.preferiti[chiave];

            //se l'ultima volta che è stato aggiornato era ieri
            if( isDateYesterday(dip.timestamp) ){
                //allora valuta se il giustificativo [oggi] (preso oggi) sia diverso da [domani] preso ieri
                if(dip.domani !== oggiS){
                    this.eventoPreferiti_CambioGiustificativoOggiRispettoADomaniDiIeri({ idDipendente, nominativo, precedente: yesterdayDomaniS, attuale: oggiS });
                }
                dip.timestamp = new Date();
                dip.oggi = oggiS;
                dip.domani = domaniS;
                this.statoEventi.changed = true;
            }
            //se invece l'ultima volta che è stato aggiornato era già oggi
            else if( isDateToday(dip.timestamp) ){
                //allora valuta se il giustificativo [oggi] (preso oggi) sia diverso da [oggi] preso oggi
                if(dip.oggi !== oggiS){
                    this.eventoPreferiti_CambioGiustificativoOggiRispettoAOggiDiOggi({ idDipendente, nominativo, precedente: dip.oggi, attuale: oggiS });
                    dip.timestamp = new Date();
                    dip.oggi = oggiS;
                    this.statoEventi.changed = true;
                }
                //e valuta se il giustificativo [domani] (preso oggi) sia diverso da [domani] preso oggi
                if(dip.domani !== domaniS){
                    this.eventoPreferiti_CambioGiustificativoDomaniRispettoADomaniDiOggi({ idDipendente, nominativo, precedente: dip.domani, attuale: domaniS });
                    dip.timestamp = new Date();
                    dip.domani = domaniS;
                    this.statoEventi.changed = true;
                }
                //e valuta se è cambiato il macrostato
                if(macrostato !== dip.macrostato){
                    //scatena evento PreferitiCambioStato
                    this.eventoPreferiti_CambioStato({ idDipendente, nominativo, precedente: dip.macrostato, attuale: macrostato});
                    dip.timestamp = new Date();
                    dip.macrostato = macrostato;
                    this.statoEventi.changed = true;
                 }
            }
            //altrimenti se l'ultimo stato registrato appartiene ad una data precedente
            else{
                dip.timestamp = new Date();
                dip.oggi = oggiS;
                dip.domani = domaniS;
                dip.macrostato = macrostato;
                this.statoEventi.changed = true;
                this.eventoPreferiti_Reset({ idDipendente, nominativo, macrostato, oggi: oggiS, domani: domaniS });
            }
        }
        //se ancora non esisteva affatto
        else{
            //aggiunge il dipendente da capo in statoEventi.preferiti
            this.statoEventi.preferiti[chiave] = { idDipendente, nominativo, macrostato, oggi: oggiS, domani: domaniS, timestamp: new Date() };
            this.statoEventi.changed = true;
            //scatena evento PreferitiNuovoDipendente
            this.eventoPreferiti_NuovoDipendente({ idDipendente, nominativo, macrostato, oggi: oggiS, domani: domaniS });
        }
    }

    //si scatena quando un nuovo dipendente è stato aggiunto a this.statoEventi.preferiti
    eventoPreferiti_NuovoDipendente({ idDipendente, nominativo, macrostato, oggi, domani }){
        const timestamp = new Date().toISOString();
        const event = { evento: 'Pref_Nuovo', timestamp, payload: { idDipendente, nominativo, macrostato, oggi, domani } };
        this.appendEvento(event);
    }

    //si scatena quando un dipendente aveva lo stato salvato a prima di oggi, e oggi il suo stato è stato resettato
    eventoPreferiti_Reset({ idDipendente, nominativo, macrostato, oggi, domani }){
        const timestamp = new Date().toISOString();
        const event = { evento: 'Pref_Reset', timestamp, payload: { idDipendente, nominativo, macrostato, oggi, domani } };
        this.appendEvento(event);
    }

    //si scatena quando un dipendente, oggi per oggi, ha cambiato stato presenza
    eventoPreferiti_CambioStato({ idDipendente, nominativo, precedente, attuale }){
        const timestamp = new Date().toISOString();
        const event = { evento: 'Pref_CambioStato', timestamp, payload: { idDipendente, nominativo, precedente, attuale } };
        this.appendEvento(event);
    }

    //si scatenza quando un dipendente, oggi ha il giustificativo di oggi diverso rispetto a quello di domani preso ieri
    eventoPreferiti_CambioGiustificativoOggiRispettoADomaniDiIeri({ idDipendente, nominativo, precedente, attuale}){
        const timestamp = new Date().toISOString();
        const event = { evento: 'Pref_CambioGiust_Oggi-DomaniDiIeri', timestamp, payload: { idDipendente, nominativo, precedente, attuale } };
        this.appendEvento(event);
    }

    //si scatena quando un dipendente, oggi ha il giustificativo di oggi diverso rispetto allo stesso preso sempre oggi in precedenza
    eventoPreferiti_CambioGiustificativoOggiRispettoAOggiDiOggi({ idDipendente, nominativo, precedente, attuale}){
        const timestamp = new Date().toISOString();
        const event = { evento: 'Pref_CambioGiust_Oggi-OggiDiOggi', timestamp, payload: { idDipendente, nominativo, precedente, attuale } };
        this.appendEvento(event);
    }

    //si scatena qunado un dipendente, oggi ha il giustificativo di domani diverso rispetto allo stesso preso sempre oggi in precedenza
    eventoPreferiti_CambioGiustificativoDomaniRispettoADomaniDiOggi({ idDipendente, nominativo, precedente, attuale}){
        const timestamp = new Date().toISOString();
        const event = { evento: 'Pref_CambioGiust_Domani-DomaniDiOggi', timestamp, payload: { idDipendente, nominativo, precedente, attuale } };
        this.appendEvento(event);
    }

    // #endregion

}

const nome = 'stopweb';
const versione = '1.2.0';
const releaseDate = '12/03/2024';
const chiaveTOS = 'ff97941154c92b0c515681f754b0bfb9';

const profiliBaseDir = {
    //nome della var d'ambiente contenente il path usato per recuperare i profili
    'ENV_VAR_NAME': 'STOPWEB_PROFILI_BASEDIR_PATH',
    //valore di default del path profili (usato se nè var d'ambiente nè file .env ce l'hanno settato)
    'DEFAULT_PROFILI': '~/.stopweb/profili',
    //valore di default del nome profilo
    'DEFAULT_PROFILO': 'default',
    //nome del file all'interno della dir profili, che determina il profilo selezionato
    'PROFILO_SELEZIONATO': '.selezionato'
};

const instance = new Config(nome, versione, releaseDate, chiaveTOS, profiliBaseDir);
Object.freeze(instance);

//module.exports = instance;
export default instance;

