export function getNowTimestamp(){
    const now = new Date();
    return formatTimestamp(now);
}

export function formatTimestamp(date){
    return `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}:${date.getSeconds().toString().padStart(2,'0')}`;
}

export function minutiFormatter(minuti){

    const parteOre = Math.floor(Math.abs(minuti) / 60);
    const parteMinuti = Math.abs(minuti) % 60;
    const hh = parteOre.toString().padStart(2, '0');
    const mm = parteMinuti.toString().padStart(2, '0');
    const h = hh[1];

    return {
        minutiTotali: parseInt(minuti),
        ore: parteOre,
        minuti: parteMinuti,
        hh,
        mm,
        hhmm: `${hh}:${mm}`,
        hhmm_signed_deficit: `${(minuti<0)?'-':'+'}${hh}:${mm}`,
        hhmm_signed_surplus: `${(minuti>0)?'-':'+'}${hh}:${mm}`,
        isNegative: minuti < 0,

        h,
        hmm: `${h}:${mm}`,
        hmm_signed_deficit: `${(minuti<0)?'-':'+'}${h}:${mm}`,
        hmm_signed_surplus: `${(minuti>0)?'-':'+'}${h}:${mm}`,
    }
}

export function isOrarioInRange(orario, [inizio, fine]){
    const toMinuti = (orario) => {
        const [ore, minuti] = orario.split(':').map(Number);
        return ore * 60 + minuti;
    }

    const orarioMinuti = toMinuti(orario);
    const inizioMinuti = toMinuti(inizio);
    const fineMinuti = toMinuti(fine);

    return orarioMinuti >= inizioMinuti && orarioMinuti <= fineMinuti;
}

export function parseOrario(orario){
    let result = {
        sign: '',
        hours: 0,
        minutes: 0,
        minutesAmount: 0
    };

    if (orario.startsWith('+') || orario.startsWith('-')) {
        result.sign = orario.charAt(0);
        orario = orario.substring(1);
    }

    const parts = orario.split(':');
    result.hours = parseInt(parts[0], 10);
    result.minutes = parseInt(parts[1], 10);

    result.minutesAmount = result.hours * 60 + result.minutes;

    if (result.sign === '-') {
        result.minutesAmount *= -1;
    }

    return result;
}

export function isDateInRange(data, [inizio, fine]) {
    return inizio <= data && data <= fine;
}

export function parseDateYYYYMMDD(YYYYMMDD){

    const anno = YYYYMMDD.substring(0, 4);
    const mese = YYYYMMDD.substring(4, 6);
    const giorno = YYYYMMDD.substring(6, 8);

    const date = new Date(anno, mese-1, giorno);

    const giorni = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const giornoSettimana = giorni[date.getDay()];
    const giornoSettimanaU3 = giornoSettimana.toUpperCase().substring(0, 3);

    const mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre', 'Ottobre', 'Novembre', 'Dicembre']
    const meseEsteso = mesi[date.getMonth()];
    const meseU3 = meseEsteso.toUpperCase().substring(0, 3);

    return {
        date,

        YYYYMMDD,
        DDMMYYYY: `${giorno}${mese}${anno}`,
        DDMMYYYY_slash: `${giorno}/${mese}/${anno}`,
        DDMMYYYY_dash:  `${giorno}-${mese}-${anno}`,
        DDMMYYYY_space: `${giorno} ${mese} ${anno}`,
        DD: giorno,
        MM: mese,
        YYYY: anno,
        YY: anno.slice(-2),

        giornoSettimana,
        giornoSettimanaU3,
        mese: meseEsteso,
        meseU3
    }
}

export function addFormatterPartsToDate(dataTimbratura){

    /**
     * CHEAT SHEET PER FORMATTAZIONE DATE
     *
     * const options = {
     *      year: 'numeric',    //( 'numeric' | '2-digit' ) es.: ( '2024', '24')
     *      month: 'long',      //( 'numeric' | '2-digit' | 'long' | 'short' | 'narrow' ) es.: ('2', '02', 'febbraio', 'feb', 'F')
     *      day: 'numeric',     //( 'numeric' | '2-digit' ) es.: ( '1', '01' )
     *      weekday: 'long'     //( 'long' | 'short' | 'narrow' ) es.: ( 'sabato', 'sab', 'S' )
     * };
     * const dateFormatter = new Intl.DateTimeFormat('it-IT', options);
     *
     * dateFormatter.format(date);
     * //=>'sabato 24 febbraio 2024'
     *
     * dateFormatter.formatToParts(date);
     */

    const format = (date, locale, partType, partValue)=>{
        return (new Intl.DateTimeFormat(locale, {[partType]: partValue})).formatToParts(date)[0].value;
    }

    const formatParts = (date, locale)=>{
        return {
            monthLong: format(date, locale, 'month', 'long'),
            monthShort: format(date, locale, 'month', 'short'),
            weekdayLong: format(date, locale, 'weekday', 'long'),
            weekdayShort: format(date, locale, 'weekday', 'short'),
            weekdayNarrow: format(date, locale, 'weekday', 'narrow'),
        };
    }

    dataTimbratura.parts = {};
    dataTimbratura.parts['it-IT'] = formatParts(dataTimbratura.date, 'it-IT');
    dataTimbratura.parts['en-US'] = formatParts(dataTimbratura.date, 'en-US');
}

