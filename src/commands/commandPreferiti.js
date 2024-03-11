import { salvaDipendentiPreferiti, fetchDipendentiPreferiti, fetchOrariPreferiti} from '../presenze/preferiti.js';

import configurationSingleton from '../commons/config.js';

const config = configurationSingleton.getInstance();

import inquirer from 'inquirer'
import { CustomListPrompt } from '../commons/InquirerCustom/CustomListPrompt.js'
import chalk from 'chalk';

const styles = {
    index: chalk.magenta,
    highlighted: chalk.bgGray
};

export async function commandGetOrari({ asJson = false } = {}){

    let o = await fetchOrariPreferitiFromApi();

    if(asJson)
        console.log(JSON.stringify(o, null, 2));
    else
        o.orari.forEach(orario=>{

            function pad(o, pad){
                const r = o?.toString().padEnd(pad, ' ');
                return (r) ? r : '-';
            }

            const id = pad(orario.id, 5);
            const cvdescr = pad(orario.cvdescr, 10);
            const descr = pad(orario.descr, 50);
            const oreminime = pad(orario.oreminime, 4);
            const oremedie = pad(orario.oremedie, 4);
            console.log(`${id} ${cvdescr} ${descr} ${oreminime} ${oremedie}`);

        });
}

export async function commandGetPreferitiDipendenti({ showTotal = true, asJson = false} = {}){

    let o = await fetchDipendentiPreferitiFromApi();

    if(asJson){
        console.log(JSON.stringify(o, null, 2));
        return;
    }

    function sortByProperty(property) {
        return function(a, b) {
            if (a[property] < b[property]) {
                return -1;
            }
            if (a[property] > b[property]) {
                return 1;
            }
            return 0;
        };
    }

    o.dipendentipreferiti.sort(sortByProperty('cognome'))
        .forEach( (dip, i) => { console.log(`${(i+1).toString().padStart(2, ' ')} ${dip.id.toString().padStart(4, ' ')} ${dip.cognome} ${dip.nome}`) } );

    if(showTotal)
        console.log(`\n[Risultati: ${o.dipendentipreferiti.length}]`);
}

export async function commandRemovePreferitiDipendenti({ id } = {}){

    const idDipendente = parseInt(id);

    let o = await fetchDipendentiPreferitiFromApi();
    const preferitiIDs = o.dipendentipreferiti.map( dip => dip.id );

    //se l'id richiesto non esiste già nella lista dei preferiti
    if( !preferitiIDs.includes(idDipendente) ){
        console.log( `L'id ${idDipendente} non è incluso nel set dei preferiti, quindi non è possibile rimuoverlo.` );
        return;
    }
    else{
        const question = [
            {
              type: 'confirm',
              name: 'proceed',
              message: 'Continuare con l\'operazione?',
              default: false,
            },
        ];

        //recupera il dipendente completo dalla lista dei dipendenti attualmente preferiti
        const dipendenteRimosso = o.dipendentipreferiti.find( dip => dip.id == idDipendente );
        const id = dipendenteRimosso.id.toString().padStart(4, ' ');
        const cognome = dipendenteRimosso.cognome;
        const nome = dipendenteRimosso.nome;
        const label = `${id} ${cognome} ${nome}`.trim();
        console.log(`Il dipendente [${label}] verrà rimosso dalla lista dei preferiti...`);

        //chiede di voler procedere
        const answers = await inquirer.prompt(question);
        //se la risposta è si
        if (answers.proceed) {
            const nuoviPreferiti = preferitiIDs.filter(value => value !== idDipendente);
            //fa la richiesta di salvataggio preferiti
            await saveDipendentiPreferitiFromApi(nuoviPreferiti);
            console.log(`Il dipendente è stato rimosso dal set dei preferiti.`);
            return;
        }
        //se la risposta è no
        else {
            console.log('Operazione annullata.');
            return;
        }
    }
}

