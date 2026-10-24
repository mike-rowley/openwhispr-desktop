const test = require("node:test");
const assert = require("node:assert/strict");
const { stripWhisperOutro } = require("../../src/utils/whisperOutroFilter.js");

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
