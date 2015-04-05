/*global describe, it, beforeEach*/
var unexpected = require('unexpected'),
    http = require('http');

describe('unexpected-http', function () {
    var expect = unexpected.clone()
        .installPlugin(require('../lib/unexpectedHttp'))
        .installPlugin(require('unexpected-promise'))
        .addAssertion('Error', 'to have message', function (expect, subject, value) {
            this.errorMode = 'nested';
            return expect(subject._isUnexpected ? subject.output.toString() : subject.message, 'to satisfy', value);
        });

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
            it('should succeed', function () {
                handleRequest = function (req, res, next) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end('{"foo": 123}');
                };
                return expect('GET ' + serverUrl, 'to yield response', {
                    body: {
                        foo: 123
                    }
                });
            });

            it('should fail with a diff', function () {
                handleRequest = function (req, res, next) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end('{"foo": 123}');
                };
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
        });
    });
});
