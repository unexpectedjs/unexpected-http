/*global unexpected:true*/
unexpected = require('unexpected').clone();
unexpected.output.preferredWidth = 80;
unexpected.installPlugin(require('./lib/unexpectedHttp'));
