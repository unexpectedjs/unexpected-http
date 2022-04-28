describe('unexpectedHttp in the browser', function () {
  const expect = window.weknowhow.expect.clone();
  console.log('window', window.unexpectedHttp.default);
  expect.use(window.unexpectedHttp.default).use(window.magicPenPrism);

  it('should assert a content type for HTML', function () {
    return expect('GET /base/test/browser/index.html', 'to yield response', {
      headers: {
        'Content-Type': /^text\/html/,
      },
    });
  });

  it('should assert a content type for an image', function () {
    return expect('GET /base/test/browser/image.png', 'to yield response', {
      headers: {
        'Content-Type': /^image\/png/,
      },
    });
  });
});
