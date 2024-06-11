const camelcase = require('camelcase')
const { partial } = require('../utils/helper')

class GulpError extends Error {
    constructor(name = 'GulpError', file, error, options = {}) {
        if (error instanceof Error === false) {
            error = new Error(error)
        }
        // reuse message
        super(`${error.message} \nGulpFile: ${file.path}`)
        // change name
        this.name = camelcase(name, {
            pascalCase: true,
        })
        // reuse stack
        this.stack = error.stack
        // keep file
        this.file = file.clone()
    }
}

function gulpErrorFactory(name, file, error, options = {}) {
    return new GulpError(name, file, error, options)
}

gulpErrorFactory.partial = function (...args) {
    return partial(gulpErrorFactory, ...args)
}

module.exports = gulpErrorFactory
