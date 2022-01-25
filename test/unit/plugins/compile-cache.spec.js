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
        context.saveCompileCache = sinon.fake(
            context.saveCompileCache._original
        )
        hooks = Compiler.installHook.firstCall.returnValue
    })

    it('new file', function () {
        Compiler.installHook.called.should.equal(true)

        should.exist(context.checkFileCached)
        should.exist(context.removeCache)
        should.exist(context.saveCompileCache)

        // init
        let hooks = Compiler.installHook.firstCall.returnValue
        hooks.init.call(context, { next })
        // before
        hooks.beforeCompile.call(context, { next })
        context._compiled.should.eql({})
        context._hitTimes.should.eql(0)
        context._cacheTimes.should.eql(0)
        context._cw.should.eql(0)
        // run
        let cached = context.checkFileCached(foo)
        cached.should.equal(false) // 未缓存
        context._compiled[pathify('/js/a.js')].should.equal(foo.stat.mtimeMs) // 更新时间戳
        context._hitTimes.should.eql(0)
        context._cacheTimes.should.eql(1)
        // save
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
        hooks.init.call(context, { next })
        hooks.beforeCompile.call(context, { next })

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
        hooks.init.call(context, { next })
        hooks.beforeCompile.call(context, { next })

        let cached = context.checkFileCached(foo)
        cached.should.equal(false)
        context._hitTimes.should.equal(0)
    })

    it('pkg version change', function () {
        context.save('version', '1.0.0') // lastVersion
        context._version = '1.2.0' // current version
        hooks.init.call(context, { next })
        hooks.beforeCompile.call(context, { next })

        let cached = context.checkFileCached(foo)
        cached.should.equal(false)
        context._hitTimes.should.equal(0)
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
        hooks.init.call(context, { next })
        hooks.beforeCompile.call(context, { next })

        let cached = context.checkFileCached(foo)
        cached.should.equal(true)
        context._hitTimes.should.equal(1)
    })

    it('remove cache', function () {
        context.sourceDir = fixture()
        context.save('compiled', {
            [fooId]: 233,
        })
        hooks.init.call(context, { next })
        hooks.beforeCompile.call(context, { next })

        context.removeCache(fixture('js/a.js'))
        should.not.exist(context._compiled[fooId])
    })
})
