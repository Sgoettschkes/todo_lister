import ws from "k6/ws";
import { URL } from "https://jslib.k6.io/url/1.0.0/index.js";

export default class Channel {
  constructor(url, topic, params = {}, broadcastCallback = () => {}) {
    this.url = new URL(url);
    this.topic = topic;
    this.params = params;
    this.callbacks = {};
    this.messageRef = 1;
    this.joinRef = null;
    this.socket = null;
    this.broadcastCallback = broadcastCallback;
  }

  join(payload, callback) {
    const connectResult = ws.connect(
      this.url.toString(),
      this.params,
      function (socket) {
        this.socket = socket;

        socket.on("open", () => {
          this.joinRef = this.messageRef.toString();
          this._send("phx_join", null, payload, callback);
        });

        socket.on("message", (response) => {
          const message = this._parseMessage(response);

          if (message.ref != null) {
            const callback = this.callbacks[message.ref.toString()];
            if (callback) {
              callback("message", message);
              // Clean up one-time callbacks after phx_reply
              if (message.event === "phx_reply") {
                delete this.callbacks[message.ref.toString()];
              }
            }
          } else {
            this.broadcastCallback("message", message);
          }
        });

        socket.on("error", (e) => {
          callback("error", e);
        });

        socket.on("close", () => {});
      }.bind(this),
    );

    // Pass connection status to callback immediately
    callback("connection", connectResult);
  }

  send(event, payload, callback = () => {}) {
    this._send(event, null, payload, callback);
  }

  sendToTopic(event, topic, payload, callback = () => {}) {
    this._send(event, topic, payload, callback);
  }

  leave() {
    if (this.socket) {
      this._send("phx_leave", null, {});
      // Close immediately - setTimeout doesn't work in k6 WebSocket context
      this.socket.close();
    }
  }

  setBroadcastCallback(callback) {
    this.broadcastCallback = callback;
  }

  _send(event, topic, payload, callback = () => {}) {
    if (!this.socket) {
      return;
    }

    const targetTopic = topic || this.topic;

    const message = JSON.stringify([
      this.joinRef,
      this.messageRef.toString(),
      targetTopic,
      event,
      payload,
    ]);

    this.socket.send(message);
    this.callbacks[this.messageRef.toString()] = callback;
    this.messageRef += 1;
  }

  _parseMessage(data) {
    try {
      const [joinRef, msgRef, topic, event, payload] = JSON.parse(data);
      return {
        joinRef: joinRef,
        ref: msgRef,
        topic: topic,
        event: event,
        payload: payload,
      };
    } catch (error) {
      return {};
    }
  }
}
