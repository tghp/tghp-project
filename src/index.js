import fs from 'fs';
import path from 'path';
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

        if (!dest) {
            dest = '.';
        }

        this.type = type;
        this.projectName = projectName;
        this.projectNames = {
            standard: projectName,
        };
        this.dest = path.resolve(dest);

        this.formatProjectNames();
        this.runProcess();
    }

    async runProcess() {
        await this.clone();
        await this.refactorVariableNames();
        await this.removeDeletableGitkeeps();
        await this.insertComposerVersions();
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
                files: [`${this.dest}/**`],
            });

            let allPathsProcessed = false;

            while (!allPathsProcessed) {
                const paths = (
                    await globby([
                        `${this.dest}/**`,
                        `${this.dest}/**/`
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

    async removeDeletableGitkeeps() {
        const paths = (
            await globby([
                `${this.dest && this.dest + '/'}**/.gitkeep.delete`,
            ], {
                onlyFiles: true,
            })
        );

        for (const path of paths) {
            shell.rm(path);
        }
    }

    async insertComposerVersions() {
      let composerJson = fs.readFileSync(`${this.dest}/composer.json`, 'utf-8');
      let composerPackageVersions = {};
      let wpackagistPackageVersions = {};

      const composerMatches = composerJson.match(/\$tghp:packagist:([^@]*)@latest\$/g);
      const wpackagistMatches = composerJson.match(/\$tghp:wpackagist:([^@]*)@latest\$/g);

      if (composerMatches) {
          for (const composerPackage of composerMatches) {
              const packageName = composerPackage.replace(/\$tghp:packagist:([^@]*)@latest\$/, '$1');
              console.log(`Getting latest version of ${packageName} from Packagist`);
              const packageMeta = await (await fetch(`https://repo.packagist.org/p2/${packageName}.json`)).json();

              if (packageMeta) {
                  composerPackageVersions[packageName] = packageMeta.packages[packageName][0].version.replace(/^v/, '');
              } else {
                  console.error(`Could not find package ${packageName}`);
              }
          }
      }

      if (wpackagistMatches) {
          for (const wpackagistPackage of wpackagistMatches) {
              const wpackageName = wpackagistPackage.replace(/\$tghp:wpackagist:([^@]*)@latest\$/, '$1');
              const packageName = wpackageName.replace('wpackagist-plugin/', '');
              console.log(`Getting latest version of ${packageName} from the WordPress plugin repository (but sourced via WordPress Packagist)`);
              const packageMeta = await (await fetch(`https://api.wordpress.org/plugins/info/1.0/${packageName}.json`)).json();

              if (packageMeta) {
                  wpackagistPackageVersions[wpackageName] = packageMeta.version;
              } else {
                  console.error(`Could not find package ${packageName}`);
              }
          }
      }

      composerJson = composerJson.replace(
        /\$tghp:([^:]*):([^@]*)@latest\$/g,
        (match, source, packageName) => {
            console.log({
                source,
                packageName,
            })
          if (source === 'packagist') {
            return composerPackageVersions[packageName];
          } else if (source === 'wpackagist') {
            return wpackagistPackageVersions[packageName];
          }

          return '';
        }
      );

      fs.writeFileSync(`${this.dest}/composer.json`, composerJson);
    }
}

export default function tghpProject(type, projectName, dest) {
	return new TGHPProject(type, projectName, dest);
}
