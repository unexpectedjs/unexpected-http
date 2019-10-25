var unexpected = require('unexpected');
var http = require('http');
var semver = require('semver');
var stream = require('stream');

function createGetAddrInfoError(host, port) {
  var getaddrinfoError;
  // Different versions of node have shuffled around the properties of error instances:
  var nodeJsVersion = process.version.replace(/^v/, '');
  if (nodeJsVersion === '0.10.29') {
    getaddrinfoError = new Error('getaddrinfo EADDRINFO');
    getaddrinfoError.code = getaddrinfoError.errno = 'EADDRINFO';
  } else if (semver.satisfies(nodeJsVersion, '>=0.12.0')) {
    var message =
      'getaddrinfo ENOTFOUND www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com';
    if (semver.satisfies(nodeJsVersion, '>=9.7.0 <10')) {
      // https://github.com/nodejs/node/issues/19716
      getaddrinfoError = new Error();
      getaddrinfoError.message = message;
    } else {
      getaddrinfoError = new Error(message);
    }
    if (
      semver.satisfies(nodeJsVersion, '>=2.0.0') &&
      semver.satisfies(nodeJsVersion, '<12')
    ) {
      getaddrinfoError.message += ` ${host}:${port}`;
      getaddrinfoError.host = host;
      getaddrinfoError.port = port;
    }
    getaddrinfoError.code = getaddrinfoError.errno = 'ENOTFOUND';
    if (semver.satisfies(nodeJsVersion, '>=13')) {
      getaddrinfoError.errno = -3008;
    }
    getaddrinfoError.hostname = 'www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com';
  } else {
    getaddrinfoError = new Error('getaddrinfo ENOTFOUND');
    getaddrinfoError.code = getaddrinfoError.errno = 'ENOTFOUND';
  }
  getaddrinfoError.syscall = 'getaddrinfo';
  return getaddrinfoError;
}

