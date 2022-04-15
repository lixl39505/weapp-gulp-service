const Compiler = require('./core/compiler')
// inner-plugins
const cleanPlugin = require('./plugins/clean')
const depGraphPlugin = require('./plugins/dep-graph')
const compileCachePlugin = require('./plugins/compile-cache')
const checksum = require('./plugins/checksum')

Compiler.use(cleanPlugin)
Compiler.use(depGraphPlugin)
Compiler.use(compileCachePlugin)

module.exports = Compiler
