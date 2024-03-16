import { WebSocketServer } from 'ws'

import express from 'express';
import configurationSingleton from '../commons/config.js';
import eventEmitterSingleton from '../commons/eventEmitter.js';

import { fetchGiornateCartellinoRAW } from '../presenze/fetch.js';
import { fetchRubrica } from '../presenze/rubrica.js';

const config = configurationSingleton.getInstance();
const events = eventEmitterSingleton.getInstance();

export function startWebSocket({ port = 3080 } = {}){

    const wss = new WebSocketServer({ port });

    wss.on('connection', function connection(ws) {
        function attachEvents(websocket){

            function forwardEventToWebSocket(event){
                if(!websocket)
                    return;
                const dataString = JSON.stringify(event);
                websocket.send(dataString);
            }

            events.on('eventi.timbrature.nuovoGiorno', forwardEventToWebSocket);
            events.on('eventi.timbrature.variazione', forwardEventToWebSocket);
            events.on('eventi.preferiti.dipendente.nuovo', forwardEventToWebSocket);
            events.on('eventi.preferiti.dipendente.reset', forwardEventToWebSocket);
            events.on('eventi.preferiti.stato.variazione', forwardEventToWebSocket);
            events.on('eventi.preferiti.giustificativo.oggi.variazioneDaIeri', forwardEventToWebSocket);
            events.on('eventi.preferiti.giustificativo.oggi.variazioneDaOggi', forwardEventToWebSocket);
            events.on('eventi.preferiti.giustificativo.domani.variazioneDaOggi', forwardEventToWebSocket);
        }
        attachEvents(ws);
    });

    wss.on('close', () => {
    });

    return wss;
}

export function startApiServer({ port = 3000 }={}){

    const app = express();
    app.use(express.json());

    //'/api/timbrature/:dataInizio/:dataFine'
    //'/api/preferiti'

    app.get('/', async (req, res) => {
    });

    app.get('/api/timbrature/:dataInizio/:dataFine', async (req, res) => {
        const { dataInizio, dataFine } = req.params;
        let json = {error: 'error'};
        try{
            json = await apiTimbrature({ dataInizio, dataFine });
        }catch(e){
            //login scaduta in tutta probabilità
        }
        res.json({ json });
    });

    app.get('/api/preferiti', async (req, res) => {
        let json = {error: 'error'};
        try{
            json = await apiPreferiti();
        }catch(e){
            //login scaduta in tutta probabilità
        }
        res.json({ json });
    });

    // Avvio del server
    app.listen(port, () => {});
}

async function apiIndex(){
    return '{}';
}

async function apiPreferiti(){
    const json = await fetchRubrica({ cookieHeader: config.cookieHeader, idDipendente: -2 });
    return json;
}

async function apiTimbrature({ dataInizio, dataFine } = {}){
    const json = await fetchGiornateCartellinoRAW(config.idDipendente, config.cookieHeader, dataInizio, dataFine);
    return json;
}