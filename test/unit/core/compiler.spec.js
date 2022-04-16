const path = require('path')
const Events = require('events')
const through = require('through2')
const Vinyl = require('vinyl')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const low = require('lowdb')
const Memory = require('lowdb/adapters/Memory')
//
const { getPkgJson, fixture, fromArray, toGlobPath } = require('~h')
const fakeWeappConfig = require('~/fakes/defaults')
// stubs
let pkgInfo = getPkgJson(),
    fsStub,
    schedulerStub,
    helperStub,
    progressStub,
    gulpStub,
    rpqStub,
    sourceWatcherStub,
    pkgWatcherStub

function requirePiper(name) {
    if (name === 'gulp-progress') {
        return proxyquire('internal/gulp-progress', {
            '../core/progress': progressStub,
        })
    }
    if (name === 'gulp-context') {
        return require('internal/gulp-context')
    }
    if (name === 'gulp-compile-cache') {
        return function ({ hit }) {
            return through.obj(function (file, enc, cb) {
                // 模拟js文件缓存
                if (file.extname === '.js') {
                    hit(file)
                    return cb(null, null)
                }
                cb(null, file)
            })
        }
    }

    return gulpPassThrough
}

// function runQueue() {}
// runQueue.promise = function (handlers) {
//     handlers.forEach((fn) => fn())
//     return Promise.resolve()
// }

// create files
function gulpSrc(paths = []) {
    return fromArray(
        paths.map((v) => {
            let base = path.dirname(fixture()),
                extName = path.extname(v)

            return new Vinyl({
                base,
                path: fixture(`foo${extName}`),
                contents: Buffer.from(''),
            })
        })
    )
}

// do nothing
function gulpPassThrough(options = {}) {
    return through.obj(function (file, enc, cb) {
        cb(null, file)
    })
}

//
function createWatcher() {
    return {
        close: sinon.fake(),
    }
}

function createCompiler(stub = {}, plugins = []) {
    let Compiler = proxyquire(
        'core/compiler',
        Object.assign(
            {
                fs: fsStub,
                // connector
                '../utils/connector': function ({ defaults } = {}) {
                    let db = low(new Memory())
                    // 默认值
                    if (defaults) {
                        db.defaults(defaults).write()
                    }
                    return db
                },
                // rqp
                './require-piper': rpqStub,
                // progressBar
                './progress': progressStub,
                // resolveOptions
                '../config': function () {
                    let options = fakeWeappConfig()
                    // 编译任务
                    options.tasks = {
                        js: {
                            test: `./**/*.js`,
                            use: ['gulp-js'],
                        },
                        less: {
                            test: `./**/*.less`,
                            use: [['gulp-less', (options) => options]],
                            compileAncestor: true,
                        },
                        img: {
                            test: ({ imgType }) =>
                                `./**/*.{${imgType.join(',')}}`,
                            use: 'gulp-img',
                        },
                    }
                    return options
                },
                // queueTask
                '../utils/scheduler': schedulerStub,
                // helpers
                '../utils/helper': helperStub,
                // gulp
                gulp: gulpStub,
                // watchers
                './watcher/source-watcher': sourceWatcherStub,
                './watcher/pkg-watcher': pkgWatcherStub,
                // pkgInfo
                '../../package.json': pkgInfo,
            },
            stub
        )
    )
    // use plugins
    plugins.forEach((v) => Compiler.use(v))
    // new instance
    let ins = new Compiler()
    // fake extension api
    ins.cleanExpired = sinon.fake.resolves([fixture('a.js')])
    ins.removeGraphNodes = sinon.fake()
    ins.reverseDep = sinon.fake()
    ins.removeCache = sinon.fake()

    return ins
}

