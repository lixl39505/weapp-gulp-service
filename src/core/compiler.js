// 3rd
const fs = require('fs')
const path = require('path')
const Events = require('events')
const combine = require('multipipe')
const fancyLog = require('fancy-log')
const ansiColors = require('ansi-colors')
const connector = require('../utils/connector')
// utils
const rqp = require('./require-piper')
const progress = require('./progress')
const resolveOptions = require('../config')
const internalTasks = require('../config/tasks')
const { queueTask } = require('../utils/scheduler')
const {
    runQueue,
    toGlobPath,
    type,
    resolveNpmList,
    log,
    statsFilesNum,
    groupBy,
    objectMerge,
    dedup,
} = require('../utils/helper')
// gulp-plugins
const gulp = require('gulp')
const { src, dest, series, parallel, watch } = gulp
const gulpIf = require('gulp-if')
const gulpProgress = rqp('gulp-progress')
const gulpContext = rqp('gulp-context')
const gulpCompileCache = rqp('gulp-compile-cache')
// watchers
const sourceWatcher = require('./watcher/source-watcher')
const pkgWatcher = require('./watcher/pkg-watcher')
// global
const plugins = [],
    hooks = {
        init: [],
        clean: [],
        beforeCompile: [],
        afterCompile: [],
        taskerror: [],
    },
    pkgInfo = require('../../package.json') // 包信息

// 打印错误日志
function logError(err) {
    progress.stop()
    // 隐藏进度条
    log((err.error || err).toString())
}

// 编译器
class Compiler extends Events {
    constructor(cmdOptions) {
        super()

        // 运行中
        this._running = false
        // 编译中
        this._compiling = false
        // 初始化完毕标志
        this._inited = false
        // global ignore
        this._ignore = ['**/node_modules/**']
        // 版本号
        this._version = pkgInfo.version
        // hooks
        this._hooks = objectMerge({}, hooks)
        // watchers
        this._watchers = []
        // tasks
        this._userTasks = {}
        this._internalTasks = {}
        // 本地存储
        this._db = null
        // async config
        this._ready = Promise.resolve()
            // configure
            .then(() => resolveOptions(cmdOptions))
            // validation
            .then((options) => {
                this.options = options
                if (!this.options.output) {
                    throw new Error('outputDir is required')
                }
            })
            // init
            .then(() => this._init())
            .then(() => (this._inited = true))
    }

