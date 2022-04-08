const path = require('path')
const { debounce, type, remove } = require('../utils/helper')

// 标准化path
function normalizePath(filePath, base) {
    return path.resolve(filePath).replace(base, '')
}
// 递归查询上游
function tracer(graph, node, cb) {
    var visited = new Set()

    function _trace(node, cb) {
        // 避免出现死循环
        if (visited.has(node.path)) {
            return
        } else {
            visited.add(node.path)
        }

        if (node.requiredBy) {
            node.requiredBy.forEach((id) => {
                var p = graph[id]

                if (p) {
                    // 上游节点/当前节点
                    cb(p, node)
                    // 深度递归查找
                    _trace(p, cb)
                }
            })
        }
    }

    _trace(node, cb)
}
// module
const hooks = {
    init({ next }) {
        // private state
        this._depGraph = this._db.get('depGraph').value() || {} // 依赖图
        this._reverseTimes = 0 // 依赖图回溯更新次数
        this._gw = 0 // 写次数

        next()
    },
    beforeCompile({ next }) {
        this._reverseTimes = 0
        this._gw = 0

        next()
    },
}
const methods = {
    // 获取文件id
    getFileId(file) {
        if (typeof file === 'string') {
            file = {
                path: file, // 源码文件路径
                base: this.sourceDir,
            }
        }
        var context = file.context || {},
            originalPath = context.originalPath

        return normalizePath(originalPath || file.path, file.base)
    },
    // 根据文件或者文件path获取节点
    getGraphNode(file, create = false) {
        let id = this.getFileId(file),
            depGraph = this._depGraph,
            node = depGraph[id]

        if (!node && create) {
            node = depGraph[id] = {
                path: id,
                dependencies: [],
                requiredBy: [],
            }
        }

        return node
    },
    // 根据id获取节点
    getGraphNodeById(id) {
        return this._depGraph[id]
    },
    // 收集依赖
    depend(file, { matchers = [] } = {}) {
        let node = this.getGraphNode(file, true),
            dirname = path.dirname(file.path),
            extname = path.extname(file.path)

        // 清除历史deps
        if (file.context.depended === false) {
            node.dependencies = []
        }
        let dependencies = new Set(node.dependencies),
            freshDeps = []
        // 依赖搜索
        if (matchers.length) {
            let content = file.contents.toString('utf8'),
                match

            matchers.forEach((r) => {
                // 正则匹配，取match[1]
                if (type(r) === 'regexp') {
                    while ((match = r.exec(content)) !== null) {
                        var request = match[1]
                        // 指定默认后缀
                        if (path.extname(request) === '') request += extname
                        request = this.wgsResolve(request, file.path)
                        freshDeps.push(request)
                    }
                }
                // 自定义匹配，返回匹配数组
                if (type(r) === 'function') {
                    let deps = r(file) || []
                    deps.forEach((v) => {
                        // 指定默认后缀
                        if (path.extname(v) === '') {
                            v += extname
                        }
                        freshDeps.push(v)
                    })
                }
            })
        }
        // 自定义依赖
        if (file.context.customDeps) {
            freshDeps.push(...file.context.customDeps)
        }
        // 去重
        freshDeps.forEach((v) =>
            dependencies.add(
                normalizePath(path.resolve(dirname, v), this.sourceDir)
            )
        )
        node.dependencies = Array.from(dependencies)
        file.context.depended = true // 带上标记
        return node
    },
    // 更新上游引用关系(requiredBy)
    reverseDep() {
        let graph = this._depGraph
        // clean
        Object.values(graph).forEach((v) => {
            v.requiredBy = []
        })
        // append
        Object.values(graph).forEach((v) => {
            v.dependencies.forEach((d) => {
                var n = graph[d]

                if (n) {
                    n.requiredBy.push(v.path)
                }
            })
        })
        this.saveDepGraph()
    },
    // 查询上游引用链
    traceReverseDep(filePath) {
        let graph = this._depGraph,
            node = graph[this.getFileId(filePath)],
            paths = []

        if (node) {
            tracer(graph, node, (upper) => {
                paths.push(upper.path)
            })
        }

        return paths
    },
    // 添加依赖
    addDep(file, paths) {
        if (typeof paths === 'string') {
            paths = [paths]
        }
        let node = this.getGraphNode(file, true),
            deps = paths.map((v) => normalizePath(v, this.sourceDir)),
            newDeps = []

        deps.forEach((v) => {
            // 幂等操作
            if (node.dependencies.indexOf(v) < 0) {
                newDeps.push(v)
            }
        })
        node.dependencies.push(...newDeps)
    },
    // 删除依赖
    removeDep(file, paths) {
        if (typeof paths === 'string') {
            paths = [paths]
        }

        let node = this.getGraphNode(file)

        if (node) {
            let deps = paths.map((v) => normalizePath(v, this.sourceDir))

            deps.forEach((cid) => {
                let child = this.getGraphNodeById(cid)
                remove(node.dependencies, cid)

                if (child) {
                    remove(child.requiredBy, node.path)
                }
            })
        }
    },
    // 删除节点
    removeGraphNodes(paths = []) {
        // removeDep(file)
        if (type(paths) !== 'array') {
            paths = [paths]
        }

        paths.forEach((v) => {
            // removeDep(filePath)
            delete this._depGraph[this.getFileId(v)]
        })
    },
    // 保存依赖图
    saveDepGraph: debounce(500, function () {
        this.save('depGraph', this._depGraph)
        this._gw++
    }),
}

// 依赖图
module.exports = function (Compiler) {
    Compiler.installHook(hooks)
    Object.assign(Compiler.prototype, methods)
}
