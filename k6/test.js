import LiveView from "./utilities/phoenix-liveview.js";
import TestScenario from "./utilities/test-scenario.js";
import { parseHTML } from "k6/html";

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
        const doc = parseHTML(html);

        ctx.h1TitleCorrectAfterSave = doc
          .find("h1")
          .text()
          .includes("Updated Todo List via K6");

        ctx.pageTitleCorrectAfterSave =
          doc.find("title").text().trim() ===
          "Updated Todo List via K6 | Todo Lister";
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
      ctx.addFirstTodoListItem =
        parseHTML(html).find('input[value="New task"]').attr("value") ===
        "New task";
    }

    next();
  });
};

const clickRefreshButton = (ctx, next) => {
  if (!ctx.listLiveView || !ctx.listConnected) {
    next();
    return;
  }

  ctx.listLiveView.pushClick("refresh", {}, (type, response) => {
    if (type === "message") {
      // Check if refresh button is disabled immediately after clicking
      const html = ctx.listLiveView.getHtml();
      const doc = parseHTML(html);
      const refreshButton = doc.find('button[phx-click="refresh"]');
      ctx.refreshButtonDisabledAfterClick =
        refreshButton.size() > 0 &&
        refreshButton.attr("disabled") !== undefined;

      ctx.listLiveView.channel.socket.setTimeout(() => {
        next();
      }, 2500);
    } else {
      next();
    }
  });
};

const waitForRefreshComplete = (ctx, next) => {
  const html = ctx.listLiveView.getHtml();
  const doc = parseHTML(html);

  // Check if refresh button is back to being enabled (no disabled attribute)
  const refreshButton = doc.find('button[phx-click="refresh"]');
  ctx.refreshButtonReEnabled =
    refreshButton.size() > 0 && !refreshButton.attr("disabled");

  next();
};

const clickFocusTimer = (ctx, next) => {
  if (!ctx.listLiveView || !ctx.listConnected) {
    next();
    return;
  }

  // Find the first timer button
  const html = ctx.listLiveView.getHtml();
  const doc = parseHTML(html);
  const timerButton = doc.find('button[phx-click="start_focus_timer"]').first();

  const itemId = timerButton.attr("phx-value-id");

  ctx.listLiveView.pushClick(
    "start_focus_timer",
    { id: itemId },
    (type, response) => {
      if (type === "message") {
        const updatedHtml = ctx.listLiveView.getHtml();
        const updatedDoc = parseHTML(updatedHtml);

        // Check if modal is shown
        ctx.focusTimerModalShown =
          updatedDoc.find("h3").text().includes("Set Focus Timer") &&
          updatedDoc.find('input[name="minutes"]').size() > 0 &&
          updatedDoc.find('input[name="seconds"]').size() > 0;
      }
      next();
    },
  );
};

const setFocusTimer = (ctx, next) => {
  if (!ctx.listLiveView || !ctx.focusTimerModalShown) {
    next();
    return;
  }

  // The item_id should be stored from the previous step
  // Let's extract it from the focus timer state
  const html = ctx.listLiveView.getHtml();
  const doc = parseHTML(html);
  const form = doc.find('form[phx-submit="set_focus_timer"]');
  const itemId = form.attr("phx-value-item_id");

  if (!itemId) {
    next();
    return;
  }

  // Try using pushClick with all parameters instead of pushForm
  ctx.listLiveView.pushClick(
    "set_focus_timer",
    {
      item_id: itemId,
      minutes: "0",
      seconds: "5",
    },
    (type, response) => {
      if (type === "message") {
        const updatedHtml = ctx.listLiveView.getHtml();
        const updatedDoc = parseHTML(updatedHtml);

        // Check if focus mode is active
        ctx.focusModeActive =
          updatedDoc.find("#focus-mode").size() > 0 &&
          updatedDoc.find("#countdown-timer").size() > 0 &&
          updatedDoc.find("h1").text().includes("New task");

        // Set up timeout to continue after 5 seconds
        ctx.listLiveView.channel.socket.setTimeout(() => {
          next();
        }, 5200); // 5.2 seconds to ensure timer completes
      } else {
        next();
      }
    },
  );
};

const verifyFocusTimerComplete = (ctx, next) => {
  if (!ctx.focusModeActive) {
    next();
    return;
  }

  // Check if we received a server-pushed event
  const events = ctx.listLiveView.getEvents();

  ctx.focusModeDeactivated = events.some((event) => {
    return (
      event[0] === "focus-complete" &&
      event[1]?.message === "Focus time complete!"
    );
  });

  ctx.listLiveView.resetEvents();

  next();
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
    addFirstTodoListItem: false,
    h1TitleCorrectAfterSave: false,
    pageTitleCorrectAfterSave: false,
    refreshButtonDisabledAfterClick: false,
    refreshButtonReEnabled: false,
    focusTimerModalShown: false,
    focusModeActive: false,
    focusModeDeactivated: false,
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
    .addStep("Click refresh button", clickRefreshButton)
    .addStep("Wait for refresh complete", waitForRefreshComplete)
    .addStep("Click focus timer", clickFocusTimer)
    .addStep("Set focus timer", setFocusTimer)
    .addStep("Wait for focus timer complete", verifyFocusTimerComplete)
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
    .addCheck(
      "H1 title correct after save",
      (ctx) => ctx.h1TitleCorrectAfterSave === true,
    )
    .addCheck(
      "Page title correct after save",
      (ctx) => ctx.pageTitleCorrectAfterSave === true,
    )
    .addCheck(
      "First Todo List Item was added",
      (ctx) => ctx.addFirstTodoListItem === true,
    )
    .addCheck(
      "Refresh button disabled after click",
      (ctx) => ctx.refreshButtonDisabledAfterClick === true,
    )
    .addCheck(
      "Refresh button re-enabled after async cycle",
      (ctx) => ctx.refreshButtonReEnabled === true,
    )
    .addCheck(
      "Focus timer modal shown",
      (ctx) => ctx.focusTimerModalShown === true,
    )
    .addCheck("Focus mode activated", (ctx) => ctx.focusModeActive === true)
    .addCheck(
      "Focus mode deactivated after timer",
      (ctx) => ctx.focusModeDeactivated === true,
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
