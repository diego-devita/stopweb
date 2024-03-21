import { WebSocketServer, WebSocket} from 'ws'

import cookieParser from 'cookie-parser';
import https from 'https';
import cors from 'cors';
import compression from 'compression';
import express from 'express';
import configurationSingleton from '../commons/config.js';
import eventEmitterSingleton from '../commons/eventEmitter.js';

import { fetchGiornateCartellinoRAW, fetchGiornateCartellino } from '../presenze/fetch.js';
import { fetchRubrica } from '../presenze/rubrica.js';
import { commandLogin } from './commandLogin.js';

import path from 'path';

import chalk from 'chalk';

import fs from 'fs';

const config = configurationSingleton.getInstance();
const events = eventEmitterSingleton.getInstance();

const msgSuccess_api = (port, schema) => /*🟢*/chalk.green(' ●  API Server in ascolto ') + chalk.yellow(schema) + (`://localhost:${chalk.yellow(port)}/stopweb/api`) ;
const msgFail_api = (error) => /*🔴*/chalk.red(` ●  Errore durante l'avvio dell'API Server: ${error.message}`);
const msgSuccess_ws = (port, schema) => chalk.green(' ●  WebSocket in ascolto ') + chalk.yellow(schema) + `://localhost:${chalk.yellow(port)}`;
const msgFail_ws = (error) => chalk.red(` ●  Si è verificato un errore con il server WebSocket: ${error.message}`);

const AUTH_COOKIE_NAME = 'auth_key';

function getPemCredentials(){

    const basedir = config.getConfigDir();
    const privateKeyPath = path.join(basedir, 'key.pem');
    const certificatePath = path.join(basedir, 'cert.pem');

    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    const certificate = fs.readFileSync(certificatePath, 'utf8');

    return  { key: privateKey, cert: certificate };
}

function parseCookieString(cookieString) {
    const cookies = {};
    if (cookieString) {
        const individualCookieStrings = cookieString.split('; ');
        individualCookieStrings.forEach(cookie => {
            const [key, value] = cookie.split('=');
            cookies[key] = decodeURIComponent(value);
        });
    }
    return cookies;
}

function isHeaderValid(headers){
    if(!headers || !headers['x-api-key'])
        return false;
    const apikey = headers['x-api-key'];
    if (!apikey || !config.isApiKeyValid(apikey))
        return false;
    return true;
}

function isCookieValid(cookies){
    if (
        (!cookies || !cookies[AUTH_COOKIE_NAME])
    ) {
        return false;
    }
    const authKey = cookies[AUTH_COOKIE_NAME];
    if (!authKey || !config.isApiKeyValid(authKey)) {
        return false;
    }
    return true;
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

            wss = new WebSocketServer({  noServer: true });

            server.on('upgrade', function(request, socket, head) {
                const cookies = request.headers.cookie;
                const parseCookies = parseCookieString(cookies);
                if (!isCookieValid(parseCookies)) {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                    return;
                }
                wss.handleUpgrade(request, socket, head, function(ws) {
                    wss.emit('connection', ws, request);
                });
            });

            server.listen(port, () => {
                console.log(msgSuccess_ws(port, 'wss'));
                resolve({ server: wss, https: true, auth: true });
            });
        }
        else{
            wss = new WebSocketServer({ port }, () => {
                console.log(msgSuccess_ws(port, 'ws'));
                resolve({ server: wss, https: false, auth: false });
            });
        }

        wss.on('error', (error) => {
            console.error(msgFail_ws(error));
            reject(error);
        });

        wss.on('connection', function connection(ws) {
            function attachEvents(websocket){

                function forwardEventToWebSocket(name, event){
                    if(!websocket)
                        return;
                    const dataString = JSON.stringify(event);
                    websocket.send(name + dataString);
                }

                const keepTracksOfEvents = [
                    'process.update.begin',
                    'process.update.done',
                    'process.update.error',
                    'process.update.next',
                    'eventi.timbrature.nuovoGiorno',
                    'eventi.timbrature.variazione',
                    'eventi.preferiti.dipendente.nuovo',
                    'eventi.preferiti.dipendente.reset',
                    'eventi.preferiti.stato.variazione',
                    'eventi.preferiti.giustificativo.oggi.variazioneDaIeri',
                    'eventi.preferiti.giustificativo.oggi.variazioneDaOggi',
                    'eventi.preferiti.giustificativo.domani.variazioneDaOggi',
                ];

                keepTracksOfEvents.forEach( eventName => {
                    events.on(eventName, (event)=>{ forwardEventToWebSocket(eventName, event) });
                });
            }
            attachEvents(ws);
        });

        wss.on('close', () => {
        });
    });
}

