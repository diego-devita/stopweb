import { fetchElenco } from '../presenze/rubrica.js';
import { readElenco, writeElenco } from '../presenze/cachedElenco.js';

import configurationSingleton from '../commons/config.js';

const config = configurationSingleton.getInstance();

export async function commandElenco({
    useCache = false,
    showTotal = true,
    sortBy = 'id',
    //se true, viene printato il json trasformato (tenendo conto pure del sort e della cache o meno)
    asTransformedJson = false,
    //se true, viene printato il json originale senza essere toccato e non viene aggiornata la cache
    asOriginalJson = false
} = {}){

    let dipendenti;
    let dipendentiOriginal;
    if(useCache){
        dipendenti = fetchElencoFromCache();
    }else{
        dipendentiOriginal = await fetchElencoFromApi();
        if(asOriginalJson){
            console.log( JSON.stringify(dipendentiOriginal, null, 2) );
            return;
        }
        dipendenti = transformElenco(dipendentiOriginal.results);
        updateCache(dipendenti);
    }

    const dipArray = Object.values(dipendenti);
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

    dipArray.sort(sortByProperty(sortBy));

    if(asTransformedJson){
        console.log( JSON.stringify(dipendenti, null, 2) );
    }else{
        dipArray.forEach( dipendente => {
            console.log(`${dipendente.id.toString().padStart(5, ' ') } ${dipendente.cognome} ${dipendente.nome}`);
        });

        if(showTotal)
            console.log(`\n[Risultati: ${Object.keys(dipendenti).length}]`);
    }
}

function updateCache(dipendenti){
    const now = new Date();
    let dipendentiCached = readElenco();

    //aggiunge i dipendenti da api alla cache
    //tutti i dipendenti dall'api, hanno .esiste = true e .aggiornato rinnovato
    //per quelli che vengono aggiunti la prima volta, .aggiunto settato a quando
    for(let idDipendente in dipendenti){
        const dipendente = dipendenti[idDipendente];
        dipendente.esiste = true;
        dipendente.aggiornato = now;
        //se non esisteva ancora in cache
        if(!dipendentiCached.hasOwnProperty(dipendente.id)){
            dipendente.aggiunto = now;
        }
        dipendentiCached[dipendente.id] = dipendente;
    }

    //prende coscienza dei dipendenti che mancano sull'api
    //tutti i dipendenti in cache che non sono presenti in remoto,
    //hanno .esiste = false e .sparito settato a quando se era la prima volta che flippava
    //in ogni caso a questi viene rinnovato .aggiornato
    for(let idDipendenteCached in dipendentiCached){
        const dipendenteCached = dipendentiCached[idDipendenteCached];
        if(!dipendenti.hasOwnProperty(dipendenteCached.id)){
            //se è la prima volta che risulta sparito
            if(dipendenteCached.esiste){
                dipendenteCached.esiste = false;
                dipendenteCached.sparito = now;
            }
            dipendenteCached.aggiornato = now;
        }
    }

    writeElenco(dipendentiCached);
}

function transformElenco(elenco = {}){
    const elencoTransformed =
        elenco.map( dip => {
            return {
                id: dip.iddip,
                cognome: dip.cognome,
                nome: dip.nome
            }
        });
    const dipendenti = {};
    elencoTransformed.forEach( dip => dipendenti[dip.id] = dip);

    return dipendenti;
}

export async function fetchElencoFromApi(){
    const cookieHeader = config.getCookieHeader();
    const elenco = await fetchElenco({cookieHeader});
    return elenco;
}

function fetchElencoFromCache(){
    return readElenco();
}