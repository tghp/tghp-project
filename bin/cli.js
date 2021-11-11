#!/usr/bin/env node

import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import mri from 'mri';
import chalk from 'chalk';

import tghpProject from '../src/index.js';

const args = mri(process.argv.slice(2));
const [type, projectName, dest = '.'] = args._;

async function main() {
    if (args.help) {
		const help = fs
			.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'help.md'), 'utf-8')
			.replace(/^(\s*)#+ (.+)/gm, (m, s, _) => s + chalk.bold(_))
			.replace(/_([^_]+)_/g, (m, _) => chalk.underline(_))
			.replace(/`([^`]+)`/g, (m, _) => chalk.cyan(_));

		process.stdout.write(`\n${help}\n`);
	} else {
        tghpProject(type, projectName, dest);
    }
}

main();