const fs = require('fs')
const path = require('path')
const proxyquire = require('proxyquire')
const Vinyl = require('vinyl')
const sinon = require('sinon')
//
const { fixture, pathify } = require('~h')
const fakeCompilerUse = require('~f/compiler-use')
//
let Compiler,
    fsStub = {
        existsSync() {
            return true
        },
    },
    next = () => {},
    foo,
    fooId,
    compileCache,
    context,
    hooks

// from compiler-cache
function uid(file) {
    return path.resolve(file.path).replace(file.base, '')
}

// 模拟一次编译
function run() {
    hooks.init.call(context, { next })
    hooks.beforeCompile.call(context, { next })
    hooks.afterCompile.call(context, { next })
}

describe('plugin-compile-cache', function () {
    beforeEach(function () {
        // reset
        Compiler = fakeCompilerUse()
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
        // init
        context = new Compiler()
        context.sourceDir = fixture()
        context.baseDir = path.dirname(fixture())
        context.saveCompileCache = sinon.fake(
            context.saveCompileCache._original
        )
        context.saveChecksums = sinon.fake(context.saveChecksums._original)
        hooks = Compiler.installHook.firstCall.returnValue
        // 先执行一次，以便生成缓存
        run()
    })

    it('first run', function () {
        Compiler.installHook.called.should.equal(true)

        should.exist(context.checkFileCached)
        should.exist(context.removeCache)
        should.exist(context.saveCompileCache)

        context._compiled.should.eql({})
        context._hitTimes.should.eql(0)
        context._cacheTimes.should.eql(0)
        context._cw.should.eql(0)
    })

    it('new file', function () {
        let cached = context.checkFileCached(foo)
        cached.should.equal(false) // 未缓存
        context._compiled[pathify('/js/a.js')].should.equal(foo.stat.mtimeMs) // 更新时间戳
        context._hitTimes.should.eql(0)
        context._cacheTimes.should.eql(1)
        context._cw.should.eql(1)
        context.query('compiled').should.eql({
            [fooId]: foo.stat.mtimeMs,
        })
    })

    it('update file', function () {
        let lastCompiled = {
            [fooId]: 1, // very long ago
        }
        context.save('compiled', lastCompiled)
        run()

        let cached = context.checkFileCached(foo)
        cached.should.equal(false)
        context._hitTimes.should.equal(0)
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
        run()

        let cached = context.checkFileCached(foo)
        cached.should.equal(false)
        context._hitTimes.should.equal(0)
    })

    it('pkg version change', function () {
        context._version = '1.2.0'
        run()

        let cached = context.checkFileCached(foo)
        cached.should.equal(false)
        context._hitTimes.should.equal(0)
    })

    it('options change', function () {
        let checksum1 = context._checksums.config
        // 修改options
        context.options = {
            callback() {},
        }
        // rerun
        run()
        let checksum2 = context._checksums.config

        checksum1.should.not.equal(checksum2)
        context._isOptionsChanged.should.equal(true)
    })

    it('checkFileChange', function () {
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

    it('hit cache', function () {
        let lastCompiled = {
            [fooId]: foo.stat.mtimeMs, // no content change
        }

        context._compiled = lastCompiled
        context._isOptionsChanged = false
        context.getGraphNode = sinon.fake.returns({
            path: fooId,
            dependencies: [],
            requiredBy: [],
        })

        let cached = context.checkFileCached(foo)
        cached.should.equal(true)
        context._hitTimes.should.equal(1)
    })

    it('remove cache', function () {
        context._compiled = {
            [fooId]: 233,
        }

        context.removeCache(fixture('js/a.js'))
        should.not.exist(context._compiled[fooId])
    })
})
