import { WebSocketServer } from 'ws'

import compression from 'compression';
import express from 'express';
import configurationSingleton from '../commons/config.js';
import eventEmitterSingleton from '../commons/eventEmitter.js';

import { fetchGiornateCartellinoRAW } from '../presenze/fetch.js';
import { fetchRubrica } from '../presenze/rubrica.js';
import { commandLogin } from './commandLogin.js';

import chalk from 'chalk';

const config = configurationSingleton.getInstance();
const events = eventEmitterSingleton.getInstance();

const msgSuccess_api = (port) => chalk.green(` API Server in ascolto sulla porta ${port} - https://localhost:${port}/stopweb/api`);
const msgFail_api = (error) => chalk.red(` Errore durante l'avvio dell'API Server: ${error.message}`);
const msgSuccess_ws = (port) => chalk.green(` WebSocket in ascolto sulla porta ${port} - ws://localhost:${port}`);
const msgFail_ws = (error) => chalk.red(` Si è verificato un errore con il server WebSocket: ${error.message}`);

export function startWebSocket({ port = 3080 } = {}){

    return new Promise((resolve, reject) => {

        const wss = new WebSocketServer({ port }, () => {
            console.log(msgSuccess_ws(port));
            resolve(wss);
        });

        wss.on('error', (error) => {
            console.error(msgFail_ws(error));
            reject(error);
        });

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
    });
}

export async function startApiServer({ port = 3000 }={}){

    return new Promise((resolve, reject) => {
        const app = express();
        app.use(express.json());
        app.use(compression());

        //Econst compression = require('compression');
        //app.use(compression({ flush: require('zlib').Z_SYNC_FLUSH }));

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

        app.get('/api/login', async (req, res) => {
            await loginProcedure(req, res);
        });

        const server = app.listen(port, () => {
            console.log(msgSuccess_api(port));
            resolve(server);
        });

        server.on('error', (error) => {
            console.error(msgFail_api(error));
            reject(error);
        });
    });

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

async function loginProcedure(req, res) {

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')

    // Pre-setup for capturing the 2FA code as soon as the event occurs
    let code2FAPromiseResolve;
    const code2FAPromise = new Promise((resolve) => {
        code2FAPromiseResolve = resolve;
    });

    events.on('login.success.2FA', ({ code2FA }) => {
        res.write(`2FA Code: ${code2FA}\n`); // Echo the 2FA code in the response
        res.flush();
        code2FAPromiseResolve(); // Resolve the promise when the event occurs
    });

    // Now, initiate the login procedure which could trigger the 2FA event
    try {
        const loginDetails = {
            headless: config.get('login.headless'),
            url: config.get('login.url'),
            username: config.get('login.username'),
            password: config.get('login.password'),
            expectedLandingPage: config.get('login.landingPage'),
            timeoutSeconds: config.get('login.timeoutSeconds'),
            p: (m)=>{ return m;}//>null
        };
        res.write(`Attempting the login...\n`);
        res.flush();
        await commandLogin(loginDetails);

        // Wait for the 2FA event to be handled, if it hasn't been already
        await code2FAPromise;
    } catch (error) {
        // Handle any errors that might occur during login
        //console.error('An error occurred during login:', error);
        res.write(`Error occurred!\n` + error.message + '\n');
        res.flush();
    } finally {
        // Cleanup: Remove the event listener to prevent memory leaks
        events.removeAllListeners('login.success.2FA');
    }

    // Finish the response after everything, including 2FA handling, is completed
    res.end('Login procedure completed.');
}