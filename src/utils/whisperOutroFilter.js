// Fork: Whisper models (cloud whisper-large-v3 especially) were trained on video
// subtitles and append their outro boilerplate to the quiet tail of a recording,
// so a dictation ends with "Thanks for watching!" that was never said. Local
// whisper.cpp guards against this with decoder thresholds (whisperServer.js,
// #1458); cloud APIs expose no such knob, so the tail is stripped from the text.
//
// Only a phrase that is the last sentence is removed (it must follow sentence
// punctuation or start the text), and only these subtitle outros, which are not
// something a person dictates into another app.

const OUTRO_PHRASES = [
  /thanks?(?: you)?(?: (?:so|very) much)? for watching(?: (?:this|the) video)?/,
  /thanks?(?: you)?(?: (?:so|very) much)? for watching(?:,| and)? (?:see you|bye)(?: (?:next time|soon|in the next (?:one|video)))?/,
  /subtitles? (?:by|created by) the amara\.org community/,
];

// A transcript that was nothing but an outro came from a recording with no speech,
// usually one started by mistake. It is dropped without any notice.
export const WHISPER_OUTRO_ONLY_CODE = "WHISPER_OUTRO_ONLY";

// Trailing punctuation, whitespace and the ellipsis/quotes Whisper wraps them in.
const EDGE = "[\\s.!?,…\"'“”]*";
const OUTRO_AT_END = new RegExp(
  `(?:^|[.!?…])${EDGE}(?:${OUTRO_PHRASES.map((p) => p.source).join("|")})${EDGE}$`,
  "i"
);

/**
 * Removes Whisper's hallucinated subtitle outro from the end of a transcript.
 * Returns the text unchanged when it does not end with one; returns "" when the
 * outro was the whole transcript (a silent recording).
 */
export function stripWhisperOutro(text) {
  if (typeof text !== "string" || !text) return text;
  let result = text;
  // A tail can stack two outros ("Thank you for watching! Thanks for watching!").
  for (let i = 0; i < 3; i++) {
    const match = result.match(OUTRO_AT_END);
    if (!match) break;
    // Keep the sentence-ending punctuation of the real text before the outro.
    const cut = match.index + (/^[.!?…]/.test(match[0]) ? 1 : 0);
    result = result.slice(0, cut);
  }
  return result === text ? text : result.trimEnd();
}
