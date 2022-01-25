const path = require('path')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const Vinyl = require('vinyl')
//
const { es6ImportReg } = require('config/constants')
const { wgsResolve } = require('core/compiler').prototype
const { fixture, pathify } = require('~h')
const fakeCompilerUse = require('~f/compiler-use')
//
let Compiler,
    next = () => {},
    depGraph,
    context,
    hooks

describe('plugin-dep-graph', function () {
    beforeEach(function () {
        // reset
        Compiler = fakeCompilerUse()
        depGraph = proxyquire('plugins/dep-graph', {})
        // install
        depGraph(Compiler)
        // init
        context = new Compiler()
        context.sourceDir = fixture()
        context.saveDepGraph = sinon.fake(context.saveDepGraph._original)
        context.wgsResolve = sinon.fake(wgsResolve)
        hooks = Compiler.installHook.firstCall.returnValue
        hooks.init.call(context, { next })
        hooks.beforeCompile.call(context, { next })
    })

    it('dep collection', function () {
        // prepare
        // 测试文件
        let a = new Vinyl({
                base: fixture(),
                path: fixture('js/a.js'),
                contents: Buffer.from('import "./b.js"'),
                context: {},
            }),
            b = new Vinyl({
                base: fixture(),
                path: fixture('js/b.js'),
                contents: Buffer.from('import "./c.js"'),
                context: {},
            }),
            c = new Vinyl({
                base: fixture(),
                path: fixture('js/c.js'),
                contents: Buffer.from('console.log(process.env.APP_SERVER)'),
                context: {
                    customDeps: [fixture('.env/APP_SERVER')],
                },
            })

        //
        Compiler.installHook.called.should.equal(true)

        context._depGraph.should.eql({})
        context._reverseTimes.should.eql(0)
        context._gw.should.eql(0)

        // depend
        const options = { matchers: [es6ImportReg] }
        context.depend(a, options)
        context.depend(b, options)
        context.depend(c, options)
        // depend duplicate
        context.depend(a, options)
        context.depend(c, options)
        // depend flag
        a.context.depended.should.equal(true)
        b.context.depended.should.equal(true)
        c.context.depended.should.equal(true)
        // dependencies
        const nodeA = context.getGraphNode(a),
            nodeB = context.getGraphNode(b),
            nodeC = context.getGraphNode(c)

        nodeA.should.eql({
            path: pathify('/js/a.js'),
            dependencies: [pathify('/js/b.js')],
            requiredBy: [],
        })
        nodeB.should.eql({
            path: pathify('/js/b.js'),
            dependencies: [pathify('/js/c.js')],
            requiredBy: [],
        })
        nodeC.should.eql({
            path: pathify('/js/c.js'),
            dependencies: [pathify('/.env/APP_SERVER')],
            requiredBy: [],
        })

        // reverseDep
        const expectGraph = {
            [pathify('/js/a.js')]: {
                path: pathify('/js/a.js'),
                dependencies: [pathify('/js/b.js')],
                requiredBy: [],
            },
            [pathify('/js/b.js')]: {
                path: pathify('/js/b.js'),
                dependencies: [pathify('/js/c.js')],
                requiredBy: [pathify('/js/a.js')],
            },
            [pathify('/js/c.js')]: {
                path: pathify('/js/c.js'),
                dependencies: [pathify('/.env/APP_SERVER')],
                requiredBy: [pathify('/js/b.js')],
            },
        }
        context.reverseDep()
        context._depGraph.should.eql(expectGraph)
        context.query('depGraph').should.eql(expectGraph)

        // traceReverseDep
        context
            .traceReverseDep(c.path)
            .should.eql([pathify('/js/b.js'), pathify('/js/a.js')])

        // addDep
        context.addDep(b, [
            fixture('js/c.js'), // duplicate
            fixture('js/d.js'), // new
        ])
        nodeB.dependencies.should.eql([
            pathify('/js/c.js'),
            pathify('/js/d.js'),
        ])

        // removeDep
        context.removeGraphNodes(c)
        should.not.exist(context.getGraphNode(c))
    })
})
