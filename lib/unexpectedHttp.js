var http = require('http'),
    https = require('https'),
    urlModule = require('url'),
    messy = require('messy'),
    _ = require('underscore');

module.exports = function (expect) {
    expect.installPlugin(require('unexpected-messy'))
        .addAssertion('to yield response', function (expect, subject, value, done) {
            var context = {};
            expect(done, 'to be a function');
            this.args.pop();

            if (typeof value === 'number') {
                value = {statusCode: value};
            } else if (typeof value === 'string' || (typeof Buffer !== 'undefined' && Buffer.isBuffer(value))) {
                value = {body: value};
            } else {
                value = _.extend({}, value);
            }

            function handleError(err) {
                if (value instanceof Error) {
                    try {
                        expect(err, 'to equal', value);
                    } catch (e) {
                        return done(e, context);
                    }
                    done(null, context);
                } else {
                    done(err, context);
                }
            }
            var location = typeof location !== 'undefined' ? location : {hostname: 'localhost'},
                isHttps = false,
                host = location.hostname || 'localhost',
                port = location.port;
            if (!subject.isMessyHttpRequest) {
                if (typeof subject === 'string') {
                    subject = {url: subject};
                } else if (typeof subject === 'object') {
                    subject = _.extend({}, subject);
                }
                expect(subject, 'to have property', 'url');
                var matchMethod = subject.url.match(/^([A-Z]+) ([\s\S]*)$/);
                if (matchMethod) {
                    subject.method = subject.method || matchMethod[1];
                    subject.url = matchMethod[2];
                }
                subject.method = subject.method || 'GET';
                subject = new messy.HttpRequest(subject);
            }
            var httpRequest = context.httpRequest = subject;
            httpRequest.protocol = httpRequest.protocol || 'HTTP/1.1';
            if (/^https?:\/\//.test(httpRequest.url)) {
                var urlObj = urlModule.parse(httpRequest.url);
                host = urlObj.hostname;
                port = urlObj.port ? parseInt(urlObj.port, 10) : undefined;
                if (!httpRequest.headers.has('Host')) {
                    httpRequest.headers.set('Host', urlObj.host);
                }
                if (urlObj.protocol === 'https:') {
                    isHttps = true;
                }
                if (urlObj.path) {
                    httpRequest.url = urlObj.path;
                }
            }
            var headers = httpRequest.headers.toCanonicalObject();
            Object.keys(headers).forEach(function (headerName) {
                headers[headerName] = headers[headerName].join(', ');
            });

            (isHttps ? https : http).request({
                host: host,
                port: port || (isHttps ? 443 : 80),
                method: httpRequest.method,
                path: httpRequest.path + (httpRequest.search || ''),
                headers: headers
            }).on('response', function (response) {
                var chunks = [];
                response.on('data', function (chunk) {
                    chunks.push(chunk);
                }).on('end', function () {
                    var body;
                    if (chunks.length > 0 && typeof Buffer === 'function' && Buffer.isBuffer(chunks[0])) {
                        body = Buffer.concat(chunks);
                    } else {
                        // String or no chunks
                        // TODO: Uint8Array (browserify)
                        body = chunks.join('');
                    }
                    var httpResponse = context.httpResponse = new messy.HttpResponse({
                        statusCode: response.statusCode,
                        statusMessage: http.STATUS_CODES[response.statusCode],
                        protocol: 'HTTP/' + (response.httpVersionMajor || '1') + '.' + (response.httpVersionMinor || '1'),
                        headers: response.headers,
                        body: body
                    });
                    try {
                        expect(context.httpExchange = new messy.HttpExchange({
                            request: httpRequest,
                            response: httpResponse
                        }), 'to satisfy', {response: value});
                    } catch (e) {
                        return done(e, context);
                    }
                    done(null, context);
                }).on('error', handleError);
            }).on('error', handleError).end(httpRequest.body);
        });
};

module.exports.messy = messy;
