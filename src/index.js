(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module. Also return global
    define(['ws-streamify', 'filereader-stream'],
    function(wsStreamify, fileReaderStream) {
      return (root.browserve = factory(wsStreamify, fileReaderStream));
    });
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(
      require('ws-streamify'),
      require('filereader-stream'));
  } else {
    // Browser globals (root is window)
    root.browserve = factory(wsStreamify, fileReaderStream);
  }
}(typeof self !== 'undefined' ? self : this,

function (wsStreamify, fileReaderStream) {

  const WebSocketStream = wsStreamify.default;


  


  class Hoster {

    constructor({ proxyAddress, port, secure }, readyCallback) {
      this._proxyAddress = proxyAddress;
      this._port = port;
      this._secure = secure;
      this._readyCallback = readyCallback;

      if (secure) {
        this._wsProtoStr = 'wss:';
      }
      else {
        this._wsProtoStr = 'ws:';
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

              console.log(`read file: ${message.url}`);

              if (message.range) {
                console.log(message.range, file.size);
                if (message.range.end !== '') {
                  file = file.slice(message.range.start, message.range.end);
                }
                else {
                  file = file.slice(message.range.start);
                }
              }

              const fileStream = fileReaderStream(file);
              const streamSettings = {
                id: message.requestId,
                size: fullFile.size,
                range: message.range,
              };

              this.createStream(streamSettings, (stream) => {
                fileStream.pipe(stream);
              });
            }
            else {
              console.log(`File ${message.url} not found`);
              this.sendCommand({
                type: 'error',
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

    sendCommand(command) {
      this.send(JSON.stringify(command));
    }

    send(message) {
      //this._ws.send(JSON.stringify(message));
      this._ws.send(message);
    }

    createStream(settings, callback) {
      const handleMessage = (rawMessage) => {
        const message = JSON.parse(rawMessage.data);
        if (message.type === 'complete-handshake') {
          socket.removeEventListener('message', handleMessage);
          settings.type = 'convert-to-stream';
          socket.send(JSON.stringify(settings));

          const stream = new WebSocketStream(socket, { highWaterMark: 1024 })

          callback(stream);
        }
        else {
          throw "Expected handshake";
        }
      };

      const wsStreamString = `${this._wsProtoStr}//${this._proxyAddress}${this._portStr}`;
      const socket = new WebSocket(wsStreamString);
      socket.addEventListener('message', handleMessage);
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


