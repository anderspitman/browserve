(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module. Also return global
    define(['ws-streamify', 'filereader-stream'],
    function(wsStreamify, fileReaderStream) {
      return (root.reverserver = factory(wsStreamify, fileReaderStream));
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
    root.reverserver = factory(wsStreamify, fileReaderStream);
  }
}(typeof self !== 'undefined' ? self : this,

function (wsStreamify, fileReaderStream) {

  const WebSocketStream = wsStreamify.default;


  function createStream(host, port, settings, callback) {

    wsStreamString = `ws://${host}:${port}`;

    const socket = new WebSocket(wsStreamString);
    socket.addEventListener('open', (e) => {

      settings.type = 'convert-to-stream';
      socket.send(JSON.stringify(settings));

      const stream = new WebSocketStream(socket, { highWaterMark: 1024 })

      callback(stream);
    });
  }


  class Server {

    constructor({ host, port }) {
      this._host = host;
      this._port = port;
      const wsString = `ws://${host}:${port}`;
      const ws = new WebSocket(wsString);
      ws.addEventListener('open', (e) => {
        console.log(`WebSocket connection opened to ${wsString}`);
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

              createStream(this._host, 8082, streamSettings, (stream) => {
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

    hostFile(url, file) {
      this._files[url] = file;
    }

    getHostedUrl(url) {
      if (this._files[url]) {
        return '/' + this._id + url;
      }
      else {
        throw "No file hosted at: " + url;
      }
    }
  }

  
  return {
    Server,
  };
}));


