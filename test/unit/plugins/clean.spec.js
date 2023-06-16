const path = require('path')
const proxyquire = require('proxyquire')
const sinon = require('sinon')
//
const { fixture, toGlobPath } = require('~h')
const fakeCompilerHooks = require('~f/compiler-hooks')
//
let Compiler,
    clean,
    context,
    lastFiles = [],
    currentFiles = []

describe('plugin-clean', function () {
    beforeEach(function () {
        // reset
        Compiler = fakeCompilerHooks()
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
        // install
        clean(Compiler)
        // mock
        context = new Compiler()
        context.baseDir = path.dirname(fixture())
        context.sourceDir = fixture()
        context.outputDir = path.join(context.baseDir, 'dist')
        context.getOutputPath = sinon.fake(context.getOutputPath)
        context.saveFileList = sinon.fake(context.saveFileList._original)
    })

    it('install', function () {
        Compiler.installHook.called.should.equal(true)
        should.exist(context.isNewFile)
        should.exist(context.cleanExpired)
        should.exist(context.cleanSpec)
        should.exist(context.getOutputPath)
        should.exist(context.saveFileList)

        return context.run().then(() => {
            context._fileList.should.eql([])
            context._expiredNum.should.eql(0)
            context._fw.should.eql(0)
        })
    })

    it('isNewFile', function () {
        // prepare
        currentFiles = ['/js/a.js']
        context.save('fileList', currentFiles)

        return context.run().then(() => {
            context.isNewFile('/js/a.js').should.equal(false)
            context.isNewFile('/js/b.js').should.equal(true)
        })
    })

    it('clean up expired files', function (done) {
        // prepare
        lastFiles = [
            fixture('js/a.js'),
            fixture('js/b.js'),
            fixture('sfc/bar.vue'),
        ]
        currentFiles = [fixture('js/a.js'), fixture('css/new.css')]
        context.save('fileList', lastFiles)

        context
            .run()
            .then(() => context.cleanExpired())
            .then((expired) => {
                expired.should.eql([fixture('js/b.js'), fixture('sfc/bar.vue')])
                // prettier-ignore
                context.getOutputPath.firstCall.returnValue.should.eql([
                    toGlobPath(path.join(context.outputDir, 'js/b.*')),
                    toGlobPath(path.join(context.outputDir, 'sfc/bar/**')),
                ])

                context._expiredNum.should.equal(2)
                context._fileList.should.eql(currentFiles)
                context.query('fileList').should.eql(currentFiles)

                done()
            })
            .catch((err) => done(err))
    })

    it('clean spec', function () {
        // last files
        lastFiles = [
            fixture('js/bar1.js'),
            fixture('css/bar2.css'),
            fixture('sfc/bar3.vue'),
        ]
        context.save('fileList', lastFiles)

        return context
            .run()
            .then(() =>
                context.cleanSpec([
                    fixture('js/bar1.js'),
                    fixture('sfc/bar3.vue'),
                ])
            )
            .then(() => {
                context.getOutputPath.firstCall.returnValue.should.eql([
                    toGlobPath(path.join(context.baseDir, 'dist/js/bar1.*')),
                    toGlobPath(path.join(context.baseDir, 'dist/sfc/bar3/**')),
                ])

                context._fileList.should.eql([fixture('css/bar2.css')])
                context.query('fileList').should.eql([fixture('css/bar2.css')])
            })
    })
})
