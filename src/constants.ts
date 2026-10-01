// Shared dependency-scanning regexes (global flags; deltic's depend pipe and
// local matchers reset lastIndex before each use).

// js
export const es5ImportReg = /require\(['"](.*?)['"]\)/g
export const es6ImportReg = /(?:from|import)\s+['"](.*?)['"]/g

// wxml: import|wxs|image|audio|video|live-player|live-pusher|web-view
export const htmlUrlReg = /(?:src|url|poster)=['"](.*?)['"]/g

// css
export const cssImportReg = /@import\s+['"](.*?)['"]/g
export const cssUrlReg = /(?:src|url)\(['"]?(.*?)['"]?\)/g
