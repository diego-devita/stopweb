import inquirer from 'inquirer'
import chalk from 'chalk'
import ListPrompt from 'inquirer/lib/prompts/list.js';
import figures from 'figures';

import { CustomPaginator } from './CustomPaginator.js';

export class CustomListPrompt extends ListPrompt {

    constructor(questions, rl, answers) {
        super(questions, rl, answers);

        this.paginator = new CustomPaginator(this.screen, { isInfinite: this.opt.isInfinite });
    }

    render() {
        // Render question
        let message = this.getQuestion();

        if (this.firstRender) {
            message += chalk.dim('(Usa le frecce)');
        }

        // Render choices or answer depending on the state
        if (this.status === 'answered') {
            message += chalk.cyan(this.opt.choices.getChoice(this.selected).short);
        } else {
            const choicesStr = listRender(this.opt.choices, this.selected);
            const indexPosition = this.opt.choices.indexOf(
                this.opt.choices.getChoice(this.selected),
            );
            const realIndexPosition =
                this.opt.choices.reduce((acc, value, i) => {
                    // Dont count lines past the choice we are looking at
                    if (i > indexPosition) {
                        return acc;
                    }
                    // Add line if it's a separator
                    if (value.type === 'separator') {
                        return acc + 1;
                    }

                    let l = value.name;
                    // Non-strings take up one line
                    if (typeof l !== 'string') {
                        return acc + 1;
                    }

                    // Calculate lines taken up by string
                    l = l.split('\n');
                    return acc + l.length;
                }, 0) - 1;
            message +=
                '\n' + this.paginator.paginate(choicesStr, realIndexPosition, this.opt.pageSize);
        }

        this.firstRender = false;

        this.screen.render(message);
    }
}

/**
 * Function for rendering list choices
 * @param  {Number} pointer Position of the pointer
 * @return {String}         Rendered content
 */
function listRender(choices, pointer) {
    let output = '';
    let separatorOffset = 0;

    choices.forEach((choice, i) => {
        if (choice.type === 'separator') {
            separatorOffset++;
            output += '  ' + choice + '\n';
            return;
        }

        if (choice.disabled) {
            separatorOffset++;
            output += '  - ' + choice.name;
            output += ` (${
            typeof choice.disabled === 'string' ? choice.disabled : 'Disabled'
            })`;
            output += '\n';
            return;
        }

        const isSelected = i - separatorOffset === pointer;
        let line = (isSelected ? figures.pointer + ' ' : '  ') + choice.name;
        if (isSelected) {
            line = chalk.cyan(line);
        }

        output += line + ' \n';
    });

    return output.replace(/\n$/, '');
}