export async function commandAddPreferitiDipendenti({ id, query} = {}){

    let o = await fetchDipendentiPreferitiFromApi();

    function highlightSubstring(content, partToHighlight, styleFunction) {
        partToHighlight = partToHighlight.toUpperCase();
        const parts = content.split(partToHighlight);
        const highlightedPart = styleFunction(partToHighlight);
        return parts.join(highlightedPart);
    }

    const idDipendente = id;

    //se l'aggiunta è per id dipendente
    if(idDipendente){
        const preferitiIDs = o.dipendentipreferiti.map( dip => dip.id );
        const nonPreferitiIDs = o.dipendenti.map( dip => dip.id );

        //se l'id richiesto esiste già nella lista dei preferiti
        if( preferitiIDs.includes(idDipendente) ){
            console.log( `L'id ${idDipendente} è già incluso nel set dei preferiti.` );
            return;
        }
        //se l'id richiesto non esiste affatto nella lista dei dipendenti non preferiti
        else if( !nonPreferitiIDs.includes(idDipendente) ){
            console.log( `L'id ${idDipendente} non esiste nel set dei dipendenti.` );
            return;
        }
        //altrimenti
        else{

            const question = [
                {
                  type: 'confirm',
                  name: 'proceed',
                  message: 'Continuare con l\'operazione?',
                  default: false,
                },
            ];

            //recupera il dipendente completo dalla lista dei dipendenti non preferiti
            const dipendenteAggiunto = o.dipendenti.find( dip => dip.id == idDipendente );
            const id = dipendenteAggiunto.id.toString().padStart(4, ' ');
            const cognome = dipendenteAggiunto.cognome;
            const nome = dipendenteAggiunto.nome;
            const label = `${id} ${cognome} ${nome}`.trim();
            console.log(`Il dipendente [${label}] verrà aggiunto alla lista dei preferiti...`);

            //chiede di voler procedere
            const answers = await inquirer.prompt(question);
            //se la risposta è si
            if (answers.proceed) {
                //aggiunge l'id alla lista già costruita degli id preferiti
                preferitiIDs.push( idDipendente );
                //fa la richiesta di salvataggio preferiti
                await saveDipendentiPreferitiFromApi(preferitiIDs);
                console.log(`Il dipendente è stato aggiunto al set dei preferiti.`);
                return;
            }
            //se la risposta è no
            else {
                console.log('Operazione annullata.');
                return;
            }
        }
    }
    //altrimenti, l'aggiunta è per query
    else{

        const preferitiIDs = o.dipendentipreferiti.map( dip => dip.id );

        function includes(value, query){
            return value.toLowerCase().includes(query.toLowerCase());
        }

        //il set dei dipendenti (ancora non preferiti) filtrato per query
        const dipendentiFiltered = o.dipendenti.filter( (dip) => {
            return (
                includes(dip.nome, query) || includes(dip.cognome, query) ||
                includes(dip.nome + ' ' + dip.cognome, query) || includes(dip.cognome + ' ' + dip.nome, query)
            )
        });
        //il set sopra stilato con i frammenti di query evidenziati
        const dipendentiFilteredStyled =
            dipendentiFiltered
                .map( (dip, i) => {
                    const c = styles.index( (i+1).toString().padStart(2, ' ') );
                    const id = dip.id.toString().padStart(4, ' ');
                    let nominativo = dip.cognome + ' ' + dip.nome;
                    nominativo = highlightSubstring(nominativo, query, styles.highlighted);
                    //const cognome = highlightSubstring(dip.cognome, query, styles.highlighted);
                    //const nome = highlightSubstring(dip.nome, query, styles.highlighted);
                    return `${c} ${id} ${nominativo}`;
                } );

        //la domanda da promptare
        const questions = [{
            type: 'customList',
            name: 'dipendenteIndex',
            message: 'Seleziona un dipendente:',
            choices: dipendentiFilteredStyled.map((d, index) => ({ name: d, value: index+1 }))
        }];

        console.log(`Cercando "${query}" nel nome o nel cognome,`);
        console.log(`sono state trovate ${dipendentiFiltered.length} occorrenze tra i dipendenti...\n`);

        //inietta il CustomListPrompt (che usa le scritte in italiano -mannaggia a Inquirer)
        inquirer.registerPrompt('customList', CustomListPrompt);

        //prompt con la lista dei dipendenti trovati
        await inquirer.prompt(questions)
            .then(async (answers) => {
                //console.log(`Hai selezionato: ${answers.dipendenteIndex}`);
                preferitiIDs.push( dipendentiFiltered[answers.dipendenteIndex-1].id );
                await saveDipendentiPreferitiFromApi(preferitiIDs);
                console.log('\nIl dipendente selezionato è stato aggiunto al set dei preferiti.');
            }).catch(error => {
                throw error;
            });
    }
}

export async function saveDipendentiPreferitiFromApi(ids){
    const cookieHeader = config.getCookieHeader();
    const o = await salvaDipendentiPreferiti({ cookieHeader, ids});
    return;
}

export async function fetchDipendentiPreferitiFromApi(){

    const cookieHeader = config.getCookieHeader();
    const o = await fetchDipendentiPreferiti({cookieHeader});
    return o;
}

export async function fetchOrariPreferitiFromApi(){

    const cookieHeader = config.getCookieHeader();
    const o = await fetchOrariPreferiti({cookieHeader});
    return o;
}