const sinon = require('sinon')
const proxyquire = require('proxyquire')
const { src } = require('gulp')
//
const { fixture, stream } = require('~h')
const compilerSession = require('~f/compiler-session')
//
let wxToolStub = {},
    cmdStub = {},
    fsStub = {},
    context = {},
    gulpContext = require('internal/gulp-context'),
    gulpBuildNpm

describe('gulp-build-npm', function () {
    beforeEach(function () {
        // reset
        cmdStub = {
            checkNpmPkg: sinon.fake.returns({
                isPkgMissing: true,
                pkgToUpdate: ['md5'],
                pkgMissing: ['axios'],
            }),
            makeCmd: sinon.fake(function (cmd) {
                // exec
                return sinon.fake.returns(cmd) // stdout
            }),
        }
        cmdStub.npmInstallNoSave = cmdStub.makeCmd('npm install --no-save')
        wxToolStub = {
            buildNpm: sinon.fake(function (options = {}, cb = () => {}) {
                const { project } = options

                setImmediate(() => {
                    var errors = []

                    // invalid
                    if (!project) {
                        return cb(new Error('Project root must be specified'))
                    }
                    if (
                        !process.env.WE_APP_PRIVATE_KEY_PATH &&
                        !process.env.WE_CLI
                    ) {
                        return cb(new Error('Wechat interface call failed'))
                    }
                    // npm build success
                    cb()
                })
            }),
        }
        fsStub = {
            existsSync: sinon.fake.returns(true),
            mkdirSync: sinon.fake(),
        }
        gulpBuildNpm = proxyquire('internal/gulp-build-npm', {
            '../core/wx-tool': wxToolStub,
            '../utils/cmd': cmdStub,
            fs: fsStub,
        })
        Object.assign(process.env, {
            WE_APP_PRIVATE_KEY_PATH: '',
            WE_CLI: '',
        })
        session = compilerSession()
    })

    it('npm install', function (done) {
        // injection
        fsStub.existsSync = function () {
            return false
        }
        process.env.WE_CLI = '/user/cli'
        // run
        src([fixture('json/package.json')])
            .pipe(gulpContext(session))
            .pipe(gulpBuildNpm({ project: session.baseDir }))
            .pipe(
                stream(function (file, enc, cb) {
                    cmdStub.npmInstallNoSave.called.should.equal(true)
                    cmdStub.npmInstallNoSave.lastCall.returnValue.should.equal(
                        'npm install --no-save'
                    )

                    done()
                })
            )
    })

    it('npm update', function (done) {
        // injection
        process.env.WE_CLI = '/user/cli'
        // run
        src([fixture('json/package.json')])
            .pipe(gulpContext(session))
            .pipe(gulpBuildNpm({ project: session.baseDir }))
            .pipe(
                stream(function (file, enc, cb) {
                    cmdStub.checkNpmPkg.called.should.equal(true)
                    cmdStub.checkNpmPkg.lastCall.returnValue.should.eql({
                        isPkgMissing: true,
                        pkgToUpdate: ['md5'],
                        pkgMissing: ['axios'],
                    })
                    cmdStub.npmInstallNoSave.called.should.equal(true)
                    cmdStub.makeCmd.args
                        .some((v) => v[0] === 'npm update md5')
                        .should.equal(true)

                    done()
                })
            )
    })

    it('wx build npm fail, no project', function (done) {
        src([fixture('json/package.json')])
            .pipe(gulpContext(session))
            .pipe(gulpBuildNpm())
            .on('error', function (err) {
                err.toString().should.equal(
                    'Error: Project root must be specified'
                )

                done()
            })
    })

    it('wx build npm fail, no WE_CLI && no PRIVATE_KEY', function (done) {
        src([fixture('json/package.json')])
            .pipe(gulpContext(session))
            .pipe(gulpBuildNpm({ project: session.baseDir }))
            .on('error', function (err) {
                err.message.should.include('Wechat interface call failed')

                done()
            })
    })

    it('wx build npm fail when tolerant', function (done) {
        src([fixture('json/package.json')])
            .pipe(gulpContext(session))
            .pipe(
                gulpBuildNpm({
                    project: context.baseDir,
                    tolerant: true,
                })
            )
            .pipe(
                stream(function (file) {
                    file.basename.should.equal('package.json')
                    wxToolStub.buildNpm.called.should.equal(true)

                    done()
                })
            )
    })

    it('wx build npm success', function (done) {
        process.env.WE_CLI = '/user/cli'

        src([fixture('json/package.json')])
            .pipe(gulpContext(session))
            .pipe(gulpBuildNpm({ project: session.baseDir }))
            .pipe(
                stream(function (file) {
                    file.basename.should.equal('package.json')
                    wxToolStub.buildNpm.called.should.equal(true)

                    done()
                })
            )
    })
})
