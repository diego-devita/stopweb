import chalk from 'chalk';
import configurationSingleton from '../commons/config.js'
import stringWidth from 'string-width';

const config = configurationSingleton.getInstance();

function createBuffer2Cols({spacer = ' '} = {}){
    return {

        esempio: [],
        descrizione: [],
        righeCount: 0,
        spacer: spacer,

        get rows(){
            return this.righeCount;
        },

        log: function(esempio, descrizione){
            this.esempio.push(esempio);
            this.descrizione.push(descrizione);
            this.righeCount += 1;
        },

        print: function({maxCol, padding = 0 } = {}){
            let lines = [];
            //Per ogni riga salvata nel buffer
            for(let i = 0; i < this.righeCount; i++){
                //inizializza una riga corrispondente sull'ouput buffer che inizi con il padding specificato
                lines.push((padding == 0) ? '' : ' '.repeat(padding));
            }
            //determina quale sia la stringa esempio con la lunghezza massima
            const max = Math.max(...this.esempio.map(line => stringWidth(line)));
            //per ogni esempio
            this.esempio.forEach((col, i)=>{
                //se il valore è [LINE]
                if(col === '[LINE]')
                    //sulla riga corrispondente dell'output buffer appendi una linea
                    //maxCol è la width massima
                    //a cui sottraggo la dimensione del padding a sinistra e a destra
                    lines[i] += chalk.dim('-'.repeat(maxCol-padding*2));
                //altrimenti il valore è un esempio vero
                else
                    //sulla riga corrispondente dell'output buffer appendi una linea
                    lines[i] += col + this.spacer + ' '.repeat(max - stringWidth(col));
            });
            //per ogni descrizione
            this.descrizione.forEach((col, i)=>{
                //se non era una linea (che hai già sputato sul buffer nel processing degli esempi)
                if(col !== '[LINE]')
                    //aggiunge una linea con la descrizione
                    lines[i] += col;
            });

            return lines.join('\n');
        }
    }
}

function stampaComandi(comandi, options = { maxCol, padding: 1, spacer: '     ' }){
    const buffer = createBuffer2Cols({ spacer: options.spacer });

    stampaComando(comandi.help, buffer);
    stampaComando(comandi.guida, buffer);
    stampaComando(comandi.manifesto, buffer);
    buffer.log('','');
    stampaComando(comandi.profilo, buffer);
    stampaComando(comandi.clear, buffer);
    buffer.log('','');
    stampaComando(comandi.login, buffer);
    stampaComando(comandi.fetch, buffer);
    stampaComando(comandi.elenco, buffer);
    stampaComando(comandi.preferiti, buffer);
    stampaComando(comandi.rubrica, buffer);
    stampaComando(comandi.eventi, buffer);

    /*
    for(let comando of Object.values(comandi)){
        stampaComando(comando, buffer);
    }
    */
    console.log(buffer.print({ maxCol: options.maxCol, padding: options.padding }));
}

function stampaEsempi(comandi, options = { asgrid: false, maxCol, padding: 1, spacer: ' ' }){

    let buffer;
    if(options.asgrid)
        buffer = createBuffer2Cols({ spacer: options.spacer  });

    let i = 0;
    let isLast = false;
    let comandiToShowOptionsFor = Object.values(comandi).filter(comando => comando.esempi && comando.esempi.length > 0);
    for(let comando of comandiToShowOptionsFor){
        if(++i == comandiToShowOptionsFor.length) isLast = true;
        //stampa tutti gli esempi del comando
        stampaEsempiComando(comando, buffer);
        //se non è l'ultimo comando, stampa una linea
        if(!isLast)
            if(buffer)
                buffer.log('[LINE]', '[LINE]');
            else
                console.log( ' '.repeat(options.padding) + chalk.dim('-'.repeat(options.maxCol-options.padding*2)) );
    }
    //costruisci l'output: maxCol è il numero massimo di caratteri per linea (serve alla riga); padding è la length padding a sinistra
    if(buffer){
        const output = buffer.print({ maxCol: options.maxCol, padding: options.padding })
        console.log(output);
    }
}

