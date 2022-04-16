const sinon = require('sinon')
const low = require('lowdb')
const Memory = require('lowdb/adapters/Memory')
// const compilerSession = require('./compiler-session')

module.exports = function () {
    function Compiler() {
        // Object.assign(this, compilerSession())
        // db in memory
        this._db = low(new Memory())
    }

    Compiler.installHook = sinon.fake(function (hooks) {
        return hooks
    })

    Object.assign(Compiler.prototype, {
        save: sinon.fake(function (key, value) {
            if (key) {
                this._db.set(key, value).write()
            }
        }),
        query: sinon.fake(function (key, defaults) {
            return this._db.get(key).value() || defaults
        }),
    })

    return Compiler
}
