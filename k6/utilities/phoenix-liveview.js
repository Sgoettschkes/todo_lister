import Channel from "./phoenix-channel.js";
import Rendered from "./rendered.js";
import http from "k6/http";
import { parseHTML } from "k6/html";
import { URL } from "https://jslib.k6.io/url/1.0.0/index.js";

export default class LiveView {
  /**
   * @param {string} url - HTTP endpoint of the LiveView page
   * @param {string} websocketUrl - WebSocket endpoint. Defaults to deriving from url (http->ws, https->wss)
   * @param {Object} channelParams - WebSocket connection parameters (headers, auth tokens, etc.)
   * 
   * @example
   * const lv = new LiveView('http://localhost:4000/todos', 'ws://localhost:4000/socket');
   * const lv = new LiveView('http://localhost:4000/todos'); // auto-derives ws URL
   * const lv = new LiveView('http://localhost:4000/todos', null, {headers: {Authorization: 'Bearer xyz'}});
   */
  constructor(url, websocketUrl = null, channelParams = {}) {
    this.url = new URL(url);
    this.websocketUrl = new URL(websocketUrl);
    this.channelParams = channelParams;
    this.channel = null;
    this.rendered = null;
    this.events = [];
  }

  /**
   * Performs initial HTTP GET to fetch LiveView page, then upgrades to WebSocket.
   * Extracts CSRF token, phx-session, and phx-id from HTML meta tags and data attributes.
   * The callback wrapping ensures server diffs are automatically applied to this.rendered.
   * URL may redirect; this.url updates to final location.
   * 
   * @example
   * lv.connect((type, message) => {
   *   if (type === 'error') throw new Error(message);
   *   // type === 'connection' indicates WebSocket established
   *   // type === 'message' for subsequent server messages
   * });
   */
  connect(callback = () => {}) {
    const response = http.get(this.url.toString());
    this.url = new URL(response.url);

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

    this.websocketUrl.searchParams.append("vsn", "2.0.0");
    this.websocketUrl.searchParams.append("_csrf_token", csrfToken);

    this.channel = new Channel(
      this.websocketUrl.toString(),
      `lv:${phxId}`,
      this.channelParams,
      this._createBroadcastHandler(),
    );

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
          this._wrapChannelCallback(callback)(type, message);
        }
      },
    );
  }

  leave() {
    this.channel?.leave();
  }

  /**
   * Triggers phx-click handlers. Event must match the exact phx-click attribute value.
   * Value object mimics phx-value-* attributes from the clicked element.
   * Server response diffs are applied before callback executes.
   * 
   * @example
   * lv.pushClick('delete-todo', {id: '123'}); // <button phx-click="delete-todo" phx-value-id="123">
   * lv.pushClick('toggle-all'); // <button phx-click="toggle-all">
   */
  pushClick(event, value = {}, callback = () => {}) {
    this._send("click", { event: event, value: value }, callback);
  }

  /**
   * Submits form matching phx-submit or phx-change handlers.
   * FormData uses flat object notation; nested fields need bracket syntax.
   * Phoenix decodes this into nested params server-side.
   * 
   * @example
   * lv.pushForm('create-todo', {title: 'Buy milk', priority: 'high'});
   * lv.pushForm('update-settings', {'user[email]': 'test@example.com', 'user[notifications]': 'true'});
   */
  pushForm(event, formData, callback = () => {}) {
    this._send("form", { event: event, value: formData }, callback);
  }

  /**
   * Triggers phx-blur handlers for input validation.
   * Value is the input's current content when focus leaves.
   * 
   * @example
   * lv.pushBlur('validate-email', 'user@example.com');
   */
  pushBlur(event, value, callback = () => {}) {
    this._send("blur", { event: event, value: value }, callback);
  }

  /**
   * Triggers phx-keyup handlers. Target matches the phx-keyup attribute value.
   * Key is the keyboard key name; value is input content after keypress.
   * Phoenix can filter keys server-side with phx-key attribute.
   * 
   * @example
   * lv.pushKeyup('search', 'Enter', 'phoenix liveview');
   * lv.pushKeyup('navigate', 'ArrowDown', ''); // for keyboard navigation
   */
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

  /**
   * Sends Phoenix heartbeat. Server closes idle connections after 60s by default.
   * LiveView typically handles this automatically, but useful in edge cases.
   */
  heartbeat() {
    this.channel?.sendToTopic("heartbeat", "phoenix", {});
  }

  /**
   * Schedules callback in WebSocket event loop, not browser setTimeout.
   * Required for k6 compatibility; native setTimeout breaks iteration lifecycle.
   * Used internally by waitFor.
   */
  setTimeout(callback, delay) {
    this.channel?.socket?.setTimeout(callback, delay);
  }

  /**
   * Polls until condition met or timeout. CheckFn returning false continues polling.
   * Any other return value (including undefined, null, truthy) stops polling and passes to callback.
   * Uses WebSocket event loop for scheduling, respecting k6 iteration lifecycle.
   * Polls every second. Throws on timeout.
   * 
   * @example
   * // Wait for element to appear
   * lv.waitFor(
   *   lv => lv.getHtml().includes('Payment complete') || false,
   *   lv => console.log('Payment processed')
   * );
   * 
   * // Extract and return data
   * lv.waitFor(
   *   lv => {
   *     const match = lv.getHtml().match(/Order #(\d+)/);
   *     return match ? match[1] : false; // return order ID or keep waiting
   *   },
   *   (lv, orderId) => console.log(`Got order: ${orderId}`)
   * );
   */
  waitFor(checkFn, callback, timeoutSeconds = 10) {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    const checkAndWait = () => {
      if (Date.now() - startTime >= timeoutMs) {
        throw new Error(`waitFor timeout after ${timeoutSeconds} seconds`);
      }

      const result = checkFn(this);
      
      // If checkFn returns exactly false, continue waiting
      // Any other value (including undefined, null, objects, etc.) is considered success
      if (result !== false) {
        callback(this, result);
        return;
      }

      this.setTimeout(() => {
        checkAndWait();
      }, 1000);
    };

    checkAndWait();
  }

  /**
   * Returns current DOM state with all Phoenix diffs applied.
   * Reflects real-time updates from server pushes and user interactions.
   * Returns undefined before connect() completes.
   */
  getHtml() {
    return this.rendered?.getFullHTML();
  }

  /**
   * Returns server-initiated events from push_event/3, not user-triggered events.
   * Includes live navigation events (live_redirect, live_patch).
   * Events accumulate across the session until resetEvents().
   * Each has {action: string, payload: any, timestamp: number}.
   * 
   * @example
   * // Server: push_event(socket, "confetti", %{duration: 3000})
   * const events = lv.getEvents();
   * // [{action: "confetti", payload: {duration: 3000}, timestamp: 1234567890}]
   */
  getEvents() {
    return this.events;
  }

  resetEvents() {
    this.events = [];
  }

  _extractLiveViewMetadata(html) {
    const doc = parseHTML(html);

    const csrfMeta = doc.find('meta[name="csrf-token"]');
    const csrfToken = csrfMeta.attr("content");

    let liveViewElement = doc.find("[data-phx-main]").first();

    if (!liveViewElement || !liveViewElement.attr("id")) {
      liveViewElement = doc.find("[data-phx-view]").first();
    }

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
    this.channel?.send(
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
          this.rendered?.applyRendered(message.payload.response.rendered);
        } else if (message.payload.response?.diff) {
          this._extractEvents(message.payload.response.diff);

          this.rendered?.applyDiff(message.payload.response.diff);
        }
      }

      return userCallback(type, message);
    };
  }

  _createBroadcastHandler() {
    return (type, message) => {
      if (message.event === "diff" && message.payload) {
        this._extractEvents(message.payload);

        this.rendered?.applyDiff(message.payload);
      }
    };
  }

  _extractEvents(diff) {
    if (diff && typeof diff === "object") {
      const extracted = Rendered.extract(diff);
      if (extracted.events && extracted.events.length > 0) {
        extracted.events.forEach((eventArray) => {
          this.events.push({
            action: eventArray[0],
            payload: eventArray[1],
            timestamp: Date.now(),
          });
        });
      }
    }
  }
}
