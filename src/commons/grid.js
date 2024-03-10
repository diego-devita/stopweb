import stringWidth from 'string-width';

import chalk from 'chalk';

export function createFormatter({
    showHeader = true,
    ignoreLines = false,
    liner = '-',
    outerSpacer = ' ',
    outerBorder = false,
    headerSeparator = '|',
    rowSeparator = '|',
    paddingLeft = 1,
    paddingChar = '-',
}={}){

    if(stringWidth(headerSeparator) !== stringWidth(rowSeparator))
        throw new Error('headerSeparator e rowSeparator devono avere la stessa lunghezza');

    if(stringWidth(paddingChar) !== 1)
        throw new Error('paddingChar deve avere lunghezza == 1');

    if(outerBorder && stringWidth(outerSpacer) !== 1)
        throw new Error('outerSpacer deve avere lunghezza == 1');

    return {
        showHeader: showHeader,
        ignoreLines: ignoreLines,

        liner: liner,
        outerSpacer: outerSpacer,
        outerBorder: outerBorder,

        headerSeparator: headerSeparator,
        rowSeparator: rowSeparator,

        paddingLeft: paddingLeft,
        paddingChar: paddingChar,

        style: {
            header: (content)=>{ return content; },
            liner: (content)=>{ return content; },
            dataRow: (content)=>{ return content; },
            totals: (content)=>{ return content; },
            emptyRow: (content)=>{ return content; }
        },

        printGridHeader: function({ grid, target = console } = {}){
            const line =
                grid.getHeaderFormatted({
                    outerBorder: this.outerBorder,
                    separator: this.headerSeparator,
                    paddingLeft: this.paddingLeft,
                    paddingChar: this.paddingChar
                });
            target.log( this.style.header(line) );
        },

        printGridLiner: function({ grid, target = console } = {}){
            const line  =
                grid.getRowLine({
                    outerBorder: this.outerBorder,
                    outerSpacer: this.outerSpacer,
                    liner: this.liner,
                    separatorLength: stringWidth(this.headerSeparator)
                });
            target.log( this.style.liner(line) );
        },

        printGridNextRow: function({ grid, target = console } = {}){
            const line =
                grid.getNextRowFormatted({
                    outerBorder: this.outerBorder,
                    separator: this.rowSeparator,
                    paddingLeft: this.paddingLeft,
                    paddingChar: this.paddingChar
                });
            target.log( this.style.dataRow(line) );
        },

        printTotalsRow: function({ grid, target = console } = {}){
            const line =
                grid.getTotalsRowFormatted({
                    outerBorder: this.outerBorder,
                    separator: this.rowSeparator,
                    paddingLeft: this.paddingLeft,
                    paddingChar: this.paddingChar
                });
            target.log( this.style.totals(line) );
        },

        printEmptyRow: function({ grid, target = console } = {}){
            const line =
                grid.getEmptyRow({
                    outerBorder: this.outerBorder,
                    separator: this.rowSeparator,
                    paddingChar: this.paddingChar
                });
            target.log( this.style.emptyRow(line) );
        },

        printGrid: function({ grid, target = console} = {}){
            grid.resetRowCursor();

            //LINER
            if(!this.ignoreLines)
                this.printGridLiner({ grid, target });

            //HEADER
            if(this.showHeader)
                this.printGridHeader({ grid, target });

            //LINER
            if(!this.ignoreLines)
                this.printGridLiner({ grid, target });

            this.printEmptyRow({ grid, target });

            //ROWS
            for(let i=1; i<=grid.rows; i++){
                this.printGridNextRow({ grid, target });
            }

            this.printEmptyRow({ grid, target });

            //LINER
            if(!this.ignoreLines)
                this.printGridLiner({ grid, target });

            //TOTALS
            this.printTotalsRow({ grid, target });

            //LINER
            if(!this.ignoreLines)
                this.printGridLiner({ grid, target });
        }
    }
}

export function createGrid(){
    return {
        _columns: {},
        _rows: 0,

        addColumn: function(column){
            if(column.name === ''){
                const index = Object.keys(this._columns).length+1;
                column.name = `col${index}`;
            }
            if(Object.keys(this._columns).includes(column.name))
                throw new Error(`Esiste già una colonna con nome ${column.name}`);
            this._columns[column.name] = column;
            column.bindToGrid(this);
        },

        addColumns: function(columns){
            for(let column of columns){
                this.addColumn(column);
            }
        },

        addRow: function({ values, id, data } = {}){
            for(let columnName of this.columnNames){
                let value;
                if(!Object.keys(values).includes(columnName))
                    value = '';
                else
                    value = values[columnName];

                this._columns[columnName].addRow({ value, id, data });
            }
            this._rows++;
        },

        get rows(){
            return this._rows;
        },

        get columns(){
            return Object.values(this._columns);
        },

        get columnNames(){
            return Object.keys(this._columns);
        },

        resetRowCursor: function(){
            for(let column of this.columns){
                column.resetRowCursor();
            }
        },

        getRowLine: function({ liner = '-', outerSpacer = ' ', outerBorder = false, separatorLength = 1} = {}){
            let lineLength = 0;
            this.columns.forEach(column => lineLength += column.length );
            //aggiunge la lunghezza del separatore tra colonne
            lineLength += (this.columns.length - 1)*separatorLength;
            const line = liner.repeat(lineLength);
            if (outerBorder)
                return `${outerSpacer}${line}${outerSpacer}`;
            else
                return line;
        },

        getEmptyRow: function({ separator = '|', outerBorder = false, paddingLeft = 1, paddingChar = ' '} = {}){
            const line =
            this.columns
                .map(column => column.getEmptySpace())
                .join(separator);
            if (outerBorder)
                return `${separator}${line}${separator}`;
            else
                return line;
        },

        getNextRowFormatted: function({ separator = '|', outerBorder = false, paddingLeft = 1, paddingChar = ' '} = {}){
            const line =
                this.columns
                    .map(column => column.getNextRowFormatted())
                    .join(separator);
            if (outerBorder)
                return `${separator}${line}${separator}`;
            else
                return line;
        },

        getHeaderFormatted: function({ separator = '|', outerBorder = false, paddingLeft = 1, paddingChar = ' '} = {}){
            const line =
                this.columns
                    .map(column => column.getHeaderFormatted({ paddingLeft, paddingChar }))
                    .join(separator);

            if (outerBorder)
                return `${separator}${line}${separator}`;
            else
                return line;
        },

        getTotalsRowFormatted: function({ separator = '|', outerBorder = false, paddingLeft = 1, paddingChar = ' '} = {}){
            const line =
                this.columns
                    .map(column => column.getTotalsFormatted({ paddingLeft, paddingChar }))
                    .join(separator);

            if (outerBorder)
                return `${separator}${line}${separator}`;
            else
                return line;
        }
    }
}