function stampaEsempiComando(comando, buffer){
    let i = 0;
    let isLast = false;
    //per ogni esempio del comando
    for(let esempio of comando.esempi){
        if(++i == comando.esempi.length) isLast = true;
        //se il buffer è stato passato
        if(buffer)
            //logga il comando sul buffer
            buffer.log(chalk.yellow(esempio.uso), chalk.dim(esempio.descrizione));
        //altrimenti
        else{
            //logga il comando direttamente su console (su righe separate)
            console.log(' ' + chalk.yellow(esempio.uso));
            console.log(' ' + chalk.dim(esempio.descrizione));
            //se non è l'ultimo esempio del comando
            if(!isLast)
                //stampa una linea vuota
                console.log('');
        }
    }
}

function stampaComando(comando, buffer){
    if(comando.nome){
        buffer.log(chalk.yellow(comando.nome), chalk.dim(comando.descrizione));
    }
}

export function printHeader(maxLength){


    function padLeftWithTruncate(content, width, truncation = '[...]', targetLength = 20) {
        // Calcola la lunghezza del contenuto senza considerare gli stili
        let contentWidth = content.length;

        // Determina se il contenuto necessita di troncamento
        let needTruncate = contentWidth > targetLength;

        // Tronca il contenuto se supera targetLength, incluso il testo di troncamento
        if (needTruncate) {
            let actualContentLength = targetLength - truncation.length;
            content = content.slice(0, actualContentLength) + truncation;
        }

        // Calcola la nuova lunghezza del contenuto troncato
        contentWidth = content.length;

        // Aggiunge il padding a sinistra per raggiungere la larghezza specificata
        const paddingLength = width - contentWidth;
        const padding = ' '.repeat(Math.max(0, paddingLength));

        return { padding, content};
    }

    //' stopweb vers: x.x.x'
    //(se i numeri di versione sono tutti ad una cifra - length: 20)
    //' stopweb vers: xx.xx.xx'
    //(se i numberi di versione sono tutti a 2 cifre - length: 23)
    let appLabel;
    appLabel = ` ${config.nome} vers: ${config.version}`;
    const appLabelFormatted = ` ${config.nome} vers: ${chalk.yellow(config.version)}`;
    const appLabelLength = appLabel.length; //già include il left pad

    //calcola la larghezza della colonna appLabel
    const appLabelCol = appLabelLength;

    //ora calcola la larghezza della colonna profilo, sottraendo la dimensione della colonna appLabel dalla maxLength
    const profiloCol = maxLength - (appLabelLength);

    //const testPath = 'very/long/path/that/will/never/end/forever/and/ever';
    //const testPath = 'very/short/instead';
    const pathProfilo = config.getBaseDir();

    const tr = padLeftWithTruncate(pathProfilo, profiloCol-10, '..', 43 );
    const parti = tr.content.split('/');
    parti.pop();
    const percorsoSenzaUltimaParte = parti.join('/');
    tr.content = chalk.dim(percorsoSenzaUltimaParte + '/') + chalk.bold.yellow(config.profileName);
    const basedirLabel = tr.padding + chalk.yellow('Profilo') + ': ' + tr.content;

    //const calcolo = `${appLabel.length}+5+${tr.padding.length}+${'Profilo: '.length}+${tr.content.length}+1=${appLabel.length+5+tr.padding.length+9+tr.content.length+1}`;
    //console.log(calcolo)

    const titolo = appLabelFormatted + basedirLabel;

    console.log('-'.repeat(maxLength));
    console.log(titolo);
    console.log('-'.repeat(maxLength));
}

function printIntro(maxLength){
    const descrizione = 'Strumento per l\'interrogazione del portale aziendale presenze.';
    const utilizzo = `Uso: ${chalk.yellow(config.nome + ' [comando] [..opz]')}`;
    const spiegazione = `le opzioni sono precedute da ${chalk.yellow('-')} o ${chalk.yellow('--')} e se non vi segue un valore, è ${chalk.yellow('true')}`;

    printHeader(maxLength);

    console.log('\n', descrizione);
    console.log('\n', utilizzo);
    console.log('\n', spiegazione);

    console.log('\n', '-'.repeat(maxLength-1));
}

