const sinon = require('sinon')
const proxyquire = require('proxyquire')
const Events = require('events')
const { fixture } = require('~/shared/helper')
// stubs
let compiler, helperStub, progressStub, nextStub, gulpStub

class Watcher extends Events {
    constructor() {
        super()

        this.on('update', (...args) => this.emit('all', ...args))
        this.on('add', (...args) => this.emit('all', ...args))
        this.on('delete', (...args) => this.emit('all', ...args))
    }
}

describe('watcher', function () {
    beforeEach(function () {
        progressStub = {
            append: sinon.fake(),
        }
        helperStub = {
            statsFilesNum: sinon.fake(),
            log: sinon.fake(),
        }
        nextStub = sinon.fake()
        compiler = {
            sourceDir: fixture(),
            createWatcher() {
                return new Watcher()
            },
            getTaskConfig(taskName) {
                return {
                    test: [taskName],
                }
            },
            createGulpTask(taskConfig) {
                // return gulp task
                return sinon.fake.resolves(taskConfig)
            },
            incrementCompile: sinon.fake(),
            cleanSpec: sinon.fake(),
            removeGraphNodes: sinon.fake(),
            removeCache: sinon.fake(),
            nextTask(fn) {
                fn(nextStub)
            },
        }
        gulpStub = {
            series(...fns) {
                return function (cb) {
                    try {
                        fns.forEach((f) => f())
                        cb()
                    } catch (err) {
                        cb(err)
                    }
                }
            },
        }
        pkgWatcher = proxyquire('core/watcher/pkg-watcher', {
            '../../utils/helper': helperStub,
            '../progress': progressStub,
            gulp: gulpStub,
        })
        sourceWatcher = proxyquire('core/watcher/source-watcher', {
            '../../utils/helper': helperStub,
        })
    })

    it('pkg watcher', function () {
        let watcher = pkgWatcher(compiler)

        watcher.emit('add', 'package.json')
        helperStub.statsFilesNum.called.should.equal(true)
        progressStub.append.called.should.equal(true)
        nextStub.called.should.equal(true)
        should.not.exist(nextStub.firstArg)
    })

    it('source watcher', function (done) {
        let watcher = sourceWatcher(compiler)

        // delete file
        watcher.emit('unlink', fixture('a1.js'))
        watcher.emit('unlink', fixture('a2.js'))
        // add file
        watcher.emit('add', fixture('b1.js'))
        watcher.emit('add', fixture('a2.js'))
        // update file
        watcher.emit('change', fixture('c1.js'))

        //
        setTimeout(() => {
            let unlinks = [fixture('a1.js')]

            compiler.incrementCompile.callCount.should.equal(1)
            compiler.incrementCompile.firstArg.should.eql([
                fixture('c1.js'),
                fixture('a2.js'),
                fixture('b1.js'),
            ])
            compiler.cleanSpec.firstArg.should.eql(unlinks)
            compiler.removeGraphNodes.firstArg.should.eql(unlinks)
            compiler.removeCache.firstArg.should.eql(unlinks)

            done()
        }, 220)
    })
})
