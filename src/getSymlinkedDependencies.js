const fs = require('fs')

const isSymlink = dependency => {
    const exists = fs.existsSync(`node_modules/${dependency}`)
    if (exists) {
        return fs.lstatSync(`node_modules/${dependency}`).isSymbolicLink()
    }
    return false
}

module.exports = directory => {
    const pacakgeJson = require(`${directory}/package.json`)
    return [
        ...Object.keys(pacakgeJson.devDependencies || {}),
        ...Object.keys(pacakgeJson.dependencies || {}),
    ]
        .filter(isSymlink)
        .filter(dep => fs.existsSync(`node_modules/${dep}`))
}
