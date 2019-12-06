import { initiateWebSocketMux, encodeObject, decodeObject } from 'omnistreams';
import { FileReadProducer } from 'omnistreams-filereader';


const JSON_RPC_SERVER_ERROR_NOT_FOUND = -32000;

class Hoster {

  constructor({ proxyAddress, port, secure, chunkSize, openRangedChunkSize }, readyCallback) {

    this._readyCallback = readyCallback;
    this._files = {};

    // Open ranged requests are sometimes terminated early, after the receiver
    // gets what they're looking for, so chunkSize is smaller by default.
    this._chunkSize = chunkSize ? chunkSize : 256*1024; //*1024;
    this._openRangedChunkSize = openRangedChunkSize ? openRangedChunkSize : 64*1024;

    this._wsProtoStr = secure ? 'wss:' : 'ws:';

    if (this.isDefaultPort(port)) {
      this._portStr = "";
    }
    else {
      this._portStr = ':' + port;
    }

    initiateWebSocketMux({ address: proxyAddress, port, secure })
    .then((mux) => {

      this._mux = mux;

      mux.onControlMessage((rawMessage) => {
        const message = decodeObject(rawMessage)
        this.onMessage(message)
      });

      // Send a keep-alive every 30 seconds
      setInterval(() => {
        mux.sendControlMessage(encodeObject({
          type: 'keep-alive',
        }))
      }, 30000)
    });
  }

  onMessage(message) {

    const rpc = message;
    switch (rpc.method) {
      case 'setId':
        this._id = rpc.params;
        this._readyCallback(this);
        break;
      case 'getFile':
        if (this._files[rpc.params.path] !== undefined) {

          const fullFile = this._files[rpc.params.path];

          let file = fullFile;

          //console.log(`read file: ${message.url}`);

          let chunkSize = this._chunkSize;

          if (rpc.params.range) {

            //console.log(message.range, file.size);
            if (rpc.params.range.end !== undefined) {
              file = file.slice(rpc.params.range.start, rpc.params.range.end);
            }
            else {
              file = file.slice(rpc.params.range.start);
              
              chunkSize = this._openRangedChunkSize;
            }
          }

          //const fileStream = fileReaderStream(file);
          const rpcResponse = {
            jsonrpc: '2.0',
            result: {
              size: fullFile.size,
              range: rpc.params.range,
            },
            id: rpc.id,
          };

          const fileStream = new FileReadProducer(file, { chunkSize })
          const sendStream = this._mux.createConduit(encodeObject(rpcResponse));

          fileStream.pipe(sendStream)

          fileStream.onTermination(() => {
          })
        }
        else {
          //console.log(`File ${message.url} not found`);
          this._mux.sendControlMessage(encodeObject({
            jsonrpc: '2.0',
            error: {
              code: JSON_RPC_SERVER_ERROR_NOT_FOUND,
              message: "File not found",
            },
            id: rpc.id,
          }))
        }
        break;
      default:
        throw new Error("Invalid method: " + rpc.method);
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

export { createHoster };
