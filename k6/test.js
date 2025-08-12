import LiveView from "./utilities/phoenix-liveview.js";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  console.log("Starting LiveView load test...");

  // Test landing page
  const baseUrl = "http://localhost:4000";
  const websocketUrl = `${baseUrl.replace("http", "ws")}/live/websocket`;
  const landingLiveView = new LiveView(baseUrl, websocketUrl);

  // Connect to landing page LiveView - this will block until connection closes
  const res = landingLiveView.connect((response) => {
    if (response.event === "phx_reply" && response.payload?.status === "ok") {
      // Try to create a new todo list
      landingLiveView.pushClick("create_list", {}, (createResponse) => {
        let listCreated = false;
        if (
          createResponse.event === "phx_reply" &&
          createResponse.payload?.status === "ok"
        ) {
          console.log("✅ Todo list created");
          listCreated = true;
        } else if (createResponse.event === "live_redirect") {
          console.log("✅ Redirecting to new list");
          listCreated = true;
        } else {
          console.log("❌ Failed to create list:", createResponse.payload);
        }

        landingLiveView.heartbeat();

        // Verify results (move checks inside WebSocket callback)
        check(
          { connected: true },
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

        landingLiveView.leave();
      });
    } else {
      console.log("❌ Failed to connect to landing page:", response);
      // Close connection on failure
      landingLiveView.leave();
    }
  });

  // Check WebSocket connection status (this runs immediately after connect())
  check(res, {
    "WebSocket handshake status is 101": (r) => r && r.status === 101,
  });
}
