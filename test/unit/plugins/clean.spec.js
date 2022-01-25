const path = require('path')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
//
const { fixture, toGlobPath } = require('~h')
const fakeCompilerUse = require('~f/compiler-use')
//
let Compiler,
    next = () => {},
    clean,
    context,
    hooks,
    lastFiles = [],
    currentFiles = []

describe('plugin-compile-cache', function () {
    beforeEach(function () {
        // reset
        Compiler = fakeCompilerUse()
        clean = proxyquire('plugins/clean', {
            del: sinon.fake(function (files) {
                return Promise.resolve(files)
            }),
            'fancy-log': sinon.fake(),
            'fast-glob': {
                sync() {
                    return currentFiles
                },
            },
        })
        // fastGlobStub.sync = function () {
        //     return currentFiles
        // }
        // install
        clean(Compiler)
        // init
        context = new Compiler()
        context.baseDir = path.dirname(fixture())
        context.sourceDir = fixture()
        context.outputDir = path.join(context.baseDir, 'dist')
        context.getOutputPath = sinon.fake(context.getOutputPath)
        context.saveFileList = sinon.fake(context.saveFileList._original)
        hooks = Compiler.installHook.firstCall.returnValue
        hooks.init.call(context, { next })
        hooks.beforeCompile.call(context, { next })
    })

    it('new file', function () {
        // prepare
        currentFiles = [
            fixture('js/new1.js'),
            fixture('js/new2.js'),
            fixture('js/new3.vue'),
        ]

        //
        Compiler.installHook.called.should.equal(true)

        should.exist(context.isNewFile)
        should.exist(context.cleanExpired)
        should.exist(context.cleanSpec)
        should.exist(context.getOutputPath)
        should.exist(context.saveFileList)

        context._fileList.should.eql([])
        context._expiredNum.should.eql(0)
        context._fw.should.eql(0)

        let isNew = context.isNewFile(currentFiles[0])
        isNew.should.equal(true)

        context.cleanExpired()
        context._fileList.should.equal(currentFiles)
        context.query('fileList').should.eql(currentFiles)
    })

    it('clean up expired files', function (done) {
        // prepare
        lastFiles = [
            fixture('js/bar1.js'),
            // expired
            fixture('css/bar2.css'),
            fixture('sfc/bar3.vue'),
        ]
        currentFiles = [
            fixture('js/bar1.js'),
            //
            fixture('css/new1.css'),
            fixture('sfc/new2.vue'),
        ]
        context._fileList = [...lastFiles]

        //
        context
            .cleanExpired()
            .then((expired) => {
                expired.should.eql([
                    fixture('css/bar2.css'),
                    fixture('sfc/bar3.vue'),
                ])

                context.getOutputPath.firstCall.returnValue.should.eql([
                    toGlobPath(path.join(context.baseDir, 'dist/css/bar2.*')),
                    toGlobPath(path.join(context.baseDir, 'dist/sfc/bar3/**')),
                ])

                context._expiredNum.should.equal(2)
                context._fileList.should.eql(currentFiles)
                context.query('fileList').should.eql(currentFiles)

                done()
            })
            .catch((err) => done(err))
    })

    it('clean spec', function (done) {
        // last files
        context._fileList = [
            fixture('js/bar1.js'),
            fixture('css/bar2.css'),
            fixture('sfc/bar3.vue'),
        ]

        context
            .cleanSpec([fixture('js/bar1.js'), fixture('sfc/bar3.vue')])
            .then(() => {
                context.getOutputPath.firstCall.returnValue.should.eql([
                    toGlobPath(path.join(context.baseDir, 'dist/js/bar1.*')),
                    toGlobPath(path.join(context.baseDir, 'dist/sfc/bar3/**')),
                ])

                context._fileList.should.eql([fixture('css/bar2.css')])
                context.query('fileList').should.eql([fixture('css/bar2.css')])

                done()
            })
            .catch((err) => done(err))
    })
})
