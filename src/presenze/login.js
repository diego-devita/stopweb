import eventEmitterSingleton from '../commons/eventEmitter.js';
import { chromium } from 'playwright';

const events = eventEmitterSingleton.getInstance();

function isValidUrl(urlString) {
    try {
        new URL(urlString);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Esegue il login sul portale presenze
 *
 * @emits performLogin#login.invalid.url            args: { error }
 * @emits performLogin#login.invalid.username       args: { error }
 * @emits performLogin#login.invalid.password       args: { error }
 * @emits performLogin#login.error.username         args: { error }
 * @emits performLogin#login.error.password         args: { error }
 * @emits performLogin#login.before.authenticator   args:
 * @emits performLogin#login.success.authenticator  args:
 * @emits performLogin#login.before.username        args:
 * @emits performLogin#login.success.username       args:
 * @emits performLogin#login.before.password        args:
 * @emits performLogin#login.success.password       args:
 * @emits performLogin#login.success.2FA            args: { code2FA }
 * @emits performLogin#login.success.landed         args: { cookieHeader }
 * @emits performLogin#login.success.idDipendente   args: { idDipendente }
 * @emits login.success.completed'                  args: { idDipendente, cookieHeader }
 *
 * @param {string} username
 * @param {string} password
 */
export async function performLogin({
    headless = true,
    url,
    expectedLandingPage = '**/default.aspx*',
    username,
    password,
    timeoutSeconds = 60
}) {

    if(!url || !isValidUrl(url)){
        const error = new Error('url non valido');
        error.details = 'login';
        events.emit('login.invalid.url', error);
        throw error;
    }

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
        const error = new Error('username non valida');
        error.details = 'login';
        events.emit('login.invalid.username', error);
        throw error;
    }

    if (!password || typeof password !== 'string' || password.trim().length === 0) {
        const error = new Error('password non valida');
        error.details = 'login';
        events.emit('login.invalid.password', error);
        throw error;
    }

    //funzione che restituisce il valore del cookie header dal contesto di page
    const getCookieHeader = async (page) => {
        const cookies = await page.context().cookies();
        const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        return cookieHeader;
    }

    let resolveIdDipendentePromise;
    const idDipendentePromise = new Promise((resolve) => {
        resolveIdDipendentePromise = resolve;
    });

    //funzione che risolve idDipendentePromise con il valore idDipendente
    //viene usata come handler dell'event onRequest emesso da page
    //e che cerca il parameter iddip tra le richieste fatte dalla pagine visitate
    const requestInspectorForIdDipendente = async function (request) {
        const url = request.url();
        if (url.includes('iddip')) {
            const urlObj = new URL(url);
            const iddip_value = urlObj.searchParams.get('iddip');
            page.removeListener('request', requestInspectorForIdDipendente);
            resolveIdDipendentePromise(iddip_value);
        }
    }

    //lancia il browser e apre una nuova pagina
    const browser = await chromium.launch({ headless });
    const page = await browser.newPage();

    //visita la pagina di login
    events.emit('login.before.authenticator');
    await page.goto(url, { waitUntil: 'networkidle' });
    events.emit('login.success.authenticator');

    //compila username e submit
    events.emit('login.before.username');
    await page.locator('[name="loginfmt"]').fill(username);
    await page.locator('input[type="submit"]').click();

    //aspetta che uno dei due eventi sia avvenuto,
    const esitoUsername = await Promise.race([
        //se compare il campo password, ritorna 'passwordReady'
        page.waitForSelector('[name="passwd"]:not(.moveOffScreen)').then(() => 'passwordReady'),
        //se compare il msg di username errato, ritorna 'usernameError'
        page.waitForSelector('#usernameError').then(() => 'usernameError')
    ]);

    if (esitoUsername === 'usernameError') {
        const errorMessageShown = await page.locator('#usernameError').textContent();
        const error = new Error(errorMessageShown);
        error.details = 'login';
        events.emit('login.error.username', error);
        throw error;
    }

    events.emit('login.success.username');

    //compila password e submit
    events.emit('login.before.password');
    await page.locator('[name="passwd"]').fill(password);
    await page.locator('input[type="submit"]').click();

    //aspetta che uno dei due eventi sia avvenuto,
    const esitoPassword = await Promise.race([
        //se compare il codice 2FA, ritorna '2FAReady'
        page.waitForSelector('#idRichContext_DisplaySign').then(() => '2FAReady'),
        //se compare il msg di password erroata, ritorna 'PasswordError'
        page.waitForSelector('#passwordError').then(() => 'PasswordError')
    ]);

    if (esitoPassword === 'PasswordError') {
        const errorMessageShown = await page.locator('#passwordError').textContent();
        const error = new Error(errorMessageShown);
        error.details = 'login';
        events.emit('login.error.password', error);
        throw error;
    }

    events.emit('login.success.password');

    //legge il codice 2FA
    const code2FA = await page.locator('#idRichContext_DisplaySign').textContent();

    events.emit('login.success.2FA', { code2FA });

    //attende che il sito reagisca all'autenticazione cambiando indirizzo
    await Promise.all([
        page.waitForURL(expectedLandingPage, { timeout: timeoutSeconds*1000 }),
        //page.waitForSelector('selector_of_an_element_on_the_target_page', { timeout: 60000 }),
    ]);

    //recupera i cookie
    const cookieHeader = await getCookieHeader(page);

    events.emit('login.success.landed', { cookieHeader });

    //aggancia un handler all'event request di page (che serve ad intercettare richieste contenenti iddip)
    page.on('request', requestInspectorForIdDipendente);
    //attende che la promise idDipendentePromise sia stata risolta dall'handler dell'evento onRequest
    const idDipendente = await idDipendentePromise;

    events.emit('login.success.idDipendente', { idDipendente });

    //chiude il browser
    await browser.close();

    events.emit('login.success.completed',  {idDipendente, cookieHeader});
}