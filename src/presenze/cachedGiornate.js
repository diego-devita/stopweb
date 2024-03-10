import configurationSingleton from '../commons/config.js'

import { creaGiornataBlank } from './giornateTransformer.js'

const config = configurationSingleton.getInstance();

function formatDate(date) {
    let d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('');
}

function generateDateRange(start, end) {
    let startDate = new Date(start.substring(0, 4), parseInt(start.substring(4, 6)) - 1, start.substring(6, 8));
    let endDate = new Date(end.substring(0, 4), parseInt(end.substring(4, 6)) - 1, end.substring(6, 8));

    let dateArray = [];
    let currentDate = startDate;
    while (currentDate <= endDate) {
        dateArray.push(formatDate(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dateArray;
}

function stringifyWithOrderedDates(giornate) {
    const orderedKeys = Object.keys(giornate).sort((a, b) => a.localeCompare(b));

    const orderedObject = {};
    for (const key of orderedKeys) {
        orderedObject[key] = giornate[key];
    }

    return JSON.stringify(orderedObject, null, 2);
}

export function isDateInRange(today, dataInizio, dataFine){
    let allDates = generateDateRange(dataInizio, dataFine);
    return allDates.includes(today);
}

export function findUncoveredIntervals(giornate, dataInizio, dataFine) {
    let allDates = generateDateRange(dataInizio, dataFine);
    let uncoveredDates = allDates.filter(date => !giornate.hasOwnProperty(date));

    let uncoveredIntervals = [];
    if (uncoveredDates.length > 0) {
        let start = uncoveredDates[0];
        let end = start;

        for (let i = 1; i < uncoveredDates.length; i++) {
            let currentDate = uncoveredDates[i];
            let previousDate = uncoveredDates[i - 1];
            let diff = (new Date(currentDate.substring(0, 4), parseInt(currentDate.substring(4, 6)) - 1, currentDate.substring(6, 8)) - new Date(previousDate.substring(0, 4), parseInt(previousDate.substring(4, 6)) - 1, previousDate.substring(6, 8))) / (1000 * 60 * 60 * 24);

            if (diff > 1) {
                uncoveredIntervals.push([start, end]);
                start = currentDate;
            }
            end = currentDate;
        }
        uncoveredIntervals.push([start, end]);
    }

    return uncoveredIntervals;
}

export function readGiornate(){

    function reviver(giornate) {
        for(let key in giornate){
            const raw = giornate[key].data.date;
            giornate[key].data.date = new Date(raw);
            giornate[key].origin = 'CACHE';
        }
    }

    try{
        const o = config.getGiornate();
        const parsed = JSON.parse(o);
        reviver(parsed);
        return parsed;
    }catch(e){
        //ritorna oggetto vuoto senza risollevare eccezione (significa che la cache è vuota)
        return {};
    }
}

export function writeGiornate(giornate){
    const o = stringifyWithOrderedDates(giornate);
    config.setGiornate(o);
}

export function creaIntervalloGiornateBlank(inizio, fine) {

    function parseDataYYYYMMDD(dataYYYYMMDD) {
        const anno = parseInt(dataYYYYMMDD.substring(0, 4), 10);
        const mese = parseInt(dataYYYYMMDD.substring(4, 6), 10) - 1;
        const giorno = parseInt(dataYYYYMMDD.substring(6, 8), 10);
        return new Date(anno, mese, giorno);
    }

    const dateInizio = parseDataYYYYMMDD(inizio);
    const dateFine = parseDataYYYYMMDD(fine);
    const dateBlank = {};

    for (let d = dateInizio; d <= dateFine; d.setDate(d.getDate() + 1)) {
        const dataFormatoYYYYMMDD = d.toISOString().split('T')[0].replace(/-/g, '');
        dateBlank[dataFormatoYYYYMMDD] = creaGiornataBlank(dataFormatoYYYYMMDD);
    }

    return dateBlank;
}