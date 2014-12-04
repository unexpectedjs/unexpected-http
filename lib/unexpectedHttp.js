var http = require('http'),
    https = require('https'),
    urlModule = require('url'),
    messy = require('messy');

module.exports = function (expect) {
    expect.installPlugin(require('unexpected-messy'))
        .addAssertion('to yield response', function (expect, subject, value, done) {
            expect(done, 'to be a function');
            this.args.pop();
            function handleError(err) {
                if (value instanceof Error) {
                    expect(err, 'to equal', value);
                    done();
                } else {
                    done(err);
                }
            }
            var location = typeof location !== 'undefined' ? location : {hostname: 'localhost'},
                isHttps = false,
                host = location.hostname || 'localhost',
                port = location.port || 80;
            if (!subject.isMessyHttpRequest) {
                if (typeof subject === 'string') {
                    subject = {url: subject};
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
            var httpRequest = subject.isMessyHttpRequest ? subject : messy.HttpRequest(subject);
            httpRequest.protocol = httpRequest.protocol || 'HTTP/1.1';
            if (/^https?:\/\//.test(httpRequest.url)) {
                var urlObj = urlModule.parse(httpRequest.url);
                host = urlObj.host;
                if (!httpRequest.headers.has('Host')) {
                    httpRequest.headers.set('Host', urlObj.host);
                }
                if (urlObj.protocol === 'https:') {
                    isHttps = true;
                }
                httpRequest.url = urlObj.path;
            }
            var headers = httpRequest.headers.toCanonicalObject();
            Object.keys(headers).forEach(function (headerName) {
                headers[headerName] = headers[headerName].join(', ');
            });

            (isHttps ? https : http).request({
                host: host,
                port: port,
                method: httpRequest.method,
                path: httpRequest.path,
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
                    var httpResponse = new messy.HttpResponse({
                        statusCode: response.statusCode,
                        statusMessage: http.STATUS_CODES[response.statusCode],
                        protocol: 'HTTP/' + (response.httpVersionMajor || '1') + '.' + (response.httpVersionMinor || '1'),
                        headers: response.headers,
                        body: body
                    });
                    try {
                        expect(new messy.HttpExchange({
                            request: httpRequest,
                            response: httpResponse
                        }), 'to satisfy', {response: value});
                    } catch (e) {
                        return done(e);
                    }
                    done();
                }).on('error', handleError);
            }).on('error', handleError).end(httpRequest.body);
        });
};