    // 初始化
    _init() {
        // 基路径（实际的cwd）
        this.baseDir = this.options.baseDir = path.dirname(this.options.config)
        // 缓存目录
        // prettier-ignore
        this.cacheDir = this.options.cacheDir = path.resolve(this.baseDir, '.wgs')
        // 输入目录
        // prettier-ignore
        this.sourceDir = this.options.sourceDir = path.resolve(this.baseDir, this.options.source)
        // 输出
        // prettier-ignore
        this.outputDir = this.options.outputDir = path.resolve(this.baseDir, this.options.output)
        // npm构建配置
        this.npmList = this.options.npmList = resolveNpmList(this.options)

        // normalize alias
        const { alias } = this.options
        if (alias) {
            Object.keys(alias).forEach((k) => {
                alias[k] = path.resolve(this.baseDir, alias[k])
            })
        }

        // 创建缓存目录
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir)
        }

        // user ignore
        this._ignore.push(
            ...this.options.ignore,
            `${toGlobPath(this.outputDir)}/**`,
            `${toGlobPath(this.cacheDir)}/**`
        )
        this._ignore = dedup(this._ignore)
        // init db
        this._db = connector({
            dir: this.cacheDir,
        })

        // init hooks
        return this.fire('init')
    }
    // 标准化任务配置对象
    _normalizeTaskConfig(config) {
        let {
            test, // glob | glob[] | { glob, options}
            use, // plugin[]
            compileAncestor = false, // 是否联动更新上游模块
            cache = true, // 是否缓存
            output = true, // 是否输出
        } = config

        // required validation
        if (!test) {
            throw new Error(`test is required. ${JSON.stringify(config)}`)
        }
        if (!use) {
            throw new Error(`use is required. ${JSON.stringify(config)}`)
        }

        if (typeof test === 'function') {
            test = test(this.options)
        }
        // test标准化
        if (type(test) !== 'object') {
            test = {
                globs: test,
                options: {},
            }
        }
        // globs统一为数组
        if (type(test.globs) !== 'array') {
            test.globs = [test.globs]
        }
        // globs统一添加sourceDir前缀
        test.globs = test.globs.map((v) =>
            toGlobPath(path.resolve(this.sourceDir, v))
        )
        test.options = Object.assign({}, test.options)
        // set ignore
        let ignore = test.options.ignore || []
        if (!Array.isArray(ignore)) ignore = [ignore]
        test.options.ignore = dedup(ignore.concat(this._ignore))
        // use: []
        if (type(use) !== 'array') {
            use = [use]
        }
        // use: [[name, options]]
        use.forEach((v, i) => {
            if (type(v) !== 'array') {
                use[i] = [v]
            }
            if (!use[i][1]) {
                use[i][1] = this.options
            } else if (typeof use[i][1] === 'function') {
                use[i][1] = use[i][1](this.options)
            }
        })

        return {
            test,
            use,
            compileAncestor,
            cache,
            output,
        }
    }
    // 标准化任务配置
    _normalizeTasks(tasks) {
        return Object.entries(tasks).reduce((acc, v) => {
            var [name, config] = v
            acc[name] = this._normalizeTaskConfig(config)
            return acc
        }, {})
    }
    // 设置编译上下文
    _setCompileContext() {
        let compileContext = {},
            keys = [
                // from instance
                ...Object.keys(this),
                // from plugins
                ...Object.keys(Object.getPrototypeOf(this)),
                // internal methods (class methods是不可枚举的)
                'wgsResolve',
                'createFileContext',
                'tap',
            ],
            c = this

        keys.forEach((k) => {
            let v = c[k]

            // 隐藏私有属性
            if (!k.startsWith('_')) {
                if (typeof v === 'function') {
                    compileContext[k] = v.bind(c)
                } else {
                    // readonly
                    Object.defineProperty(compileContext, k, {
                        get() {
                            return c[k]
                        },
                    })
                }
            }
        })

        this._compileContext = compileContext
    }
    // 编译前清理动作
    _clean() {
        // 文件在磁盘上可能发生了变动，需要维护状态一致性
        return this._ready
            .then(() => this.cleanExpired())
            .then((expired) => this.fire('clean', { expired }))
    }
    // 执行task
    _runTasks(userTasks = {}, internalTasks = {}) {
        let session = this.createCompileSession(),
            runErr = null

        return (
            // init-hook
            this._ready
                // progress
                .then(() => {
                    let paths = [],
                        ignore = []

                    Object.values(userTasks)
                        .concat(Object.values(internalTasks))
                        .forEach((v) => {
                            if (v.test) {
                                paths.push(v.test.globs)
                                ignore.push(...v.test.options.ignore)
                            }
                        })

                    // lock
                    this._compiling = true

                    progress.append(
                        statsFilesNum(paths, {
                            ignore: dedup(ignore),
                        })
                    )
                })
                // before-hook
                .then(() => this.fire('beforeCompile', { session }))
                // compile
                .then(() => {
                    let internalGulpTasks = Object.values(internalTasks).map(
                            (v) => this.createGulpTask(v, session)
                        ),
                        userGulpTasks = Object.values(userTasks).map((v) =>
                            this.createGulpTask(v, session)
                        ),
                        topTasks = []

                    // 内置任务优先
                    if (internalGulpTasks.length) {
                        topTasks.push(parallel(...internalGulpTasks))
                    }
                    // 用户级任务
                    if (userGulpTasks.length) {
                        topTasks.push(parallel(...userGulpTasks))
                    }
                    // 收尾工作
                    if (topTasks.length) {
                        topTasks.push((cb) => {
                            // 更新依赖图
                            this.reverseDep()
                            // save env
                            this.save('env', this.options.env)
                            cb()
                        })
                    }

                    return new Promise((resolve, reject) => {
                        topTasks.length
                            ? series(...topTasks)((err) =>
                                  err ? reject(err) : resolve()
                              )
                            : resolve()
                    })
                })
                // after-hook
                .then(() => this.fire('afterCompile', { session }))
                // end
                .then(() => {
                    // 当前编译会话结束
                    session.endTime = Date.now()
                    session.totalCache = this._cacheTimes
                    session.totalHit = this._hitTimes

                    let elapsedTime = session.endTime - session.startTime
                    // prettier-ignore
                    console.log('\n')
                    fancyLog(
                        ansiColors.cyan(
                            `Compiling Time: ${
                                elapsedTime < 10
                                    ? '<10ms'
                                    : (elapsedTime / 1000).toFixed(2) + 's'
                            } `
                        )
                    )

                    // 适当等待最后一次文件写入
                    setTimeout(() => {
                        var expiredNum = this._expiredNum,
                            fileWTS = this._fw,
                            hitTimes = this._hitTimes,
                            cacheTimes = this._cacheTimes,
                            cacheWTS = this._cw,
                            reverseTimes = this._reverseTimes,
                            depWTS = this._gw

                        // 打印统计信息
                        var stats = `${expiredNum} file expired, save ${fileWTS} sec. ${hitTimes}/${session.total} file skipped, save ${cacheWTS} sec. graph reverse ${reverseTimes} sec, save ${depWTS} sec.`
                        fancyLog(ansiColors.cyan(stats))
                    }, 1000)

                    return session
                })
                // error handle
                .catch((e) => {
                    runErr = e

                    return runErr && this.fire('taskerror', { error: runErr })
                })
                // done
                .then(() => (runErr ? Promise.reject(runErr) : session))
                .finally(() => {
                    // unlock
                    this._compiling = false
                })
        )
    }
    // 编译上游模块
    _compileUpStream(session) {
        // @bugfix 由于缓存原因，部分依赖发生变动的模块需要重新编译
        if (session.totalHit > 0) {
            let downs = new Set(session.files),
                ups = this.traceUpstreamModules(session.files)

            this.incrementCompile(
                ups.filter((x) => !downs.has(x)),
                false
            )
        }
    }

    // 添加事件
    tap(name, handler) {
        let list = this._hooks[name]

        if (list) {
            list.push(handler)
        }
    }
    // 触发事件
    fire(name, payload = {}) {
        const handlers = this._hooks[name]

        if (handlers.length) {
            if (type(payload) !== 'object') {
                payload = { payload }
            }

            return runQueue.promise(handlers, (fn, next) => {
                payload.next = next
                fn.call(this, payload)
            })
        } else {
            return Promise.resolve()
        }
    }
    // 查询数据库
    query(key, defaults) {
        return this._db.get(key).value() || defaults
    }
    // 写数据库
    save(key, value) {
        if (key) {
            this._db.set(key, value).write()
        }
    }
    // 创建watcher
    createWatcher(paths, options) {
        if (typeof paths === 'string') {
            paths = [paths]
        }

        log(ansiColors.white(`watching ${paths}`))

        // normalize options
        options = objectMerge({}, options)
        // 忽略outputDir以及.env.*文件
        let ignored = options.ignored || []
        if (!Array.isArray(ignored)) ignored = [ignored]
        ignored.push('.env', '.env.*', ...this._ignore)
        options.ignored = dedup(ignored)

        let watcher = watch(paths, options)

        // catch chokidar error
        watcher.on('error', logError)
        // catch gulp error
        let errorListeners = gulp.listeners('error')
        if (errorListeners && errorListeners.indexOf(logError) < 0) {
            gulp.on('error', logError)
        }

        return watcher
    }
    // 编译
    run() {
        if (this._running) {
            return
        }
        this._running = true

        return this._ready
            .then(() => {
                this._userTasks = this._normalizeTasks(this.options.tasks || {})
                this._internalTasks = this._normalizeTasks(internalTasks)
            })
            .then(() => this._setCompileContext())
            .then(() => this._clean())
            .then(() => this._runTasks(this._userTasks, this._internalTasks))
            .then((session) => this._compileUpStream(session))
            .finally(() => (this._running = false))
    }
    // 编译并watch
    watch() {
        if (this._running) {
            return
        }
        this._running = true

        return this._ready
            .then(() => {
                this._userTasks = this._normalizeTasks(this.options.tasks || {})
                this._internalTasks = this._normalizeTasks(internalTasks)
            })
            .then(() => this._setCompileContext())
            .then(() => this._clean())
            .then(() => this._runTasks(this._userTasks, this._internalTasks))
            .then((session) => this._compileUpStream(session))
            .then(() => {
                // watching
                this._watchers.push(sourceWatcher(this))
                this._watchers.push(pkgWatcher(this))
            })
            .finally(() => (this._running = false))
    }
    // 停止watch
    stop() {
        this._watchers.forEach((v) => v.close())
        this._watchers = []
    }
    // 创建gulpTask
    createGulpTask(config, session) {
        // stream-task
        const { test, use, cache, output } = config
        const { cacheDir, outputDir, sourceDir } = this.options
        const transformer = combine(
            ...use.map(([name, options]) => rqp(name)(options))
        )

        return function () {
            return (
                src(test.globs, {
                    ...test.options,
                    base: sourceDir, // 统一base
                })
                    // 上下文注入
                    .pipe(gulpContext(session))
                    // 编译缓存
                    .pipe(
                        gulpIf(
                            cache, // 使用缓存
                            gulpCompileCache({
                                cacheDir, // 缓存文件存放位置
                                outputDir, // 输出目录
                                hit: () => progress.increment(), // 若缓存命中，pipe会中止，所以进度+1
                            })
                        )
                    )
                    .pipe(transformer)
                    // 输出
                    .pipe(gulpIf(output, dest(outputDir)))
                    // 进度+1
                    .pipe(gulpProgress())
            )
        }
    }
    // 获取任务配置对象
    getTaskConfig(taskType, clone = false) {
        var result = this._internalTasks[taskType] || this._userTasks[taskType]

        if (clone && result) {
            result = objectMerge({}, result)
        }

        return result
    }
    // 获取任务类型
    getTaskType(filePath) {
        var t = path.extname(filePath).replace('.', '')

        if (this.options.imgType.indexOf(t) >= 0) {
            t = 'img'
        }

        return t
    }
    // 增量编译
    incrementCompile(filePaths = [], trace = true) {
        if (!Array.isArray(filePaths)) {
            filePaths = [filePaths]
        }
        // 无需编译
        if (filePaths.length <= 0) return

        // 需要溯源
        if (trace) {
            filePaths.push(...this.traceUpstreamModules(filePaths))
        }
        // 去重
        filePaths = dedup(filePaths)
        // 创建编译任务
        let tasks = groupBy(filePaths, (v) => this.getTaskType(v))
        tasks = Object.entries(tasks).reduce((acc, [t, paths]) => {
            let config = this.getTaskConfig(t, true)

            // 跳过不支持的任务
            if (!config) {
                // prettier-ignore
                log(ansiColors.yellow(`Compiling .${t} files is not supported!`))
            } else {
                config.test.globs = paths // 目标文件
                config.cache = false // 忽略缓存
                acc[t] = config
            }

            return acc
        }, {})
        // no tasks
        if (Object.keys(tasks).length <= 0) {
            return
        }
        // run tasks
        this.nextTask(() => this._runTasks(tasks))
    }
    // 添加代办任务
    nextTask(fn) {
        queueTask(fn)
    }
    // 模块路径解析
    wgsResolve(request, relativePath) {
        var d,
            pwd = relativePath ? path.dirname(relativePath) : this.sourceDir

        if (path.isAbsolute(request)) {
            // from root
            d = path.join(this.sourceDir, request)
        } else if (request.startsWith('./') || request.startsWith('../')) {
            // releative
            d = path.resolve(pwd, request)
        } else {
            // for node_modules
            d = path.resolve(this.sourceDir, request)
        }

        return d
    }
    // 创建文件级上下文
    createFileContext(file, session) {
        let fileContext = Object.create(this._compileContext)

        Object.assign(fileContext, {
            originalPath: file.path,
            customDeps: [], // 自定义依赖
            depended: false,
            session,
        })

        return fileContext
    }
    // 创建compile会话对象
    createCompileSession() {
        let session = Object.create(this._compileContext)

        Object.assign(session, {
            startTime: Date.now(), // 编译开始时间
            endTime: -1, // 编译结束时间
            files: [], // 编译文件列表
            total: 0, // 总文件数
            totalCache: 0, // 缓存总数
            totalHit: 0, // 缓存命中数
        })

        return session
    }
    // 获取上游模块路径
    traceUpstreamModules(filePaths) {
        let ups = [],
            sourceDir = this.options.sourceDir

        if (!Array.isArray(filePaths)) {
            filePaths = [filePaths]
        }

        filePaths.forEach((p) => {
            let taskType = this.getTaskType(p),
                taskConfig = this.getTaskConfig(taskType)

            if (taskConfig && taskConfig.compileAncestor) {
                ups.push(
                    ...this.traceReverseDep(p).map((v) =>
                        path.join(sourceDir + v)
                    )
                )
            }
        })

        return ups
    }
    // for test
    ready(cb) {
        return cb ? this._ready.then(cb) : this._ready
    }

    // 插件安装
    static use(plugin, options) {
        if (plugins.indexOf(plugin) >= 0) return

        plugins.push(plugin)
        plugin(Compiler, options)
    }
    // 添加hook
    static installHook(name, handler) {
        // hook map
        if (type(name) === 'object') {
            Object.entries(name).forEach(([k, v]) => Compiler.installHook(k, v))
        } else {
            hooks[name] && hooks[name].push(handler)
        }
    }
    // 设置pipe
    static setPipe(k, v) {
        rqp.cache[k] = v
    }
    // 移除pipe
    static removePipe(k) {
        delete rqp.cache[k]
    }
    // 获取pipe
    static getPipe(k) {
        return rqp(k)
    }
}

module.exports = Compiler
