const sinon = require('sinon')
const proxyquire = require('proxyquire')
//
let cmd,
    childProcessStub = {},
    fancyLogStub = {},
    fsStub = {}

describe('cmd', function () {
    beforeEach(function () {
        // reset
        childProcessStub = {
            execSync: sinon.fake(function (cmd) {
                // npm ls
                if (cmd.indexOf('npm ls ') >= 0) {
                    return JSON.stringify({
                        problems: [
                            'missing: axios@0.19.2, required by kry-portal@1.0.0',
                            'missing: js-cookie@^2.2.1, required by kry-portal@1.0.0',
                            'missing: md5@^2.2.1, required by kry-portal@1.0.0',
                        ],
                        dependencies: {
                            vue: {
                                version: '2.6.10',
                                from: 'vue@^2.6.10',
                                resolved:
                                    'http://npm.at4.cn:82/vue/-/vue-2.6.10.tgz',
                            },
                        },
                    })
                }
            }),
        }
        fancyLogStub = sinon.fake()
        fsStub = {
            // read package.json
            readFileSync() {
                return JSON.stringify({
                    dependencies: {
                        axios: '^0.19.0',
                        md5: '^2.2.1',
                        vue: '^2.6.12',
                        'js-cookie': '^2.2.1',
                    },
                    devDependencies: {
                        chai: '^4.1.2',
                        less: '^3.0.4',
                    },
                })
            },
        }
        cmd = proxyquire('utils/cmd', {
            child_process: childProcessStub,
            'fancy-log': fancyLogStub,
            fs: fsStub,
        })
    })

    it('makeCmd', function () {
        let { makeCmd, npmInstall, npmInstallNoSave, npmLs } = cmd

        npmInstall.toString().should.equal('npm install')
        npmInstallNoSave.toString().should.equal('npm install --no-save')
        npmLs.toString().should.equal('npm ls --depth 0 --json -s')

        let myCmd = makeCmd('npm version patch')
        myCmd.toString().should.equal('npm version patch')

        myCmd()
        fancyLogStub.called.should.equal(true)
        childProcessStub.execSync.lastArg.should.eql({
            stdio: 'inherit',
        })

        fancyLogStub.resetHistory()
        myCmd({
            log: false,
            exec: {
                cwd: '/users/app',
                stdio: 'pipe',
            },
        })
        fancyLogStub.called.should.equal(false)
        childProcessStub.execSync.lastArg.should.eql({
            cwd: '/users/app',
            stdio: 'pipe',
        })
    })

    it('checkNpmPkg', function () {
        let { checkNpmPkg } = cmd
        let { isPkgMissing, pkgToUpdate, pkgMissing } = checkNpmPkg(
            '/path/to/package.json',
            '/path/to'
        )

        isPkgMissing.should.equal(true)
        pkgToUpdate.should.eql(['vue'])
        pkgMissing.should.eql(['missing: axios', 'missing: md5', 'missing: js-cookie'])
    })
})
