const puppeteer = require('puppeteer');
process.env.CHROME_BIN = puppeteer.executablePath();

module.exports = function (config) {
    config.set({
        frameworks: ['mocha'],

        files: [
            { pattern: 'test/browser/index.html', watched: false, included: false, served: true, nocache: false },
            { pattern: 'test/browser/image.png', watched: false, included: false, served: true, nocache: false },
            './node_modules/unexpected/unexpected.js',
            './node_modules/magicpen-prism/magicPenPrism.min.js',
            './unexpectedHttp.min.js',
            './test/browser/unexpectedHttp.js'
        ],

        client: {
            mocha: {
                reporter: 'html',
                timeout: 60000
            }
        },

        browsers: ['ChromeHeadless']
    });
};