describe('unexpected-http', function() {
  var expect = unexpected
    .clone()
    .use(require('../lib/unexpectedHttp'))
    .addAssertion('<any> when delayed a little bit <assertion?>', function(
      expect
    ) {
      return expect.promise(function(run) {
        setTimeout(
          run(function() {
            return expect.shift();
          }),
          1
        );
      });
    });

  expect.output.preferredWidth = 80;

  expect.output.installPlugin(require('magicpen-prism'));

  it('should do a basic request @integration', function() {
    return expect(
      'GET http://www.gofish.dk/',
      'to yield HTTP response satisfying',
      {
        headers: {
          'Content-Type': /text\/html/
        }
      }
    );
  });

  it('should fail with a diff @integration', function() {
    return expect(
      expect('GET http://www.gofish.dk/', 'to yield HTTP response satisfying', {
        headers: {
          'Content-Type': /text\/plain/
        }
      }),
      'when rejected to have message',
      /Content-Type: text\/html.*\/\/ should match \/text\\\/plain/
    );
  });

  describe('with the expected response object containing an error property @integration', function() {
    it('should expect an error #2', function() {
      return expect(
        'GET http://www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com/',
        'to yield HTTP response satisfying',
        {
          error: createGetAddrInfoError(
            'www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com',
            80
          )
        }
      );
    });
  });

  describe('with the response property given as an error instance @integration', function() {
    it('should expect an error', function() {
      return expect(
        'GET http://www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com/',
        'to yield HTTP response satisfying',
        createGetAddrInfoError('www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com', 80)
      );
    });

    it('should fail with a diff if the request fails with an error that does not equal the expected error', function() {
      return expect(
        expect(
          'GET http://www.veqwjioevjqwoevijqwokevijqwioevjkqwioevq.com/',
          'to yield HTTP response satisfying',
          new Error('foobar')
        ),
        'when rejected to have message',
        expect.it(function(message) {
          // The error varies a lot depending on the node.js version:
          expect(
            message.replace(/Error\(\{[\s\S]*\}\)$/, 'Error(...)'),
            'to equal',
            "expected 'GET http://www.veqwjioevjqwoevijqwokevijqwioevjkqwioevq.com/'\n" +
              "to yield HTTP response satisfying Error('foobar')\n" +
              '\n' +
              'Error(...)'
          );
        })
      );
    });
  });

  it('should expect an error if the response is given as an error @integration', function() {
    return expect(
      'GET http://www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com/',
      'to yield HTTP response satisfying',
      createGetAddrInfoError('www.icwqjecoiqwjecoiwqjecoiwqjceoiwq.com', 80)
    );
  });

  it('should reject with an actual UnexpectedError mentioning the error code when an unexpected socket error is encountered', function() {
    return expect(
      expect(
        'GET http://www.veqwjioevjqwoevijqwokevijqwioevjkqwioevq.com/',
        'to yield HTTP response satisfying',
        {}
      ),
      'when rejected to have message',
      /getaddrinfo/
    );
  });

  describe('with a local test server', function() {
    var handleRequest, serverHostname, serverAddress, serverUrl, server;

    beforeEach(function() {
      handleRequest = undefined;
      server = http.createServer(function(req, res) {
        res.sendDate = false;
        handleRequest(req, res);
      });
      server.listen(0);
      serverAddress = server.address();
      serverHostname =
        serverAddress.address === '::' ? 'localhost' : serverAddress.address;
      serverUrl = `http://${serverHostname}:${serverAddress.port}/`;
    });

    afterEach(function() {
      server.close();
    });

    it('should provide a context object', function() {
      handleRequest = function(req, res) {
        res.writeHead(503);
        res.end();
      };
      return expect(serverUrl, 'to yield HTTP response satisfying', 503).then(
        function(context) {
          expect(context, 'to satisfy', {
            httpRequest: {},
            httpResponse: {},
            httpExchange: {}
          });
        }
      );
    });

    describe('within a timeout', function() {
      beforeEach(function() {
        handleRequest = function(req, res) {
          setTimeout(function() {
            res.setHeader('Content-Type', 'text/plain');
            res.end('foobar');
          }, 3);
        };
      });

      it('should not fail if its within the timeframe', function() {
        return expect(
          {
            url: serverUrl,
            timeout: 1000
          },
          'to yield HTTP response satisfying',
          { body: 'foobar' }
        );
      });

      it('should fail if it is not within the timeframe', function() {
        return expect(
          expect(
            {
              url: serverUrl,
              timeout: 1
            },
            'to yield HTTP response satisfying',
            'foobar'
          ),
          'when rejected to have message',
          `expected { url: 'http://${serverHostname}:${serverAddress.port}/', timeout: 1 }\n` +
            `to yield HTTP response satisfying 'foobar'\n` +
            `  expected a response within 1 ms`
        );
      });
    });

    describe('using a number as a shorthand for a response with that status code', function() {
      beforeEach(function() {
        handleRequest = function(req, res) {
          res.writeHead(412);
          res.end();
        };
      });

      it('should succeed', function() {
        return expect(
          `GET ${serverUrl}`,
          'to yield HTTP response satisfying',
          412
        );
      });

      it('should fail with a diff', function() {
        return expect(
          function() {
            return expect(
              `GET ${serverUrl}`,
              'to yield HTTP response satisfying',
              503
            );
          },
          'to error with',
          /HTTP\/1\.1 412 Precondition Failed \/\/ should be 503 Service Unavailable/
        );
      });
    });

    describe('with a JSON response', function() {
      beforeEach(function() {
        handleRequest = function(req, res) {
          res.setHeader('Content-Type', 'application/json');
          res.end('{"foo": 123}');
        };
      });

      it('should succeed', function() {
        return expect(`GET ${serverUrl}`, 'to yield HTTP response satisfying', {
          body: {
            foo: 123
          }
        });
      });

      it('should fail with a diff', function() {
        return expect(
          expect(`GET ${serverUrl}`, 'to yield HTTP response satisfying', {
            body: {
              foo: 456
            }
          }),
          'when rejected to have message',
          expect.it(function(message) {
            expect(
              message
                .replace(/^\s*Connection:.*\n/m, '')
                .replace(/\n\s*Content-Length:.*$|\s*Content-Length:.*\n/gm, '')
                .replace(
                  /\n\s*Transfer-Encoding:.*$|\s*Transfer-Encoding:.*\n/gm,
                  ''
                ),
              'to equal',
              `expected 'GET ${serverUrl}'\n` +
                `to yield HTTP response satisfying { body: { foo: 456 } }\n` +
                `\n` +
                `GET / HTTP/1.1\n` +
                `Host: ${serverHostname}:${serverAddress.port}\n` +
                `\n` +
                `HTTP/1.1 200 OK\n` +
                `Content-Type: application/json\n` +
                `\n` +
                `{\n` +
                `  foo: 123 // should equal 456\n` +
                `}`
            );
          })
        );
      });

      describe('with an expectation that requires async work', function() {
        it('should succeed', function() {
          return expect(
            `GET ${serverUrl}`,
            'to yield HTTP response satisfying',
            {
              body: {
                foo: expect.it('when delayed a little bit to equal', 123)
              }
            }
          );
        });

        it('should fail with a diff', function() {
          return expect(
            expect(`GET ${serverUrl}`, 'to yield HTTP response satisfying', {
              body: {
                foo: expect.it('when delayed a little bit to equal', 456)
              }
            }),
            'when rejected to have message',
            expect.it(function(message) {
              expect(
                message
                  .replace(/^\s*Connection:.*\n/m, '')
                  .replace(
                    /\n\s*Content-Length:.*$|\s*Content-Length:.*\n/gm,
                    ''
                  )
                  .replace(
                    /\n\s*Transfer-Encoding:.*$|\s*Transfer-Encoding:.*\n/gm,
                    ''
                  ),
                'to equal',
                `expected 'GET ${serverUrl}'\n` +
                  `to yield HTTP response satisfying { body: { foo: expect.it('when delayed a little bit to equal', 456) } }\n` +
                  `\n` +
                  `GET / HTTP/1.1\n` +
                  `Host: ${serverHostname}:${serverAddress.port}\n` +
                  `\n` +
                  `HTTP/1.1 200 OK\n` +
                  `Content-Type: application/json\n` +
                  `\n` +
                  `{\n` +
                  `  foo: 123 // expected: when delayed a little bit to equal 456\n` +
                  `}`
              );
            })
          );
        });
      });

      it('should send the correct Authorization header when specified in the headers object', function() {
        var authorizationHeader;
        handleRequest = function(req, res) {
          authorizationHeader = req.headers.authorization;
          res.end();
        };
        return expect(
          {
            url: `GET ${serverUrl}`,
            headers: {
              Authorization: 'foobar'
            }
          },
          'to yield HTTP response satisfying',
          200
        ).then(function() {
          expect(authorizationHeader, 'to equal', 'foobar');
        });
      });

      it('should send the correct Authorization header when the credentials are specified in the url', function() {
        var authorizationHeader;
        handleRequest = function(req, res) {
          authorizationHeader = req.headers.authorization;
          res.end();
        };
        return expect(
          {
            url: `GET http://foobar:quux@${serverHostname}:${serverAddress.port}/`
          },
          'to yield HTTP response satisfying',
          200
        ).then(function() {
          expect(authorizationHeader, 'to equal', 'Basic Zm9vYmFyOnF1dXg=');
        });
      });
    });

    describe('with a request body stream', function() {
      beforeEach(function() {
        handleRequest = function(req, res) {
          req.pipe(res);
        };
      });

      it('should succeed', function() {
        var responseBodyStream = new stream.Readable();
        responseBodyStream._read = function(num, cb) {
          responseBodyStream._read = function() {};
          setTimeout(function() {
            responseBodyStream.push('foobar');
            responseBodyStream.push(null);
          }, 0);
        };

        return expect(
          {
            url: `PUT ${serverUrl}`,
            body: responseBodyStream
          },
          'to yield HTTP response satisfying',
          {
            body: Buffer.from('foobar', 'utf-8')
          }
        );
      });

      it('should fail if there was an error on the stream', function() {
        var erroringStream = new stream.Readable();
        erroringStream._read = function(num, cb) {
          setTimeout(function() {
            erroringStream.emit('error', new Error('Fake error'));
          }, 0);
        };

        return expect(
          {
            url: `PUT ${serverUrl}`,
            body: erroringStream
          },
          'to yield HTTP response satisfying',
          new Error('Fake error')
        );
      });
    });
  });
});
