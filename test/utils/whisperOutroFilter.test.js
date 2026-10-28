const test = require("node:test");
const assert = require("node:assert/strict");
const {
  stripWhisperOutro,
  scrubSubtitleCredits,
} = require("../../src/utils/whisperOutroFilter.js");

test("the Amara.org subtitle credit is removed wherever it appears", () => {
  // The form that leaked through fork.5: appended with no punctuation (#3923).
  assert.equal(
    stripWhisperOutro(
      "using characters and sets that we've generated Subtitles by the Amara.org community"
    ),
    "using characters and sets that we've generated"
  );
  assert.equal(
    stripWhisperOutro("that we've generated. Subtitles by the Amara.org community."),
    "that we've generated."
  );
  assert.equal(
    scrubSubtitleCredits("First part. Subtitles by the Amara.org community. Second part."),
    "First part. Second part."
  );
  assert.equal(scrubSubtitleCredits("Done (subtitles by the amara.org community)"), "Done");
  for (const only of [
    "Subtitles by the Amara.org community",
    " Subtitles by the Amara.org community.",
    '"Subtitles by the Amara.org community"',
    "Subtitles by the Amara.org community Subtitles by the Amara.org community",
  ]) {
    assert.equal(stripWhisperOutro(only), "", only);
  }
  assert.equal(scrubSubtitleCredits("No credit here."), "No credit here.");
});

test("a capitalised outro appended with no punctuation is removed", () => {
  assert.equal(
    stripWhisperOutro("then run a 2X Fiends 1 preset Thanks for watching!"),
    "then run a 2X Fiends 1 preset"
  );
  assert.equal(stripWhisperOutro("that is the plan Thank you for watching"), "that is the plan");
});

test("a hallucinated outro sentence is removed from the end", () => {
  assert.equal(
    stripWhisperOutro("He walks up behind the two men. Thanks for watching!"),
    "He walks up behind the two men."
  );
  assert.equal(
    stripWhisperOutro("likes, follows, all of those sorts of things. Thank you for watching!"),
    "likes, follows, all of those sorts of things."
  );
  assert.equal(stripWhisperOutro("Done… Thank you so much for watching."), "Done…");
});

test("a transcript that is only the outro becomes empty", () => {
  assert.equal(stripWhisperOutro(" Thank you for watching!"), "");
  assert.equal(stripWhisperOutro("Thank you so much for watching. Thanks for watching!"), "");
  assert.equal(stripWhisperOutro("Subtitles by the Amara.org community"), "");
});

test("the phrase is kept when it is part of what was said", () => {
  for (const text of [
    "I was watching TV and said thanks for watching it with me.",
    "Thanks for watching the kids yesterday, really appreciate it.",
    "He said thanks for watching!",
    "Normal sentence. Thank you.",
    "Thanks for watching over the house. See you Monday.",
  ]) {
    assert.equal(stripWhisperOutro(text), text);
  }
});

test("an outro-only recording is dropped with no notice and no saved audio", () => {
  const { WHISPER_OUTRO_ONLY_CODE } = require("../../src/utils/whisperOutroFilter.js");
  const {
    transcriptionFailureOutcome,
  } = require("../../src/helpers/transcriptionFailureOutcome.js");
  const error = Object.assign(new Error("No audio detected"), { code: WHISPER_OUTRO_ONLY_CODE });
  assert.deepEqual(transcriptionFailureOutcome(error), {
    noAudio: false,
    keepAudio: false,
    report: null,
  });
});

test("non-string input passes through", () => {
  assert.equal(stripWhisperOutro(""), "");
  assert.equal(stripWhisperOutro(undefined), undefined);
});