describe('compiler', function () {
    beforeEach(function () {
        fsStub = {
            existsSync: sinon.fake.returns(false),
            mkdirSync: sinon.fake(),
        }
        schedulerStub = {
            // 立即同步执行，方便单测
            queueTask(fn) {
                return fn()
            },
        }
        helperStub = {
            // runQueue,
            resolveNpmList(options) {
                let baseDir = options.baseDir
                return [
                    {
                        path: path.join(baseDir, './fixture/json/package.json'),
                        output: path.join(baseDir, './dist'),
                    },
                ]
            },
            statsFilesNum(paths) {
                return paths.length
            },
            log: sinon.fake(),
        }
        progressStub = {
            append: sinon.fake(),
            stop: sinon.fake(),
            increment: sinon.fake(),
        }
        gulpStub = Object.assign(new Events(), {
            // create one file in memory
            src: sinon.fake(gulpSrc),
            // no output
            dest: sinon.fake(gulpPassThrough),
        })
        rpqStub = sinon.fake(requirePiper)
        sourceWatcherStub = sinon.fake(createWatcher)
        pkgWatcherStub = sinon.fake(createWatcher)
    })

    it('init', function () {
        should.Throw(() => {
            // exception
            createCompiler({
                // resolveOptions
                '../config': function () {
                    return {}
                },
            })
        }, 'outputDir is required')

        // normal
        let compiler = createCompiler()

        compiler.running.should.equal(false)
        compiler.compiling.should.equal(false)
        compiler.baseDir.should.equal(path.dirname(fixture()))
        compiler.cacheDir.should.equal(path.join(compiler.baseDir, '.wgs'))
        compiler.sourceDir.should.equal(path.join(compiler.baseDir, 'src'))
        compiler.outputDir.should.equal(path.join(compiler.baseDir, 'dist'))
        compiler.options.alias.should.eql({
            '@': fixture(),
        })

        fsStub.mkdirSync.called.should.equal(true)

        compiler._watchers.should.eql([])
        compiler._userTasks.should.eql({})
        compiler._internalTasks.should.eql({})

        return compiler._inited
    })

    it('run tasks', function () {
        // exception
        let compiler = createCompiler({
            // resolveOptions
            '../config': function () {
                let options = fakeWeappConfig()
                // 编译任务
                options.tasks = {
                    js: {
                        use: ['gulp-js'],
                    },
                }
                return options
            },
        })
        should.Throw(() => compiler.run(), 'test is required')

        compiler = createCompiler({
            // resolveOptions
            '../config': function () {
                let options = fakeWeappConfig()
                // 编译任务
                options.tasks = {
                    js: {
                        test: `./**/*.js`,
                    },
                }
                return options
            },
        })
        should.Throw(() => compiler.run(), 'use is required')

        // normal
        compiler = createCompiler()

        return (
            compiler
                .run()
                // check tasks
                .then(() => {
                    let ignore = [
                        '*.md',
                        '/Users/july/workspace/open-source/wgs/test/dist/**',
                        '/Users/july/workspace/open-source/wgs/test/.wgs/**',
                        '**/node_modules/**',
                    ]
                    // js task
                    compiler._userTasks.js.should.deep.include({
                        test: {
                            globs: [
                                toGlobPath(
                                    path.resolve(
                                        compiler.sourceDir,
                                        './**/*.js'
                                    )
                                ),
                            ],
                            options: { ignore },
                        },
                        compileAncestor: false,
                        cache: true,
                        output: true,
                    })
                    compiler._userTasks.js.use.should.lengthOf(1)
                    compiler._userTasks.js.use[0].should.include('gulp-js')
                    compiler._userTasks.js.use[0][1].should.equal(
                        compiler.options
                    )
                    // less task
                    compiler._userTasks.less.should.deep.include({
                        test: {
                            globs: [
                                toGlobPath(
                                    path.resolve(
                                        compiler.sourceDir,
                                        './**/*.less'
                                    )
                                ),
                            ],
                            options: { ignore },
                        },
                        compileAncestor: true,
                        cache: true,
                        output: true,
                    })
                    compiler._userTasks.less.use.should.lengthOf(1)
                    compiler._userTasks.less.use[0].should.include('gulp-less')
                    compiler._userTasks.less.use[0][1].should.equal(
                        compiler.options
                    )
                    // img task
                    compiler._userTasks.img.should.deep.include({
                        test: {
                            globs: [
                                toGlobPath(
                                    path.resolve(
                                        compiler.sourceDir,
                                        `./**/*.{${compiler.options.imgType.join(
                                            ','
                                        )}}`
                                    )
                                ),
                            ],
                            options: { ignore },
                        },
                        compileAncestor: false,
                        cache: true,
                        output: true,
                    })
                    compiler._userTasks.img.use.should.lengthOf(1)
                    compiler._userTasks.img.use[0].should.include('gulp-img')
                    compiler._userTasks.img.use[0][1].should.equal(
                        compiler.options
                    )
                    // pkg task
                    compiler._internalTasks.pkg.should.deep.include({
                        test: {
                            globs: [toGlobPath(fixture('json/package.json'))],
                            options: {
                                allowEmpty: true,
                                ignore,
                            },
                        },
                        compileAncestor: false,
                        cache: false,
                        output: false,
                    })
                    compiler._internalTasks.pkg.use.should.lengthOf(1)
                    compiler._internalTasks.pkg.use[0].should.include(
                        'gulp-pkg'
                    )
                    compiler._internalTasks.pkg.use[0][1].should.equal(
                        compiler.options
                    )
                })
                // check compileContext
                .then(() => {
                    let context = compiler._compileContext
                    // no private
                    should.not.exist(context._init)
                    should.not.exist(context._userTasks)
                    should.not.exist(context._runTasks)
                    // no internal
                    should.not.exist(context.run)
                    should.not.exist(context.incrementCompile)
                    // public
                    should.exist(context.running)
                    should.exist(context.cleanExpired)
                })
                // check clean
                .then(() => {
                    let expired = [fixture('a.js')]
                    compiler.cleanExpired.called.should.equal(true)
                    compiler.removeGraphNodes.called.should.equal(true)
                    compiler.removeGraphNodes.firstArg.should.eql(expired)
                    compiler.reverseDep.called.should.equal(true)
                    compiler.removeCache.called.should.equal(true)
                    compiler.removeCache.firstArg.should.eql(expired)
                })
                // check runTasks
                .then(() => {
                    let total =
                        Object.keys(compiler._userTasks).length +
                        Object.keys(compiler._internalTasks).length

                    // progress
                    progressStub.append.firstArg.should.equal(total)
                    progressStub.increment.callCount.should.equal(total)
                    // cache
                    compiler.compiling.should.equal(false)
                    compiler.reverseDep.called.should.equal(true)
                    compiler.query('env').should.eql({
                        APP_PUBLICK_PATH: '/',
                        CUSTOM_TAB_BAR: true,
                    })
                })
        )
    })

    it('watch tasks', function () {
        // normal
        let compiler = createCompiler()
        // create-watcher
        let myWatcher = compiler.createWatcher([fixture('js/*.js')])

        myWatcher.emit('error', new Error('watch error'))
        helperStub.log.lastArg.should.equal('Error: watch error')
        gulpStub.emit('error', new Error('gulp error'))
        helperStub.log.lastArg.should.equal('Error: gulp error')
        myWatcher.close()

        return compiler
            .watch()
            .then(() => {
                sourceWatcherStub.called.should.equal(true)
                pkgWatcherStub.called.should.equal(true)
                compiler._watchers.should.lengthOf(2)
            })
            .then(() => {
                compiler.stop()
                compiler._watchers.should.lengthOf(0)
            })
    })

    it('compile up-stream', function () {
        // normal
        let compiler = createCompiler()

        compiler.traceReverseDep = sinon.fake.returns([
            fixture('b.less'),
            fixture('c.less'),
        ])
        sinon.replace(compiler, '_runTasks', sinon.fake(compiler._runTasks))

        return compiler.run().then(() => {
            // 编译上游模块
            compiler._compileUpStream({
                totalHit: 1,
                files: [fixture('a.less')],
            })

            let tasks = compiler._runTasks.firstArg
            // js-task
            Object.keys(tasks).should.lengthOf(1)
            // a.js b.js
            tasks.less.test.globs.should.lengthOf(2)
        })
    })

    it('increment compile', function () {
        // normal
        let compiler = createCompiler()

        compiler.traceReverseDep = sinon.fake.returns([
            fixture('b.js'),
            fixture('c.js'),
        ])
        sinon.replace(compiler, '_runTasks', sinon.fake(compiler._runTasks))

        // 增量编译在run之前是不生效的
        compiler.incrementCompile(fixture('a.js'))
        compiler._runTasks.called.should.equal(false)

        // run tasks
        return compiler
            .run()
            .then(() => {
                compiler.incrementCompile(fixture('a.js'))

                let tasks = compiler._runTasks.firstArg
                // only js
                Object.keys(tasks).should.lengthOf(1)
                Object.values(tasks).forEach((v) => {
                    // no cache
                    v.cache.should.equal(false)
                })
                // no up files
                tasks.js.test.globs.should.lengthOf(1)
            })
            .then(() => {
                compiler.incrementCompile(fixture('a.less'))

                let tasks = compiler._runTasks.firstArg
                // less + js
                Object.keys(tasks).should.lengthOf(2)
                Object.values(tasks).forEach((v) => {
                    // no cache
                    v.cache.should.equal(false)
                })
                // two up files
                tasks.js.test.globs.should.lengthOf(2)
            })
    })

    it('hooks', function () {
        // normal
        let compiler = createCompiler(),
            handler = sinon.fake(function (payload) {
                var { next } = payload
                next()
            })

        compiler.tap('beforeCompile', handler)
        return compiler.fire('beforeCompile', 'hello').then(() => {
            handler.called.should.equal(true)
        })
    })

    it('install plugin', function () {
        // stubs
        let onInit = sinon.fake(({ next }) => next()),
            onClean = sinon.fake(({ next }) => next()),
            onBeforeCompile = sinon.fake(({ next }) => next()),
            onAfterCompile = sinon.fake(({ next }) => next()),
            getName = sinon.fake.returns('foo')

        function myPlugin(Compiler) {
            Compiler.installHook({
                init: onInit,
                clean: onClean,
                beforeCompile: onBeforeCompile,
                afterCompile: onAfterCompile,
            })
            Compiler.prototype.$getName = getName
        }

        let compiler = createCompiler({}, [
            myPlugin,
            // redundent
            myPlugin,
        ])

        return compiler.run().then(() => {
            onInit.callCount.should.equal(1)
            onClean.callCount.should.equal(1)
            onBeforeCompile.callCount.should.equal(1)
            onAfterCompile.callCount.should.equal(1)
            compiler.$getName().should.equal('foo')
        })
    })

    it('piper operation', function () {
        function rqp() {
            return true
        }
        rqp.cache = {}

        let compiler = createCompiler({
                './require-piper': rqp,
            }),
            Compiler = compiler.constructor,
            p1 = sinon.fake()

        Compiler.setPipe('myPipe', p1)
        rqp.cache['myPipe'].should.equal(p1)
        Compiler.getPipe('myPipe').should.equal(true)
        Compiler.removePipe('myPipe')
        should.not.exist(rqp.cache['myPipe'])
    })
})
