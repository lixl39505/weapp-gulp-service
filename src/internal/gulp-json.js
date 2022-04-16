const path = require('path')
const fastGlob = require('fast-glob')
const combine = require('multipipe')
//
const gulpIf = require('gulp-if')
const gulpStrJson5 = require('./gulp-str-json5')
const gulpEnv = require('./gulp-env')
const gulpAppJson = require('./gulp-app-json')
const gulpDepend = require('./gulp-depend')

// .json文件
module.exports = function (options = {}) {
    return combine(
        gulpEnv(options),
        gulpStrJson5(),
        gulpIf(function (file) {
            return file.basename == 'app.json'
        }, gulpAppJson(options)),
        gulpIf(
            function (file) {
                return file.extname === '.json' || file.extname === '.json5'
            },
            gulpDepend({
                matchers: [
                    // depend usingComponents
                    function (file) {
                        const { wgsResolve } = file.context
                        let contents = file.contents.toString('utf8'),
                            jo,
                            reqs = [],
                            deps = []

                        try {
                            jo = JSON.parse(contents)
                        } catch (e) {
                            jo = {}
                        }

                        // usingComponents
                        if (jo.usingComponents) {
                            reqs.push(...Object.values(jo.usingComponents))
                        }
                        // pages
                        if (jo.pages) {
                            jo.pages.forEach((v) => {
                                if (v && v.path) {
                                    reqs.push(v.path)
                                } else {
                                    reqs.push(v)
                                }
                            })
                        }
                        // subpackages
                        if (jo.subpackages) {
                            jo.subpackages.forEach((p) => {
                                if (p.pages) {
                                    p.pages.forEach((v) => {
                                        if (v && v.path) {
                                            reqs.push(path.join(p.root, v.path))
                                        } else {
                                            reqs.push(path.join(p.root, v))
                                        }
                                    })
                                }
                            })
                        }

                        if (reqs.length) {
                            reqs.forEach((s) => {
                                var d = wgsResolve(s, file.path),
                                    basename = path.basename(d)

                                // 合并重复末尾part
                                if (d.endsWith(`/${basename}/${basename}`)) {
                                    d = d.slice(0, 0 - basename.length - 1)
                                }
                                deps.push(
                                    ...fastGlob.sync([
                                        `${d}.{vue, mp}`,
                                        `${d}/*.*`,
                                    ])
                                )
                            })
                        }

                        return deps
                    },
                ],
            })
        )
    )
}
