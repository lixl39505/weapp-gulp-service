const fs = require('fs')
const semver = require('semver')
const fancyLog = require('fancy-log')
const ansiColors = require('ansi-colors')
const { execSync } = require('child_process')
const { objectMerge } = require('./helper')

// 创建cmd命令
function makeCmd(
    cmd,
    defaultOptions = {
        log: true, // 打印命令行
        // child_process 配置项
        exec: {
            stdio: 'inherit',
        },
    }
) {
    const ins = function (options) {
        var _opt = objectMerge(objectMerge({}, defaultOptions), options)
        var { log, exec: execOptions } = _opt

        // 打印
        if (log) {
            fancyLog(ansiColors.yellow(cmd))
        }

        return execSync(cmd, execOptions)
    }

    ins.toString = () => cmd

    return ins
}

// 安装npm
const npmInstall = makeCmd('npm install')
// 安装npm --no-save
const npmInstallNoSave = makeCmd('npm install --no-save')
// 查询本地pkg安装信息
const npmLs = makeCmd('npm ls --depth 0 --json -s')

// npm包状态检测
function checkNpmPkg(packagePath, cwd) {
    var installInfo,
        packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8')),
        execOptions = {
            stdio: 'pipe',
        }

    // 查询本地pkg安装信息
    if (cwd) execOptions.cwd = cwd
    try {
        installInfo = npmLs({ exec: execOptions }).toString()
    } catch (e) {
        installInfo = e.stdout.toString()
    }

    var pkgList = JSON.parse(installInfo) || {}

    // structure
    /*
        {
            "name": "exampe",
            "version": "1.0.0",
            "problems": [
                "missing: ivux@1.2.43, required by exampe@1.0.0",
                "missing: ivux-alive-tab@1.0.13, required by exampe@1.0.0",
                ...
            ],
            // devDependencies包，若node_modules以及package-lock下都存在，则会显示resolved信息；否则不显示，而且没有missing error。
            // dependencies包复杂一点： 
            //     package-lock  node_modules  结果
            // 		    ✔ 			  ✘        出现且resolved=$path，problems出现missing
            // 		    ✘ 			  ✔        出现且missing = true，problems出现missing
            // 		    ✘ 			  ✘        出现且missing = true，problems出现missing
            "dependencies":
            {
                "@cypress/webpack-preprocessor":
                {
                    "version": "4.1.0",
                    "from": "@cypress/webpack-preprocessor@4.1.0",
                    "resolved": "http://npm.yz.cn/@cypress%2fwebpack-preprocessor/-/webpack-preprocessor-4.1.0.tgz"
                },
                ...
            },
        }
    */

    var pkgActual = pkgList.dependencies || {},
        pkgExpect = packageJson.dependencies,
        missingProblems = (pkgList.problems || []).filter((v) =>
            v.startsWith('missing:')
        ),
        pkgMissing = [],
        pkgToUpdate = [],
        isPkgMissing = missingProblems.length > 0

    // check pkg
    Object.keys(pkgExpect).forEach((name) => {
        var targetRange = pkgExpect[name]

        if (
            pkgActual[name] &&
            !pkgActual[name].missing &&
            pkgMissing.findIndex((v) => v.startsWith(`missing: ${name}`)) < 0
        ) {
            var currentVer = pkgActual[name].version

            // pkg expired
            if (!semver.satisfies(currentVer, targetRange)) {
                pkgToUpdate.push(name)
            }
        } else {
            // missing pkg
            pkgMissing.push(`missing: ${name}`)
            isPkgMissing = true
        }
    })

    return {
        isPkgMissing, // 是否有包缺失
        pkgToUpdate, // 需要更新的包
        pkgMissing, // 缺失的包
    }
}

module.exports = {
    makeCmd,
    checkNpmPkg,
    npmInstall,
    npmInstallNoSave,
    npmLs,
}
