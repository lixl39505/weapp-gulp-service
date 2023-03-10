"use strict";

require("core-js/modules/es.promise");

require("core-js/modules/es.string.replace");

var _path = require("path");

var _fsExtra = require("fs-extra");

var _fs = require("fs");

var _loadAndResolveLessVars = require("./loadAndResolveLessVars");

const dummyExternalDependencyFolder = (0, _path.resolve)('./node_modules/dummy');
const dummyExternalDependencyPath = (0, _path.resolve)(dummyExternalDependencyFolder, 'variables.less');
beforeAll(() => {
  if (!(0, _fs.existsSync)(dummyExternalDependencyPath)) {
    (0, _fsExtra.ensureFileSync)(dummyExternalDependencyPath);
    (0, _fs.writeFileSync)(dummyExternalDependencyPath, '@base-color: #00ff00;\n@light-color  : lighten(@base-color, 10);', {
      encoding: 'utf8'
    });
  }
});
afterAll(() => {
  if ((0, _fs.existsSync)(dummyExternalDependencyFolder)) {
    (0, _fsExtra.removeSync)(dummyExternalDependencyFolder);
  }
});
describe('loadLessWithImports', () => {
  it('loads Less file and its imports (transitively), collects the imports', () => {
    const {
      code,
      imports
    } = (0, _loadAndResolveLessVars.loadLessWithImports)('test/variables.less');
    expect(code).toMatchSnapshot();
    const basePath = (0, _path.resolve)('./');
    expect(imports.map(path => path.replace(basePath, ''))).toEqual(['/node_modules/dummy/variables.less', '/test/theme.less']);
  });
});
describe('loadAndResolveLessVars', () => {
  it('loads Less files, resolves imports, and resolves and collects variables', async () => {
    const output = await (0, _loadAndResolveLessVars.loadAndResolveLessVars)('test/variables.less');
    expect(output).toEqual({
      'base-color': '#00ff00',
      // from dummy lib (transitive external import)
      'light-color': '#4dff4d',
      // original from from dummy lib overwritten locally, computed from imported variable
      'primary-color': 'indigo',
      // from local import
      'dark-color': '#00cc00',
      // from local import, computed from transitively imported variable
      'secondary-color': 'indigo',
      // from entry point, simple assignment from imported variable
      'error-color': 'darkred' // from entry point

    });
  });
});