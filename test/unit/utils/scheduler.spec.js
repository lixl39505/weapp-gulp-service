const sinon = require('sinon')
const proxyquire = require('proxyquire')
//
let scheduler

describe('scheduler', function () {
    beforeEach(function () {
        scheduler = require('utils/scheduler')
    })

    it('queue task', function (done) {
        let { queueTask, getFlushing, getSize } = scheduler

        // cbs
        queueTask((next) => {
            setImmediate(() => next())
        })
        // thenable
        queueTask(() => Promise.resolve())
        // async
        getFlushing().should.equal(false)
        getSize().should.equal(2)

        setTimeout(() => {
            // run out
            getSize().should.equal(0)

            done()
        }, 20)
    })

    it('callback error', function (done) {
        let { queueTask } = scheduler,
            log = sinon.fake()

        queueTask((next) => {
            setImmediate(() => {
                log()
                next()
            })
        })
        queueTask((next) => {
            setImmediate(() => {
                log()
                next(new Error('fool'))
            })
        })
        queueTask((next) => {
            setImmediate(() => {
                log()
                next()
            })
        })

        setTimeout(() => {
            // error first
            log.callCount.should.equal(2)

            done()
        }, 20)
    })

    it('promise reject', function (done) {
        let { queueTask } = scheduler,
            log = sinon.fake()

        queueTask((next) => {
            setImmediate(() => {
                log()
                next()
            })
        })
        queueTask(() => {
            log()
            return Promise.reject()
        })
        queueTask((next) => {
            setImmediate(() => {
                log()
                next()
            })
        })

        setTimeout(() => {
            // error first
            log.callCount.should.equal(2)

            done()
        }, 20)
    })
})
