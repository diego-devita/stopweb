import configurationSingleton from '../commons/config.js'
import readlineSync from 'readline-sync';

const config = configurationSingleton.getInstance();

export function commandClear({ domain, conferma = false } = {}){

    const basedir = config.getPathByDomain({ domain });

    if (!config.domainExists({ domain })){
        console.log(`Non è possibile continuare perché la directory ${basedir} non esiste.`);
        return;
    }

    let answer = 'S';
    if(conferma === false)
        answer = readlineSync.question(`Verrà cancellata la directory ${basedir}\nDesideri continuare? (S/N) `);

    if (answer.toUpperCase() === 'S') {
        config.clear({ domain });
        console.log(`La directory ${basedir} è stata rimossa.`);
    }
    else if (answer.toUpperCase() === 'N') {
        console.log('Operazione annullata.');
    }
    else {
        console.log('Operazione annullata.');
    }

}