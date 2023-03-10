"use strict";

require("core-js/modules/es.array.iterator");

require("core-js/modules/es.promise");

require("core-js/modules/es.string.replace");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.loadLessWithImports = loadLessWithImports;
exports.resolveLessVariables = resolveLessVariables;
exports.loadAndResolveLessVars = loadAndResolveLessVars;

var _less = _interopRequireDefault(require("less"));

var _path = require("path");

var _fs = require("fs");

var _getRegexpMatches = require("../get-regexp-matches");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const root = (0, _path.resolve)('./');

function replaceSubstring(string, start, end, replacement) {
  return string.substring(0, start) + replacement + string.substring(end);
}

const importRegExp = /^@import\s+['"]([^'"]+)['"];$/gm;

function loadLessWithImports(entry) {
  const entryPath = (0, _path.resolve)('./', entry);
  const input = (0, _fs.readFileSync)(entryPath, 'utf8');
  const imports = (0, _getRegexpMatches.getRegexpMatches)(importRegExp, input).map(match => {
    const importPath = match[1];
    const fullImportPath = /\.less$/.test(importPath) ? importPath : `${importPath}.less`;
    const resolvedImportPath = /^~/.test(importPath) ? (0, _path.resolve)(root, 'node_modules', fullImportPath.slice(1)) : (0, _path.resolve)((0, _path.dirname)(entryPath), fullImportPath);
    return {
      match,
      path: resolvedImportPath,
      ...loadLessWithImports(resolvedImportPath)
    };
  });
  return {
    code: imports.reduceRight((acc, {
      match,
      code
    }) => replaceSubstring(acc, match.index, match.index + match[0].length, code), input),
    imports: imports.reduce((acc, {
      path,
      imports: nestedImports
    }) => [...acc, ...nestedImports, path], [])
  };
}

const varNameRegExp = /^\s*@([\w-]+)\s*:/gm;

function findLessVariables(lessCode) {
  return (0, _getRegexpMatches.getRegexpMatches)(varNameRegExp, lessCode).map(([, varName]) => varName);
}

const cssVarRegExp = /--([^:]+): ([^;]*);/g;

async function resolveLessVariables(lessCode, lessOptions) {
  const varNames = findLessVariables(lessCode);
  let renderResult;

  try {
    renderResult = await _less.default.render(`${lessCode} #resolved {\n${varNames.map(varName => `--${varName}: @${varName};`).join('\n')}\n}`, lessOptions);
  } catch (e) {
    throw new Error(`Less render failed! (${e.message}) Less code:\n${lessCode}\nVariables found:\n${varNames.join(', ')}`);
  }

  return (0, _getRegexpMatches.getRegexpMatches)(cssVarRegExp, renderResult.css.replace(/#resolved {(.*)}/, '$1')).reduce((acc, [, varName, value]) => ({ ...acc,
    [varName]: value
  }), {});
}
/**
 * Loads a Less file and all of its dependencies (transitively), compiles the Less code, and returns all variables
 * found in the resolved code in an object.
 * @param {String} entry path to the file
 * @param {Object} lessOptions (optional)
 * @returns {Promise<Object>}
 */


async function loadAndResolveLessVars(entry, lessOptions) {
  const {
    code: lessCode
  } = loadLessWithImports(entry);
  return await resolveLessVariables(lessCode, lessOptions);
}