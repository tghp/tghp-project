import degit from 'degit';
import slugify from 'slugify';
import replace from 'replace-in-file';
import { globby } from 'globby';
import shell from 'shelljs';

class TGHPProject {

	constructor(type, projectName, dest) {
        if (!type) {
            throw new Error('No type provided');
        }

        if (!projectName) {
            throw new Error('No proejct name provided');
        }

        this.type = type;
        this.projectName = projectName;
        this.projectNames = {
            standard: projectName,
        };
        this.dest = dest;

        this.formatProjectNames();
        this.runProcess();
    }

    async runProcess() {
        await this.clone();
        await this.refactorVariableNames();
        // await this.removeDeletableGitkeeps();
    }

    formatProjectNames() {
        const slugifiedProjectName = slugify(this.projectName);

        this.projectNames = {
            standard: this.projectName,
            upperCaseUnderscored: slugifiedProjectName.replace(/-/, '_').toUpperCase(),
            lowerCaseHyphenated: slugifiedProjectName.toLowerCase(),
            lowerCaseJoined: slugifiedProjectName.toLowerCase().replace(/[^a-z0-1]/, ''),
            camelCase: slugifiedProjectName
                .split('-')
                .map((part, i) => i === 0 ? part.toLowerCase() : part.substr(0, 1).toUpperCase() + part.substr(1).toLowerCase())
                .join(''),
            classCase: slugifiedProjectName
                .split('-')
                .map(part => part.substr(0, 1).toUpperCase() + part.substr(1).toLowerCase())
                .join(''),
        }
    }

    async clone() {
        // TODO: Support various path types: '.' for here, 'some-folder' for relative, and '/Users/whatever/here' for absolute
        const tghpDegit = degit(`tghp/template-${this.type}`, {
            cache: false,
            verbose: true,
        });

        tghpDegit.on('info', info => {
            console.log(info.message);
        });

        await tghpDegit.clone(this.dest);
    }

    async refactorVariableNames() {
        for (const projectNameKey of Object.keys(this.projectNames)) {
            const projectNameKeyValue = this.projectNames[projectNameKey];

            const replacements = await replace({
                from: new RegExp(`\\$tghp:${projectNameKey}\\$`, 'g'),
                to: projectNameKeyValue,
                files: [`./${this.dest}/**`],
            });

            let allPathsProcessed = false;

            while (!allPathsProcessed) {
                const paths = (
                    await globby([
                        `${this.dest && this.dest + '/'}**`,
                        `${this.dest && this.dest + '/'}**/`
                    ], {
                        onlyFiles: false,
                        markDirectories: true,
                    })
                ).filter(path => {
                    const projectNameKeySearchRegex = new RegExp(`\\$tghp:${projectNameKey}\\$`);
                    return `/${path}`.match(projectNameKeySearchRegex);
                });

                if (paths.length) {
                    // Re-search each time a change is made, as if a replacement is in a sub-folder, the process wil lbreak
                    const path = paths[0];
                    const replaceRegex = new RegExp(`\\$tghp:${projectNameKey}\\$`);
                    shell.mv(path, path.replace(replaceRegex, projectNameKeyValue));
                } else {
                    allPathsProcessed = true;
                }
            }
        }
    }
}

export default function tghpProject(type, projectName, dest) {
	return new TGHPProject(type, projectName, dest);
}