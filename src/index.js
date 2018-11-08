(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module. Also return global
    define([], function() {
      return (root.browserve = factory());
    });
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.browserve = factory();
  }
}(typeof self !== 'undefined' ? self : this,

function () {

  class Hoster {

    constructor({ proxyAddress, port, secure }, readyCallback) {
      this._proxyAddress = proxyAddress;
      this._port = port;
      this._secure = secure;
      this._readyCallback = readyCallback;

      if (secure) {
        this._wsProtoStr = 'wss:';
        this._httpProtoStr = 'https:';
      }
      else {
        this._wsProtoStr = 'ws:';
        this._httpProtoStr = 'http:';
      }

      if (this.isDefaultPort(port)) {
        this._portStr = "";
      }
      else {
        this._portStr = ':' + port;
      }

      const wsString = `${this._wsProtoStr}//${proxyAddress}${this._portStr}`;
      const ws = new WebSocket(wsString);

      ws.addEventListener('open', (e) => {
        console.log(`WebSocket connection opened to ${wsString}`);
      });

      ws.addEventListener('error', (e) => {
        console.error("Error opening WebSocket connection: " + e);
      });

      ws.addEventListener('message', (message) => {
        this.onMessage(JSON.parse(message.data));
      });

      this._ws = ws;
      this._files = {};
    }

    onMessage(message) {

      switch(message.type) {
        case 'complete-handshake':
          this._id = message.id;
          this._readyCallback();
           
          break;
        case 'GET':
          if (message.type === 'GET') {
            if (this._files[message.url] !== undefined) {

              const fullFile = this._files[message.url];

              let file = fullFile;

              //console.log(`read file: ${message.url}`);

              const formData = new FormData();

              if (message.range) {

                formData.append('start', message.range.start);
                formData.append('end', message.range.end);

                //console.log(message.range, file.size);
                if (message.range.end !== '') {
                  file = file.slice(message.range.start, message.range.end);
                }
                else {
                  file = file.slice(message.range.start);
                }
              }

              formData.append('hostId', this._id);
              formData.append('requestId', message.requestId);
              formData.append('fileSize', file.size);
              formData.append('file', file);
              const uri = `${this._httpProtoStr}//${this._proxyAddress}${this._portStr}/file`;
              fetch(uri, {
                method: 'POST',
                body: formData,
              })
              .catch((err) => {
                console.log(err);
              });
            }
            else {
              //console.log(`File ${message.url} not found`);
              this.sendError({
                code: 404,
                message: "File not found",
                requestId: message.requestId,
              });
            }
          }
          break;
        default:
          throw "Invalid message type: " + message.type;
          break;
      }
    }

    sendError(err) {
      const formData = new FormData();
      formData.append('hostId', this._id);
      formData.append('type', 'error');
      formData.append('code', err.code);
      formData.append('message', err.message);
      formData.append('requestId', err.requestId);
      const uri = `${this._httpProtoStr}//${this._proxyAddress}${this._portStr}/command`;
      fetch(uri, {
        method: 'POST',
        body: formData,
      })
      .catch((err) => {
        console.log(err);
      });
      //this.send(JSON.stringify(command));
    }

    send(message) {
      //this._ws.send(JSON.stringify(message));
      this._ws.send(message);
    }

    hostFile(url, file) {
      this._files[url] = file;
    }

    getHostedPath(url) {
      if (this._files[url]) {
        return '/' + this._id + url;
      }
      else {
        throw "No file hosted at: " + url;
      }
    }

    getPortStr() {
      return this._portStr;
    }

    isDefaultPort(port) {
      if ((this._wsProtoStr === 'ws:' && port === 80) ||
          (this._wsProtoStr === 'wss:' && port === 443)) {
        return true;
      }
      else {
        return false;
      }
    }
  }

  
  return {
    Hoster,
  };
}));


