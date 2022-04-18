const fs = require('fs')
const path = require('path')
const proxyquire = require('proxyquire')
const Vinyl = require('vinyl')
const sinon = require('sinon')
const { checksum } = require('utils/helper')
//
const { fixture, pathify } = require('~h')
const fakeCompilerHooks = require('~f/compiler-hooks')
//
let Compiler,
    fsStub = {
        existsSync() {
            return true
        },
    },
    foo,
    fooId,
    compileCache,
    context

function makeFile(path, content = '') {
    return new Vinyl({
        base: fixture(),
        path,
        contents: Buffer.from(content),
    })
}

// from compiler-cache
function uid(file) {
    return path.resolve(file.path).replace(file.base, '')
}

describe('plugin-compile-cache', function () {
    beforeEach(function () {
        // reset
        Compiler = fakeCompilerHooks()
        compileCache = proxyquire('plugins/compile-cache', {
            fs: fsStub,
            'fancy-log': sinon.fake(),
        })
        // 测试文件
        foo = new Vinyl({
            base: fixture(),
            path: fixture('js/a.js'),
            stat: fs.statSync(fixture('js/a.js')),
            contents: Buffer.from('var a = 1'),
        })
        fooId = uid(foo)
        // install
        compileCache(Compiler)
        // mock
        context = new Compiler()
        context.options = {}
        context.sourceDir = fixture()
        context.baseDir = path.dirname(fixture())
        context.saveCompileCache = sinon.fake(
            context.saveCompileCache._original
        )
        context.saveChecksums = sinon.fake(context.saveChecksums._original)
        context.removeCache = sinon.fake(context.removeCache)
        // 预生成options checksum，即默认options未发生变动
        context.save('checksums', {
            config: checksum('{}'),
        })
    })

    it('install', function () {
        Compiler.installHook.called.should.equal(true)

        return context.run().then(() => {
            should.exist(context.checkFileCached)
            should.exist(context.removeCache)
            should.exist(context.saveCompileCache)

            context.removeCache.called.should.equal(true)
            context.removeCache.firstArg.should.eql([])

            context._compiled.should.eql({})
            context._hitTimes.should.eql(0)
            context._cacheTimes.should.eql(0)
            context._cw.should.eql(0)
        })
    })

    it('file expired', function () {
        let lastCompiled = {
            [pathify('/js/a.js')]: 1,
            [pathify('/js/b.js')]: 1,
            [pathify('/js/c.js')]: 1,
        }
        context.save('compiled', lastCompiled)

        return context
            .run()
            .then(() => {
                context._compiled.should.eql(lastCompiled)
                context.fire('clean', {
                    expired: [fixture('js/a.js'), fixture('js/b.js')],
                })
            })
            .then(() => {
                context._compiled.should.eql({
                    [pathify('/js/c.js')]: 1,
                })
            })

        // compiler.removeGraphNodes.called.should.equal(true)
        // compiler.removeGraphNodes.firstArg.should.eql(expired)
        // compiler.reverseDep.called.should.equal(true)
    })

    it('gulp task error', function () {
        let lastCompiled = {
            [pathify('/js/a.js')]: 1,
            [pathify('/js/b.js')]: 1,
            [pathify('/js/c.js')]: 1,
        }
        context.save('compiled', lastCompiled)

        return context
            .run()
            .then(() => {
                context._compiled.should.eql(lastCompiled)
                context.fire('taskerror', {
                    error: {
                        file: makeFile(fixture('js/b.js')),
                    },
                })
            })
            .then(() => {
                context._compiled.should.eql({
                    [pathify('/js/a.js')]: 1,
                    [pathify('/js/c.js')]: 1,
                })
            })
    })

    it('new file', function () {
        return context.run().then(() => {
            let cached = context.checkFileCached(foo)

            // 未缓存
            cached.should.equal(false)
            context._hitTimes.should.eql(0)
            context._cacheTimes.should.eql(1)
            context._cw.should.eql(1)
            // 更新时间戳
            context.query('compiled').should.eql({
                [fooId]: foo.stat.mtimeMs,
            })
        })
    })

    it('update file', function () {
        let lastCompiled = {
            [fooId]: 1, // very long ago
        }
        context.save('compiled', lastCompiled)

        return context.run().then(() => {
            let cached = context.checkFileCached(foo)

            cached.should.equal(false)
            context._hitTimes.should.equal(0)
        })
    })

    it('env change', function () {
        let lastCompiled = {
                [fooId]: foo.stat.mtimeMs, // no content change
            },
            lastEnv = {
                APP_SERVER: 'server001',
            }

        process.env.APP_SERVER = 'server002'
        context.save('compiled', lastCompiled)
        context.save('env', lastEnv)
        context.getGraphNode = sinon.fake(function (file) {
            return {
                path: fooId,
                dependencies: [path.join('/.env/APP_SERVER')],
                requiredBy: [],
            }
        })

        return context.run().then(() => {
            let cached = context.checkFileCached(foo)

            cached.should.equal(false)
            context._hitTimes.should.equal(0)
        })
    })

    it('pkg version change', function () {
        let lastCompiled = {
            [fooId]: foo.stat.mtimeMs, // newest
        }
        context.save('compiled', lastCompiled)
        context._version = '1.2.0'

        return context.run().then(() => {
            let cached = context.checkFileCached(foo)

            cached.should.equal(false)
            context._hitTimes.should.equal(0)
        })
    })

    it('options change', function () {
        let checksum1 = context.query('checksums').config
        // 修改options
        context.options = {
            callback() {},
        }

        console.log('checksum1: ', checksum1)

        return context.run().then(() => {
            let checksum2 = context.query('checksums').config

            console.log('checksum2: ', checksum2)

            checksum1.should.not.equal(checksum2)
            context._isOptionsChanged.should.equal(true)
        })
    })

    it('content change', function () {
        return context.run().then(() => {
            // 生成checksum
            context.checkFileChanged(foo, {
                namespace() {
                    return 'views'
                },
            })
            let newFile = foo.clone(),
                change = context.checkFileChanged(newFile, {
                    namespace() {
                        return 'views'
                    },
                })

            change.should.equal(false)

            newFile.contents = Buffer.from('var b = 1')
            change = context.checkFileChanged(newFile, {
                namespace() {
                    return 'views'
                },
            })
            change.should.equal(true)
        })
    })

    it('hit cache', function () {
        let lastCompiled = {
            [fooId]: foo.stat.mtimeMs, // no content change
        }

        context.save('compiled', lastCompiled)
        context.getGraphNode = sinon.fake.returns({
            path: fooId,
            dependencies: [],
            requiredBy: [],
        })

        return context.run().then(() => {
            let cached = context.checkFileCached(foo)
            cached.should.equal(true)
            context._hitTimes.should.equal(1)
        })
    })

    it('remove cache', function () {
        context.save('compiled', {
            [fooId]: 233,
        })

        return context.run().then(() => {
            context.removeCache(fixture('js/a.js'))
            should.not.exist(context.query('compiled')[fooId])
        })
    })
})
