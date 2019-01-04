describe('unexpectedHttp in the browser', function() {
  var expect = window.weknowhow.expect.clone();
  expect.installPlugin(window.unexpectedHttp);
  expect.installPlugin(window.magicPenPrism);

  it('should assert a content type for HTML', function() {
    return expect('GET /base/test/browser/index.html', 'to yield response', {
      headers: {
        'Content-Type': /^text\/html/
      }
    });
  });

  it('should assert a content type for an image', function() {
    return expect('GET /base/test/browser/image.png', 'to yield response', {
      headers: {
        'Content-Type': /^image\/png/
      }
    });
  });
});
