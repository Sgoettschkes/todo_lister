import LiveView from "./utilities/phoenix-liveview.js";
import TestScenario from "./utilities/test-scenario.js";

export const options = {
  vus: 1,
  iterations: 1,
};

// Step definitions
const connectToLandingPage = (ctx, next) => {
  ctx.liveView = new LiveView(ctx.baseUrl, ctx.websocketUrl, {
    client_id: ctx.clientId,
  });

  let connectionCaptured = false;

  ctx.liveView.connect((type, response) => {
    if (type === "connection") {
      ctx.landingConnectionStatus = response;
      connectionCaptured = true;
    } else if (type === "message") {
      // Wait for both connection status and join response
      if (
        response &&
        response.event === "phx_reply" &&
        response.payload?.status === "ok"
      ) {
        ctx.landingConnected = true;
        // Make sure we have the connection status
        if (!connectionCaptured) {
          // Connection status wasn't captured separately, might be embedded
          ctx.landingConnectionStatus = ctx.landingConnectionStatus || {
            status: 101,
          };
        }
        next();
      } else {
        ctx.liveView.leave();
        next();
      }
    } else {
      // Handle other cases
      if (!response || response.event !== "phx_reply") {
        ctx.liveView.leave();
        next();
      }
    }
  });
};

const createTodoList = (ctx, next) => {
  ctx.liveView.pushClick("create_list", {}, (type, createResponse) => {
    if (
      createResponse.event === "phx_reply" &&
      createResponse.payload?.status === "ok"
    ) {
      ctx.listUrl = createResponse.payload.response.live_redirect.to;
      ctx.listCreated = ctx.listUrl !== null;
    }

    ctx.liveView.heartbeat();
    ctx.liveView.leave();
    next();
  });
};

const connectToListPage = (ctx, next) => {
  if (!ctx.listUrl) {
    // Skip if no list URL
    next();
    return;
  }

  ctx.listLiveView = new LiveView(
    `${ctx.baseUrl}${ctx.listUrl}`,
    ctx.websocketUrl,
    { client_id: ctx.clientId },
  );

  let connectionCaptured = false;

  ctx.listLiveView.connect((type, response) => {
    if (type === "connection") {
      ctx.listConnectionStatus = response;
      connectionCaptured = true;
    } else if (type === "message") {
      if (
        response &&
        response.event === "phx_reply" &&
        response.payload?.status === "ok"
      ) {
        ctx.listConnected = true;
        // Make sure we have the connection status
        if (!connectionCaptured) {
          // Connection status wasn't captured separately, might be embedded
          ctx.listConnectionStatus = ctx.listConnectionStatus || {
            status: 101,
          };
        }
        next();
      } else {
        ctx.listLiveView.leave();
        next();
      }
    } else {
      // Handle other cases
      if (!response || response.event !== "phx_reply") {
        ctx.listLiveView.leave();
        next();
      }
    }
  });
};

const editTitle = (ctx, next) => {
  if (!ctx.listLiveView || !ctx.listConnected) {
    next();
    return;
  }

  ctx.listLiveView.pushClick("edit_title", {}, (type, editResponse) => {
    if (
      editResponse.event === "phx_reply" &&
      editResponse.payload?.status === "ok"
    ) {
      ctx.editSuccessful = true;
      next();
    } else {
      ctx.listLiveView.leave();
      next();
    }
  });
};

const saveTitle = (ctx, next) => {
  if (!ctx.listLiveView || !ctx.editSuccessful) {
    if (ctx.listLiveView) {
      ctx.listLiveView.leave();
    }
    next();
    return;
  }

  ctx.listLiveView.pushBlur(
    "save_title",
    { value: "Updated Todo List via K6" },
    (type, saveResponse) => {
      if (
        saveResponse.event === "phx_reply" &&
        saveResponse.payload?.status === "ok"
      ) {
        const html = ctx.listLiveView.getHtml();
        if (html) {
          ctx.titleChanged = html.includes("Updated Todo List via K6");
        }
      }

      ctx.listLiveView.leave();
      next();
    },
  );
};

export default function () {
  const scenario = new TestScenario();

  // Initialize context
  scenario.context = {
    baseUrl: "http://localhost:4000",
    websocketUrl: "ws://localhost:4000/live/websocket",
    clientId: getOrCreateClientId(),
    landingConnected: false,
    listCreated: false,
    listConnected: false,
    titleChanged: false,
  };

  // Define steps
  scenario
    .addStep("Connect to landing page", connectToLandingPage)
    .addStep("Create todo list", createTodoList)
    .addStep("Connect to list page", connectToListPage)
    .addStep("Edit title", editTitle)
    .addStep("Save title", saveTitle);

  // Define checks
  scenario
    .addCheck(
      "WebSocket handshake status on landing page is 101",
      (ctx) =>
        ctx.landingConnectionStatus &&
        ctx.landingConnectionStatus.status === 101,
    )
    .addCheck(
      "Connected to landing page",
      (ctx) => ctx.landingConnected === true,
    )
    .addCheck("Todo list created", (ctx) => ctx.listCreated === true)
    .addCheck(
      "WebSocket handshake status on todo list page is 101",
      (ctx) =>
        ctx.listConnectionStatus && ctx.listConnectionStatus.status === 101,
    )
    .addCheck(
      "Connected to todo list page",
      (ctx) => ctx.listConnected === true,
    )
    .addCheck(
      "Todo list title was changed",
      (ctx) => ctx.titleChanged === true,
    );

  // Run the scenario
  scenario.run();
}

function getOrCreateClientId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
