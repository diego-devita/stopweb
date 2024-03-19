import eventEmitterSingleton from '../commons/eventEmitter.js';
import configurationSingleton from '../commons/config.js'
import { ExpiredLoginError } from '../commons/errors.js';

import { transformGiornate } from './giornateTransformer.js';

const events = eventEmitterSingleton.getInstance();
const config = configurationSingleton.getInstance();

import fs from 'fs';

const url_cartellino = config.get('cartellino.url');

//interroga l'api e restituisce le giornate trasformate
export async function fetchGiornateCartellino(idDipendente, cookieHeader, dataInizio, dataFine){

    //attiva la risposta fasulla
    const MOCK_API = config.getExtra('mock');
    //costruisce una risposta fasulla copiandola
    const BUILD_MOCK = config.getExtra('mockRecord');
    //percorso del file che conserva l'ultima risposta fasulla creata
    const MOCK_FILE = config.getPathByDomain({domain: 'cache'}) + '/response-cartellino';

    let originalData;
    if(MOCK_API)
        originalData = { json: ()=>{ return JSON.parse( fs.readFileSync(MOCK_FILE, 'utf-8') ) }}
    else
        originalData = await fetchCartellino(idDipendente, cookieHeader, dataInizio, dataFine);

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
    const giornateLavorate = transformGiornate(jsonData);
    return giornateLavorate;
}

//interroga l'api e restituisce il json originale ricevuto
export async function fetchGiornateCartellinoRAW(idDipendente, cookieHeader, dataInizio, dataFine){

    //attiva la risposta fasulla
    const MOCK_API = config.getExtra('mock');
    //costruisce una risposta fasulla copiandola
    const BUILD_MOCK = config.getExtra('mockRecord');
    //percorso del file che conserva l'ultima risposta fasulla creata
    const MOCK_FILE = config.getPathByDomain({domain: 'cache'}) + '/response-cartellino-raw';

    let originalData;
    if(MOCK_API)
        originalData = { json: ()=>{ return JSON.parse( fs.readFileSync(MOCK_FILE, 'utf-8') ) }}
    else
        originalData = await fetchCartellino(idDipendente, cookieHeader, dataInizio, dataFine);

    if(BUILD_MOCK)
        fs.writeFileSync(MOCK_FILE, JSON.stringify(jsonData, null, 2));

    return await originalData.json();
}

//interroga l'api e restituisce la response
export async function fetchCartellino(idDipendente, cookieHeader, dataInizio, dataFine) {

    if (!idDipendente || !cookieHeader || !dataInizio || !dataFine) {
        throw new Error("Tutti gli argomenti (idDipendente, cookieHeader, dataInizio, dataFine) sono obbligatori!");
    }

    //funzione che dato l'idDipendente restituisce l'url da interrogare parametrizzato
    const prepareUrlCartellino = (idDipendente)=>{
        const url = new URL(url_cartellino);
        url.searchParams.append("PageMethod", "ConsultaCartellino");
        url.searchParams.append("iddip", idDipendente);
        return url.toString();
    }

    //url già parametrizzato da interrogare
    const urlToFetch = prepareUrlCartellino(idDipendente);

    //payload da accompagnare alla richiesta
    const payload = {
      "_dtdatainizio": `${dataInizio}000000`,
      "_dtdatafine": `${dataFine}000000`,
      "dipendenti": [],
      "lingua": "",
      "sologganomali": false,
      "soloconvalidati": false,
      "conautstra": false,
      "_itiporichiesta": 0,
      "_iidprospetto": 0,
      "_itipoconsultazione": 0,
      "ordinamentodip": "C"
    };

    config.appendToLog('requests', urlToFetch + ` [dataInizio: ${dataInizio}, dataFine: ${dataFine}]`);

    const response = await fetch(urlToFetch, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieHeader
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new ExpiredLoginError();
        //throw new Error(`Error: ${response.statusText}`);
    }

    const data = /*await*/ response//.json();

    return data;
}



