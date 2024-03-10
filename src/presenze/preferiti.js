import configurationSingleton from '../commons/config.js'

const config = configurationSingleton.getInstance();

import { ExpiredLoginError } from '../commons/errors.js';

const url_preferiti = config.get('preferiti.url');

export async function salvaDipendentiPreferiti({cookieHeader, ids = []}){

    const prepareUrl = ()=>{
        const url = new URL(url_preferiti);
        url.searchParams.append("PageMethod", "SalvaDipendentiPerRubrica");
        return url.toString();
    }

    const payload = ids.map( id => { return { '_iid': parseInt(id) }});

    const urlToFetch = prepareUrl();

    config.appendToLog('requests', urlToFetch);

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
    }

    let jsonData;
    try{
        //{ success: true }
        jsonData = await response.json();
    }catch(e){
        //tecnicamente qui ha fallito a decodificare il json, ma se succede è perché la risposta era strampalata
        //ergo 99% è perché la login era scaduta
        throw new ExpiredLoginError();
    }

    return jsonData;
}

export async function fetchDipendentiPreferiti({cookieHeader}) {

    const prepareUrl = ()=>{
        const url = new URL(url_preferiti);
        url.searchParams.append("PageMethod", "ReadDipendentiRubricaPreferiti");
        return url.toString();
    }

    const urlToFetch = prepareUrl();


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

    let jsonData;
    try{
        //{ dipendenti[{cognome, id, nome}], dipendentipreferiti[{cognome, id, nome}], parametri: }
        jsonData = await response.json();
    }catch(e){
        //tecnicamente qui ha fallito a decodificare il json, ma se succede è perché la risposta era strampalata
        //ergo 99% è perché la login era scaduta
        throw new ExpiredLoginError();
    }

    return jsonData;
}

export async function fetchOrariPreferiti({cookieHeader}) {

    const prepareUrl = ()=>{
        const url = new URL(url_preferiti);
        url.searchParams.append("PageMethod", "ReadOrariPreferiti");
        return url.toString();
    }

    const urlToFetch = prepareUrl();

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

    let jsonData;
    try{
        //{ cvdescr, descr, oreminime, oremedie }
        jsonData = await response.json();
    }catch(e){
        //tecnicamente qui ha fallito a decodificare il json, ma se succede è perché la risposta era strampalata
        //ergo 99% è perché la login era scaduta
        throw new ExpiredLoginError();
    }

    return jsonData;
}