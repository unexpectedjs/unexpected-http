/*global describe, it, beforeEach*/
var unexpected = require('unexpected'),
    unexpectedHttp = require('../lib/unexpectedHttp'),
    http = require('http');

describe('unexpected-http', function () {
    var expect = unexpected.clone().installPlugin(unexpectedHttp);

    expect.output.installPlugin(require('magicpen-prism'));

    it('should do a basic request @integration', function (done) {
        expect('GET http://www.gofish.dk/', 'to yield response', {
            headers: {
                'Content-Type': /text\/html/
            }
        }, done);
    });

    it('should fail with a diff @integration', function (done) {
        expect('GET http://www.gofish.dk/', 'to yield response', {
            headers: {
                'Content-Type': /text\/plain/
            }
        }, function (err) {
            expect(err, 'to be an', Error);
            expect(err.output.toString(), 'to match', /Content-Type: text\/html.*\/\/ should match \/text\\\/plain/);
            done();
        });
    });

    it('should expect an error if the response is given as an error @integration', function (done) {
        var expectedError = new Error('getaddrinfo EADDRINFO');
        expectedError.code = expectedError.errno = 'EADDRINFO';
        expectedError.syscall = 'getaddrinfo';
        expect(
            'GET http://www.veqwjioevjqwoevijqwokevijqwioevjkqwioevq.com/',
            'to yield response',
            expectedError,
            done
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
            it('should succeed', function (done) {
                handleRequest = function (req, res, next) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end('{"foo": 123}');
                };
                expect('GET ' + serverUrl, 'to yield response', {
                    body: {
                        foo: 123
                    }
                }, done);
            });

            it('should fail with a diff', function (done) {
                handleRequest = function (req, res, next) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end('{"foo": 123}');
                };
                expect('GET ' + serverUrl, 'to yield response', {
                    body: {
                        foo: 456
                    }
                }, function (err) {
                    expect(err, 'to be an', Error);
                    expect(err.output.toString(), 'to equal',
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
                    done();
                });
            });
        });
    });
});
