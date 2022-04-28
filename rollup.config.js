import nodeResolve from '@rollup/plugin-node-resolve';
import nodeGlobals from 'rollup-plugin-node-globals';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import nodePolyfills from 'rollup-plugin-polyfill-node';

const plugins = [
  commonjs(),
  nodePolyfills(),
  json(),
  nodeResolve({ preferBuiltins: false }),
  nodeGlobals(),
];

module.exports = [
  {
    input: 'lib/unexpectedHttp.js',
    output: {
      file: 'unexpectedHttp.js',
      name: 'unexpectedHttp',
      exports: 'named',
      format: 'umd',
      sourcemap: false,
      strict: false,
    },
    plugins,
  },
  {
    input: 'lib/unexpectedHttp.js',
    output: {
      file: 'unexpectedHttp.min.js',
      name: 'unexpectedHttp',
      exports: 'named',
      format: 'umd',
      sourcemap: false,
      strict: false,
    },
    plugins: [...plugins, require('rollup-plugin-terser').terser()],
  },
];
