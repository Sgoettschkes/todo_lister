import Channel from "./phoenix-channel.js";
import Renderer from "./renderer.js";
import http from "k6/http";
import { parseHTML } from "k6/html";
import { URL } from "https://jslib.k6.io/url/1.0.0/index.js";

export default class LiveView {
  constructor(url, websocketUrl = null) {
    this.url = new URL(url);
    this.websocketUrl = new URL(websocketUrl);
    this.channel = null;
    this.renderer = null;
  }

  connect(callback = () => {}) {
    // Get the initial page to extract LiveView data
    const response = http.get(this.url.toString());

    if (response.status !== 200) {
      console.error(`Failed to load page: ${response.status}`);
      callback({ status: "error", reason: "Failed to load page" });
      return;
    }

    this.renderer = new Renderer(response.body);

    // Parse LiveView metadata from HTML
    const { csrfToken, phxId, phxSession, phxStatic } =
      this.renderer.extractLiveViewMetadata();

    if (!csrfToken || !phxId || !phxSession || !phxStatic) {
      console.error("Missing required LiveView data");
      callback({ status: "error", reason: "Missing LiveView data" });
      return;
    }

    // Add required query parameters to WebSocket URL
    this.websocketUrl.searchParams.append("vsn", "2.0.0");
    this.websocketUrl.searchParams.append("_csrf_token", csrfToken);

    // Create channel for LiveView connection
    this.channel = new Channel(
      this.websocketUrl.toString(),
      `lv:${phxId}`,
      this._params(response.cookies),
      () => {},
    );

    // Join the LiveView channel with exact parameters from elixir-k6
    return this.channel.join(
      {
        url: this.url.toString(),
        session: phxSession,
        static: phxStatic,
        params: {
          _csrf_token: csrfToken,
          _mounts: 0,
        },
      },
      (message) => {
        if (message.event === "phx_reply" && message.payload?.status === "ok") {
          this.renderer.applyDiff(message.payload.response.rendered);
        }

        callback(message);
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
      this._send("heartbeat", {});
    }
  }

  _params(cookies = {}) {
    return {
      headers: {
        Cookie: this._cookieHeaderFor(cookies),
        Origin: this.url.origin,
        "User-Agent": "k6-liveview-test/1.0",
      },
    };
  }

  _cookieHeaderFor(allCookies) {
    let cookieHeader = "";
    for (const [_name, cookies] of Object.entries(allCookies)) {
      for (const cookie of cookies) {
        if (cookieHeader) cookieHeader += "; ";
        cookieHeader += `${cookie.name}=${cookie.value}`;
      }
    }
    return cookieHeader;
  }

  _send(event, payload = {}, callback = () => {}) {
    if (!this.channel) {
      console.error("Not connected to LiveView");
      return;
    }

    this.channel.send(
      "event",
      {
        type: event,
        event: payload.event || event,
        value: payload.value || payload,
      },
      callback,
    );
  }
}
