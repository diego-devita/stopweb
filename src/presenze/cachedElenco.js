import configurationSingleton from '../commons/config.js'

const config = configurationSingleton.getInstance();

export function readElenco(){

    function reviver(dipendenti) {
        for(let idDipendente in dipendenti){
            const dipendente = dipendenti[idDipendente];

            const aggiornatoRaw = dipendente.aggiornato;
            dipendente.aggiornato = new Date(aggiornatoRaw);

            const aggiuntoRaw = dipendente.aggiunto;
            dipendente.aggiunto = new Date(aggiuntoRaw);

            if(dipendente.sparito){
                const sparitoRaw = dipendente.sparito;
                dipendente.sparito = new Date(sparitoRaw);
            }
        }
    }

    try{
        const o = config.getElenco();
        const parsed = JSON.parse(o);
        reviver(parsed);
        return parsed;
    }catch(e){
        //ritorna oggetto vuoto senza risollevare eccezione (significa che la cache è vuota)
        return {};
    }
}

export function writeElenco(elenco){
    const o = stringifyWithOrderedIds(elenco);
    config.setElenco(o);
}

function stringifyWithOrderedIds(elenco) {
    const orderedKeys = Object.keys(elenco).sort((a, b) => a.localeCompare(b));

    const orderedObject = {};
    for (const key of orderedKeys) {
        orderedObject[key] = elenco[key];
    }

    return JSON.stringify(orderedObject, null, 2);
}