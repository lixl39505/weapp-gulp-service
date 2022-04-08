// 内部任务（优先执行）
module.exports = {
    // 编译package.json
    pkg: {
        test: ({ npmList }) => ({
            globs: npmList.map((v) => v.path),
            options: {
                allowEmpty: true, // npm是可选功能
            },
        }),
        use: ['gulp-pkg'],
        compileAncestor: false,
        cache: false,
        output: false,
    },
}
