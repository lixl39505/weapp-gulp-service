const path = require('path')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const Vinyl = require('vinyl')
//
const { es6ImportReg } = require('config/constants')
const { wgsResolve } = require('core/compiler').prototype
const { fixture, pathify } = require('~h')
const fakeCompilerHooks = require('~f/compiler-hooks')
//
let Compiler, depGraph, context

describe('plugin-dep-graph', function () {
    beforeEach(function () {
        // reset
        Compiler = fakeCompilerHooks()
        depGraph = proxyquire('plugins/dep-graph', {})
        // install
        depGraph(Compiler)
        // mock
        context = new Compiler()
        context.sourceDir = fixture()
        context.saveDepGraph = sinon.fake(context.saveDepGraph._original)
        context.wgsResolve = sinon.fake(wgsResolve)
    })

    it('install', function () {
        Compiler.installHook.called.should.equal(true)

        return context.run().then(() => {
            context._depGraph.should.eql({})
            context._reverseTimes.should.eql(0)
            context._gw.should.eql(0)
        })
    })

    it('dep manage', function () {
        // 测试文件
        // a -> b b->c c->env.APP_SERVER
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
                    // 自定义依赖
                    customDeps: [fixture('.env/APP_SERVER')],
                },
            })

        return context.run().then(() => {
            // depend
            const options = { matchers: [es6ImportReg] }
            context.depend(a, options)
            context.depend(b, options)
            context.depend(c, {
                matchers: [() => ['../img/wx.png']],
            })
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
                dependencies: [
                    pathify('/img/wx.png'),
                    pathify('/.env/APP_SERVER'),
                ],
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
                    dependencies: [
                        pathify('/img/wx.png'),
                        pathify('/.env/APP_SERVER'),
                    ],
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
            context.addDep(b, fixture('js/c.js')) // duplicate
            context.addDep(b, [
                fixture('js/d.js'), // new
            ])
            nodeB.dependencies.should.eql([
                pathify('/js/c.js'),
                pathify('/js/d.js'),
            ])

            // removeDep
            context.removeDep(a, fixture('js/b.js'))
            nodeA.dependencies.should.eql([])
            nodeB.requiredBy.should.eql([])

            // remove nodes
            context.removeGraphNodes(c)
            should.not.exist(context.getGraphNode(c))
        })
    })
})
