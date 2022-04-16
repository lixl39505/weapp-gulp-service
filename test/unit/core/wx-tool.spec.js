const sinon = require('sinon')
const proxyquire = require('proxyquire')
// utils
const { afterN } = require('~h')
// target
let wxTool, wxCi, wxCli
// stubs
let ciStub, cliStub

describe('wx-tool', function () {
    beforeEach(function () {
        ciStub = sinon.fake(function WxCI(options) {
            if (!options.privateKeyPath) {
                throw new Error('projectPath is required')
            }
            // mock upload
            this.upload = function (options) {
                if (!options.version) {
                    return Promise.reject(new Error('version is required'))
                }
                return Promise.resolve()
            }
            // mock buildNpm
            this.buildNpm = function () {
                if (process.env.MOCHA_PACKAGEJSON) {
                    return Promise.resolve()
                }
                return Promise.reject(new Error('no package.json'))
            }
            return this
        })
        cliStub = sinon.fake(function WxCli(cliPath) {
            if (!cliPath) {
                throw new Error('cliPath is required')
            }
            // mock upload
            this.upload = function (options) {
                if (!options.version) {
                    throw new Error('version is required')
                }
            }
            // mock buildNpm
            this.buildNpm = function () {
                if (process.env.MOCHA_PACKAGEJSON) {
                    return
                }
                throw new Error('no package.json')
            }
            return this
        })
        wxTool = proxyquire('core/wx-tool', {
            './ci': ciStub,
            './cli': cliStub,
        })

        // reset env
        delete process.env.WE_APP_PRIVATE_KEY_PATH
        delete process.env.WE_CLI
        delete process.env.MOCHA_PACKAGEJSON
    })

    it('create ci', function () {
        // fail
        wxTool.getWx({}, (err) => {
            should.exist(err)
            err.message.should.equal('Wechat interface call failed')
        })
        // success
        process.env.WE_APP_PRIVATE_KEY_PATH = '/user/proj.key'
        wxTool.getWx({}, (err, wx) => {
            should.equal(err, null)
            should.exist(wx)
            wx.type.should.equal('ci')
        })
        // cache
        wxTool.getWx({}, (err, wx) => {
            should.equal(err, null)
            should.exist(wx)
            wx.type.should.equal('ci')
        })
    })

    it('create cli', function () {
        // fail
        wxTool.getWx({}, (err) => {
            should.exist(err)
            err.message.should.equal('Wechat interface call failed')
        })
        // success
        process.env.WE_CLI = '/user/wx-devtool'
        wxTool.getWx({}, (err, wx) => {
            should.equal(err, null)
            should.exist(wx)
            wx.type.should.equal('cli')
        })
        // cache
        wxTool.getWx({}, (err, wx) => {
            should.equal(err, null)
            should.exist(wx)
            wx.type.should.equal('cli')
        })
    })

    it('ci upload', function (done) {
        let unitErr,
            unitDone = afterN(3, () => {
                done(unitErr)
            })

        // fail
        wxTool.upload({}, (err) => {
            unitErr = err
            should.exist(err)
            err.message.should.equal('Wechat interface call failed')
            unitDone()
        })

        process.env.WE_APP_PRIVATE_KEY_PATH = '/user/proj.key'

        // fail
        wxTool.upload({}, (err) => {
            unitErr = err
            should.exist(err)
            err.message.should.equal('version is required')
            unitDone()
        })

        // success
        wxTool.upload(
            {
                ver: '1.0.0',
            },
            (err) => {
                unitErr = err
                should.not.exist(err)
                unitDone()
            }
        )
    })

    it('cli upload', function (done) {
        let unitErr,
            unitDone = afterN(3, () => {
                done(unitErr)
            })

        // fail
        wxTool.upload({}, (err) => {
            unitErr = err
            should.exist(err)
            err.message.should.equal('Wechat interface call failed')
            unitDone()
        })

        process.env.WE_CLI = '/user/wx-devtool'

        // fail
        wxTool.upload({}, (err) => {
            unitErr = err
            should.exist(err)
            err.message.should.equal('version is required')
            unitDone()
        })

        // success
        wxTool.upload(
            {
                ver: '1.0.0',
            },
            (err) => {
                unitErr = err
                should.not.exist(err)
                unitDone()
            }
        )
    })

    it('ci buildNpm', function (done) {
        let unitErr,
            unitDone = afterN(3, () => {
                done(unitErr)
            })

        // fail
        wxTool.buildNpm({}, (err) => {
            unitErr = err
            should.exist(err)
            err.message.should.equal('Wechat interface call failed')
            unitDone()
        })

        process.env.WE_APP_PRIVATE_KEY_PATH = '/user/proj.key'

        // fail
        wxTool.buildNpm({}, (err) => {
            unitErr = err
            should.exist(err)
            err.message.should.equal('no package.json')
            unitDone()
        })

        // success
        process.env.MOCHA_PACKAGEJSON = '/user/package.json'
        wxTool.buildNpm({}, (err) => {
            unitErr = err
            should.not.exist(err)
            unitDone()
        })
    })

    it('cli buildNpm', function (done) {
        let unitErr,
            unitDone = afterN(3, () => {
                done(unitErr)
            })

        // fail
        wxTool.buildNpm({}, (err) => {
            unitErr = err
            should.exist(err)
            err.message.should.equal('Wechat interface call failed')
            unitDone()
        })

        process.env.WE_CLI = '/user/wx-devtool'

        // fail
        wxTool.buildNpm({}, (err) => {
            unitErr = err
            should.exist(err)
            err.message.should.equal('no package.json')
            unitDone()
        })

        // success
        process.env.MOCHA_PACKAGEJSON = '/user/package.json'
        wxTool.buildNpm({}, (err) => {
            unitErr = err
            should.not.exist(err)
            unitDone()
        })
    })
})
