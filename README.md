unexpected-http
===============

[Unexpected](http://github.com/sunesimonsen/unexpected) plugin for testing HTTP servers. Uses same syntax as [unexpected-express](https://github.com/papandreou/unexpected-express) whenever possible.

Works with node.js and in browsers (via [browserify](http://browserify.org) (see [example](tests/index.html)).

[![NPM version](https://badge.fury.io/js/unexpected-http.png)](http://badge.fury.io/js/unexpected-http)
[![Build Status](https://travis-ci.org/papandreou/unexpected-http.png)](https://travis-ci.org/papandreou/unexpected-http)
[![Coverage Status](https://coveralls.io/repos/papandreou/unexpected-http/badge.png)](https://coveralls.io/r/papandreou/unexpected-http)
[![Dependency Status](https://david-dm.org/papandreou/unexpected-http.png)](https://david-dm.org/papandreou/unexpectetd-http)

```javascript
var expect = require('unexpected').clone().installPlugin(require('unexpected-http'));

describe('google.com', function () {
    it('should redirect to a country-specific version', function (done) {
        expect('GET http://google.com/', 'to yield response', {
            statusCode: 302,
            headers: {
                Location: /www\.google\.\w+/
            },
            body: /The document has moved/
        }, done);
    });
});
```
