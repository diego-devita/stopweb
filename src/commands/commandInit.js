import configurationSingleton from '../commons/config.js'
import chalk from 'chalk';
import inquirer from 'inquirer';

import stringWidth from 'string-width';

import { printHeader } from './commandHelp.js';

const config = configurationSingleton.getInstance();

function printManifesto(){

    const manifesto = [];
    //manifesto.push('');
    manifesto.push('                       ' + chalk.bold(` ${config.nome} `) + ('- MANI(FESTO)AVANTI'));
    manifesto.push('                    Criticità e condizioni di utilizzo');
    manifesto.push('==========================================================================');
    manifesto.push('');
    manifesto.push(' Lo strumento è stato sviluppato per accelerare le operazioni di');
    manifesto.push(' consultazione delle presenze in azienda.');
    manifesto.push(' ');
    manifesto.push(' Fa risparmiare tempo e permette di fare calcoli rapidamente sul')
    manifesto.push(' tempo lavorato per semplificare la rendicontazione.');
    manifesto.push(' ');
    manifesto.push(` In ogni caso ${chalk.underline.bold('non si può sostituire allo strumento ufficiale')}`);
    manifesto.push(' che va preferito per l\'attendibilità dei risultati.');
    manifesto.push(' ');
    manifesto.push(` Questo invece presenta delle criticità:`);
    manifesto.push(' ');
    manifesto.push('  - Fa i calcoli delle pres./assen. basandosi solo sulle timbrature');
    manifesto.push('  - Non è mai la verità, ma un prodotto delle sue considerazioni;');
    manifesto.push('  - TRASFERTA e SMART WORKING non fanno PRESENZA (come fosse FESTIVO);');
    manifesto.push('  - Non restituisce i contatori (ferie, permessi, etc...);');
    manifesto.push('  - Non entra nel merito dei giustificativi ma solo delle voci elaborate;');
    manifesto.push('  - FORSE(?) il sito presenze preferisce non essere interrogato;');
    manifesto.push(' ');
    manifesto.push(' Inoltre:');
    manifesto.push(' ');
    manifesto.push(`  Mantiene sulla dir ${chalk.dim('<profilo>/userdata')} tutte le informazioni in chiaro;`);
    manifesto.push(`  ${chalk.dim('<profilo>/config/configuration.yaml')} può conservare le credenziali;`);
    manifesto.push(`  ${chalk.dim('<profilo>/userdata/auth')} conserva i cookie in chiaro;`);
    manifesto.push(`  ${chalk.dim('<profilo>/userdata/cache')} conserva cache dipendenti e timbrature;`);
    manifesto.push(`  ${chalk.dim('<profilo>/userdata/logs')} conserva i log (con informazioni sensibili?);`);
    manifesto.push('');

    if(!config.isTosAccepted()){
        manifesto.push('--------------------------------------------------------------------------');
        manifesto.push(chalk.bold('QUINDI'));
        manifesto.push('');
        manifesto.push('Se nonostante tutte le problematiche e i fattori di rischio,');
        manifesto.push('si vuole comunque usare tutte le funzionalità di questo strumento,');
        manifesto.push('è necessario prima accettarne le condizioni e tenerle bene a mente!');
        manifesto.push('');
        manifesto.push('Per farlo e quindi sbloccare lo strumento: ' + chalk.dim(`${config.nome} condizioni --accetta`));
        manifesto.push(' '.padEnd(43, ' ') + chalk.dim(`${config.nome} maniavanti --stacce`));
        manifesto.push('');
    }else{
        manifesto.push(chalk.bgGreen.black.bold('                                                                          '));
        manifesto.push(chalk.bgGreen.black.bold('                    LE CONDIZIONI SONO STATE ACCETTATE                    '));
        manifesto.push(chalk.bgGreen.black.bold('                                                                          '));
    }

    printHeader(78);
    printBox(manifesto.join('\n'), 74, 1);
    //console.log( manifesto.join('\n  ') );
}

export function commandManifesto(){
    printManifesto();
}

export async function commandInit(){
    if(!config.isTosAccepted()){
        const question = [
            {
              type: 'confirm',
              name: 'proceed',
              message: 'Dopo aver letto le condizioni vuoi accettarle e continuare?',
              default: false,
            },
        ];
        const answers = await inquirer.prompt(question);
        //se la risposta è si
        if (answers.proceed) {
            config.acceptTos();
            console.log('');
            console.log('Le condizioni sono state accettate!');
            return;
        }
        //se la risposta è no
        else {
            console.log('Operazione annullata. Le condizioni non sono state accettate.');
            return;
        }
    }else{
        console.log('Le condizioni sono già state accettate!');
    }
}

function printBox(content, width, paddingLeft = 1){
    const borderTL = chalk.dim('╔');
    const borderTR = chalk.dim('╗');
    const borderBL = chalk.dim('╚');
    const borderBR = chalk.dim('╝');
    const borderH  = chalk.dim('═');
    const borderV  = chalk.dim('║');

    console.log(borderTL + borderH.repeat(width+paddingLeft*2) + borderTR);
    const contentFramed = content.split('\n').map( line => borderV + ' '.repeat(paddingLeft) + line + ' '.repeat(width-stringWidth(line)) + ' '.repeat(paddingLeft) + borderV).join('\n');
    console.log(contentFramed);
    console.log(borderBL + borderH.repeat(width+paddingLeft*2) + borderBR);
}