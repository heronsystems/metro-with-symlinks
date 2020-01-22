const fs = require('fs')

const isSymlink = dependency => {
    const exists = fs.existsSync(`node_modules/${dependency}`)
    if (exists) {
        return fs.lstatSync(`node_modules/${dependency}`).isSymbolicLink()
    }
    return false
}

module.exports = directory => {
    const packageJson = require(`${directory}/package.json`)
    const symlinks = [
        ...Object.keys(packageJson.devDependencies || {}),
        ...Object.keys(packageJson.dependencies || {}),
        ...Object.keys(packageJson.peerDependencies || {}),
    ]
        .filter(isSymlink)
        .filter(dep => fs.existsSync(`node_modules/${dep}`))
    return symlinks
}
