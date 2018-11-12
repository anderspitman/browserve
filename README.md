The point of fibridge `(FIle BRIDGE)` is to allow your browser to "host" files
which can be streamed over HTTP. This requires a proxy server to handle the
HTTP requests and forward them to the browser over websockets. The proxy server
lives
[here](https://github.com/anderspitman/fibridge-proxy).

Why would this be useful? If the user has a very large file (genomic data files
can easily be in the 20GB-200GB range), and you want to make
[ranged requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)
to that file (ie only download specific chunks) as though it were hosted on a
normal server, fibridge provides this functionality.

NOTE: This is an early work in progress and not quite ready to be used for
in production.

# Example usage

First install the proxy server:
```bash
npm install -g fibridge-proxy
```

And run it:
```bash
fibridge-proxy -p 8080
```

Create a Hoster object in the browser and host a couple files.  See
`dist/index.html` for a working example where the user selects a file from
their computer.

```javascript
fibridge.createHoster({ proxyAddress: 'localhost', port: 8080, secure: false }).then((hoster) => {

  const file1 = new File(["Hi there"], "file1.txt", {
    type: "text/plain",
  });
  
  const file2 = new File(["I'm Old Gregg"], "file2.txt", {
    type: "text/plain",
  });
  
  hoster.hostFile({ path: '/file1', file: file1 });
  hoster.hostFile({ path: '/file2', file: file2 });
});
```

Retrieve the files using any http client:
```bash
curl localhost:8080/file1
Hi there
curl localhost:8080/file2
I'm Old Gregg
```

Ranged requests work too:
```bash
curl -H "Range: bytes=0-2" localhost:8080/file1
Hi
```
