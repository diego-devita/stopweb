import {minutiFormatter, isOrarioInRange, parseDateYYYYMMDD, addFormatterPartsToDate} from '../commons/date.js';

import configurationSingleton from '../commons/config.js'
const config = configurationSingleton.getInstance();

export function transformGiornate(originalData){

    const giornateTransformed = {};

    originalData.result.sintesi.data
        .forEach(giornata => {
            const giornataTransformed = trasformGiornata(giornata);
            giornateTransformed[giornataTransformed.data.YYYYMMDD] = giornataTransformed;
        });

    return giornateTransformed;
}

function trasformGiornata(giornata){

    /*
    0	_iiddip
    1	_dtdata
    2	_50statopdl
    3	_istato
    4	_6codorario
    5	_60descrorario
    6	_121nominativo
    7	_60cognome
    8	_60nome
    9	_128dipimage
    10	_10matricola
    11	_20codanagest
    12	_16codfisc
    13	_20libero
    14	_foreminime
    15	_foremedie
    16	_fsvolto
    17	_ftotaa
    18	_ftotoo
    19	_ftotin
    20	_ftotsg
    21	_ftotsp
    22	_jslistaanomalie
    23	_jslistatimbvariate
    24	_jslistatimboriginali
    25	_jslistatimborigvariate
    26	_jslistatimbrwebbreve
    27	_jslistaautstrafasce
    28	_jslistavbdescrestesa
    29	_jslistagiustiftw
    30	_jslistagiustifweb
    31	_jslistavbriportodescr
    */

    const data0  = giornata[0];  //id dipendente
    const data1  = giornata[1];  //YYYYMMDD000000
    const data2  = giornata[2];  //"DA ELAB" / "ELAB GG" / "ELAB P3"
    const data5  = giornata[5];  //"07.12 ingresso 08.00 entro le 09.30 COM" / "SABATO" / "DOMENICA" / "FESTIVO" / "Stakeholder Satisfaction 07.12"
    const data6  = giornata[6];  //"COGNOME NOME"
    const data7  = giornata[7];  //"COGNOME"
    const data8  = giornata[8];  //"NOME"
    const data15 = giornata[15]; //432 (MINUTI DA LAVORARE)
    const data16 = giornata[16]; //512 (MINUTI LAVORATI)
    const data22 = JSON.parse(giornata[22]); //NON È CHIARO - { meta: [_255note, _30descr, _1tiposegnalazcod, _4tiposegnalazdescr, data: [] }
    const data23 = JSON.parse(giornata[23]); //TIMBRATURE - { meta: [_1verso, _iminuti], data: [["E",482],["U",756],["E",787],["U",1049]] }
    const data26 = JSON.parse(giornata[26]); //NON È CHIARO - { meta: [_iiddocumento, _1tipo, _60descr, _iore, _10verso], data: [] }
    const data28 = JSON.parse(giornata[28]); //VOCI ELABORATE - { meta: [_30descr, _ivalore, _2tipov], data: [] }
    const data29 = JSON.parse(giornata[29]); //NON È CHIARO - { meta: [_iiddocumento, _1tipo, _60descr, _iorainizio, _iorafine, _idurata, _50tipodescr, _20nomefiglio], data: [] }
    const data30 = JSON.parse(giornata[30]); //NON È CHIARO - { meta: [_iiddocumento, _1tipo, _60descr, _iorainizio, _iorafine, _idurata, _50tipodescr, _20nomefiglio, _20esito], data: [] }

    const idDipendente = data0;
    const dettagliFinestraIngressoEOreGiorno = data5;

    const giornataYYYYMMDD = data1.slice(0,8);
    const dataDelGiorno = parseDateYYYYMMDD(giornataYYYYMMDD);
    addFormatterPartsToDate(dataDelGiorno);

    //tengo traccia di data2 e data5 nel dump globale
    config.pushEntryInDump('data2', data2, dataDelGiorno.DDMMYYYY_dash, data2);
    config.pushEntryInDump('data5', data5, dataDelGiorno.DDMMYYYY_dash, data5);

    //tiene traccia delle data entries nel global dump
    config.pushEntriesInDump('data22', data22.data, dataDelGiorno.DDMMYYYY_dash, 0);
    config.pushEntriesInDump('data23', data23.data, dataDelGiorno.DDMMYYYY_dash, 0);
    config.pushEntriesInDump('data26', data26.data, dataDelGiorno.DDMMYYYY_dash, 0);
    config.pushEntriesInDump('data28', data28.data, dataDelGiorno.DDMMYYYY_dash, 0);
    config.pushEntriesInDump('data29', data29.data, dataDelGiorno.DDMMYYYY_dash, 2);
    config.pushEntriesInDump('data30', data30.data, dataDelGiorno.DDMMYYYY_dash, 2);

    let tipoGiorno = '';
    switch (dettagliFinestraIngressoEOreGiorno){
        case 'FESTIVO':
            tipoGiorno = 'Festivo';
            break;
        case 'SABATO':
            tipoGiorno = 'Sabato';
            break;
        case 'DOMENICA':
            tipoGiorno = 'Domenica';
            break;
        default:
            if( dettagliFinestraIngressoEOreGiorno?.includes('Stakeholder Satisfaction'.toLowerCase()) )
                tipoGiorno = dettagliFinestraIngressoEOreGiorno; //'STAKEHOLDER SATISFACTION'
            else
                tipoGiorno = 'Ordinario';
    }

    let smartWorking = false;
    let ferie = false;
    let buonoPasto = false;
    let trasferta = false;
    let rol = 0;
    let minutiPermessi = 0;

    //per ogni voce elaborata
    for(let entry of data28.data){

        const descrizione = entry[0];
        const valore = entry[1];
        const tipo = entry[2];

        if (descrizione == 'SMART WORKING'){
            smartWorking = true;
        }
        else if(descrizione == 'FERIE'){
            ferie = true;
        }
        else if(descrizione == 'BUONO PASTO'){
            buonoPasto = true;
        }
        else if(descrizione.toUpperCase().includes('TRASFERTA')){
            trasferta = true;
        }
        else if(descrizione == 'ROL' || descrizione == 'BANCA ORE GODUTA'){
            rol = parseInt(valore);
            minutiPermessi += rol;
        }
    }

    const timbratureDelGiornoOriginali = data23.data;

    const timbratureDelGiorno =
        timbratureDelGiornoOriginali
            .map(entry => {
                const versoU1 = entry[0];
                const minuti = parseInt(entry[1]);

                const orario = minutiFormatter(minuti);
                const verso = versoU1 === "E" ? "Entrata" : "Uscita";
                const minutiCalcolato = parseInt(orario.hh) * 60 + parseInt(orario.mm);

                return {
                    versoU1,
                    verso,
                    hhmm: orario.hhmm,
                    hh: orario.hh,
                    mm: orario.mm,
                    minuti,
                    minutiCalcolato
                };
            });

    const intervalli = calcolaIntervalli(timbratureDelGiorno);
    const pranzo = calcolaDettaglioPranzo(intervalli.assenze);
    const aspettativa = calcolaAspettativa(timbratureDelGiorno, intervalli, pranzo, minutiPermessi);

    return {
        data: dataDelGiorno,
        tipoGiorno,

        intervalli,
        pranzo,
        aspettativa,
        timbrature: timbratureDelGiorno,
        minutiLavorati: parseInt(data16),

        buonoPasto,
        smartWorking,
        ferie,
        trasferta,

        rol,
        minutiPermessi
    };
}