export function commandGuida(){

    const maxLength = 78;

    printIntro(maxLength);

    const pad = 40;
    console.log('');
    console.log(chalk.yellow(' Profilo:'));
    console.log();
    const padOffset = 0;//13
    console.log(` ${chalk.dim((config.nome + ' profilo --crea [nomeprofilo]').padEnd(pad+padOffset, ' '))} per creare un profilo`);
    console.log(` ${chalk.dim((config.nome + ' profilo --lista').padEnd(pad+padOffset, ' '))} per vedere la lista`);
    console.log(` ${chalk.dim((config.nome + ' profilo --cambia [nomeprofilo]').padEnd(pad+padOffset, ' '))} per sceglierlo`);
    console.log();
    console.log(chalk.yellow(' Inizializzazione (del profilo scelto):'));
    console.log();
    console.log(` ${chalk.dim((config.nome + ' profilo --init').padEnd(pad, ' '))} per inizializ. la config a default`);
    console.log(` ${chalk.dim((config.nome + ' profilo --seturls [sito]').padEnd(pad, ' '))} per personalizzare le api url`);
    console.log(` ${chalk.dim((config.nome + ' profilo --checkurls').padEnd(pad, ' '))} per controllare le url`);
    console.log(` ${chalk.dim((config.nome + ' profilo').padEnd(pad, ' '))} per conoscere lo stato della config`);
    console.log(` ${chalk.dim((config.nome + ' profilo --dettagli').padEnd(pad, ' '))}`);
    console.log(` ${chalk.dim((config.nome + ' profilo --yaml').padEnd(pad, ' '))} per conoscere validità formale yaml`);
    console.log();
    console.log(chalk.yellow(' Condizioni:'));
    console.log();
    console.log(` ${chalk.dim((config.nome + ' manifesto').padEnd(pad, ' '))} per consultare manifesto e criticità`);
    console.log(` ${chalk.dim((config.nome + ' condizioni --accetta').padEnd(pad, ' '))} per accettare le condizioni`);
    console.log(` ${chalk.dim((config.nome + ' maniavanti --stacce').padEnd(pad, ' '))}`);
}

export function commandVersione(){
    console.log(`${config.nome} vers: ${config.version}`);
    console.log(`Data rilascio: ${config.releaseDate}`);
    console.log(`Profilo corrente: ${config.getBaseDir()}`);
}

