const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

let cursor = { x: 700, y: 500 };
const DISPLAY = { workArea: { x: 0, y: 0, width: 1440, height: 900 } };

// Same stub approach as windowManagerAssistantPanel.test.js, but windowConfig
// is the real module so the follow loop runs the real placement math.
const originalLoad = Module._load;
Module._load = function loadWindowManagerWithStubs(request, parent, isMain) {
  if (request === "electron") {
    return {
      app: { on: () => undefined },
      screen: {
        getPrimaryDisplay: () => DISPLAY,
        getDisplayMatching: () => DISPLAY,
        getDisplayNearestPoint: () => DISPLAY,
        getCursorScreenPoint: () => ({ ...cursor }),
        on: () => undefined,
      },
      BrowserWindow: class {},
      Menu: {},
      shell: {},
      dialog: {},
    };
  }
  if (request === "./debugLogger")
    return { warn: () => undefined, debug: () => undefined, log: () => undefined };
  if (request === "./hotkeyManager") {
    const FakeHotkeyManager = class {
      unregisterAll() {}
      isInListeningMode() {
        return false;
      }
    };
    FakeHotkeyManager.isGlobeLikeHotkey = () => false;
    return FakeHotkeyManager;
  }
  if (request === "./dragManager")
    return class {
      isDragActive() {
        return false;
      }
    };
  if (request === "./menuManager") return {};
  if (request === "./devServerManager") return { DEV_SERVER_PORT: 5173 };
  if (request === "./dockManager") return {};
  if (request === "./i18nMain") return { i18nMain: { t: (key) => key } };
  return originalLoad.call(this, request, parent, isMain);
};
const WindowManager = require("../../src/helpers/windowManager");
const { WINDOW_SIZES } = require("../../src/helpers/windowConfig");
Module._load = originalLoad;

// `rounding` mimics fractional display scaling, where Windows hands back a
// window a pixel or two larger than the size requested.
function makeManager({ rounding = 0 } = {}) {
  const manager = new WindowManager();
  manager.setOnboardingActive(false);
  let visible = false;
  const window = {
    bounds: {
      x: 1228,
      y: 776,
      width: WINDOW_SIZES.BASE.width + rounding,
      height: WINDOW_SIZES.BASE.height + rounding,
    },
    isDestroyed: () => false,
    isVisible: () => visible,
    isMinimized: () => false,
    showInactive: () => {
      visible = true;
    },
    hide: () => {
      visible = false;
    },
    getBounds: () => ({ ...window.bounds }),
    setBounds: (next) => {
      window.bounds = {
        ...next,
        width: next.width + rounding,
        height: next.height + rounding,
      };
    },
    webContents: { send: () => undefined },
  };
  manager.mainWindow = window;
  manager._notifyMainWindowHorizontalDirection = () => undefined;
  return { manager, window };
}

async function tick(manager) {
  manager._followCursorTick();
  await manager._mainWindowResizeQueue;
}

// Pill center and bottom edge, from the window bounds (12px center dock).
const pillAnchor = (bounds) => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height - 12,
});

test("the pill appears at the pointer and follows it until the dictation ends", async () => {
  const { manager, window } = makeManager();
  try {
    manager.setPanelStartPosition("follow-cursor");
    manager.setCursorFollowOffset(40);

    cursor = { x: 700, y: 500 };
    manager.showDictationPanel({ reposition: true });
    assert.deepEqual(pillAnchor(window.bounds), { x: 700, y: 460 });

    manager.setDictationLifecycleState("recording");
    assert.ok(manager._cursorFollowTimer, "tracking starts with the recording");

    cursor = { x: 900, y: 650 };
    await tick(manager);
    assert.deepEqual(pillAnchor(window.bounds), { x: 900, y: 610 });

    manager.setDictationLifecycleState("idle");
    assert.equal(manager._cursorFollowTimer, null, "tracking stops when idle");

    cursor = { x: 100, y: 100 };
    await tick(manager);
    assert.deepEqual(pillAnchor(window.bounds), { x: 900, y: 610 }, "idle pill stays put");
  } finally {
    manager._stopCursorFollow();
  }
});

test("fractional display scaling that rounds the window up still follows", async () => {
  // 157.5% scaling hands back a 209×121 window for a 208×120 request.
  const { manager, window } = makeManager({ rounding: 1 });
  try {
    manager.setPanelStartPosition("follow-cursor");
    manager.setCursorFollowOffset(40);

    cursor = { x: 700, y: 500 };
    manager.showDictationPanel({ reposition: true });
    // The window's top-left is placed from the canonical 208×120 size.
    assert.deepEqual([window.bounds.x, window.bounds.y], [596, 352]);

    manager.setDictationLifecycleState("recording");
    cursor = { x: 900, y: 650 };
    await tick(manager);
    assert.deepEqual([window.bounds.x, window.bounds.y], [796, 502]);
    assert.equal(window.bounds.width, WINDOW_SIZES.BASE.width + 1, "size does not creep");
  } finally {
    manager._stopCursorFollow();
  }
});

test("a grown window keeps its place while the pointer moves", async () => {
  const { manager, window } = makeManager();
  try {
    manager.setPanelStartPosition("follow-cursor");
    manager.showDictationPanel({ reposition: true });
    manager.setDictationLifecycleState("recording");

    window.bounds = { x: 300, y: 300, width: 400, height: 500 };
    cursor = { x: 1000, y: 700 };
    await tick(manager);

    assert.deepEqual(window.bounds, { x: 300, y: 300, width: 400, height: 500 });
  } finally {
    manager._stopCursorFollow();
  }
});

test("corner positions never track the pointer", () => {
  const { manager } = makeManager();
  try {
    manager.setPanelStartPosition("bottom-right");
    manager.showDictationPanel({ reposition: true });
    manager.setDictationLifecycleState("recording");

    assert.equal(manager._cursorFollowTimer, null);
  } finally {
    manager._stopCursorFollow();
  }
});

test("the offset is clamped and falls back to the default when unreadable", () => {
  const { manager } = makeManager();

  manager.setCursorFollowOffset(-5);
  assert.equal(manager.getCursorFollowOffset(), 0);
  manager.setCursorFollowOffset("999");
  assert.equal(manager.getCursorFollowOffset(), 200);
  manager.setCursorFollowOffset("");
  assert.equal(manager.getCursorFollowOffset(), 30);
});
