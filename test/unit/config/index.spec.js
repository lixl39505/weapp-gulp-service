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

    it('resolveOptions', function () {
        var config = resolveOptions({
            args: {
                config: fixture('../weapp.config.js'),
                mode: 'prod',
            },
        })

        // env
        config.env.mode.should.equal('prod')
        config.env.NODE_ENV.should.equal('production')
        config.env.CUSTOM_TAB_BAR.should.equal('true')
        // options merge
        config.app.should.eql({
            description: 'template',
            miniprogramRoot: 'dist/',
            setting: {
                es6: true,
                packNpmRelationList: [
                    {
                        packageJsonPath: './package.json',
                        miniprogramNpmDistDir: './dist',
                    },
                ],
            },
        })
        config.output.should.equal('dist')
        config.source.should.equal('src')
        config.lessVar.should.equal('./dark.less')
        config.alias.should.eql({
            '@': './src',
            _c: './src/components',
        })
    })
})
