// @ts-check

const tsJest = require('ts-jest').default;

/** @type {import('@jest/transform').SyncTransformer<any>} */
const transformer = tsJest.createTransformer({
  tsconfig: {
    jsx: 'react-jsx',
    module: 'commonjs',
    moduleResolution: 'node',
    target: 'es2020',
    lib: ['es2020', 'dom', 'dom.iterable'],
    skipLibCheck: true,
    esModuleInterop: true,
    types: ['vite/client', 'jest', 'node'],
  },
  diagnostics: {
    ignoreCodes: [1343],
  },
});

/** @type {import('@jest/transform').SyncTransformer<any>} */
const customTransformer = {
  /**
   * @param {string} src
   * @param {string} filename
   * @param {import('@jest/transform').TransformOptions<any>} config
   * @returns {import('@jest/transform').TransformedSource}
   */
  process(src, filename, config) {
    const modifiedSrc = src.replace(/import\.meta\.env/g, 'process.env');
    return transformer.process(modifiedSrc, filename, config);
  },
};

module.exports = customTransformer;

