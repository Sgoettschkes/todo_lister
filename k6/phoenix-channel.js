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
    
    // Append Phoenix WebSocket version
    this.url.searchParams.append("vsn", "2.0.0");
  }

  join(payload, callback) {
    return ws.connect(
      this.url.toString(),
      this.params,
      function (socket) {
        this.socket = socket;
        
        socket.on("open", () => {
          console.log("Channel WebSocket connected");
          this.joinRef = this.messageRef.toString();
          this._send("phx_join", payload, callback);
        });
        
        socket.on("message", (response) => {
          const message = this._parseMessage(response);
          
          if (message.ref != null) {
            const callback = this.callbacks[message.ref.toString()];
            if (callback) {
              callback(message);
              // Clean up one-time callbacks after phx_reply
              if (message.event === "phx_reply") {
                delete this.callbacks[message.ref.toString()];
              }
            }
          } else {
            this.broadcastCallback(message);
          }
        });
        
        socket.on("error", (e) => {
          console.error("Channel WebSocket error:", e);
        });
        
        socket.on("close", () => {
          console.log("Channel WebSocket closed");
        });
      }.bind(this)
    );
  }

  send(event, payload, callback = () => {}) {
    this._send(event, payload, callback);
  }

  leave() {
    if (this.socket) {
      this._send("phx_leave", {});
      // Close immediately - setTimeout doesn't work in k6 WebSocket context
      this.socket.close();
    }
  }

  setBroadcastCallback(callback) {
    this.broadcastCallback = callback;
  }

  _send(event, payload, callback) {
    if (!this.socket) {
      console.error("Cannot send, WebSocket is not connected");
      return;
    }

    const message = JSON.stringify([
      this.joinRef,
      this.messageRef.toString(),
      this.topic,
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
      console.error("Failed to parse message:", error);
      return {};
    }
  }

  // Heartbeat to keep connection alive
  heartbeat() {
    if (this.socket) {
      this._send("heartbeat", {});
    }
  }
}