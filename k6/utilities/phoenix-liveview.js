import Channel from "./phoenix-channel.js";
import Rendered from "./rendered.js";
import http from "k6/http";
import { parseHTML } from "k6/html";
import { URL } from "https://jslib.k6.io/url/1.0.0/index.js";

export default class LiveView {
  constructor(url, websocketUrl = null, channelParams = {}) {
    this.url = new URL(url);
    this.websocketUrl = new URL(websocketUrl);
    this.channelParams = channelParams;
    this.channel = null;
    this.rendered = null;
    this.events = [];
  }

  connect(callback = () => {}) {
    // Get the initial page to extract LiveView data
    const response = http.get(this.url.toString());

    if (response.status !== 200) {
      callback("error", `Failed to load page: ${response.status}`);
      return;
    }

    // Initialize the renderer with the initial HTML
    this.rendered = new Rendered(response.body);

    // Parse LiveView metadata from HTML
    const { csrfToken, phxId, phxSession, phxStatic } =
      this._extractLiveViewMetadata(response.body);

    if (!csrfToken || !phxId || !phxSession || !phxStatic) {
      callback("error", "Missing required LiveView data");
      return;
    }

    // Add required query parameters to WebSocket URL
    this.websocketUrl.searchParams.append("vsn", "2.0.0");
    this.websocketUrl.searchParams.append("_csrf_token", csrfToken);

    // Create channel for LiveView connection with broadcast handler
    this.channel = new Channel(
      this.websocketUrl.toString(),
      `lv:${phxId}`,
      this.channelParams,
      this._createBroadcastHandler(),
    );

    // Join the LiveView channel - now purely callback-based
    this.channel.join(
      {
        url: this.url.toString(),
        session: phxSession,
        static: phxStatic,
        params: {
          _csrf_token: csrfToken,
          _mounts: 0,
        },
      },
      (type, message) => {
        if (type === "connection") {
          callback(type, message);
        } else {
          // Handle other messages with wrapped callback
          this._wrapChannelCallback(callback)(type, message);
        }
      },
    );
  }

  leave() {
    if (this.channel) {
      this.channel.leave();
    }
  }

  pushClick(event, value = {}, callback = () => {}) {
    this._send("click", { event: event, value: value }, callback);
  }

  pushForm(event, formData, callback = () => {}) {
    this._send("form", { event: event, value: formData }, callback);
  }

  pushBlur(event, value, callback = () => {}) {
    this._send("blur", { event: event, value: value }, callback);
  }

  pushKeyup(target, key, value, callback = () => {}) {
    this._send(
      "keyup",
      {
        event: target,
        value: { key: key, value: value },
      },
      callback,
    );
  }

  heartbeat() {
    if (this.channel) {
      this.channel.sendToTopic("heartbeat", "phoenix", {});
    }
  }

  getHtml() {
    return this.rendered ? this.rendered.getFullHTML() : null;
  }

  getEvents() {
    return this.events;
  }

  resetEvents() {
    this.events = [];
  }

  _extractLiveViewMetadata(html) {
    const doc = parseHTML(html);

    // Extract CSRF token
    const csrfMeta = doc.find('meta[name="csrf-token"]');
    const csrfToken = csrfMeta.attr("content");

    // Find the main LiveView element
    let liveViewElement = doc.find("[data-phx-main]").first();

    // If not found, try data-phx-view
    if (!liveViewElement || !liveViewElement.attr("id")) {
      liveViewElement = doc.find("[data-phx-view]").first();
    }

    // Extract LiveView attributes
    const phxId = liveViewElement.attr("id");
    const phxSession = liveViewElement.attr("data-phx-session");
    const phxStatic = liveViewElement.attr("data-phx-static");

    return {
      csrfToken: csrfToken,
      phxId: phxId,
      phxSession: phxSession,
      phxStatic: phxStatic,
    };
  }

  _send(event, payload = {}, callback = () => {}) {
    if (!this.channel) {
      return;
    }

    this.channel.send(
      "event",
      {
        type: event,
        event: payload.event || event,
        value: payload.value || payload,
      },
      this._wrapChannelCallback(callback),
    );
  }

  _wrapChannelCallback(userCallback) {
    return (type, message) => {
      if (message.event === "phx_reply" && message.payload?.status === "ok") {
        if (message.payload.response?.rendered) {
          if (this.rendered) {
            this.rendered.applyRendered(message.payload.response.rendered);
          }
        } else if (message.payload.response?.diff) {
          this._extractEvents(message.payload.response.diff);

          if (this.rendered) {
            this.rendered.applyDiff(message.payload.response.diff);
          }
        }
      }

      return userCallback(type, message);
    };
  }

  _createBroadcastHandler() {
    return (type, message) => {
      if (message.event === "diff" && message.payload) {
        this._extractEvents(message.payload);

        if (this.rendered) {
          this.rendered.applyDiff(message.payload);
        }
      }
    };
  }

  _extractEvents(diff) {
    if (diff && typeof diff === "object") {
      const extracted = Rendered.extract(diff);
      const timestamp = Date.now();
      extracted.events.forEach((event) => {
        this.events.push({
          ...event,
          timestamp: timestamp,
        });
      });
    }
  }
}