export function createGridColumn({
    name = 'default',
    length = 1,
    header = '',
    transformer = {
        doIgnore: (id)=>{
            return true;
        },
        toScalar: (value)=>{
            return 0;
        },
        toString: (value)=>{
            return '';
        }
    },
    styleHeader = { paddingLeft: 1, paddingChar: ' ', overflow: 'ignore' },
    styleDataRow = { paddingLeft: 1, paddingChar: ' ', overflow: 'ignore' },
    styleTotals = { paddingLeft: 1, paddingChar: ' ', overflow: 'ignore' },

} = {}){
    return {
        _name: name,
        _length: length,
        _header: header,

        _datas: [],
        _ids: [],
        _rows: [],
        _rowCursor: 0,

        _boundGrid: null,

        _transformer: transformer,

        _styleHeader:  styleHeader,
        _styleDataRow: styleDataRow,
        _styleTotals:  styleTotals,

        get name(){
            return this._name;
        },

        set name(value){
            if(this._boundGrid)
                throw new Error(`La colonna ${nome} è già collegata ad una grid e non può più cambiare nome`)
            this._name = value;
        },

        get length(){
            return this._length;
        },

        getRowValue(i){
            return this._rows[i];
        },

        getEmptySpace: function(){
            return ' '.repeat(this._length);
        },

        formatValue: function({
            value,
            length = this._length,
            paddingLeft = 1,
            paddingChar = ' ',
            overflow = 'ignore'//clip|trim|trim&clip|ignore
        } = {}){
            let paddingRight = length - stringWidth(value) - paddingLeft;
            let pR = '';
            if(paddingRight > 0)
                pR = paddingChar.repeat(paddingRight);
            let pL = paddingChar.repeat(paddingLeft);
            let valueFormatted = `${pL}${value}${pR}`;

            if(stringWidth(valueFormatted) > length){
                switch(overflow){
                    case 'ignore':
                        break;
                    case 'clip':
                        valueFormatted = valueFormatted.substring(0, length);
                        break;
                    case 'trim':
                        valueFormatted = valueFormatted.trim();
                        break;
                    case 'trim&clip':
                        valueFormatted = valueFormatted.trim().substring(0, length);
                        break;
                    default:
                        throw new Error(`overflow non può avere valore ${overflow}`);
                }
            }
            return valueFormatted;
        },

        getHeaderFormatted: function ({
            length = this._length,
            paddingLeft = this._styleHeader.paddingLeft,
            paddingChar = this._styleHeader.paddingChar,
            overflow = this._styleHeader.overflow
        } = {}){
            return this.formatValue({ value: this._header, length, paddingLeft, paddingChar, overflow });
        },

        getNextRowFormatted: function ({
            length = this._length,
            paddingLeft = this._styleDataRow.paddingLeft,
            paddingChar = this._styleDataRow.paddingChar,
            overflow = this._styleDataRow.overflow
        } = {}){
            return this.formatValue({ value: this._rows[this._rowCursor++], length, paddingLeft, paddingChar, overflow });
        },

        getTotalsFormatted: function({
            length = this._length,
            paddingLeft = this._styleTotals.paddingLeft,
            paddingChar = this._styleTotals.paddingChar,
            overflow = this._styleTotals.overflow
        } = {}){

            const removeChalkStyles = (str) => {
                // ANSI escape codes pattern
                const ansiEscapeRegex = /\x1B\[[0-9;]*m/g;
                return str.replace(ansiEscapeRegex, '');
            }

            let total = 0;
            for(let i=0; i<this._rows.length; i++){
                if(!this._transformer.doIgnore(this._ids[i])){
                    const value = removeChalkStyles(this._rows[i]);
                    total += this._transformer.toScalar(value);
                }
            }

            return this.formatValue({ value: this._transformer.toString(total), length, paddingLeft, paddingChar, overflow });
        },

        resetRowCursor: function(){
            this._rowCursor = 0;
        },

        get rowCursor(){
            return this._rowCursor;
        },

        addRow: function ({ value, id, data } = {}){
            this._ids.push(id);
            this._datas.push(data);
            this._rows.push(value.trimEnd());
        },

        get rows(){
            return this._rows.length;
        },

        bindToGrid: function(grid){
            if(this._boundGrid)
                throw new Error(`La colonna ${this.name} è già collegata ad una grid.`);
            this._boundGrid = grid;
        },

    }
}