export async function startApiServer({ port = 3000, corsFree = true }={}){

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

        // Middleware to check for the auth cookie
        function checkAuthCookie(req, res, next) {
            if (!isCookieValid(req.cookies) && !isHeaderValid(req.headers))
                return res.redirect('/login');
            next();
        }

        const app = express();
        app.use(express.json());
        app.use(compression());
        app.use(cookieParser());
        if(corsFree)
            app.use(cors());

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
                    body{
                        padding: 2em;
                    }
                    #websocket{
                        display: flex;
                        gap: 1em;
                    }
                    #websocket input{
                        width: 3em;
                        margin-left: 0.25em;
                        line-height: 2.5em;
                        padding-left: .5em;
                    }
                    #websocket button{
                        margin-left: 2em;
                        background: dodgerblue;
                        border: none;
                        padding: 0.5em 2em;
                        color: white;
                        border-radius: 0.4em;
                        font-size: .9em;
                        font-weight: 600;
                        cursor: pointer;
                    }
                    #websocket button:disabled{
                        margin-left: 2em;
                        padding: 0.5em 2em;
                        border-radius: 0.4em;
                        font-size: .9em;
                        font-weight: 600;
                        background: revert;
                        border: revert;
                        color: revert;
                        cursor: revert;
                    }
                    #output{
                        list-style: none;
                    }
                    #output pre{
                        background: lightgray;
                        padding: 1em;
                        border: dashed 2px;
                        width: fit-content;
                        min-width: 80ch;
                    }
                    .stopweb{
                        background: black;
                        color: white;
                        font-family: monospace;
                        padding: 0.2em 0.4em;
                        margin-right: .5em;
                    }
                    ul.endpoints li{
                        position: relative;
                        display: block;
                        padding: 0.5em 2em;
                        border: solid 4px lightgoldenrodyellow;
                        background: darkseagreen;
                        margin-bottom: 0.5em;
                    }
                    ul.endpoints li a{
                        font-weight: 600;
                        text-decoration: none;
                        font-size: 1.5em;
                    }
                    ul.endpoints li button.fetch{
                        position: absolute;
                        right: -4em;
                        bottom: 0;
                        width: 3.5em;
                        height: 3.25em;
                        cursor: pointer;
                        display: fleX;
                        align-items: center;
                        justify-content: center;
                    }
                    h2{
                        font-size: 2em;
                        margin-bottom: 1em;
                        text-align: center;
                    }
                    .hostname{
                        padding: 0.5em 1em 0.5em 2em;
                        border: solid;
                        color: #555;
                        font-weight: 600;
                    }
                    ul.lista {
                        display: table;
                        width: 1%;
                        margin: 0 auto;
                        padding: 0;
                        list-style: none;
                    }
                    ul.lista li {
                        display: inline-block;
                        width: 100%;
                        box-sizing: border-box;
                        text-align: center;
                    }
                    #logout{
                        margin-left: 0.25em;
                        background: red;
                        border: none;
                        padding: 0.5em 3em;
                        color: white;
                        border-radius: 0.4em;
                        font-size: .9em;
                        font-weight: 600;
                        cursor: pointer;
                        line-height: 2;
                        margin-bottom: 2em;
                    }
                    .loader {
                        border: 4px solid #f3f3f3; /* Sfondo chiaro */
                        border-top: 4px solid #3498db; /* Colore bordo (Blu) */
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        animation: spin 2s linear infinite;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
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
                            document.querySelector('#output pre').innerHTML += '<strong style="color:green;">WebSocket connection established</strong>\\n';
                        };
                        ws.onmessage = function(event) {
                            const d = new Date();
                            const timestamp = d.getDate().toString().padStart(2,'0') + '/' + (d.getMonth()+1).toString().padStart(2,'0') + '/' + d.getFullYear() + ' ' + d.getHours().toString().padStart(2,'0') + '.' + d.getMinutes().toString().padStart(2,'0') + '.' + d.getSeconds().toString().padStart(2,'0');
                            document.querySelector('#output pre').innerHTML += '<strong>[' + timestamp +']</strong>\\n' + event.data + '\\n';
                        };
                        ws.onerror = function(error) {
                            document.querySelector('#output pre').innerHTML += '<strong style="color:red;">WebSocket error:</strong>\\n' + error + '\\n';
                        };
                        ws.onclose = function() {
                            document.querySelector('#output pre').innerHTML += '<strong style="color:red;">WebSocket connection closed</strong>\\n';
                            document.getElementById('connect').disabled = false;
                        }
                    }

                    async function fetchFromApi({ url, apikey } = {}) {
                        try{
                            const options = { method: 'GET', headers: { 'x-api-key': apikey } };
                            const response = await fetch(url, options);
                            const data = await response.json();
                            return data;
                        } catch (error) {
                            console.error('Errore durante il fetch:', error);
                            throw error;
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

                    async function logout() {
                        try {
                            const response = await fetch('/logout', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json',},
                            });

                            if (response.ok) {
                                window.location.href = '/login';
                            } else {
                                //console.error('Logout failed.');
                            }
                        } catch (error) {
                            //console.error('There was a problem with the logout request:', error);
                        }
                    }

                    function addFetchButtons(){

                        document.querySelectorAll('.endpoints li.fetch_enabled')
                            .forEach( li => {
                                const btn = \`
                                    <button class="fetch">
                                        <svg fill="green" version="1.1"" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 58.752 58.752" xml:space="preserve">
                                            <g>
                                                <path d="M52.524,23.925L12.507,0.824c-1.907-1.1-4.376-1.097-6.276,0C4.293,1.94,3.088,4.025,3.088,6.264v46.205
                                                    c0,2.24,1.204,4.325,3.131,5.435c0.953,0.555,2.042,0.848,3.149,0.848c1.104,0,2.192-0.292,3.141-0.843l40.017-23.103
                                                    c1.936-1.119,3.138-3.203,3.138-5.439C55.663,27.134,54.462,25.05,52.524,23.925z M49.524,29.612L9.504,52.716
                                                    c-0.082,0.047-0.18,0.052-0.279-0.005c-0.084-0.049-0.137-0.142-0.137-0.242V6.263c0-0.1,0.052-0.192,0.14-0.243
                                                    c0.042-0.025,0.09-0.038,0.139-0.038c0.051,0,0.099,0.013,0.142,0.038l40.01,23.098c0.089,0.052,0.145,0.147,0.145,0.249
                                                    C49.663,29.47,49.611,29.561,49.524,29.612z"/>
                                            </g>
                                        </svg>
                                        <div class="spinner" style="display: none;">
                                            <div class="loader"></div>
                                        </div>
                                    </button>
                                \`;
                                li.insertAdjacentHTML('beforeend', btn);
                            });

                        document.querySelectorAll('.endpoints li.fetch_enabled')
                            .forEach( li => {
                                const anchor = li.querySelector('a');
                                const fetchBtn = li.querySelector('button.fetch');
                                fetchBtn.dataset.url = anchor.href;
                                fetchBtn.addEventListener('click', async (event) => {
                                    const btn = event.currentTarget;
                                    const url = btn.dataset.url;
                                    btn.querySelector('.spinner').style.display = 'block';
                                    const result = await fetchFromApi({ url });
                                    btn.querySelector('.spinner').style.display = 'none';
                                    console.log(result);
                                });
                            });
                    }

                    document.addEventListener('DOMContentLoaded',()=>{
                        replacePlaceholders();
                        const wsUrl = getWebSocketURL('');
                        document.querySelector('#websocket .hostname').textContent = wsUrl;
                        document.getElementById('logout')
                            .addEventListener('click', ()=>{
                                logout();
                            });
                        addFetchButtons();
                    });

                </script>
            </head>
            <body>
                <div style="display: flex; justify-content: center;">
                    <button id="logout">Logout</button>
                </div>
                <h2>
                    <span class="stopweb">stopweb_</span>
                    <span>API Endpoints</span>
                </h2>
                <ul class="endpoints lista">
                    <li id="api_timbrature" class="fetch_enabled">
                        <a href="/stopweb/api/timbrature/[datainizio]/[datafine]" target="_blank">/stopweb/api/timbrature/&lt;dataInizio&gt;/&lt;dataFine&gt;</a>
                    </li>
                    <li id="api_report" class="fetch_enabled">
                        <a href="/stopweb/api/report/[datainizio]/[datafine]" target="_blank">/stopweb/api/report/&lt;dataInizio&gt;/&lt;dataFine&gt;</a>
                    </li>
                    <li id="api_preferiti" class="fetch_enabled">
                        <a href="/stopweb/api/preferiti" target="_blank">/stopweb/api/preferiti</a>
                    </li>
                    <li id="api_eventi" class="fetch_enabled">
                        <a href="/stopweb/api/eventi" target="_blank">/stopweb/api/eventi</a>
                    </li>
                    <li id="api_eventi_stato" class="fetch_enabled">
                        <a href="/stopweb/api/eventi/stato" target="_blank">/stopweb/api/eventi/stato</a>
                    </li>
                    <li id="api_eventi_update" class="fetch_enabled">
                        <a href="/stopweb/api/eventi/update" target="_blank">/stopweb/api/eventi/update</a>
                    </li>
                    <li id="api_login">
                        <a href="/stopweb/api/login" target="_blank">/stopweb/api/login</a>
                    </li>
                </ul>
                <h2><span class="stopweb">stopweb_</span> Events Websocket</h2>
                <ul class="lista">
                    <li id="websocket">
                        <span class="hostname"></span>
                        <span><input type="text" value="?"></span>
                        <button id="connect" onclick="this.disabled = true; connectToGivenPort();">connect</button>
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

        // Route to handle login form submission
        app.post('/login', express.urlencoded({ extended: true }), (req, res) => {
            const { apiKey } = req.body;
            if (config.isApiKeyValid(apiKey)) {
                // Set the cookie with the API key if it's valid
                res.cookie(AUTH_COOKIE_NAME, apiKey, { httpOnly: true, secure: true }); // Add 'secure: true' in production
                return res.redirect('/'); // Redirect to the home page or wherever appropriate
            }
            res.status(401).send('Invalid API Key');
        });
        // Route to serve the login page
        app.get('/login', (req, res) => {
            // Simplified HTML form for API key submission
            const htmlContent = `
            <style>
                .container {
                    font-size: 1.5em;
                    display: flex;
                    align-items: center;
                    height: 100vh;
                    justify-content: center;
                    gap: 1em;
                    flex-wrap: wrap;
                    flex-direction: column;
                }
                h1{
                    width: 100%;
                    text-align: center;
                }
                input[name="apiKey"]{
                    line-height: 1.5em;
                    font-size: 1em;
                    padding: 0 0 0 1em;
                }
                .btn {
                    font-size: 1em;
                    /*font-size: 16px;*/
                    cursor: pointer;
                    outline: 0;
                    color: #fff;
                    background-color: #0d6efd;
                    border-color: #0d6efd;
                    display: inline-block;
                    font-weight: 400;
                    line-height: 1.5;
                    text-align: center;
                    border: 1px solid transparent;
                    border-radius: .25rem;
                    padding: 0.2em 2em;
                    transition: color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out;
                    :hover {
                        color: #fff;
                        background-color: #0b5ed7;
                        border-color: #0a58ca;
                    }
                }
                .label{
                    padding: 0.5em 1em;
                    background: lightgoldenrodyellow;
                    border: solid 1px gray;
                    border-right: none;
                    font-family: monospace;
                    line-height: 1.5em;
                    font-size: 1em;
                }
                .stopweb{
                    background: black;
                    color: white;
                    font-family: monospace;
                    padding: 0.2em 0.4em;
                }
            </style>
            <form method="POST" action="/login">
                <div class="container">
                    <h1>
                        <span class="stopweb">stopweb_</span>
                        <span>://api</span>
                    </h1>
                    <div style="display: flex;">
                        <span class="label">API Key: </span>
                        <input type="text" name="apiKey">
                    </div>
                    <input class="btn" type="submit" value="Login">
                </div>
            </form>
            `;

            res.send(htmlContent);
        });
        app.post('/logout', (req, res) => {
            // Imposta il cookie per scadere immediatamente
            res.cookie('auth_key', '', { expires: new Date(0), path: '/', httpOnly: true, secure: true });

            // Puoi anche inviare una risposta per confermare il logout
            res.status(200).send('Logout successful');
        });

         //accendi autenticazione solo se le validKeys sono state caricate e siamo in modalità https (Quindi i pem file sono validi)
        if(config.validKeys !== null && httpsMode)
            app.use(checkAuthCookie);

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

        app.get('/stopweb/api/report/:dataInizio/:dataFine', async (req, res) => {
            const { dataInizio, dataFine } = req.params;
            let json = {error: 'error'};
            try{
                json = await apiReport({ dataInizio, dataFine });
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

        app.get('/', showIndex);
        app.get('/stopweb', showIndex);
        app.get('/stopweb/api', showIndex);


        let server;
        if(httpsMode){
            server = https.createServer(credentials, app);
            server.listen(port, () => {
                console.log(msgSuccess_api(port, 'https'));
                resolve({ server, https: true, auth: config.validKeys !== null});
            });
        }
        else{
            server = app.listen(port, () => {
                console.log(msgSuccess_api(port, 'http'));
                resolve({ server, https: false, auth: false });
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

async function apiReport({ dataInizio, dataFine } = {}){
    const json = await fetchGiornateCartellino(config.idDipendente, config.cookieHeader, dataInizio, dataFine);
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