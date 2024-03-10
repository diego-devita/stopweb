import eventEmitterSingleton from '../commons/eventEmitter.js';
import { performLogin } from '../presenze/login.js';

import configurationSingleton from '../commons/config.js'

import chalk from 'chalk';

const events = eventEmitterSingleton.getInstance();
const config = configurationSingleton.getInstance();

export async function commandLogin({
    headless = true,
    url,
    expectedLandingPage,
    username,
    password,
    timeoutSeconds = 60,
    p = printConsole
}) {

    const stileSuccess = chalk.green.bold;
    const stileFailure = chalk.red.bold;
    const stileInfo = chalk.bgBlue.bold;

    events.on('login.invalid.url', ({ error }) => {
        p('\nLogin fallita - la url inserita non è valida.\n');
    });

    events.on('login.invalid.username', ({ error }) => {
        p('\nLogin fallita - la username inserita non è valida.\n');
    });

    events.on('login.invalid.password', ({ error }) => {
        p('\nLogin fallita - la password inserita non è valida.\n');
    });

    events.on('login.error.url', ({ error }) => {
        p('\nLogin fallita - la url da visitare per il login non è valida.\n');
    });

    events.on('login.error.username', ({ error }) => {
        p(stileFailure('KO.') + '\nLogin fallita - la username non è stata riconosciuta.\n');
    });

    events.on('login.error.password', ({ error }) => {
        p(stileFailure('KO.') + '\nLogin fallita - la password non è corretta.\n');
    });

    events.on('login.before.authenticator', () => {
        p('In attesa di MS Authenticator...');
    });

    events.on('login.success.authenticator', () => {
        p(stileSuccess('OK.'), true);
    });

    events.on('login.before.username', () => {
        p('Username...');
    });

    events.on('login.before.password', () => {
        p('Password...');
    });

    events.on('login.success.username', () => {
        p(stileSuccess('OK.'), true);
    });

    events.on('login.success.password', () => {
        p(stileSuccess('OK.'), true);
    });

    events.on('login.success.2FA', ({ code2FA }) => {
        p('Il codice 2FA è: ' + stileInfo(` ${code2FA} `), true);
        p('La pagina è in attesa...');
    });

    events.on('login.success.landed', ({ cookieHeader }) => {
        p(stileSuccess('OK.'), true);
        p('\n' + stileSuccess('Login avvenuta con successo!'), true);
        p('\nIn attesa di recuperare l\'id dipendente...');
    });

    events.on('login.success.idDipendente', ({ idDipendente }) => {
        p(stileInfo(` ${idDipendente} `), true);
    });

    events.on('login.success.completed', ( {idDipendente, cookieHeader} ) => {
        config.setCookieHeader(cookieHeader);
        config.setIdDipendente(idDipendente);

        p(`\nL'operazione è completata.`, true);
    });

    await performLogin({
        headless,
        url,
        expectedLandingPage,
        username,
        password,
    });
}

function printConsole(message, addNewLine = false){
    return new Promise((resolve) => {
      const output = addNewLine ? `${message}\n` : message;
      process.stdout.write(output, 'utf-8', () => { resolve(); });
    });
};