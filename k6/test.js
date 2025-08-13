import LiveView from "./utilities/phoenix-liveview.js";
import TestScenario from "./utilities/test-scenario.js";

export const options = {
  vus: 1,
  iterations: 1,
};

// Generic LiveView connection step factory
const createConnectToLiveViewStep = (config) => {
  return (ctx, next) => {
    const url = config.urlBuilder(ctx);
    const liveViewKey = config.liveViewKey;
    const connectedKey = config.connectedKey;

    if (config.skipCondition && config.skipCondition(ctx)) {
      next();
      return;
    }

    ctx[liveViewKey] = new LiveView(url, ctx.websocketUrl, {
      client_id: ctx.clientId,
    });

    ctx[liveViewKey].connect((type, response) => {
      if (type === "connection") {
        // do nothing
      } else if (type === "message") {
        ctx[connectedKey] = true;
        // Make sure we have the connection status
        next();
      } else {
        ctx[liveViewKey].leave();
        next();
      }
    });
  };
};

// Step definitions
const connectToLandingPage = createConnectToLiveViewStep({
  urlBuilder: (ctx) => ctx.baseUrl,
  liveViewKey: "liveView",
  connectedKey: "landingConnected",
});

const connectToListPage = createConnectToLiveViewStep({
  urlBuilder: (ctx) => `${ctx.baseUrl}${ctx.listUrl}`,
  liveViewKey: "listLiveView",
  connectedKey: "listConnected",
  skipCondition: (ctx) => !ctx.listUrl,
});

const createTodoList = (ctx, next) => {
  ctx.liveView.pushClick("create_list", {}, (type, createResponse) => {
    if (
      createResponse.event === "phx_reply" &&
      createResponse.payload?.status === "ok"
    ) {
      ctx.listUrl = createResponse.payload.response.live_redirect.to;
      ctx.listCreated = ctx.listUrl !== null;
    }

    ctx.liveView.leave();
    next();
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
      "Connected to landing page",
      (ctx) => ctx.landingConnected === true,
    )
    .addCheck("Todo list created", (ctx) => ctx.listCreated === true)
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
