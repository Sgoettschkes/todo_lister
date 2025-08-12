import LiveView from "./utilities/phoenix-liveview.js";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  const baseUrl = "http://localhost:4000";
  const websocketUrl = `${baseUrl.replace("http", "ws")}/live/websocket`;
  const landingLiveView = new LiveView(baseUrl, websocketUrl);

  // Store test results
  let connected = false;
  let listCreated = false;

  // Connect to landing page LiveView - this will block until connection closes
  const res = landingLiveView.connect((response) => {
    if (response.event === "phx_reply" && response.payload?.status === "ok") {
      connected = true;

      // Try to create a new todo list
      landingLiveView.pushClick("create_list", {}, (createResponse) => {
        if (
          createResponse.event === "phx_reply" &&
          createResponse.payload?.status === "ok"
        ) {
          listCreated = true;
        } else if (createResponse.event === "live_redirect") {
          listCreated = true;
        }

        landingLiveView.heartbeat();
        landingLiveView.leave();
      });
    } else {
      landingLiveView.leave();
    }
  });

  check(res, {
    "WebSocket handshake status is 101": (r) => r && r.status === 101,
  });

  check(
    { connected },
    {
      "Connected to landing page": (r) => r.connected === true,
    },
  );

  check(
    { created: listCreated },
    {
      "Todo list created": (r) => r.created === true,
    },
  );
}
