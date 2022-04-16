const sinon = require('sinon')
const { src } = require('gulp')
const { fixture, stream, afterN } = require('~h')
const compilerSession = require('~f/compiler-session')
//
const gulpContext = require('internal/gulp-context')
const gulpLessVar = require('internal/gulp-less-var')
//
let context = {}

describe('gulp-less-var', function () {
    beforeEach(function () {
        // reset
        session = compilerSession()
    })

    it('variables', function (done) {
        this.timeout(50000)

        var varJs = '',
            varXss = '',
            hooks = {},
            graph = {
                '/variables.less': {
                    path: '/variables.less',
                    dependencies: ['/default.less'],
                },
                '/default.less': {
                    path: '/default.less',
                    dependencies: ['/variables.less'],
                },
            }

        session.tap = function (name, handler) {
            hooks[name] = hooks[name] || []
            hooks[name].push(handler)
        }
        session.fire = function (name, payload) {
            var handlers = hooks[name] || []

            handlers.forEach((f) =>
                f.call(session, {
                    next: () => {},
                    payload,
                })
            )
        }
        session.getGraphNode = (file) => graph[file.path.replace(file.base, '')]
        session.getGraphNodeById = (id) => graph[id]
        session.removeDep = (id, lessVarId) => {
            var node = graph[id]
            if (node) {
                var idx = node.dependencies.indexOf(lessVarId)
                if (idx >= 0) node.dependencies.splice(idx, 1)
            }
        }

        src([fixture('less/variables.less')])
            .pipe(gulpContext(session))
            .pipe(gulpLessVar(session.options))
            .pipe(
                stream(function (file, env, cb) {
                    const { extname } = file,
                        contents = file.contents.toString('utf8')

                    if (extname == '.js') {
                        varJs = contents
                    }

                    if (extname == '.wxss') {
                        varXss = contents
                    }

                    cb()
                })
            )
            // flow mode
            .on('data', () => {})
            .on('end', function () {
                //
                varJs.should.equal(`export default {"primaryColor":"#123456"}`)
                varXss.should.equal(`page {--primary-color: #123456;}`)
                session.fire('afterCompile')
                graph['/default.less'].dependencies.should.eql([])
                done()
            })

        // after compiler hook
        // session
    })
})
