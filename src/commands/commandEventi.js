import configurationSingleton from '../commons/config.js'
import chalk from 'chalk';
import { formatTimestamp } from '../commons/date.js';

const config = configurationSingleton.getInstance();

export function printEventi(){

    const eventi = config.readEventi();
    eventi.forEach(evento => {

        const payload = evento.payload;

        const timestamp = new Date(evento.timestamp);
        const timestampFormatted = formatTimestamp(timestamp);
        const eventName = chalk.blueBright(evento.evento.padEnd(40, '-'));

        const header = `${chalk.yellow(timestampFormatted)} ${eventName}`;

        const id = payload.idDipendente.toString().padEnd(4,' ');
        const nominativo = payload.nominativo.padEnd(30, '-');

        function formatStatoPresenza(stato){
            return (stato == 'P') ? chalk.greenBright.bold(stato) : chalk.redBright.bold(stato);
        }

        switch(evento.evento){
            case 'Pref_Nuovo':
            case 'Pref_Reset':
                const macrostato = formatStatoPresenza(payload.macrostato);
                console.log(`${header} ${id} ${nominativo} ${macrostato} O:${payload.oggi} D:${payload.domani}`);
                break;
            case 'Pref_CambioStato':
                const statoPrecedente = formatStatoPresenza(payload.precedente);
                const statoAttuale = formatStatoPresenza(payload.attuale);
                console.log(`${header} ${id} ${nominativo} ${statoPrecedente} => ${statoAttuale}`);
                break;
            case 'Pref_CambioGiust_Oggi-DomaniDiIeri':
            case 'Pref_CambioGiust_Oggi-OggiDiOggi':
            case 'Pref_CambioGiust_Domani-DomaniDiOggi':
                console.log(`${header} ${id} ${nominativo} ${payload.precedente} => ${payload.attuale}`);
                break;
            default:
        }
    });

}