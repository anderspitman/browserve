const path = require('path');

module.exports = {
  output: {
    library: 'fibridge',
    libraryTarget: 'umd',
    filename: 'fibridge.min.js',
  },
  devServer: {
    contentBase: './dist',
  },
  mode: 'development'
};
