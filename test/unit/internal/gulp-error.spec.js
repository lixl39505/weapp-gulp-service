const GulpError = require('internal/gulp-error')

describe('gulp-error', function () {
    it('create', function () {
        var err = new GulpError('test', { path: '/test.js' }, 'not found')

        err.name.should.equal('Test') // pascalCase
        err.message.should.equal(`not found \nGulpFile: /test.js`)
        err.toString().should.equal(`Test: not found \nGulpFile: /test.js`)
    })

    it('partial', function () {
        var err = new GulpError.partial('Foo')(
            { path: '/test.js' },
            'not found'
        )

        err.name.should.equal('Foo')
        err.message.should.equal(`not found \nGulpFile: /test.js`)
        err.toString().should.equal(`Foo: not found \nGulpFile: /test.js`)
    })
})
