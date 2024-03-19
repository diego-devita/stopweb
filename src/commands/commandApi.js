import { WebSocketServer, WebSocket} from 'ws'

import https from 'https';
import compression from 'compression';
import express from 'express';
import configurationSingleton from '../commons/config.js';
import eventEmitterSingleton from '../commons/eventEmitter.js';

import { fetchGiornateCartellinoRAW } from '../presenze/fetch.js';
import { fetchRubrica } from '../presenze/rubrica.js';
import { commandLogin } from './commandLogin.js';

import path from 'path';

import chalk from 'chalk';

import fs from 'fs';

const config = configurationSingleton.getInstance();
const events = eventEmitterSingleton.getInstance();

const msgSuccess_api = (port) => chalk.green(` API Server in ascolto sulla porta ${port} - https://localhost:${port}/stopweb/api`);
const msgFail_api = (error) => chalk.red(` Errore durante l'avvio dell'API Server: ${error.message}`);
const msgSuccess_ws = (port) => chalk.green(` WebSocket in ascolto sulla porta ${port} - ws://localhost:${port}`);
const msgFail_ws = (error) => chalk.red(` Si è verificato un errore con il server WebSocket: ${error.message}`);

function getPemCredentials(){

    const basedir = config.getConfigDir();
    const privateKeyPath = path.join(basedir, 'key.pem');
    const certificatePath = path.join(basedir, 'cert.pem');

    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    const certificate = fs.readFileSync(certificatePath, 'utf8');

    return  { key: privateKey, cert: certificate };
}

export function startWebSocket({ port = 3080 } = {}){

    return new Promise((resolve, reject) => {

        let credentials;
        let httpsMode = false;
        try{
            credentials = getPemCredentials();
            httpsMode = true;
        }
        catch(e){
           //se si rompe in tutta probabilità perché i file pem non esistono
           //e tanto vale che sia il criterio per stabili di aprire la connessione in http o in https
           //i file pem necessari possono essere creati con:
           //openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=IT/ST=Italy/L=Rome/O=stopweb/OU=stopweb/CN="
           //e vanno messi in $profilo/config/
        }
        let server;
        let wss;
        if(httpsMode){
            server = https.createServer(credentials);
            wss = new WebSocketServer({ server });

            server.listen(port, () => {
                console.log(msgSuccess_ws(port));
                resolve(wss);
            });
        }
        else{
            wss = new WebSocketServer({ port }, () => {
                console.log(msgSuccess_ws(port));
                resolve(wss);
            });
        }

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
                <style>
                    #websocket input{
                        width: 3em;
                        margin-left: 0.25em;
                    }
                    #websocket button{
                        margin-left: 0.25em;
                    }
                    #output{
                        list-style: none;
                    }
                    #output pre{
                        background: lightgray;
                        padding: 1em;
                        border: dashed 1px;
                        width: fit-content;
                        min-width: 15em;
                    }
                </style>
                <script>

                    function getWebSocketURL(port) {
                        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                        const wsHost = window.location.hostname;
                        const wsURL = wsProtocol + '//' + wsHost + ':' + port;

                        return wsURL;
                    }

                    function connectToWebSocket(url){
                        var ws = new WebSocket(url);

                        ws.onopen = function() {
                            document.querySelector('#output pre').textContent += 'WebSocket connection established\\n';
                        };
                        ws.onmessage = function(event) {
                            document.querySelector('#output pre').textContent += 'Message from server:\\n' + event.data + '\\n';
                        };
                        ws.onerror = function(error) {
                            document.querySelector('#output pre').textContent += 'WebSocket error:\\n' + error + '\\n';
                        };
                        ws.onclose = function() {
                            document.querySelector('#output pre').textContent += 'WebSocket connection closed\\n';
                        }
                    }

                    function getTodayAsYYYYMMDD() {
                        const today = new Date();
                        const yyyy = today.getFullYear();
                        let mm = today.getMonth() + 1;
                        let dd = today.getDate();
                        mm = mm < 10 ? '0' + mm : mm;
                        dd = dd < 10 ? '0' + dd : dd;
                        return yyyy + mm + dd;
                    }

                    function connectToGivenPort(){
                        const port = document.querySelector('#websocket input').value;
                        const url = getWebSocketURL(port);
                        connectToWebSocket(url);
                    }

                    function replacePlaceholders(){
                        const li = document.getElementById('api_timbrature');
                        let url = li.querySelector('a').href;
                        url = url.replace('[datainizio]', getTodayAsYYYYMMDD());
                        url = url.replace('[datafine]', getTodayAsYYYYMMDD());
                        li.querySelector('a').href = url;
                    }

                    document.addEventListener('DOMContentLoaded',()=>{
                        replacePlaceholders();
                        const wsUrl = getWebSocketURL('');
                        document.querySelector('#websocket .hostname').textContent = wsUrl;
                    });

                </script>
            </head>
            <body>
                <h2>stopweb API Endpoints</h2>
                <ul>
                    <li id="api_timbrature"><a href="/stopweb/api/timbrature/[datainizio]/[datafine]">/stopweb/api/timbrature/&lt;dataInizio&gt;/&lt;dataFine&gt;</a></li>
                    <li id="api_preferiti"><a href="/stopweb/api/preferiti">/stopweb/api/preferiti</a></li>
                    <li id="api_eventi"><a href="/stopweb/api/eventi">/stopweb/api/eventi</a></li>
                    <li id="api_eventi_stato"><a href="/stopweb/api/eventi/stato">/stopweb/api/eventi/stato</a></li>
                    <li id="api_eventi_update"><a href="/stopweb/api/eventi/update">/stopweb/api/eventi/update</a></li>
                    <li id="api_login"><a href="/stopweb/api/login">/stopweb/api/login</a></li>
                </ul>
                <h2>stopweb Events Websocket</h2>
                <ul>
                    <li id="websocket">
                        <span class="hostname"></span>
                        <span><input type="text" value="?"></span>
                        <button onclick="connectToGivenPort();">connect</button>
                    </li>
                    <li id="output">
                        <pre></pre>
                    </li>
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

        let credentials;
        let httpsMode = false;
        try{
            credentials = getPemCredentials();
            httpsMode = true;
        }
        catch(e){
           //se si rompe in tutta probabilità perché i file pem non esistono
           //e tanto vale che sia il criterio per stabili di aprire la connessione in http o in https
           //i file pem necessari possono essere creati con:
           //openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=IT/ST=Italy/L=Rome/O=stopweb/OU=stopweb/CN="
           //e vanno messi in $profilo/config/
        }

        let server;
        if(httpsMode){
            server = https.createServer(credentials, app);
            server.listen(port, () => {
                console.log(msgSuccess_api(port));
                resolve(server);
            });
        }
        else{
            server = app.listen(port, () => {
                console.log(msgSuccess_api(port));
                resolve(server);
            });
        }

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