function calcolaIntervalli(timbratureDelGiorno) {

    let presenzaMinuti = 0;
    let assenzaMinuti = 0;
    let presenze = [];
    let assenze = [];

    let timbraturaPrecedente;
    let versoPrecedente = 'U';
    let minutiPrecedenti = 0;

    let anomalia = false;
    let timbratureValide = 0;

    for(let [i, timbratura] of timbratureDelGiorno.entries()){

        //se il verso di uscita AND si tratta della prima timbratura
        if(timbratura.versoU1 == 'U' && i == 0){
            anomalia = true;
            break;
        }

        //se il verso è come quella della timbratura precedente
        if(timbratura.versoU1 == versoPrecedente){
            anomalia = true;
            break;
        }

        if(i > 0){
            const delta = timbratura.minutiCalcolato - minutiPrecedenti;
            if(timbratura.versoU1 == 'E'){
                assenzaMinuti += delta;
                assenze.push({ t1: timbraturaPrecedente, t2: timbratura, delta: minutiFormatter(delta) });
            }
            else{
                //il conteggio delle timbrature valide, vale solo per le presenze e precede di 2
                timbratureValide += 2;
                presenzaMinuti += delta;
                presenze.push({ t1: timbraturaPrecedente, t2: timbratura, delta: minutiFormatter(delta) });
            }
        }

        versoPrecedente = timbratura.versoU1;
        minutiPrecedenti = timbratura.minutiCalcolato;
        timbraturaPrecedente = timbratura;
    }

    if(!anomalia && versoPrecedente == 'E')
        anomalia = true;

    return {
        anomalia,
        timbratureValide,
        presenza: minutiFormatter(presenzaMinuti),
        assenza: minutiFormatter(assenzaMinuti),
        presenze: presenze, //presenze.map(minuti => minutiFormatter(minuti)),
        assenze: assenze, //assenze.map(minuti => minutiFormatter(minuti)),
    };
};

