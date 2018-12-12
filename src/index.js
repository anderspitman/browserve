const WebSocket = require('isomorphic-ws');
const wsStreamify = require('ws-streamify');
//const fileReaderStream = require('filereader-stream');
const { Peer } = require('netstreams');

//const WebSocketStream = wsStreamify.default;

class Hoster {

  constructor({ proxyAddress, port, secure }, readyCallback) {
    this._proxyAddress = proxyAddress;
    this._port = port;
    this._secure = secure;
    this._readyCallback = readyCallback;

    const nsPeer = new Peer();

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
      //console.log(`WebSocket connection opened to ${wsString}`);
    });

    ws.addEventListener('error', (e) => {
      console.error("Error opening WebSocket connection: " + e);
    });

    ws.addEventListener('message', (message) => {
      this.onMessage(JSON.parse(message.data));
    });

    this._ws = ws;
    this._files = {};


    this._wsStreamString = wsString + '/stream';
    this._streamWs = new WebSocket(this._wsStreamString);

    this._streamWs.binaryType = 'arraybuffer';

    this._streamWs.onopen = () => {
      const conn = nsPeer.createConnection();
      this._streamConn = conn;

      conn.setSendHandler((message) => {
        this._streamWs.send(message)
      })

      this._streamWs.onmessage = (message) => {
        conn.onMessage(message.data)
      }

      //const stream = conn.createStream();
      //stream.write(new Uint8Array([44, 45, 56]));

      //const file = new File(["Hi there"], "og.txt", {
      //  type: "text/plain",
      //});

      //stream.writeFile(file);
    };
  }

  onMessage(message) {

    switch(message.type) {
      case 'complete-handshake':
        this._id = message.id;
        this._readyCallback(this);
         
        break;
      case 'GET':
        if (message.type === 'GET') {
          if (this._files[message.url] !== undefined) {

            const fullFile = this._files[message.url];

            let file = fullFile;

            //console.log(`read file: ${message.url}`);

            if (message.range) {
              //console.log(message.range, file.size);
              if (message.range.end !== '') {
                file = file.slice(message.range.start, message.range.end);
              }
              else {
                file = file.slice(message.range.start);
              }
            }

            //const fileStream = fileReaderStream(file);
            const streamSettings = {
              id: message.requestId,
              size: fullFile.size,
              range: message.range,
            };

            //this.createStream(streamSettings, (stream) => {
            //  fileStream.pipe(stream);
            //});

            console.log(streamSettings);
            const stream = this._streamConn.createStream(streamSettings);
            stream.sendFile(file);

          }
          else {
            //console.log(`File ${message.url} not found`);
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

  //createStream(settings, callback) {
  //  const handleMessage = (rawMessage) => {
  //    const message = JSON.parse(rawMessage.data);
  //    if (message.type === 'complete-handshake') {
  //      socket.removeEventListener('message', handleMessage);
  //      settings.type = 'convert-to-stream';
  //      socket.send(JSON.stringify(settings));

  //      const stream = new WebSocketStream(socket, { highWaterMark: 1024 })

  //      callback(stream);
  //    }
  //    else {
  //      throw "Expected handshake";
  //    }
  //  };

  //  const wsStreamString = `${this._wsProtoStr}//${this._proxyAddress}${this._portStr}`;
  //  const socket = new WebSocket(wsStreamString);
  //  socket.addEventListener('message', handleMessage);
  //}

  hostFile({ path, file }) {
    this._files[path] = file;
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

function createHoster(options) {
  return new Promise((resolve, reject) => {
    new Hoster(options, function ready(hoster) {
      resolve(hoster);
    });
  });
}

module.exports = {
  createHoster,
};
