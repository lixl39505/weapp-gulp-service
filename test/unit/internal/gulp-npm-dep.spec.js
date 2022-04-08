const path = require('path')
const fs = require('fs')
const sinon = require('sinon')
const { src } = require('gulp')
const { fixture, minify, stream } = require('~h')
const compilerContext = require('~f/compiler-context')
//
const gulpContext = require('internal/gulp-context')
const gulpNpmDep = require('internal/gulp-npm-dep')
//
let context = {}

describe('gulp-npm-dep', function () {
    beforeEach(function () {
        // reset
        context = compilerContext()
    })

    it('no npm modules', function (done) {
        // set env
        process.env.WE_APP_PRIVATE_KEY_PATH = '/user/private.key'
        process.env.WE_CLI =
            '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'

        src([fixture('json/package.json')])
            .pipe(gulpContext(context))
            .pipe(gulpNpmDep({ packNpmRelationList: context.npmList }))
            .pipe(
                stream(function (file, enc, cb) {
                    try {
                        let res = JSON.parse(file.contents.toString('utf8')),
                            now = new Date().getTime()

                        // all keys
                        Object.keys(res).should.eql([
                            'dependencies',
                            'peerDependencies',
                            'privateKeyPath',
                            'cliPath',
                            'nodeModules',
                            'miniNpm',
                        ])

                        // content
                        res.should.deep.include({
                            dependencies: {
                                md5: '^2.2.1',
                                'miniprogram-computed': '^2.1.1',
                            },
                            peerDependencies: {
                                'weapp-cookie': '^1.4.6',
                            },
                            privateKeyPath: '/user/private.key',
                            cliPath:
                                '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
                        })
                        // npm stat
                        let { nodeModules, miniNpm } = res

                        nodeModules.birthtime.should.equal(nodeModules.ctime)
                        nodeModules.ctime.should.equal(nodeModules.mtime)
                        nodeModules.birthtime.should.lte(now)

                        miniNpm.birthtime.should.equal(miniNpm.ctime)
                        miniNpm.ctime.should.equal(miniNpm.mtime)
                        miniNpm.birthtime.should.lte(now)

                        done()
                    } catch (e) {
                        done(e)
                    }
                    cb(null, file)
                })
            )
    })

    it('exist npm modules', function (done) {
        let fstat = {
            birthtime: new Date(),
            ctime: new Date(),
            mtime: new Date(),
        }

        sinon.replace(fs, 'existsSync', sinon.fake.returns(true))
        sinon.replace(fs, 'statSync', sinon.fake.returns(fstat))

        src([fixture('json/package.json')])
            .pipe(gulpContext(context))
            .pipe(gulpNpmDep({ packNpmRelationList: context.npmList }))
            .pipe(
                stream(function (file, enc, cb) {
                    try {
                        let res = JSON.parse(file.contents.toString('utf8')),
                            { nodeModules, miniNpm } = res

                        // prettier-ignore
                        nodeModules.birthtime.should.equal(fstat.birthtime.getTime())
                        nodeModules.ctime.should.equal(fstat.ctime.getTime())
                        nodeModules.mtime.should.equal(fstat.mtime.getTime())
                        // prettier-ignore
                        miniNpm.birthtime.should.equal(fstat.birthtime.getTime())
                        miniNpm.ctime.should.equal(fstat.ctime.getTime())
                        miniNpm.mtime.should.lte(fstat.mtime.getTime())

                        done()
                    } catch (e) {
                        done(e)
                    }
                    cb(null, file)
                })
            )
    })
})
