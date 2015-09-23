/*global describe, it, beforeEach, setTimeout*/
var unexpected = require('unexpected'),
    http = require('http'),
    semver = require('semver');

describe('unexpected-http', function () {
    var expect = unexpected.clone()
        .installPlugin(require('../lib/unexpectedHttp'))
        .addAssertion('when delayed a little bit', function (expect, subject) {
            var that = this;
            return expect.promise(function (run) {
                setTimeout(run(function () {
                    return that.shift(expect, subject, 0);
                }), 1);
            });
        });

    expect.output.preferredWidth = 80;

    expect.output.installPlugin(require('magicpen-prism'));

    it('should do a basic request @integration', function () {
        return expect('GET http://www.gofish.dk/', 'to yield response', {
            headers: {
                'Content-Type': /text\/html/
            }
        });
    });

    it('should fail with a diff @integration', function () {
        return expect(
            expect('GET http://www.gofish.dk/', 'to yield response', {
                headers: {
                    'Content-Type': /text\/plain/
                }
            }),
            'when rejected',
            'to have message',
                /Content-Type: text\/html.*\/\/ should match \/text\\\/plain/
        );
    });

    describe('with the response property given as an error instance @integration', function () {
        it('should expect an error', function () {
            var expectedError;
            // I do not know the exact version where this change was introduced. Hopefully this is enough to get
            // it working on Travis (0.10.36 presently):
            var nodeJsVersion = process.version.replace(/^v/, '');
            if (nodeJsVersion === '0.10.29') {
                expectedError = new Error('getaddrinfo EADDRINFO');
                expectedError.code = expectedError.errno = 'EADDRINFO';
            } else if (semver.satisfies(nodeJsVersion, '>=0.12.0')) {
                expectedError = new Error('getaddrinfo ENOTFOUND www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com');
                if (semver.satisfies(nodeJsVersion, '>=2.0.0')) {
                    expectedError.message += ' www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com:80';
                    expectedError.host = 'www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com';
                    expectedError.port = 80;
                }
                expectedError.code = expectedError.errno = 'ENOTFOUND';
                expectedError.hostname = 'www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com';
            } else {
                expectedError = new Error('getaddrinfo ENOTFOUND');
                expectedError.code = expectedError.errno = 'ENOTFOUND';
            }
            expectedError.syscall = 'getaddrinfo';
            return expect(
                'GET http://www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com/',
                'to yield response',
                expectedError
            );
        });

        it('should fail with a diff if the request fails with an error that does not equal the expected error', function () {
            return expect(
                expect(
                    'GET http://www.veqwjioevjqwoevijqwokevijqwioevjkqwioevq.com/',
                    'to yield response',
                    new Error('foobar')
                ),
                'when rejected',
                'to have message', function (message) {
                    // The error varies a lot depending on the node.js version:
                    expect(message.replace(/Error\(\{[\s\S]*\}\)$/, 'Error(...)'), 'to equal',
                        "expected 'GET http://www.veqwjioevjqwoevijqwokevijqwioevjkqwioevq.com/'\n" +
                        "to yield response Error('foobar')\n" +
                        "\n" +
                        "Error(...)"
                    );
                }
            );
        });
    });

    it('should expect an error if the response is given as an error @integration', function () {
        var expectedError;
        // I do not know the exact version where this change was introduced. Hopefully this is enough to get
        // it working on Travis (0.10.36 presently):
        var nodeJsVersion = process.version.replace(/^v/, '');
        if (nodeJsVersion === '0.10.29') {
            expectedError = new Error('getaddrinfo EADDRINFO');
            expectedError.code = expectedError.errno = 'EADDRINFO';
        } else if (semver.satisfies(nodeJsVersion, '>=0.12.0')) {
            expectedError = new Error('getaddrinfo ENOTFOUND www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com');
            if (semver.satisfies(nodeJsVersion, '>=2.0.0')) {
                expectedError.message += ' www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com:80';
                expectedError.host = 'www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com';
                expectedError.port = 80;
            }
            expectedError.code = expectedError.errno = 'ENOTFOUND';
            expectedError.hostname = 'www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com';
        } else {
            expectedError = new Error('getaddrinfo ENOTFOUND');
            expectedError.code = expectedError.errno = 'ENOTFOUND';
        }
        expectedError.syscall = 'getaddrinfo';
        return expect(
            'GET http://www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com/',
            'to yield response',
            expectedError
        );
    });

    it('should reject with an actual UnexpectedError mentioning the error code when an unexpected socket error is encountered', function () {
        return expect(
            expect(
                'GET http://www.veqwjioevjqwoevijqwokevijqwioevjkqwioevq.com/',
                'to yield response',
                {}
            ),
            'when rejected',
            'to have message', /getaddrinfo/
        );
    });

    describe('with a local test server', function () {
        var handleRequest,
            serverHostname,
            serverAddress,
            serverUrl;
        beforeEach(function () {
            handleRequest = undefined;
            var server = http.createServer(function (req, res, next) {
                res.sendDate = false;
                handleRequest(req, res, next);
            }).listen(0);
            serverAddress = server.address();
            serverHostname = serverAddress.address === '::' ? 'localhost' : serverAddress.address;
            serverUrl = 'http://' + serverHostname + ':' + serverAddress.port + '/';
        });

        describe('within a timeout', function () {
            beforeEach(function () {
                handleRequest = function (req, res, next) {
                    setTimeout(function () {
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('foobar');
                    }, 3);
                };
            });
            it('should not fail if its within the timeframe', function () {
                return expect({
                    url: serverUrl,
                    timeout: 20
                }, 'to yield response', 'foobar');
            });
            it('should fail if it is not within the timeframe', function () {
                return expect(
                    expect({
                        url: serverUrl,
                        timeout: 1
                    }, 'to yield response', 'foobar'),
                    'when rejected', 'to have message',
                        "expected { url: 'http://" + serverHostname + ":" + serverAddress.port + "/', timeout: 1 } to yield response 'foobar'\n" +
                        "  expected a response within 1 ms"
                );
            });
        });

        describe('with a JSON response', function () {
            beforeEach(function () {
                handleRequest = function (req, res, next) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end('{"foo": 123}');
                };
            });

            it('should succeed', function () {
                return expect('GET ' + serverUrl, 'to yield response', {
                    body: {
                        foo: 123
                    }
                });
            });

            it('should fail with a diff', function () {
                return expect(
                    expect('GET ' + serverUrl, 'to yield response', {
                        body: {
                            foo: 456
                        }
                    }),
                    'when rejected',
                    'to have message', function (message) {
                        expect(message.replace(/^\s*Connection:.*\n/m, '').replace(/\n\s*Content-Length:.*$|\s*Content-Length:.*\n/mg, ''), 'to equal',
                            "expected 'GET " + serverUrl + "' to yield response { body: { foo: 456 } }\n" +
                            '\n' +
                            'GET / HTTP/1.1\n' +
                            'Host: ' + serverHostname + ':' + serverAddress.port + '\n' +
                            '\n' +
                            'HTTP/1.1 200 OK\n' +
                            'Content-Type: application/json\n' +
                            '\n' +
                            '{\n' +
                            '  foo: 123 // should equal 456\n' +
                            '}'
                        );
                    }
                );
            });

            describe('with an expectation that requires async work', function () {
                it('should succeed', function () {
                    return expect('GET ' + serverUrl, 'to yield response', {
                        body: {
                            foo: expect.it('when delayed a little bit', 'to equal', 123)
                        }
                    });
                });

                it('should fail with a diff', function () {
                    return expect(
                        expect('GET ' + serverUrl, 'to yield response', {
                            body: {
                                foo: expect.it('when delayed a little bit', 'to equal', 456)
                            }
                        }),
                        'when rejected',
                        'to have message', function (message) {
                            expect(message.replace(/^\s*Connection:.*\n/m, '').replace(/\n\s*Content-Length:.*$|\s*Content-Length:.*\n/mg, ''), 'to equal',
                                "expected 'GET " + serverUrl + "'\n" +
                                "to yield response { body: { foo: expect.it('when delayed a little bit', 'to equal', 456) } }\n" +
                                '\n' +
                                'GET / HTTP/1.1\n' +
                                'Host: ' + serverHostname + ':' + serverAddress.port + '\n' +
                                '\n' +
                                'HTTP/1.1 200 OK\n' +
                                'Content-Type: application/json\n' +
                                '\n' +
                                '{\n' +
                                '  foo: 123 // expected: when delayed a little bit to equal 456\n' +
                                '}'
                            );
                        }
                    );
                });
            });
        });
    });
});
