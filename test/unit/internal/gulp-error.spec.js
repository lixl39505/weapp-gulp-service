const GulpError = require('internal/gulp-error')
const Vinyl = require('vinyl')

let file = new Vinyl({
    base: '/',
    path: '/test.js',
    contents: Buffer.from(''),
})

describe('gulp-error', function () {
    it('create', function () {
        var err = new GulpError('test', file, 'not found')

        err.name.should.equal('Test') // pascalCase
        err.message.should.equal(`not found \nGulpFile: /test.js`)
        err.toString().should.equal(`Test: not found \nGulpFile: /test.js`)
    })

    it('partial', function () {
        var err = new GulpError.partial('Foo')(file, 'not found')

        err.name.should.equal('Foo')
        err.message.should.equal(`not found \nGulpFile: /test.js`)
        err.toString().should.equal(`Foo: not found \nGulpFile: /test.js`)
    })
})
