import chalk from 'chalk';

import Paginator from 'inquirer/lib/utils/paginator.js';

export class CustomPaginator extends Paginator {
    constructor(options) {
        super(options);
    }

    paginate(output, active, pageSize) {
        pageSize ||= 7;
        let lines = output.split('\n');

        if (this.screen) {
            lines = this.screen.breakLines(lines);
            active = lines
                .map((lineParts) => lineParts.length)
                .splice(0, active)
                .reduce((a, b) => a + b, 0);
            lines = lines.flat();
        }

        // Make sure there's enough lines to paginate
        if (lines.length <= pageSize) {
            return output;
        }
        const visibleLines = this.isInfinite
            ? this.getInfiniteLines(lines, active, pageSize)
            : this.getFiniteLines(lines, active, pageSize);
        this.lastIndex = active;
        return (
            visibleLines.join('\n') +
            '\n' +
            chalk.dim('(Muoviti su e giù per svelare tutte le scelte disponibili)')
        );
    }
}