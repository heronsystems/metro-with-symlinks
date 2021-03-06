// Check for symlinks in node_modules
// If found generate and use metro config.
//
// Sources:
//     - https://github.com/facebook/metro/issues/1#issuecomment-346502388
//     - https://github.com/facebook/metro/issues/1#issuecomment-334546083

const fs = require('fs')
const exec = require('child_process').execSync
const dedent = require('dedent-js')
const getSymlinkedDependencies = require('./getSymlinkedDependencies')
const getMetroConfig = require('./getMetroConfig')
const getDependencyPath = require('./getDependencyPath')

const CONFIG_FILENAME = 'metro.config.js'
const BABEL_CONFIG_FILENAME = 'babel.config.js'

const mapDep = dep => `    - ${dep} -> ${getDependencyPath(dep)}`
const mapAliasDep = dep => {
    return `"${dep}": "${getDependencyPath(dep).replace(/\\/g, '\\\\')}"`
}

module.exports = (cwd, command, flags) => {
    const symlinkedDependencies = getSymlinkedDependencies(cwd)
    const packagesString = symlinkedDependencies.map(mapDep).join('\n')

    const config = getMetroConfig(symlinkedDependencies)
    fs.writeFileSync(CONFIG_FILENAME, config)

    fs.writeFileSync(
        BABEL_CONFIG_FILENAME,
        dedent`
            module.exports = {
                presets: ["module:metro-react-native-babel-preset"],
                plugins: [
                    [
                        "module-resolver",
                        {
                            alias: {
                                ${symlinkedDependencies
                                    .map(mapAliasDep)
                                    .join(', \n\t\t\t\t\t')}}
                        }
                    ]
                ]
            }
        `,
    )

    if (!symlinkedDependencies || symlinkedDependencies.length === 0) {
        console.log(dedent`
          No symlinked packages detected
      `)
    } else {
        console.log(dedent`
            Detected symlinked packages:
            ${packagesString}
        `)
    }

    if (command) {
        console.log(dedent`
            using metro-with-symlinks - https://github.com/MrLoh/metro-with-symlinks
        `)
    } else {
        console.log(dedent`
            wrote ${CONFIG_FILENAME} - https://github.com/MrLoh/metro-with-symlinks
        `)
    }

    if (!command) process.exit()

    exec(
        `node node_modules/react-native/local-cli/cli.js ${command} --config ../../../../${CONFIG_FILENAME} ${flags}`,
        { stdio: [0, 1, 2] },
    )
}
