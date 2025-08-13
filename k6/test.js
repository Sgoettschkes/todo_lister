import LiveView from "./utilities/phoenix-liveview.js";
import { check, sleep } from "k6";
import { parseHTML } from "k6/html";

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  const baseUrl = "http://localhost:4000";
  const websocketUrl = `${baseUrl.replace("http", "ws")}/live/websocket`;
  let client1Id = getOrCreateClientId();

  let liveView = new LiveView(baseUrl, websocketUrl, { client_id: client1Id });

  let connected = false;
  let listUrl = null;
  let res = null;

  liveView.connect((type, response) => {
    if (type === "connection") {
      res = response;
    } else if (
      response.event === "phx_reply" &&
      response.payload?.status === "ok"
    ) {
      connected = true;

      liveView.pushClick("create_list", {}, (type, createResponse) => {
        if (
          createResponse.event === "phx_reply" &&
          createResponse.payload?.status === "ok"
        ) {
          listUrl = createResponse.payload.response.live_redirect.to;
        }

        liveView.heartbeat();
        liveView.leave();
      });
    } else {
      liveView.leave();
    }
  });

  check(res, {
    "WebSocket handshake status on landing page is 101": (status) =>
      status && status.status === 101,
  });

  check(
    { connected },
    {
      "Connected to landing page": (r) => r.connected === true,
    },
  );

  check(
    { created: listUrl !== null },
    {
      "Todo list created": (r) => r.created === true,
    },
  );

  res = null;
  connected = false;
  let titleChanged = false;

  if (listUrl) {
    liveView = new LiveView(`${baseUrl}${listUrl}`, websocketUrl, {
      client_id: client1Id,
    });

    liveView.connect((type, response) => {
      if (type === "connection") {
        res = response;
      } else if (
        response.event === "phx_reply" &&
        response.payload?.status === "ok"
      ) {
        connected = true;

        liveView.pushClick("edit_title", {}, (type, editResponse) => {
          if (
            editResponse.event === "phx_reply" &&
            editResponse.payload?.status === "ok"
          ) {
            liveView.pushBlur(
              "save_title",
              { value: "Updated Todo List via K6" },
              (type, saveResponse) => {
                if (
                  saveResponse.event === "phx_reply" &&
                  saveResponse.payload?.status === "ok"
                ) {
                  let html = liveView.getHtml();
                  if (html) {
                    // Check if the title was updated in the HTML
                    titleChanged = html.includes("Updated Todo List via K6");
                  }

                  liveView.leave();
                } else {
                  liveView.leave();
                }
              },
            );
          } else {
            liveView.leave();
          }
        });
      } else {
        liveView.leave();
      }
    });
  }

  check(res, {
    "WebSocket handshake status on todo list page is 101": (status) =>
      status && status.status === 101,
  });

  check(
    { connected },
    {
      "Connected to todo list page": (r) => r.connected === true,
    },
  );

  check(
    { titleChanged },
    {
      "Todo list title was changed": (r) => r.titleChanged === true,
    },
  );
}

function getOrCreateClientId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