export async function commandHelp({ showSintesi = true, comando, grid } = {}){

    const comandi = {
        '*': {
            esempi: [
                { uso: '[comando] [..opz] --nocolor', descrizione: 'Non utilizza i colori' }
            ]
        },
        'help': {
            nome: 'help',
            descrizione: 'Mostra questa schermata di aiuto -lo stesso succede senza comando',
            esempi: [
                { uso: 'help', descrizione: 'Mostra la lista dei comandi disponibili'},
                //{ uso: 'help --cols 78', descrizione: 'Manda a capo al num. di col [>=78]'},
                { uso: 'help --dettagli', descrizione: 'Mostra oltre ai comandi anche i dettagli delle opzioni'},
                { uso: 'help --dettagli [nomecomando]', descrizione: 'Mostra i dettagli del comando scelto'},
                { uso: 'help --dettagli [..] --asgrid', descrizione: 'Mostra i dettagli a tabella (unfriendly)'},
                { uso: 'help --versione', descrizione: 'Mostra la versione, data di rilascio e profilo dir'}
            ]
        },
        'guida': {
            nome: 'guida',
            descrizione: 'Mostra una guida rapida per iniziare',
        },
        'profilo': {
            nome: 'profilo',
            descrizione: 'Gestione profilo',
            esempi: [
                { uso: 'profilo', descrizione: 'Mostra la sintesi del profilo corrente' },
                { uso: 'profilo --dettagli', descrizione: 'Mostra i dettagli del profilo corrente'},
                { uso: 'profilo --yaml', descrizione: 'Mostra i dettagli validità del file di config del profilo corrente'},
                { uso: 'profilo --init', descrizione: 'Inizializza la configurazione del profilo corrente'},
                { uso: 'profilo --seturls [hostname]', descrizione: 'Se la config esiste, personalizza le url con [hostname] eg: presenze.sito.it'},
                { uso: 'profilo --checkurls', descrizione: 'Elenca il codice di risposta HTTP restituito dalle url nella configurazione'},
                { uso: 'profilo --lista', descrizione: 'Mostra la lista dei profili esistenti'},
                { uso: 'profilo --crea [nomeprofilo]', descrizione: 'Crea un profilo sul [path]'},
                { uso: 'profilo --cambia [nomeprofilo]', descrizione: 'Cambia il profilo corrente e lo fa puntare su [path]'},
            ]
        },
        'clear': {
            nome: 'clear',
            descrizione: 'Rimuove le informazioni conservate in <profilo>/userdata',
            esempi: [
                { uso: 'clear', descrizione: 'Cancella tutta la dir <profilo>/userdata (tutti i gruppi e la parent dir)' },
                { uso: 'clear --gruppo auth', descrizione: 'Cancella la dir <profilo>/userdata/auth (gruppo auth)' },
                { uso: 'clear --gruppo cache', descrizione: 'Cancella la dir <profilo>/userdata/cache (gruppo cache)' },
                { uso: 'clear --gruppo logs', descrizione: 'Cancella la dir <profilo>/userdata/logs (gruppo logs)' },
                { uso: 'clear [..opz] --conferma', descrizione: 'Non chiede conferma prima di cancellare la dir' },
            ]
        },
        'login': {
            nome: 'login',
            descrizione: 'Fa la login sul sito presenze e conserva i cookie',
            esempi: [
                { uso: 'login', descrizione: 'Fa la login sul portale presenze -chiede prima username e password' },
                { uso: 'login --username mailbox@host.it', descrizione: 'Fa la login sul portale presenze -chiede prima password' },
                { uso: 'login [..] --noheadless', descrizione: 'Forza l\'apertura del browser in trasparenza' }
            ]
        },
        'fetch': {
            nome: 'fetch',
            descrizione: 'Recupera e mostra le timbrature',
            esempi: [
                { uso: 'fetch', descrizione: 'Oggi'},
                { uso: 'fetch --oggi', descrizione: 'Oggi'},
                { uso: 'fetch --ieri', descrizione: 'Ieri'},
                { uso: 'fetch --mese', descrizione: 'Mese corrente'},
                { uso: 'fetch --mese 01', descrizione: 'Gennaio (anno corrente)'},
                { uso: 'fetch --mese 01 --anno 2023', descrizione: 'Gennaio 2023'},
                { uso: 'fetch --data 20230101', descrizione: 'Data specifica (YYYYMMDD|DD-MM-YYYY)'},
                { uso: 'fetch --dataInizio 20230101 --dataFine 20240101', descrizione: 'Intervallo da-a (YYYYMMDD|DD-MM-YYYY)'},
                { uso: 'fetch --dataInizio 20230101', descrizione: 'Intervallo da-a oggi (YYYYMMDD|DD-MM-YYYY)'},
                { uso: 'fetch --daOggiMeno 1d', descrizione: 'Intervallo da oggi meno 1 giorno (==1g)'},
                { uso: 'fetch --daOggiMeno 2w', descrizione: 'Intervallo da oggi meno 2 settimane (==2s)'},
                { uso: 'fetch --daOggiMeno 3m', descrizione: 'Intervallo da oggi meno 3 mesi'},
                { uso: 'fetch [..opz] --nocache', descrizione: 'Non utilizza la cache e interroga forzatamente l\'api'},
                { uso: 'fetch [..opz] --cacheonly', descrizione: 'Pesca le giornate dell\'intervallo solo dalla cache e non coinvolge l\'api'},
                { uso: 'fetch [..opz] --oggiNoRefetch', descrizione: 'Se la data oggi è nell\'intervallo e sta già in cache, evita refetch automatico'},
                { uso: 'fetch [..opz] --includiOggiInTotali', descrizione: 'Nei totali del periodo, include anche il valore di oggi'},
                { uso: 'fetch [..opz] --fillGaps', descrizione: 'Quando i risultati vengono solo da cache, riempie i buchi giornate'},
                { uso: 'fetch [..opz] --colTimbratureSize', descrizione: 'Quantità di timbrature che può ospitare la colonna corrispondente [4-8]'},
                { uso: 'fetch [..opz] --showCacheStatus', descrizione: 'Mostra colonna con stato cache (from: F=Fetch,C=Cache,B=Blank)'},
                { uso: 'fetch [..opz] --json', descrizione: 'Riporta il json originale restituito dall\'api'},
                { uso: 'fetch [..opz] --json originale', descrizione: 'Riporta il json originale restituito dall\'api (non intacca cache)'},
                { uso: 'fetch [..opz] --json trasformato', descrizione: 'Riporta il json trasformato per come sono modellate le giornate'},
                { uso: 'fetch [..opz] --nocache --dump', descrizione: 'In coda aggiunge il dump delle voci raggruppate su dati particolari'},
            ]
        },
        'elenco': {
            nome: 'elenco',
            descrizione: 'Mostra l\'elenco dei dipendenti',
            esempi: [
                { uso: 'elenco', descrizione: 'Mostra l\'elenco dei dipendenti #i [ID] [NOMINATIVO] (sorted by id)' },
                { uso: 'elenco --cache', descrizione: 'Non interroga l\'api ma recupera l\'elenco solo dalla cache' },
                { uso: 'elenco --notot', descrizione: 'Non mostra il count dei risultati'},
                { uso: 'elenco --sortby [nome|cognome|id]', descrizione: 'Decide l\'ordinamento dell\'elenco'},
                { uso: 'elenco --json', descrizione: 'Restituisce il json originale (non intacca cache)'},
                { uso: 'elenco --json originale|o', descrizione: 'Restituisce il json originale (non intacca cache)'},
                { uso: 'elenco [..opz] --json trasformato|t', descrizione: 'Restituisce il json trasfromato'},
            ]
        },
        'rubrica' : {
            nome: 'rubrica',
            descrizione: 'Mostra le entry rubrica dei dipendenti',
            esempi: [
                { uso: 'rubrica', descrizione: 'Mostra l\'elenco rubrica dei dipendenti tra i preferiti (sorted by cognome)' },
                { uso: 'rubrica --tutti', descrizione: 'Mostra l\'elenco rubrica di tutti i dipendenti' },
                { uso: 'rubrica --preferiti', descrizione: 'Mostra l\'elenco rubrica dei dipendenti salvati tra i preferiti' },
                { uso: 'rubrica --id [0-9]+', descrizione: 'Mostra la entry rubrica del dipendente specificato' },
                { uso: 'rubrica --ids [0-9]+(,[0-9]+)*', descrizione: 'Mostra le entry rubrica dei dipendenti specificati' },
                { uso: 'rubrica --ids [..valori] --delayms 100', descrizione: 'Fa un\'attesa di 100ms tra una richiesta e l\'altra (default: 1000)' },
                { uso: 'rubrica [..opz] --presenti [now|adesso|oggi|domani]', descrizione: 'Mostra i risultati filtrati con i criteri scelti'},
                { uso: 'rubrica [..opz] --notot', descrizione: 'Non mostra il count dei risultati'},
                { uso: 'rubrica [..opz] --noTimeSpent', descrizione: 'Non mostra il tempo richiesto per la response' },
                { uso: 'rubrica [..opz] --gruppo [nomegruppo]', descrizione: 'Mostra i risultati raggruppati come da [nomegruppo] corrispondente'},
                { uso: 'rubrica [..opz] --print [short1|short2|short3|long]', descrizione: 'Mostra i risultati con la modalità scelta che per default è short3' },
                { uso: 'rubrica [..opz] --print json', descrizione: 'Mostra il json originale (usare senza opzioni a monte per: no filter)' },
                { uso: 'rubrica [..opz] --sortby [nome|cognome|id|stato|descrizione]', descrizione: 'Decide ordine elenco (anche gruppi). In short3, nome/cognome seguono.'},
            ]
        },
        'preferiti' : {
            nome: 'preferiti',
            descrizione: 'Gestisce la propria lista preferiti dei dipendenti',
            esempi: [
                { uso: 'preferiti', descrizione: 'Mostra l\'elenco dei dipendenti salvati tra i preferiti (sorted by cognome)' },
                { uso: 'preferiti --list', descrizione: 'Mostra l\'elenco dei dipendenti salvati tra i preferiti (sorted by cognome)' },
                { uso: 'preferiti [..opz] --notot', descrizione: 'Non mostra il count dei risultati'},
                { uso: 'preferiti --add [id]', descrizione: 'Aggiunge il dipendente (id) alla lista dei preferiti' },
                { uso: 'preferiti --add "[query]"', descrizione: 'Aggiunge il dipendente (matching with query) alla lista dei preferiti' },
                { uso: 'preferiti --remove [id]', descrizione: 'Rimuove il dipendente (id) dalla lista dei preferiti' },
                { uso: 'preferiti --json', descrizione: 'Restituisce il json originale'},
                { uso: 'preferiti --orari', descrizione: 'Mostra la lista delle voci orario disponibili'},
                { uso: 'preferiti --orari --json', descrizione: 'Mostra la lista delle voci orario disponibili -json originale'},
            ]
        },
        'manifesto' : {
            nome: 'manifesto',
            descrizione: 'Mostra le condizioni di utilizzo accettate' + '\n' + ' '.padStart(12) + '(sinonimi: condizioni|maniavanti|eula)'
        },
        'eventi' : {
            nome: 'eventi',
            descrizione: 'Mostra la lista di tutti gli eventi registrati',
            esempi: [
                { uso: 'eventi', descrizione: 'Mostra la coda eventi (prodotta dal comando rubrica)' },
                { uso: 'eventi --storicizza', descrizione: 'Svuota coda eventi che sposta su storia del risp. giorno (raggr. per dipend.)' },
                { uso: 'eventi --storia [YYYYMMDD]', descrizione: 'Mostra la storia eventi del giorno specificato' },
            ]
        }
    };

    const maxLength = 78;

    printIntro(maxLength);

    if(!config.isTosAccepted()){
        stampaPreInit(config.nome);
        console.log('\n');
    }
    else{
        console.log('\n','Comandi disponibili:', '\n');
        stampaComandi(comandi, { maxCol: maxLength, padding: 1, spacer: '  ' });

        console.log('\n', '-'.repeat(maxLength-1));

        if(showSintesi){
            console.log('\n', 'Per maggiori dettagli:', ` ${chalk.yellow(config.nome + ' help --dettagli')}`);
            console.log(' '.repeat(25) + `${chalk.yellow(config.nome + ' help --dettagli --asgrid')}`);
            console.log(' '.repeat(25) + `${chalk.yellow(config.nome + ' help --dettagli [comando]')}`);
            console.log(' '.repeat(25) + `${chalk.yellow(config.nome + ' help --dettagli [comando] --asgrid')}`);
            console.log('');
            console.log('-'.repeat(maxLength));
        }else{
            const showAsGrid = (grid === true) ? true : false;
            console.log('\n', 'Esempi di utilizzo:', '\n');
            if(comando && (comando in comandi)){
                const comandiFiltered = { comando : comandi[comando] };
                stampaEsempi(comandiFiltered, { asgrid: showAsGrid, maxCol: maxLength, padding: 1, spacer: '  ' });
            }else{
                stampaEsempi(comandi, { asgrid: showAsGrid, maxCol: maxLength, padding: 1, spacer: '  ' });
            }
            console.log();
            console.log('-'.repeat(maxLength));
        }
    }
}

