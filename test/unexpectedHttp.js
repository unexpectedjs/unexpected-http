/*global describe, it*/
var unexpected = require('unexpected'),
    unexpectedHttp = require('../lib/unexpectedHttp');

describe('unexpected-http', function () {
    var expect = unexpected.clone().installPlugin(unexpectedHttp);

    expect.output.installPlugin(require('magicpen-prism'));

    it('should do a basic request', function (done) {
        expect('GET http://www.gofish.dk/', 'to yield response', {
            headers: {
                'Content-Type': /text\/html/
            }
        }, done);
    });

    it('should fail with a diff', function (done) {
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

    it('should expect an error if the response is given as an error', function (done) {
        var expectedError = new Error('getaddrinfo ENOTFOUND');
        expectedError.code = expectedError.errno = 'ENOTFOUND';
        expectedError.syscall = 'getaddrinfo';
        expect(
            'GET http://www.veqwjioevjqwoevijqwokevijqwioevjkqwioevq.com/',
            'to yield response',
            expectedError,
            done
        );
    });
});
