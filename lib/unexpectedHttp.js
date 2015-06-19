/*global window*/
var http = require('http'),
    https = require('https'),
    messy = require('messy'),
    _ = require('underscore');

module.exports = {
    name: 'unexpected-http',
    installInto: function (expect) {
        expect
            .installPlugin(require('unexpected-messy'))
            .addAssertion(['string', 'object'], 'to yield response', function (expect, subject, value) {
                var context = {},
                    expectedResponseError;
                if (Object.prototype.toString.call(value) === '[object Error]' || value instanceof Error) {
                    expectedResponseError = value;
                } else if (typeof value === 'number') {
                    value = {statusCode: value};
                } else if (typeof value === 'string' || (typeof Buffer !== 'undefined' && Buffer.isBuffer(value))) {
                    value = {body: value};
                } else {
                    value = _.extend({}, value);
                }

                return expect.promise(function (resolve, reject) {
                    var callbackCalled = false;
                    function handleError(err) {
                        if (!callbackCalled) {
                            callbackCalled = true;
                            if (expectedResponseError) {
                                try {
                                    expect(err, 'to equal', expectedResponseError);
                                } catch (e) {
                                    return reject(e);
                                }
                                resolve(context);
                            } else if (err.code) {
                                // Socket or DNS error
                                try {
                                    expect.fail({
                                        diff: function (output) {
                                            output.error(err.message);
                                            return { diff: output };
                                        },
                                        code: err.code // Will work when https://github.com/unexpectedjs/unexpected/pull/174 is merged
                                    });
                                } catch (e) {
                                    reject(e);
                                }
                            } else {
                                reject(err);
                            }
                        }
                    }
                    var requestOptions = {};
                    if (!subject.isMessyHttpRequest) {
                        subject = new messy.HttpRequest(subject);
                    }
                    var httpRequest = context.httpRequest = subject;
                    httpRequest.protocol = httpRequest.protocol || 'HTTP/1.1';
                    if (Array.isArray(httpRequest.body) || (httpRequest.body && typeof httpRequest.body === 'object' && (typeof Buffer === 'undefined' || !Buffer.isBuffer(httpRequest.body)))) {
                        if (!httpRequest.headers.has('Content-Type')) {
                            httpRequest.headers.set('Content-Type', 'application/json');
                        }
                        httpRequest.body = JSON.stringify(httpRequest.body);
                    }

                    // Avoid using Transfer-Encoding: chunked for the request body as that confuses NGINX -- and we know the length
                    // of the request body:
                    if (!httpRequest.headers.has('Content-Length')) {
                        var contentLength = 0;
                        if (httpRequest.unchunkedBody) {
                            contentLength = httpRequest.unchunkedBody.length;
                        }
                        httpRequest.headers.set('Content-Length', contentLength);
                    }

                    var headers = httpRequest.headers.toCanonicalObject();
                    Object.keys(headers).forEach(function (headerName) {
                        headers[headerName] = headers[headerName].join(', ');
                    });


                    _.extend(requestOptions, {
                        host: httpRequest.host || (typeof window === 'object' && typeof window.location !== 'undefined' ? window.location.hostname : 'localhost'),
                        port: httpRequest.port || (httpRequest.encrypted ? 443 : 80),
                        method: httpRequest.method,
                        path: httpRequest.path + (httpRequest.search || ''),
                        headers: headers
                    }, _.pick(subject, ['ca', 'cert', 'key', 'rejectUnauthorized']));

                    (httpRequest.encrypted ? https : http).request(requestOptions).on('response', function (response) {
                        if (callbackCalled) {
                            return;
                        }
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
                                unchunkedBody: body
                            });
                            expect.promise(function () {
                                expect(expectedResponseError, 'to be undefined');
                                return expect(context.httpExchange = new messy.HttpExchange({
                                    request: httpRequest,
                                    response: httpResponse
                                }), 'to satisfy', {response: value});
                            }).caught(function (e) {
                                if (!callbackCalled) {
                                    callbackCalled = true;
                                    return reject(e);
                                }
                            }).then(function () {
                                if (!callbackCalled) {
                                    callbackCalled = true;
                                    resolve(context);
                                }
                            });
                        }).on('error', handleError);
                    }).on('error', handleError).end(httpRequest.unchunkedBody);
                });
            });
    }
};

module.exports.messy = messy;
