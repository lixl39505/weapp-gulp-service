const sinon = require('sinon')
const proxyquire = require('proxyquire')
const { fixture } = require('~/shared/helper')
//
let resolveOptions, helperStub

describe('config', function () {
    beforeEach(function () {
        sinon.replace(console, 'log', sinon.fake())

        helperStub = {
            loadProcessEnv() {
                return {
                    NODE_ENV: 'development',
                    CUSTOM_TAB_BAR: 'true',
                }
            },
        }

        resolveOptions = proxyquire('config/index', {
            '../utils/helper': helperStub,
        })
    })

    it('resolve', function () {
        return resolveOptions({
            args: {
                config: fixture('../weapp.config.js'),
                mode: 'prod',
            },
        }).then((config) => {
            // check env
            config.env.mode.should.equal('prod')
            config.env.NODE_ENV.should.equal('production')
            config.env.CUSTOM_TAB_BAR.should.equal('true')
            // check tasks
            var imgTask = config.tasks.img
            imgTask.test.should.a('function')
            imgTask.test(config).should.eql('./**/*.{jpg,png,svg,webp,gif}')
            // check others
            config.output.should.equal('dist')
            config.source.should.equal('src')
            config.lessVar.should.equal('./dark.less')
            config.alias.should.eql({
                '@': './src',
                _c: './src/components',
            })
        })
    })

    it('ignore string', function () {
        return resolveOptions({
            args: {
                config: fixture('../weapp.config.ignore.js'),
            },
        }).then((config) => {
            config.ignore.should.eql(['*.md'])
        })
    })

    it('callback', function () {
        return resolveOptions({
            args: {
                config: fixture('../weapp.config.callback.js'),
            },
        }).then((config) => {
            config.lessVar.should.eql('./white.less')
        })
    })
})
