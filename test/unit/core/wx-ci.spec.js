const sinon = require('sinon')
const proxyquire = require('proxyquire')
// utils
const { fixture } = require('~h')
// target
let WxCI
// stubs
let requiregStub, ciStub
// states
let isPackManually, isPack, isUpload

describe('wx-ci', function () {
    beforeEach(function () {
        ciStub = {
            Project: function (options) {
                return this
            },
            packNpmManually({ packageJsonPath, miniprogramNpmDistDir }) {
                return new Promise((resolve, reject) => {
                    isPackManually
                        ? resolve({ packageJsonPath, miniprogramNpmDistDir })
                        : reject(new Error('packNpmManually error'))
                })
            },
            packNpm(project, config) {
                return new Promise((resolve, reject) => {
                    isPack ? resolve() : reject(new Error('packNpm error'))
                }).then(() => {
                    if (config && config.reporter) {
                        config.reporter('packNpm success')
                    }

                    return project
                })
            },
            upload(config) {
                return new Promise((resolve, reject) => {
                    isUpload
                        ? resolve(config)
                        : reject(new Error('upload error'))
                })
            },
        }
        requiregStub = sinon.fake(function (path) {
            // ci stub
            if (path === 'miniprogram-ci') {
                return ciStub
            }

            throw new Error(`${path} cannot be found`)
        })
        WxCI = proxyquire('core/wx-tool/ci', {
            requireg: requiregStub,
        })
    })

    it('create', function () {
        let options = {},
            wx

        // fail
        should.Throw(() => {
            wx = new WxCI(options)
        }, 'Project root must be specified')
        // fail
        options.projectPath = fixture()
        should.Throw(() => {
            wx = new WxCI(options)
        }, `The project configuration file '${fixture('./project.config.json')}' does not exist`)
        // fail
        options.projectPath = fixture('../')
        should.Throw(() => {
            wx = new WxCI(options)
        }, 'Private key file path not provided')
        // fail
        options.privateKeyPath = 'unknow.key'
        should.Throw(() => {
            wx = new WxCI(options)
        }, `Private key file '${fixture('../' + options.privateKeyPath)}' does not exist`)
        // success
        options.privateKeyPath = 'private.key'
        wx = new WxCI(options)
        wx.projectConfig.description.should.equal('template')
        wx.miniprogramRoot.should.equal(fixture('../dist'))
        wx.packNpmManually.should.equal(true)
        wx.packNpmRelationList.should.eql([
            {
                packageJsonPath: './package.json',
                miniprogramNpmDistDir: './dist',
            },
        ])
        wx.project.should.instanceof(ciStub.Project)
    })

    it('buildNpm', function () {
        let wx = new WxCI({
                projectPath: fixture('../'),
                privateKeyPath: 'private.key',
            }),
            unitErr

        return (
            Promise.resolve()
                // packManually fail
                .then(() => {
                    isPackManually = false

                    return wx.buildNpm().catch((err) => (unitErr = err))
                })
                .then(() => {
                    unitErr.message.should.equal('packNpmManually error')
                })
                // packManually success
                .then(() => {
                    isPackManually = true

                    return wx.buildNpm()
                })
                .then((results) => {
                    results.should.eql([
                        {
                            packageJsonPath: fixture('../package.json'),
                            miniprogramNpmDistDir: fixture('../dist'),
                        },
                    ])
                })
                // pack fail
                .then(() => {
                    wx.packNpmManually = false
                    isPack = false

                    return wx.buildNpm().catch((err) => (unitErr = err))
                })
                .then(() => {
                    unitErr.message.should.equal('packNpm error')
                })

                // pack success
                .then(() => {
                    isPack = true
                    return wx.buildNpm()
                })
                .then((results) => {
                    results.should.instanceof(ciStub.Project)
                })
        )
    })

    it('upload', function () {
        let wx = new WxCI({
                projectPath: fixture('../'),
                privateKeyPath: 'private.key',
            }),
            unitErr

        return (
            Promise.resolve()
                // fail
                .then(() => {
                    should.Throw(() => wx.upload(), '未提供版本号')
                })
                // fail
                .then(() => {
                    isUpload = false

                    return wx
                        .upload({ version: '1.0.0' })
                        .catch((err) => (unitErr = err))
                })
                .then(() => {
                    unitErr.message.should.equal('upload error')
                })
                // success
                .then(() => {
                    isUpload = true
                    return wx.upload({ version: '1.0.0' })
                })
                .then((res) => {
                    res.version.should.equal('1.0.0')
                })
        )
    })
})
