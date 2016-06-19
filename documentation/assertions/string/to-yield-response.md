Executes a request defined as a compact string asserts the response received
matches what was expected.

```js
describe('google.com', function () {
    it('should redirect to a country-specific version', function () {
        return expect('GET http://google.com/', 'to yield response', {
            statusCode: 302,
            headers: {
                Location: /www\.google\.\w+/
            },
            body: /The document has moved/
        });
    });
});
```
