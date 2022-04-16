const sinon = require('sinon')
const proxyquire = require('proxyquire')
const dashify = require('dashify')
// utils
const { fixture } = require('~h')
// target
let WxCLI
// stubs
// states
let isExec

describe('wx-cli', function () {
    beforeEach(function () {
        WxCLI = proxyquire('core/wx-tool/cli', {
            child_process: {
                // mock
                execSync: function (order, config) {
                    return order
                },
            },
        })
    })

    it('create', function () {
        let cliPath = '',
            options = {},
            wx

        // fail
        should.Throw(() => {
            wx = new WxCLI(cliPath, options)
        }, 'Wechat developer tool cli path not provided')
        // fail
        cliPath = fixture('wx-dev-tool-cli')
        should.Throw(() => {
            wx = new WxCLI(cliPath, options)
        }, 'The path of wechat developer tool cli is incorrect')
        // success
        cliPath = fixture('../wx-dev-tool-cli')
        wx = new WxCLI(cliPath, options)
        wx.path.should.equal(cliPath)
        wx.globalOptions.should.eql(options)
    })

    it('run cmd', function () {
        let cliPath = fixture('../wx-dev-tool-cli')
        ;(wx = new WxCLI(cliPath, {})),
            (cmds = [
                'login',
                'autoPreview',
                'upload',
                'buildNpm',
                'auto',
                'open',
                'close',
                'quit',
                'resetFileutils',
                'cache',
            ])

        cmds.forEach((v) => {
            wx[v]({
                s: 1,
                long: 2,
            }).should.equal(`"${cliPath}" ${dashify(v)} -s 1 --long 2 `)
        })
    })
})
