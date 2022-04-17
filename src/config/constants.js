// js
const es5ImportReg = /require\(['"](.*?)['"]\)/g
const es6ImportReg = /(?:from|import)\s+['"](.*?)['"]/g
// wxml : import|wxs|image|audio|video|live-player|live-pusher|web-view
const htmlUrlReg = /(?:src|url|poster)=['"](.*?)['"]/g
// css
const cssImportReg = /@import\s+['"](.*?)['"]/g
const cssUrlReg = /(?:src|url)\(['"]?(.*?)['"]?\)/g

module.exports = {
    es5ImportReg,
    es6ImportReg,
    htmlUrlReg,
    cssImportReg,
    cssUrlReg,
}
