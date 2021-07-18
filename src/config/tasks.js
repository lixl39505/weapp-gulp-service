// 内部任务（优先执行）
module.exports = {
    // 编译package.json
    pkg: {
        test: ({ npmList }) => npmList.map((v) => v.path),
        use: ['gulp-pkg'],
        compileAncestor: false,
        cache: false,
        output: false,
    },
}
