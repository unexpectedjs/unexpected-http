const http = require('http');
const https = require('https');
const messy = require('messy');
const _ = require('underscore');

module.exports = {
  name: 'unexpected-http',
  installInto: function (expect) {
    expect
      .child()
      .use(require('unexpected-messy'))
      .exportAssertion(
        [
          '<string|object> to yield [HTTP] response <any>',
          '<string|object> to yield [HTTP] response satisfying <any>',
        ],
        function (expect, subject, value) {
          const context = {};
          let expectedResponseError;
          if (
            Object.prototype.toString.call(value) === '[object Error]' ||
            value instanceof Error
          ) {
            expectedResponseError = value;
          } else if (
            value &&
            typeof value === 'object' &&
            (typeof Buffer === 'undefined' || !Buffer.isBuffer(value))
          ) {
            value = _.extend({}, value);
            if (value.error) {
              expectedResponseError = value.error;
            }
          }

          let request;
          return expect
            .promise(function (resolve, reject) {
              const requestOptions = {};
              const requestTimeout = subject.timeout || 0;
              const requestBody = subject.body;
              let requestBodyIsJson = false;
              let requestBodyIsStream = false;

              if (
                Array.isArray(requestBody) ||
                (requestBody &&
                  typeof requestBody === 'object' &&
                  (typeof Buffer === 'undefined' ||
                    !Buffer.isBuffer(requestBody)))
              ) {
                if (typeof requestBody.pipe === 'function') {
                  subject = _.omit(subject, 'body');
                  requestBodyIsStream = true;
                } else {
                  requestBodyIsJson = true;
                }
              }

              if (!subject.isMessyHttpRequest) {
                subject = new messy.HttpRequest(
                  subject && typeof subject === 'object'
                    ? _.omit(subject, 'timeout')
                    : subject
                );
              }

              const httpRequest = (context.httpRequest = subject);
              httpRequest.protocol = httpRequest.protocol || 'HTTP/1.1';
              if (requestBodyIsJson) {
                if (!httpRequest.headers.has('Content-Type')) {
                  httpRequest.headers.set('Content-Type', 'application/json');
                }
                httpRequest.body = JSON.stringify(httpRequest.body);
              }
              // Avoid using Transfer-Encoding: chunked for the request body as that confuses NGINX -- and we know the length
              // of the request body:
              if (
                !requestBodyIsStream &&
                !httpRequest.headers.has('Content-Length')
              ) {
                let contentLength = 0;
                if (httpRequest.unchunkedBody) {
                  contentLength = httpRequest.unchunkedBody.length;
                }
                httpRequest.headers.set('Content-Length', contentLength);
              }

              const headers = httpRequest.headers.toCanonicalObject();
              Object.keys(headers).forEach(function (headerName) {
                headers[headerName] = headers[headerName].join(', ');
              });
              _.extend(
                requestOptions,
                {
                  host:
                    httpRequest.host ||
                    (typeof window === 'object' &&
                    typeof window.location !== 'undefined'
                      ? window.location.hostname
                      : 'localhost'),
                  port:
                    httpRequest.port ||
                    (typeof window === 'object' &&
                      (typeof window.location !== 'undefined'
                        ? window.location.port
                        : window.location.protocol === 'https:'
                        ? 443
                        : 80)) ||
                    (httpRequest.encrypted ? 443 : 80),
                  method: httpRequest.method,
                  path: httpRequest.path + (httpRequest.search || ''),
                  headers,
                  mode: 'disable-fetch',
                },
                _.pick(subject, ['ca', 'cert', 'key', 'rejectUnauthorized'])
              );

              // set the protocol and scheme for HTTPS requests in the browser
              if (typeof window === 'object' && httpRequest.encrypted) {
                _.extend(requestOptions, {
                  scheme: 'https',
                  protocol: 'https:',
                });
              }

              let timeout = null;
              if (requestTimeout > 0) {
                timeout = setTimeout(function () {
                  expect.errorMode = 'nested';
                  try {
                    expect.fail(
                      'expected a response within {0} ms',
                      requestTimeout
                    );
                  } catch (err) {
                    reject(err);
                  }
                }, requestTimeout);
              }
              request = (httpRequest.encrypted ? https : http)
                .request(requestOptions)
                .on('response', function (response) {
                  const chunks = [];
                  response
                    .on('data', function (chunk) {
                      chunks.push(chunk);
                    })
                    .on('end', function () {
                      if (timeout) {
                        clearTimeout(timeout);
                      }

                      let body;
                      if (
                        chunks.length > 0 &&
                        typeof Buffer !== 'undefined' &&
                        Buffer.isBuffer(chunks[0])
                      ) {
                        body = Buffer.concat(chunks);
                      } else if (
                        chunks.length > 0 &&
                        chunks[0] instanceof Uint8Array
                      ) {
                        // Browserify: Make sure we end up with a Buffer instance:
                        if (chunks.length === 1) {
                          body = Buffer.from(chunks[0]);
                        } else {
                          let totalLength = 0;
                          let i;
                          for (i = 0; i < chunks.length; i += 1) {
                            totalLength += chunks[i].length;
                          }
                          body = Buffer.alloc(totalLength);
                          let offset = 0;
                          for (i = 0; i < chunks.length; i += 1) {
                            for (let j = 0; j < chunks[i].length; j += 1) {
                              body[offset] = chunks[i][j];
                              offset += 1;
                            }
                          }
                        }
                      } else {
                        // String or no chunks
                        body = chunks.join('');
                      }
                      const httpResponse = (context.httpResponse =
                        new messy.HttpResponse({
                          statusCode: response.statusCode,
                          statusMessage: http.STATUS_CODES[response.statusCode],
                          protocol: `HTTP/${response.httpVersionMajor || '1'}.${
                            response.httpVersionMinor || '1'
                          }`,
                          headers: response.headers,
                          unchunkedBody: body,
                        }));
                      resolve(
                        (context.httpExchange = new messy.HttpExchange({
                          request: httpRequest,
                          response: httpResponse,
                        }))
                      );
                    })
                    .on('error', reject);
                })
                .on('error', reject);

              if (request.xhr) {
                // In browserify: Make sure the response comes back as a Uint8Array
                request.xhr.responseType = 'arraybuffer';
              }

              if (requestBodyIsStream) {
                requestBody.pipe(request);
                requestBody.on('error', reject);
              } else {
                request.end(httpRequest.unchunkedBody);
              }
            })
            .then(
              function (httpExchange) {
                expect(expectedResponseError, 'to be undefined');
                return expect(httpExchange, 'to satisfy', { response: value });
              },
              function (err) {
                if (request) {
                  request.abort();
                }
                if (expectedResponseError) {
                  expect(err, 'to equal', expectedResponseError);
                } else if (err.code) {
                  // Socket or DNS error
                  expect.fail({
                    diff: function (output) {
                      output.error(err.message);
                      return output;
                    },
                    code: err.code,
                  });
                } else {
                  throw err;
                }
              }
            )
            .then(function () {
              return context;
            });
        }
      );
  },
};

module.exports.messy = messy;
