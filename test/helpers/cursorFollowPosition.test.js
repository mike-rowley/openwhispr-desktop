const test = require("node:test");
const assert = require("node:assert/strict");

const { WindowPositionUtil, WINDOW_SIZES } = require("../../src/helpers/windowConfig");
const { CURSOR_FOLLOW_OFFSET_LIMITS } = require("../../src/helpers/voiceSurfaceGeometry");

const DISPLAY = { workArea: { x: 0, y: 0, width: 1440, height: 900 } };
// The pill rests 12px above the window's bottom edge (center dock).
const pillBottom = (bounds) => bounds.y + bounds.height - 12;
const pillCenterX = (bounds) => bounds.x + bounds.width / 2;

test("floats the pill the configured distance above the pointer, centered on it", () => {
  const bounds = WindowPositionUtil.getCursorFollowPosition(
    { x: 700, y: 500 },
    DISPLAY,
    WINDOW_SIZES.BASE,
    30
  );

  assert.equal(bounds.width, WINDOW_SIZES.BASE.width);
  assert.equal(bounds.height, WINDOW_SIZES.BASE.height);
  assert.equal(pillCenterX(bounds), 700);
  assert.equal(pillBottom(bounds), 470);
});

test("defaults to the shared offset", () => {
  const bounds = WindowPositionUtil.getCursorFollowPosition({ x: 700, y: 500 }, DISPLAY);

  assert.equal(pillBottom(bounds), 500 - CURSOR_FOLLOW_OFFSET_LIMITS.default);
});

test("hangs the pill below the pointer when there is no room above it", () => {
  const bounds = WindowPositionUtil.getCursorFollowPosition(
    { x: 700, y: 50 },
    DISPLAY,
    WINDOW_SIZES.BASE,
    30
  );
  // Tallest pill is 40px; its top sits below a ~20px pointer plus the offset.
  const pillTop = pillBottom(bounds) - 40;

  assert.equal(pillTop, 50 + 20 + 30);
  assert.ok(bounds.y >= DISPLAY.workArea.y);
});

test("stays on the display at its side edges", () => {
  const right = WindowPositionUtil.getCursorFollowPosition(
    { x: 1435, y: 500 },
    DISPLAY,
    WINDOW_SIZES.BASE,
    30
  );
  const left = WindowPositionUtil.getCursorFollowPosition(
    { x: 3, y: 500 },
    DISPLAY,
    WINDOW_SIZES.BASE,
    30
  );

  assert.equal(right.x, 1440 - WINDOW_SIZES.BASE.width);
  assert.equal(left.x, 0);
});

test("works on a monitor with a negative origin", () => {
  const upper = { workArea: { x: -200, y: -1080, width: 1920, height: 1040 } };
  const bounds = WindowPositionUtil.getCursorFollowPosition(
    { x: 500, y: -400 },
    upper,
    WINDOW_SIZES.BASE,
    30
  );

  assert.equal(pillCenterX(bounds), 500);
  assert.equal(pillBottom(bounds), -430);
});

test("follow-cursor rests the pill in the center dock", async () => {
  const { resolveVoicePillDock, usesCenterDock } = await import(
    "../../src/helpers/voicePillPresentation.js"
  );

  assert.equal(usesCenterDock("follow-cursor"), true);
  assert.equal(usesCenterDock("center"), true);
  assert.equal(usesCenterDock("bottom-left"), false);
  assert.equal(
    resolveVoicePillDock({
      liveTranscriptOpen: false,
      assistantOpen: false,
      panelStartPosition: "follow-cursor",
    }),
    "center"
  );
});
