import configurationSingleton from '../commons/config.js'
import chalk from 'chalk';
import { formatTimestamp } from '../commons/date.js';

const config = configurationSingleton.getInstance();

const style = {};

style.oggi = chalk.blueBright;
style.domani = chalk.blueBright;
style.true = chalk.green.bold;
style.false = chalk.red.bold;
style.null = chalk.magenta;
style.freccia = chalk.blueBright;
style.chiave = chalk.yellow;
style.colon = chalk.dim;
style.separator = chalk.dim;

style.eventName = chalk.blueBright;
style.timestamp = chalk.yellow;
style.nominativo = chalk.dim;

style.presente = chalk.greenBright.bold;
style.assente = chalk.redBright.bold;

style.dim = chalk.dim;

function printEventi(eventi){

    eventi.forEach(evento => {

        const payload = evento.payload;

        const timestamp = new Date(evento.timestamp);
        const timestampFormatted = formatTimestamp(timestamp);
        const eventName = style.eventName(evento.evento.padEnd(40, '-'));

        const header = `${style.timestamp(timestampFormatted)} ${eventName}`;
        let id, nominativo;
        if(evento.evento.startsWith('Pref_')){
            id = payload.idDipendente.toString().padEnd(4,' ');
            nominativo = style.nominativo (payload.nominativo.padEnd(30, '-'));
        }

        function formatStatoPresenza(stato){
            return (stato == 'P') ? style.presente.bold(stato) : style.assente.bold(stato);
        }

        function formatGiust(g){
            if(g=='NULL')
                return style.null('    ' + g + '   ');
            function parseString(input) {
                const parts = input.split(';');
                let result = [];
                parts.forEach(part => {
                    if(part) {
                        const [key, value] = part.split(':');
                        result.push({key, value});
                    }
                });
                return result;
            }
            const p = parseString(g);
            let styled = [];
            p.forEach(part =>
                styled.push(
                    style.chiave(part.key)
                    /*+ ':'*/
                    + ( (part.value == '1') ? style.true(part.value) : style.false(part.value) )
                    /*+ style.separator('/')*/
                )
            );
            return styled.join(style.separator('|'));
        }

        switch(evento.evento){
            case 'Timbr_NuovoGiorno':
                console.log(`${header} ${payload.giorno} ${payload.timbrature}`);
                break;
            case 'Timbr_Cambio':
                console.log(`${header} ${payload.giorno} ${payload.dopo}`);
                break;
            case 'Pref_Nuovo':
            case 'Pref_Reset':
                const macrostato = formatStatoPresenza(payload.macrostato);
                console.log(`${header} ${id} ${nominativo} ${macrostato} ${style.oggi('OGG')}${style.colon(':')}${formatGiust(payload.oggi)} ${style.domani('DOM')}${style.colon(':')}${formatGiust(payload.domani)}`);
                break;
            case 'Pref_CambioStato':
                const statoPrecedente = formatStatoPresenza(payload.precedente);
                const statoAttuale = formatStatoPresenza(payload.attuale);
                console.log(`${header} ${id} ${nominativo} ${statoPrecedente} => ${statoAttuale}`);
                break;
            case 'Pref_CambioGiust_Oggi-DomaniDiIeri':
            case 'Pref_CambioGiust_Oggi-OggiDiOggi':
            case 'Pref_CambioGiust_Domani-DomaniDiOggi':
                console.log(`${header} ${id} ${nominativo} ${formatGiust(payload.precedente)} => ${formatGiust(payload.attuale)}`);
                break;
            default:
        }
    });

}

export function printCodaEventi(){
    const eventi = config.readEventi();
    printEventi(eventi);
}

export function printStoriaEventiDelGiorno(YYYYMMDD){
    const eventiByDipendente = config.readStoriaEventiDelGiorno(YYYYMMDD);
    Object.keys(eventiByDipendente)
        .forEach(idDipendente => {
            console.log('-'.repeat(130));
            printEventi(eventiByDipendente[idDipendente]);
        })
}

export function storicizzaCodaEventi(){
    const eventi = config.readEventi();
    const eventiByDay = config.storicizza(eventi);
    Object.keys(eventiByDay)
        .forEach(day => {
            const storiaEventiDelGiorno = eventiByDay[day];
            const YYYYMMDD = day.replace(/-/g, '');
            config.appendToStoriaEventiDelGiorno(YYYYMMDD, storiaEventiDelGiorno)
        });
    //svuota lista eventi
}