function calcolaDettaglioPranzo(assenze){

    const durataPranzo = config.get('cartellino.minutiPausaPranzoObbligatoria');
    const rangeUscitaPranzo = ['12:30','14:30'];
    for(let assenza of assenze){
        if( isOrarioInRange(assenza.t1.hhmm, rangeUscitaPranzo) ){
            return {
                assenza: assenza,
                deficit: durataPranzo - assenza.delta.minutiTotali,
                isValido: assenza.delta.minutiTotali >= durataPranzo
            }
        }
    }

    return {};
}

function calcolaAspettativa(timbrature, intervalli, pranzo, minutiPermessi = 0){

    //07:12
    //let minutiPresenzaRichiesti = 432;

    let minutiPresenzaRichiesti = config.get('cartellino.minutiPresenzaRichiesti');
    const minutiPausaPranzoObbligatoria = config.get('cartellino.minutiPausaPranzoObbligatoria');

    if(timbrature.length == 0)
        return {};

    //dovresti considerare il caso in cui hai fatto una presenza < 6H e il pranzo non si conta
    if(pranzo && pranzo.deficit > 0)
        minutiPresenzaRichiesti += pranzo.deficit;
    if(Object.keys(pranzo).length === 0)
        minutiPresenzaRichiesti += minutiPausaPranzoObbligatoria;//30;

    let orarioDiUscitaRichiesto = timbrature[0].minutiCalcolato + intervalli.assenza.minutiTotali + minutiPresenzaRichiesti;

    return {
        uscitaSenzaPermessi: minutiFormatter(orarioDiUscitaRichiesto),
        deficitSenzaPermessi:  minutiFormatter(minutiPresenzaRichiesti - intervalli.presenza.minutiTotali),

        uscita: minutiFormatter(orarioDiUscitaRichiesto - minutiPermessi),
        deficit:  minutiFormatter(minutiPresenzaRichiesti - intervalli.presenza.minutiTotali - minutiPermessi)
    }
}

export function creaGiornataBlank(YYYYMMDD) {

    const dataDelGiorno = parseDateYYYYMMDD(YYYYMMDD);
    addFormatterPartsToDate(dataDelGiorno);

    return {
        data: dataDelGiorno,
        origin: 'BLANK',
        tipoGiorno: /*undefined*/'Blank',
        intervalli: calcolaIntervalli([]),
        pranzo: {},
        aspettativa: {},
        timbrature: [],
        minutiLavorati: 0,
        buonoPasto: undefined,
        smartWorking: undefined,
        ferie: undefined,
        trasferta: undefined,
        rol: undefined,
        minutiPermessi: undefined,
    };
}