// Fork: Whisper models (cloud whisper-large-v3 especially) were trained on video
// subtitles and append their outro boilerplate to the quiet tail of a recording,
// so a dictation ends with "Thanks for watching!" that was never said. Local
// whisper.cpp guards against this with decoder thresholds (whisperServer.js,
// #1458); cloud APIs expose no such knob, so the text is cleaned instead.
//
// Two kinds of boilerplate, treated differently:
// - A subtitle credit ("Subtitles by the Amara.org community") is never dictated,
//   so it is removed wherever it appears, with or without punctuation around it.
// - "Thanks for watching!" can be said for real, so it is removed only as the
//   transcript's last sentence: after sentence punctuation, at the start, or
//   capitalised mid-line the way Whisper appends it ("...we generated Thanks for
//   watching"). "He said thanks for watching!" is kept.

// A transcript that was nothing but boilerplate came from a recording with no
// speech, usually one started by mistake. It is dropped without any notice.
export const WHISPER_OUTRO_ONLY_CODE = "WHISPER_OUTRO_ONLY";

const SUBTITLE_CREDIT =
  /[([]?\s*\b(?:subtitles?|captions?) (?:by|created by|made by|provided by) the amara\.org community\b\s*[)\]]?[.!]?/gi;

const WATCHING =
  "(?:thanks?|thank you)(?: (?:so|very) much)? for watching" +
  "(?: (?:this|the) video)?" +
  "(?:(?:,| and)? (?:see you|bye)(?: (?:next time|soon|in the next (?:one|video)))?)?";
// Trailing punctuation, whitespace and the ellipsis/quotes Whisper wraps them in.
const EDGE = "[\\s.!?,…\"'“”]*";
// After sentence punctuation or at the start of the text.
const WATCHING_AFTER_SENTENCE = new RegExp(`(?:^|[.!?…])${EDGE}${WATCHING}${EDGE}$`, "i");
// Capitalised after a word with no punctuation between, as Whisper appends it.
// Case-sensitive on the leading "T" so a lower-case quote stays.
const WATCHING_CAPITALISED = new RegExp(
  `\\s(?=T)${WATCHING.replace("(?:thanks?|thank you)", "(?:Thanks?|Thank you)")}${EDGE}$`
);
const ONLY_PUNCTUATION = /^[\s.!?,…"'“”()[\]]*$/;

/**
 * Removes every subtitle credit from the text. Returns the text unchanged when it
 * has none; returns "" when nothing but the credit (and punctuation) was there.
 */
export function scrubSubtitleCredits(text) {
  if (typeof text !== "string" || !text) return text;
  SUBTITLE_CREDIT.lastIndex = 0;
  if (!SUBTITLE_CREDIT.test(text)) return text;
  const scrubbed = text
    .replace(SUBTITLE_CREDIT, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.!?,…])/g, "$1")
    .trim();
  return ONLY_PUNCTUATION.test(scrubbed) ? "" : scrubbed;
}

/**
 * Removes Whisper's hallucinated subtitle boilerplate from a transcript.
 * Returns the text unchanged when it has none; returns "" when the boilerplate
 * was the whole transcript (a silent recording).
 */
export function stripWhisperOutro(text) {
  if (typeof text !== "string" || !text) return text;
  let result = scrubSubtitleCredits(text);
  // A tail can stack two outros ("Thank you for watching! Thanks for watching!").
  for (let i = 0; i < 3 && result; i++) {
    const match = result.match(WATCHING_AFTER_SENTENCE) || result.match(WATCHING_CAPITALISED);
    if (!match) break;
    // Keep the sentence-ending punctuation of the real text before the outro.
    const cut = match.index + (/^[.!?…]/.test(match[0]) ? 1 : 0);
    result = result.slice(0, cut);
  }
  if (result === text) return text;
  result = result.trimEnd();
  return ONLY_PUNCTUATION.test(result) ? "" : result;
}