export function valutaDate({dataInizio, dataFine, oggi, ieri, settimana, mese, anno, daOggiMeno, data} = {}){

    const getFirstDayAndLastDayOfMonth = (monthAsNumber, yearAsYYYY = new Date().getFullYear())=>{
        // Nota: monthAsNumber dovrebbe essere nel range 1-12
        const firstDayOfMonth = new Date(yearAsYYYY, monthAsNumber - 1, 1);
        const lastDayOfMonth = new Date(yearAsYYYY, monthAsNumber, 0);

        const formatYYYYMMDD = (date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}${mm}${dd}`;
        };

        return {
            firstDay: formatYYYYMMDD(firstDayOfMonth),
            lastDay: formatYYYYMMDD(lastDayOfMonth)
        };
    }

    function getYesterdayDateAsYYYYMMDD() {
        const today = new Date();
        const yesterday = new Date(today.setDate(today.getDate() - 1));

        const yyyy = yesterday.getFullYear();
        const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
        const dd = String(yesterday.getDate()).padStart(2, '0');

        return `${yyyy}${mm}${dd}`;
    }

    function getCurrentMonthAsMM(){
        const date = new Date();
        const month = date.getMonth() + 1;
        return month < 10 ? '0' + month : '' + month;
    }

    function getOperationAsYYYYMMDD(operation) {
        const today = new Date();

        const match = operation.match(/^(\d+)([gsmdw])$/);

        if (!match) {
            throw new Error("Operazione non valida.");
        }

        const amount = parseInt(match[1], 10) * -1;
        const unit = match[2];
        let dateOperation = new Date(today);

        switch (unit) {
            case 'g':
            case 'd':
            dateOperation.setDate(dateOperation.getDate() + amount);
            break;
            case 's':
            case 'w':
            dateOperation.setDate(dateOperation.getDate() + amount * 7);
            break;
            case 'm':
            dateOperation.setMonth(dateOperation.getMonth() + amount);
            break;
            default:
            throw new Error("Unità non supportata.");
        }

        const yyyy = dateOperation.getFullYear();
        const mm = String(dateOperation.getMonth() + 1).padStart(2, '0');
        const dd = String(dateOperation.getDate()).padStart(2, '0');
        return `${yyyy}${mm}${dd}`;
    }

    function validaDate(dataInizio, dataFine) {

        const regexFormatoYYYYMMDD = /^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/;
        const regexFormatoDDMMYYYY = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\d{4}$/;

        function stringToDate(dataString) {

            let isYYYYMMDD;
            let isDDMMYYYY;
            if ( regexFormatoYYYYMMDD.test(dataString) )
                isYYYYMMDD = true;
            else if( regexFormatoDDMMYYYY.test(dataString) )
                isDDMMYYYY = true;
            else
                throw new Error("Formato data non valido. Utilizzare YYYYMMDD o DD-MM-YYYY.");

            let anno;
            let mese;
            let giorno;

            if(isYYYYMMDD){
                anno = parseInt(dataString.substring(0, 4), 10);
                mese = parseInt(dataString.substring(4, 6), 10) - 1;
                giorno = parseInt(dataString.substring(6, 8), 10);
            }
            if(isDDMMYYYY){
                anno = parseInt(dataString.substring(6, 10), 10);
                mese = parseInt(dataString.substring(3, 5), 10) - 1;
                giorno = parseInt(dataString.substring(0, 2), 10);
            }

            const data = new Date(anno, mese, giorno);
            // Verifica che i componenti della data siano coerenti con quelli forniti
            if (data.getFullYear() === anno && data.getMonth() === mese && data.getDate() === giorno) {
                return { data, YYYYMMDD: `${anno}${(mese+1).toString().padStart(2,'0')}${giorno.toString().padStart(2,'0')}`};
            }

            return null;
        }

        // Verifica del formato
        if (
            ( !regexFormatoYYYYMMDD.test(dataInizio) && !regexFormatoDDMMYYYY.test(dataInizio) )
            ||
            ( !regexFormatoYYYYMMDD.test(dataFine) && !regexFormatoDDMMYYYY.test(dataFine) )
        ) {
            throw new Error("Formato data non valido. Utilizzare YYYYMMDD o DD-MM-YYYY.");
        }

        // Conversione e validità delle date
        const dataInizioObj = stringToDate(dataInizio);
        const dataFineObj = stringToDate(dataFine);

        if (!(dataInizioObj.data && dataFineObj.data)) {
            throw new Error("Una delle date non è valida.");
        }

        // Confronto delle date
        if (dataInizioObj.data > dataFineObj.data) {
            throw new Error("La data di fine deve venire dopo la data di inizio.");
        }

        //validazione superata

        return {
            dataInizio: dataInizioObj,
            dataFine: dataFineObj
        }
    }

    function getWeekInterval(year, month, weekNumber, cutoff) {
        // Convert month to JavaScript month index (0-based)
        const monthIndex = month - 1;
        const firstOfMonth = new Date(year, monthIndex, 1);
        const lastOfMonth = new Date(year, monthIndex + 1, 0);

        // Get the day of the week for the first of the month (0=Sunday, 6=Saturday), then adjust to Monday-based (1=Monday, 7=Sunday)
        let firstOfMonthDayOfWeek = firstOfMonth.getDay();
        firstOfMonthDayOfWeek = firstOfMonthDayOfWeek === 0 ? 7 : firstOfMonthDayOfWeek;

        // Calculate the start date of the target week
        let weekStart = new Date(firstOfMonth);
        weekStart.setDate(firstOfMonth.getDate() + (weekNumber - 1) * 7 - (firstOfMonthDayOfWeek - 1));

        // Adjust the start date based on the cutoff flag
        if (cutoff && weekStart < firstOfMonth) {
            weekStart = new Date(firstOfMonth);
        }

        // Calculate the end date of the week
        let weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        // Adjust the end date based on the cutoff flag
        if (cutoff && weekEnd > lastOfMonth) {
            weekEnd = new Date(lastOfMonth);
        }

        // Ensure the week doesn't extend into the next month without cutoff
        if (!cutoff) {
            if (weekStart.getMonth() < monthIndex) {
                weekStart = new Date(firstOfMonth);
            }
            if (weekEnd.getMonth() > monthIndex) {
                weekEnd = new Date(lastOfMonth);
            }
        }

        // Format the dates as 'YYYYMMDD'
        const format = (date) => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

        return {
            begin: format(weekStart),
            end: format(weekEnd)
        };
    }

    if(mese !== true)
        mese = parseInt(mese);

    if(oggi === true){
        const o = getTodayDateAsYYYYMMDD();
        dataInizio = o;
        dataFine = o;
    }
    else if(ieri === true){
        const o = getYesterdayDateAsYYYYMMDD();
        dataInizio = o;
        dataFine = o;
    }
    else if(mese === true){
        const m = parseInt(getCurrentMonthAsMM());
        if(settimana){
            const interval = getWeekInterval(new Date().getFullYear(), m, parseInt(settimana), false);
            dataInizio = interval.begin;
            dataFine = interval.end;
        }else{
            const o = getFirstDayAndLastDayOfMonth(m, anno);
            dataInizio = o.firstDay;
            dataFine = o.lastDay;
        }
    }
    else if(mese >= 1 && mese <= 12){
        if(settimana){
            const interval = getWeekInterval(new Date().getFullYear(), mese, settimana, true);
            dataInizio = interval.begin;
            dataFine = interval.end;
        }
        else{
            const o = getFirstDayAndLastDayOfMonth(mese, anno);
            dataInizio = o.firstDay;
            dataFine = o.lastDay;
        }
    }
    else if(daOggiMeno){
        dataInizio = getOperationAsYYYYMMDD(daOggiMeno);
        dataFine = getTodayDateAsYYYYMMDD();
    }
    else if(dataInizio && !dataFine){
        dataFine = getTodayDateAsYYYYMMDD();
        const dateValidate = validaDate(dataInizio, dataFine);
        dataInizio = dateValidate.dataInizio.YYYYMMDD;
    }
    else if(dataInizio && dataFine){
        const dateValidate = validaDate(dataInizio, dataFine);
        dataInizio = dateValidate.dataInizio.YYYYMMDD;
        dataFine = dateValidate.dataFine.YYYYMMDD;
    }
    else if(data){
        const dateValidate = validaDate(data, data);
        dataInizio = dateValidate.dataInizio.YYYYMMDD;
        dataFine = dateValidate.dataFine.YYYYMMDD;
    }
    else{
        const o = getTodayDateAsYYYYMMDD();
        dataInizio = o;
        dataFine = o;
    }


    return {dataInizio, dataFine};
}

export function getTodayDateAsYYYYMMDD(){
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}

export function isYYYYMMDDToday(YYYYMMDD){
    return getTodayDateAsYYYYMMDD() === YYYYMMDD;
}

export function isDateToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

export function isDateYesterday(date) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return date.getDate() === yesterday.getDate() &&
           date.getMonth() === yesterday.getMonth() &&
           date.getFullYear() === yesterday.getFullYear();
}