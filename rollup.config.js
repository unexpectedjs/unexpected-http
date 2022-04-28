const plugins = [
  require('rollup-plugin-json')(),
  require('rollup-plugin-commonjs')(),
  require('rollup-plugin-node-resolve')({ preferBuiltins: true }),
  require('rollup-plugin-node-globals')(),
];

module.exports = [
  {
    input: 'lib/unexpectedHttp.js',
    output: {
      file: 'unexpectedHttp.js',
      name: 'unexpected.http',
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
      name: 'unexpected.http',
      exports: 'named',
      format: 'umd',
      sourcemap: false,
      strict: false,
    },
    plugins: [...plugins, require('rollup-plugin-terser').terser()],
  },
];
