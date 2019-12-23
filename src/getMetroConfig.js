// Check for symlinks in node_modules
// If found generate and use metro config.
//
// Sources:
//     - https://github.com/facebook/metro/issues/1#issuecomment-346502388
//     - https://github.com/facebook/metro/issues/1#issuecomment-334546083

const fs = require('fs')
const exec = require('child_process').execSync
const dedent = require('dedent-js')
const getDependencyPath = require('./getDependencyPath')

const replaceAll = (str, find, replace) => {
    return str.replace(new RegExp(find, 'g'), replace);
}

const mapModule = name =>
    `'${name}': path.resolve(__dirname, 'node_modules/${name}')`

const mapBL = path => {
    const basePath = `/${path.replace(/\//g, "[/\\\\]")}`
    return (
        `${basePath}[/\\\\].*/`
    )
}

const mapPath = path =>
    `/${path.replace(
        /\//g,
        "[/\\\\]"
    )}[/\\\\]node_modules[/\\\\]react-native[/\\\\].*/`;

module.exports = symlinkedDependencies => {
    const symlinkedDependenciesPaths = symlinkedDependencies.map(
        getDependencyPath,
    )

    const peerDependenciesOfSymlinkedDependencies = symlinkedDependenciesPaths
        .map(path => require(`${path}/package.json`).peerDependencies)
        .map(
            peerDependencies =>
                peerDependencies ? Object.keys(peerDependencies) : [],
        )
        // flatten the array of arrays
        .reduce(
            (flatDependencies, dependencies) => [
                ...flatDependencies,
                ...dependencies,
            ],
            [],
        )
        // filter to make array elements unique
        .filter(
            (dependency, i, dependencies) =>
                dependencies.indexOf(dependency) === i,
        )
    const devDependenciesOfSymlinkedDependencies = symlinkedDependenciesPaths
        .map(path => require(`${path}/package.json`).devDependencies)
        .map(
            (devDependencies, i) => {
                const path = symlinkedDependenciesPaths[i]
                return devDependencies ? Object.keys(devDependencies).map(k => `${path}/node_modules/${k}`) : []
            }
        )
        // flatten the array of arrays
        .reduce(
            (flatDependencies, dependencies) => [
                ...flatDependencies,
                ...dependencies,
            ],
            [],
        )
        // filter to make array elements unique
        .filter(
            (dependency, i, dependencies) =>
                dependencies.indexOf(dependency) === i,
        )
        // BH (7/26/2019): This is odd but it seems like anything that uses RN components needs @babel/runtime.
        .filter(d => {
            const regex = new RegExp(/@babel\/runtime/);
            return !regex.test(d)
        })

    const extraNodeModules = peerDependenciesOfSymlinkedDependencies
        .map(mapModule)
        .join(',\n  ')

    const getBlacklistForSymlink = symlinkedDependenciesPaths.map(d => replaceAll(d, /\\/, "\/"))
        .map(mapPath)
        .join(',\n  ')

    const getBlacklistRE = devDependenciesOfSymlinkedDependencies.map(d => replaceAll(d, /\\/, "\/"))
        .map(mapBL)
        .concat(getBlacklistForSymlink)
        .join(',\n  ')

    const getFullBlacklist = symlinkedDependenciesPaths.map(d => {
        return `${d}/example`
    }).map(d => replaceAll(d, /\\/, "\/")).map(mapBL)
        .concat(getBlacklistRE)
        .join(',\n  ')


    const getProjectRoots = symlinkedDependenciesPaths
        .map(path => `path.resolve('${path.replace(/\\/g, '\\\\')}')`)
        .join(',\n  ')

    return dedent`
      const path = require('path');

      const extraNodeModules = {
        ${extraNodeModules}
      };
      const blacklistRegexes = [
        ${getFullBlacklist}
      ];
      const watchFolders = [
        ${getProjectRoots}
      ];

      const metroVersion = require('metro/package.json').version;
      const metroVersionComponents = metroVersion.match(/^(\\d+)\\.(\\d+)\\.(\\d+)/);
      if (metroVersionComponents[1] === '0' && parseInt(metroVersionComponents[2], 10) >= 43) {
          module.exports = {
            transformer: {
                getTransformOptions: async () => ({
                    transform: {
                        experimentalImportSupport: false,
                        inlineRequires: false
                    }
                })
            },
            resolver: {
              extraNodeModules,
              blacklistRE: require('metro-config/src/defaults/blacklist')(blacklistRegexes)
            },
            watchFolders
          };
      } else {
          module.exports = {
            extraNodeModules,
            getBlacklistRE: () => require('metro/src/blacklist')(blacklistRegexes),
            getProjectRoots: () => [path.resolve(__dirname)].concat(watchFolders),
            transformer: {
                getTransformOptions: async () => ({
                    transform: {
                        experimentalImportSupport: false,
                        inlineRequires: false
                    }
                })
            }
          };
      }



   `
}
