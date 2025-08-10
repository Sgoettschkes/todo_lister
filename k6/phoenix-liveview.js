import Channel from "./phoenix-channel.js";
import http from "k6/http";
import { parseHTML } from "k6/html";
import { URL } from "https://jslib.k6.io/url/1.0.0/index.js";

export default class LiveView {
  constructor(url, websocketUrl = null) {
    this.url = new URL(url);
    
    // If no websocket URL provided, derive it from the HTTP URL
    if (!websocketUrl) {
      const wsProtocol = url.startsWith("https") ? "wss" : "ws";
      const baseUrl = url.replace(/^https?/, wsProtocol);
      const wsBase = baseUrl.split('/').slice(0, 3).join('/');
      websocketUrl = `${wsBase}/live/websocket`;
    }
    
    this.websocketUrl = new URL(websocketUrl);
    this.channel = null;
    this.csrfToken = null;
    this.phxId = null;
    this.phxSession = null;
    this.phxStatic = null;
  }

  connect(callback = () => {}, getParams = null, parseBody = this._parseBody) {
    // Get the initial page to extract LiveView data
    const response = http.get(this.url.toString(), getParams);
    
    if (response.status !== 200) {
      console.error(`Failed to load page: ${response.status}`);
      callback({ status: "error", reason: "Failed to load page" });
      return;
    }

    // Parse LiveView metadata from HTML
    const { csrfToken, phxId, phxSession, phxStatic } = parseBody(response.body);
    
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
      () => {}
    );

    // Join the LiveView channel with exact parameters from elixir-k6
    return this.channel.join(
      {
        url: this.url.toString(),
        session: phxSession,
        static: phxStatic,
        params: {
          _csrf_token: csrfToken,
          _mounts: 0
        }
      },
      callback
    );
  }

  leave() {
    if (this.channel) {
      this.channel.leave();
    }
  }

  // Send an event to the LiveView
  send(event, payload = {}, callback = () => {}) {
    if (!this.channel) {
      console.error("Not connected to LiveView");
      return;
    }
    
    this.channel.send("event", {
      type: event,
      event: payload.event || event,
      value: payload.value || payload,
    }, callback);
  }

  // Send a click event
  pushEvent(event, value = {}, callback = () => {}) {
    this.send("click", { event: event, value: value }, callback);
  }

  // Send a form submission
  pushForm(event, formData, callback = () => {}) {
    this.send("form", { event: event, value: formData }, callback);
  }

  // Send a keyup event
  pushKeyup(target, key, value, callback = () => {}) {
    this.send("keyup", {
      event: target,
      value: { key: key, value: value }
    }, callback);
  }

  // Keep the connection alive
  heartbeat() {
    if (this.channel) {
      this.channel.heartbeat();
    }
  }

  _parseBody(body) {
    const doc = parseHTML(body);
    
    // Extract CSRF token
    const csrfMeta = doc.find('meta[name="csrf-token"]');
    const csrfToken = csrfMeta.attr("content");
    
    // Find the main LiveView element
    let liveViewElement = doc.find('[data-phx-main]').first();
    
    // If not found, try data-phx-view
    if (!liveViewElement || !liveViewElement.attr("id")) {
      liveViewElement = doc.find('[data-phx-view]').first();
    }
    
    // Extract LiveView attributes
    const phxId = liveViewElement.attr("id");
    const phxSession = liveViewElement.attr("data-phx-session");
    const phxStatic = liveViewElement.attr("data-phx-static");
    
    console.log(`Parsed LiveView: id=${phxId}, session=${phxSession ? 'present' : 'missing'}`);
    
    return {
      csrfToken: csrfToken,
      phxId: phxId,
      phxSession: phxSession,
      phxStatic: phxStatic,
    };
  }

  _params(cookies = {}) {
    return {
      headers: {
        Cookie: this._cookieHeaderFor(cookies),
        Origin: this.url.origin,
        "User-Agent": "k6-liveview-test/1.0"
      }
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
}