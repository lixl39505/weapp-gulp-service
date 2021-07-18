const Compiler = require('./core/compiler')
// inner-plugins
const cleanPlugin = require('./plugins/clean')
const depGraphPlugin = require('./plugins/dep-graph')
const compileCachePlugin = require('./plugins/compile-cache')
const statsPlugin = require('./plugins/stats')

Compiler.use(cleanPlugin)
Compiler.use(depGraphPlugin)
Compiler.use(compileCachePlugin)
Compiler.use(statsPlugin)

module.exports = Compiler
