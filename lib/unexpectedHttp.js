/*global window*/
var http = require('http'),
    https = require('https'),
    urlModule = require('url'),
    messy = require('messy'),
    _ = require('underscore');

module.exports = {
    name: 'unexpected-http',
    installInto: function (expect) {
        expect.installPlugin(require('unexpected-messy'))
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
                                    return resolve(e, context);
                                }
                                resolve(context);
                            } else {
                                reject(err);
                            }
                        }
                    }
                    var requestOptions = {};
                    if (!subject.isMessyHttpRequest) {
                        if (typeof subject === 'string') {
                            subject = {url: subject};
                        } else if (typeof subject === 'object') {
                            subject = _.extend({}, subject);
                        }
                        ['ca', 'cert', 'key'].forEach(function (key) {
                            if (key in subject) {
                                requestOptions[key] = subject[key];
                                delete subject[key];
                            }
                        });
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
                    var baseUrl = typeof window === 'object' && typeof window.location !== 'undefined' ? window.location.href : 'http://localhost/';
                    httpRequest.url = urlModule.resolve(baseUrl, httpRequest.url);
                    var urlObj = urlModule.parse(httpRequest.url),
                        isHttps = urlObj.protocol === 'https:',
                        host = urlObj.hostname,
                        port = urlObj.port ? parseInt(urlObj.port, 10) : undefined;
                    if (!httpRequest.headers.has('Host')) {
                        httpRequest.headers.set('Host', urlObj.host);
                    }
                    if (urlObj.path) {
                        httpRequest.url = urlObj.path;
                    }
                    if (Array.isArray(httpRequest.body) || (httpRequest.body && typeof httpRequest.body === 'object' && (typeof Buffer === 'undefined' || !Buffer.isBuffer(httpRequest.body)))) {
                        if (!httpRequest.headers.has('Content-Type')) {
                            httpRequest.headers.set('Content-Type', 'application/json');
                        }
                        httpRequest.body = JSON.stringify(httpRequest.body);
                    }

                    var headers = httpRequest.headers.toCanonicalObject();
                    Object.keys(headers).forEach(function (headerName) {
                        headers[headerName] = headers[headerName].join(', ');
                    });

                    _.extend(requestOptions, {
                        host: host,
                        port: port || (isHttps ? 443 : 80),
                        method: httpRequest.method,
                        path: httpRequest.path + (httpRequest.search || ''),
                        headers: headers
                    });

                    (isHttps ? https : http).request(requestOptions).on('response', function (response) {
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
                                rawBody: body
                            });
                            try {
                                expect(expectedResponseError, 'to be undefined');
                                expect(context.httpExchange = new messy.HttpExchange({
                                    request: httpRequest,
                                    response: httpResponse
                                }), 'to satisfy', {response: value});
                            } catch (e) {
                                if (!callbackCalled) {
                                    callbackCalled = true;
                                    return reject(e);
                                }
                            }
                            if (!callbackCalled) {
                                callbackCalled = true;
                                resolve(context);
                            }
                        }).on('error', handleError);
                    }).on('error', handleError).end(httpRequest.body);
                });
            });
    }
};

module.exports.messy = messy;
