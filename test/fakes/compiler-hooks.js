const sinon = require('sinon')
const low = require('lowdb')
const Memory = require('lowdb/adapters/Memory')
const { objectMerge, runQueue, type } = require('utils/helper')

module.exports = function () {
    const hooks = {
        init: [],
        clean: [],
        beforeCompile: [],
        afterCompile: [],
        taskerror: [],
    }

    // 提供plugin测试所必需的：
    // 1. hook功能以及；
    // 2. 内存db；
    function Compiler() {
        this._db = low(new Memory())
        this._hooks = objectMerge({}, hooks) // hooks
        this._inited = this.fire('init')
    }
    // use
    Compiler.installHook = sinon.fake(function (name, handler) {
        if (type(name) === 'object') {
            Object.entries(name).forEach(([k, v]) => Compiler.installHook(k, v))
        } else {
            hooks[name] && hooks[name].push(handler)
        }
    })
    // core methods
    Object.assign(Compiler.prototype, {
        save: sinon.fake(function (key, value) {
            if (key) {
                this._db.set(key, value).write()
            }
        }),
        query: sinon.fake(function (key, defaults) {
            return this._db.get(key).value() || defaults
        }),
        tap: sinon.fake(function (name, handler) {
            let list = this._hooks[name]

            if (list) {
                list.push(handler)
            }
        }),
        fire: sinon.fake(function (name, payload = {}) {
            const handlers = this._hooks[name]

            if (handlers.length) {
                if (type(payload) !== 'object') {
                    payload = { payload }
                }

                return runQueue.promise(handlers, (fn, next) => {
                    payload.next = next
                    fn.call(this, payload)
                })
            } else {
                return Promise.resolve()
            }
        }),
        // 模拟一次正常运行
        run() {
            return this._inited
                .then(() => this.fire('clean', { expired: [] }))
                .then(() => this.fire('beforeCompile', { session: this }))
                .then(() => this.fire('afterCompile', { session: this }))
        },
    })

    return Compiler
}
