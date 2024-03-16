import configurationSingleton from '../commons/config.js'

const config = configurationSingleton.getInstance();
import fs from 'fs';

import { ExpiredLoginError } from '../commons/errors.js';

const url_rubrica = config.get('rubrica.url');

//attiva la risposta fasulla
const MOCK_API = config.mock;
//costruisce una risposta fasulla copiandola
const BUILD_MOCK = false;
//percorso del file che conserva l'ultima risposta fasulla creata
const MOCK_FILE = config.getPathByDomain({domain: 'cache'}) + '/response-rubrica';

export async function fetchElenco({cookieHeader}){

    const prepareUrl = ()=>{
        const url = new URL(url_rubrica);
        url.searchParams.append("PageMethod", "ElencoSottopostiSelectVisibiltàEstesa");
        url.searchParams.append("pattern", "");
        url.searchParams.append("page", "1");
        url.searchParams.append("pageLimit", "2000");
        return url.toString();
    }

    const urlToFetch = prepareUrl();

    config.appendToLog('requests', urlToFetch);

    const response = await fetch(urlToFetch, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieHeader
        },
    });

    if (!response.ok) {
        throw new ExpiredLoginError();
    }

    let jsonData;
    try{
        jsonData = await response.json();
    }catch(e){
        //tecnicamente qui ha fallito a decodificare il json, ma se succede è perché la risposta era strampalata
        //ergo 99% è perché la login era scaduta
        throw new ExpiredLoginError();
    }

    return jsonData;
}

export async function fetchRubrica({cookieHeader, idDipendente = -1}) {

    let originalData;
    if(MOCK_API)
        originalData = { json: ()=>{ return JSON.parse( fs.readFileSync(MOCK_FILE, 'utf-8') ) }}
    else
        originalData = await fetchRubricaFromApi(idDipendente, cookieHeader, dataInizio, dataFine);

    async function fetchRubricaFromApi(idDipendente, cookieHeader){
        const prepareUrl = (idDipendente)=>{
            const url = new URL(url_rubrica);
            url.searchParams.append("PageMethod", "LeggiRubrica");
            url.searchParams.append("iddip", idDipendente);
            return url.toString();
        }

        const urlToFetch = prepareUrl(idDipendente);

        const response = await fetch(urlToFetch, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookieHeader
            },
        });

        if (!response.ok) {
            throw new ExpiredLoginError();
            //throw new Error(`Error: ${response.statusText}`);
        }
    }

    let jsonData;
    try{
        jsonData = await originalData.json();
        if(BUILD_MOCK)
            fs.writeFileSync(MOCK_FILE, JSON.stringify(jsonData, null, 2));
    }catch(e){
        //tecnicamente qui ha fallito a decodificare il json, ma se succede è perché la risposta era strampalata
        //ergo 99% è perché la login era scaduta
        throw new ExpiredLoginError();
    }

    return jsonData;
}