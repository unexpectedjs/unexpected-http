/*global describe, it, beforeEach, setTimeout*/
var unexpected = require('unexpected'),
    http = require('http');

describe('unexpected-http', function () {
    var expect = unexpected.clone()
        .installPlugin(require('../lib/unexpectedHttp'))
        .installPlugin(require('unexpected-promise'))
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
            if (process.version === 'v0.10.29') {
                expectedError = new Error('getaddrinfo EADDRINFO');
                expectedError.code = expectedError.errno = 'EADDRINFO';
            } else {
                expectedError = new Error('getaddrinfo ENOTFOUND');
                expectedError.code = expectedError.errno = 'ENOTFOUND';
            }
            expectedError.syscall = 'getaddrinfo';
            return expect(
                'GET http://www.veqwjioevjqwoevijqwokevijqwioevjkqwioevq.com/',
                'to yield response',
                expectedError
            );
        });

        it('should fail with a diff if the request fails with an error that does not equal the expected error', function () {
            var expectedErrorCode = process.version === 'v0.10.29' ? 'EADDRINFO' : 'ENOTFOUND';
            return expect(
                expect(
                    'GET http://www.veqwjioevjqwoevijqwokevijqwioevjkqwioevq.com/',
                    'to yield response',
                    new Error('foobar')
                ),
                'when rejected',
                'to have message',
                    "expected 'GET http://www.veqwjioevjqwoevijqwokevijqwioevjkqwioevq.com/' to yield response Error({ message: 'foobar' })\n" +
                    "\n" +
                    "Error({\n" +
                    "  message: 'getaddrinfo " + expectedErrorCode + "', // should equal 'foobar'\n" +
                    "                                    // -getaddrinfo " + expectedErrorCode + "\n" +
                    "                                    // +foobar\n" +
                    "  code: '" + expectedErrorCode + "', // should be removed\n" +
                    "  errno: '" + expectedErrorCode + "', // should be removed\n" +
                    "  syscall: 'getaddrinfo' // should be removed\n" +
                    "})"
            );
        });
    });

    it('should expect an error if the response is given as an error @integration', function () {
        var expectedError;
        if (process.version === 'v0.10.29') {
            expectedError = new Error('getaddrinfo EADDRINFO');
            expectedError.code = expectedError.errno = 'EADDRINFO';
        } else {
            expectedError = new Error('getaddrinfo ENOTFOUND');
            expectedError.code = expectedError.errno = 'ENOTFOUND';
        }
        expectedError.syscall = 'getaddrinfo';
        return expect(
            'GET http://www.veqwjioevjqwoevijqwokevijqwioevjkqwioevq.com/',
            'to yield response',
            expectedError
        );
    });

    describe('with a local test server', function () {
        var handleRequest,
            serverAddress,
            serverUrl;
        beforeEach(function () {
            handleRequest = undefined;
            var server = http.createServer(function (req, res, next) {
                res.sendDate = false;
                handleRequest(req, res, next);
            }).listen(0);
            serverAddress = server.address();
            serverUrl = 'http://' + serverAddress.address + ':' + serverAddress.port + '/';
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
                    'to have message',
                        "expected 'GET " + serverUrl + "' to yield response { body: { foo: 456 } }\n" +
                        '\n' +
                        'GET / HTTP/1.1\n' +
                        'Host: ' + serverAddress.address + ':' + serverAddress.port + '\n' +
                        '\n' +
                        'HTTP/1.1 200 OK\n' +
                        'Content-Type: application/json\n' +
                        'Connection: keep-alive\n' +
                        'Transfer-Encoding: chunked\n' +
                        '\n' +
                        '{\n' +
                        '  foo: 123 // should equal 456\n' +
                        '}'
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
                        'to have message',
                            "expected 'GET " + serverUrl + "'\n" +
                            "to yield response { body: { foo: expect.it('when delayed a little bit', 'to equal', 456) } }\n" +
                            '\n' +
                            'GET / HTTP/1.1\n' +
                            'Host: ' + serverAddress.address + ':' + serverAddress.port + '\n' +
                            '\n' +
                            'HTTP/1.1 200 OK\n' +
                            'Content-Type: application/json\n' +
                            'Connection: keep-alive\n' +
                            'Transfer-Encoding: chunked\n' +
                            '\n' +
                            '{\n' +
                            '  foo: 123 // expected 123 when delayed a little bit to equal 456\n' +
                            '}'
                    );
                });
            });
        });
    });
});
