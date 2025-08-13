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
        next();
      }
    });
  };
};

const createLeaveLiveViewStep = (config) => {
  return (ctx, next) => {
    const liveViewKey = config.liveViewKey;

    ctx[liveViewKey].leave();
    next();
  };
};

// Step definitions
const connectToLandingPage = createConnectToLiveViewStep({
  urlBuilder: (ctx) => ctx.baseUrl,
  liveViewKey: "liveView",
  connectedKey: "landingConnected",
});

const createTodoList = (ctx, next) => {
  ctx.liveView.pushClick("create_list", {}, (type, createResponse) => {
    if (type === "message") {
      ctx.listUrl = createResponse.payload.response.live_redirect.to;
      ctx.listCreated = ctx.listUrl !== null;
    }
    next();
  });
};

const leaveLandingPage = createLeaveLiveViewStep({
  liveViewKey: "liveView",
});

const connectToListPage = createConnectToLiveViewStep({
  urlBuilder: (ctx) => `${ctx.baseUrl}${ctx.listUrl}`,
  liveViewKey: "listLiveView",
  connectedKey: "listConnected",
  skipCondition: (ctx) => !ctx.listUrl,
});

const editTitle = (ctx, next) => {
  if (!ctx.listLiveView || !ctx.listConnected) {
    next();
    return;
  }

  ctx.listLiveView.pushClick("edit_title", {}, (type, response) => {
    if (type === "message") {
      ctx.editSuccessful = true;
    }
    next();
  });
};

const saveTitle = (ctx, next) => {
  if (!ctx.listLiveView || !ctx.editSuccessful) {
    next();
    return;
  }

  ctx.listLiveView.pushBlur(
    "save_title",
    { value: "Updated Todo List via K6" },
    (type, response) => {
      if (type === "message") {
        const html = ctx.listLiveView.getHtml();
        if (html) {
          ctx.titleChanged = html.includes("Updated Todo List via K6");
        }
      }

      next();
    },
  );
};

const addFirstTodoListItem = (ctx, next) => {
  if (!ctx.listLiveView || !ctx.editSuccessful) {
    next();
    return;
  }

  ctx.listLiveView.pushClick("add_item", {}, (type, response) => {
    if (type === "message") {
      const html = ctx.listLiveView.getHtml();
      if (html) {
        ctx.addFirstTodoListItem = html.includes("New task");
      }
    }

    next();
  });
};

const leaveListPage = createLeaveLiveViewStep({
  liveViewKey: "listLiveView",
});

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
    addFirstTodoListItem: false,
  };

  // Define steps
  scenario
    .addStep("Connect to landing page", connectToLandingPage)
    .addStep("Create todo list", createTodoList)
    .addStep("Leave landing page", leaveLandingPage)
    .addStep("Connect to list page", connectToListPage)
    .addStep("Edit title", editTitle)
    .addStep("Save title", saveTitle)
    .addStep("Add first todo list item", addFirstTodoListItem)
    .addStep("Leave list page", leaveListPage);

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
    .addCheck("Todo list title was changed", (ctx) => ctx.titleChanged === true)
    .addCheck(
      "First Todo List Item was added",
      (ctx) => ctx.addFirstTodoListItem === true,
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
