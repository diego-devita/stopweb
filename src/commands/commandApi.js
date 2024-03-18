import { WebSocketServer } from 'ws'

import compression from 'compression';
import express from 'express';
import configurationSingleton from '../commons/config.js';
import eventEmitterSingleton from '../commons/eventEmitter.js';

import { fetchGiornateCartellinoRAW } from '../presenze/fetch.js';
import { fetchRubrica } from '../presenze/rubrica.js';
import { commandLogin } from './commandLogin.js';

import chalk from 'chalk';

import fs from 'fs';

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

        const showIndex = async (req, res) => {
            // HTML content listing the routes
            const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>stopweb API Index</title>
                <script>
                    var ws = new WebSocket('ws://localhost:3080');
                    ws.onopen = function() {
                        console.log('WebSocket connection established');
                    };
                    ws.onmessage = function(event) {
                        console.log('Message from server:', event.data);
                    };
                    ws.onerror = function(error) {
                        console.log('WebSocket error:', error);
                    };
                    ws.onclose = function() {
                        console.log('WebSocket connection closed');
                    }
                </script>
            </head>
            <body>
                <h1>stopweb API Endpoints</h1>
                <ul>
                    <li><a href="/stopweb/api/timbrature/2022-01-01/2022-01-31">/stopweb/api/timbrature/&lt;dataInizio&gt;/&lt;dataFine&gt;</a></li>
                    <li><a href="/stopweb/api/preferiti">/stopweb/api/preferiti</a></li>
                    <li><a href="/stopweb/api/eventi">/stopweb/api/eventi</a></li>
                    <li><a href="/stopweb/api/eventi/stato">/stopweb/api/eventi/stato</a></li>
                    <li><a href="/stopweb/api/eventi/update">/stopweb/api/eventi/update</a></li>
                    <li><a href="/stopweb/api/login">/stopweb/api/login</a></li>
                </ul>
            </body>
            </html>
            `;

            // Send the HTML content as the response
            res.send(htmlContent);
        }

        app.get('/', showIndex);
        app.get('/stopweb', showIndex);
        app.get('/stopweb/api', showIndex);

        app.get('/stopweb/api/timbrature/:dataInizio/:dataFine', async (req, res) => {
            const { dataInizio, dataFine } = req.params;
            let json = {error: 'error'};
            try{
                json = await apiTimbrature({ dataInizio, dataFine });
            }catch(e){
                //login scaduta in tutta probabilità
            }
            res.json({ json });
        });

        app.get('/stopweb/api/preferiti', async (req, res) => {
            let json = {error: 'error'};
            try{
                json = await apiPreferiti();
            }catch(e){
                //login scaduta in tutta probabilità
            }
            res.json({ json });
        });

        app.get('/stopweb/api/eventi', async (req, res) => {
            let json = {error: 'error'};
            try{
                json = await apiEventi();
            }
            catch(e){
            }
            res.json({ json });
        });

        app.get('/stopweb/api/eventi/stato', async (req, res) => {
            let json = {error: 'error'};
            try{
                json = await apiStatoEventi();
            }
            catch(e){
            }
            res.json({ json });
        });

        app.get('/stopweb/api/eventi/update', async (req, res) => {
            let json = {error: 'error'};
            try{
                json = await apiEventiUpdate();
            }
            catch(e){
            }
            res.json({ json });
        });

        app.get('/stopweb/api/login', async (req, res) => {
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

async function apiEventi(){
    const eventi = config.readEventi();
    return eventi;
}

async function apiStatoEventi(){
    const statoEventi = config.statoEventi;
    return statoEventi;
}

async function apiEventiUpdate(){

    function waitForFileRemoval(filePath, timeout) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            // Function to check file existence
            function checkFile() {
                if (!fs.existsSync(filePath)) {
                    resolve(true); // File does not exist, resolve the promise
                } else if (Date.now() - startTime >= timeout) {
                    resolve(false); // Timeout reached, resolve the promise with false
                } else {
                    setTimeout(checkFile, 100); // Check again after a delay
                }
            }

            checkFile();
        });
    }

    const signalFile = config.setContent('eventi', 'forceupdate', '', false);
    const timeout = 5000; // 5 seconds
    try {
        const wasRemoved = await waitForFileRemoval(signalFile, timeout);
        if (wasRemoved) {
            return 'La procedura di aggiornamento stato è stata lanciata.';
        } else {
            fs.unlinkSync(signalFile);
            return 'E\' scaduto il tempo di attesa per una risposta dal loop eventi.';
        }
    } catch (error) {
        return 'An error occurred:' + error;
    }
}