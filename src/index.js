const WebSocket = require('isomorphic-ws');
const ab2str = require('arraybuffer-to-string')
const str2ab = require('string-to-arraybuffer')
const { FileReadStream } = require('omnistreams-filereader');
const { Multiplexer } = require('omnistreams-concurrent');


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

    this._files = {};

    const wsString = `${this._wsProtoStr}//${proxyAddress}${this._portStr}/omnistreams`
    const streamWs = new WebSocket(wsString);

    streamWs.binaryType = 'arraybuffer';

    streamWs.onopen = () => {
      const mux = new Multiplexer()
      this._mux = mux
      this._streamMux = mux;

      mux.setSendHandler((message) => {
        streamWs.send(message)
      })

      streamWs.onmessage = (message) => {
        mux.handleMessage(message.data)
      }

      mux.onControlMessage((rawMessage) => {
        const message = JSON.parse(ab2str(rawMessage))
        this.onMessage(message)
      })

      // Send a keep-alive every minute
      setInterval(() => {
        this._mux.sendControlMessage(new Uint8Array(str2ab(JSON.stringify({
          type: 'keep-alive',
        }))))
      }, 60000)
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

            const fileStream = new FileReadStream(file)
            fileStream.id = streamSettings.id
            const sendStream = this._streamMux.createConduit(streamSettings);

            fileStream.pipe(sendStream)

            fileStream.onTerminate(() => {
            })
          }
          else {
            //console.log(`File ${message.url} not found`);
            this._mux.sendControlMessage(new Uint8Array(str2ab(JSON.stringify({
              type: 'error',
              code: 404,
              message: "File not found",
              requestId: message.requestId,
            }))))
          }
        }
        break;
      default:
        throw "Invalid message type: " + message.type;
        break;
    }
  }

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
