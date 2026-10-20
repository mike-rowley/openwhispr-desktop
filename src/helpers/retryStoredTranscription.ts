import { getSettings } from "../stores/settingsStore";
import { usePolicyStore } from "../stores/policyStore";
import { isTranscriptionContextAllowed } from "../stores/policyRules";
import { getManagedTranscriptionResolution } from "../services/managedTranscription";
import {
  executeTranslationChain,
  hasTextContent,
  shouldRunTranslateStep,
} from "./translationChain";
import { applyChineseScript, resolveChineseScriptTarget } from "../utils/chineseScript";
import { getAgentName } from "../utils/agentName";
import logger from "../utils/logger";
import type { TranscriptionItem } from "../types/electron";

type CleanupError = Error & { messageKey?: string };

export type RetryStoredTranscriptionResult =
  | { status: "ok"; transcription: TranscriptionItem; cleanupError?: CleanupError }
  | { status: "blocked"; message?: string; messageKey?: string; managedByOrg?: boolean }
  | { status: "error"; error?: string; messageKey?: string };

/**
 * Re-transcribes a history row's stored audio with the transcription settings
 * selected now, then runs the same cleanup / translation / Chinese-script passes
 * dictation does. Shared by History's Re-transcribe and the dictation error
 * card's Resend; callers own the toasts.
 */
export async function retryStoredTranscription(
  id: number
): Promise<RetryStoredTranscriptionResult> {
  const s = getSettings();
  const managed = getManagedTranscriptionResolution();
  if (managed?.kind === "error") {
    return { status: "blocked", message: managed.message, messageKey: managed.messageKey };
  }
  if (!managed && !isTranscriptionContextAllowed(usePolicyStore.getState(), s, "dictation")) {
    return { status: "blocked", managedByOrg: true };
  }

  const result = await window.electronAPI.retryTranscription(id, {
    managed,
    useLocalWhisper: s.useLocalWhisper,
    localTranscriptionProvider: s.localTranscriptionProvider,
    cloudTranscriptionMode: s.cloudTranscriptionMode,
    cloudTranscriptionProvider: s.cloudTranscriptionProvider,
    cloudTranscriptionModel: s.cloudTranscriptionModel,
    cloudTranscriptionBaseUrl: s.cloudTranscriptionBaseUrl,
    cortiEnvironment: s.cortiEnvironment,
    cortiTenant: s.cortiTenant,
    parakeetModel: s.parakeetModel,
    cohereModel: s.cohereModel,
    whisperModel: s.whisperModel,
    preferredLanguage: s.preferredLanguage,
    transcriptionMode: s.transcriptionMode,
    remoteTranscriptionType: s.remoteTranscriptionType,
    remoteTranscriptionUrl: s.remoteTranscriptionUrl,
    remoteTranscriptionModel: s.remoteTranscriptionModel,
  });
  if (!result.success || !result.transcription) {
    return {
      status: "error",
      error: result.error,
      messageKey: (result as { messageKey?: string }).messageKey,
    };
  }

  const rawText = result.transcription.text;
  let finalTranscription = result.transcription;
  let cleanupError: CleanupError | undefined;

  // A translation dictation must re-run cleanup-then-translate on retry, not plain cleanup.
  let handledTranslation = false;
  let translationApplied = false;
  if (result.transcription.route_kind === "translation") {
    handledTranslation = true;
    try {
      const [
        { default: ReasoningService },
        { resolveReasoningRoute },
        { getEffectiveCleanupModel, getSettings: getEffectiveSettings },
      ] = await Promise.all([
        import("../services/ReasoningService"),
        import("./audioManager"),
        import("../stores/settingsStore"),
      ]);
      const settings = getEffectiveSettings();
      const agentName = getAgentName();
      const route = resolveReasoningRoute(rawText, settings, agentName, false, true);
      if (route.kind === "translation") {
        const { text, translated } = await executeTranslationChain({
          text: rawText,
          cleanupReachable: route.cleanupReachable,
          runCleanup: (currentText: string) =>
            ReasoningService.processText(
              currentText,
              getEffectiveCleanupModel(),
              agentName,
              route.cleanupConfig
            ),
          runTranslate: (currentText: string) =>
            ReasoningService.processText(currentText, route.model, agentName, route.config),
          shouldTranslate: shouldRunTranslateStep(
            settings.translationSourceLanguage,
            settings.translationTargetLanguage
          ),
          onCleanupError: (error: CleanupError) => {
            logger.warn(
              "Cleanup step failed in translation chain, translating raw transcript",
              { error: error.message },
              "transcription"
            );
            // The chain still translates the raw transcript, so the caller says why
            // cleanup was dropped rather than reporting a clean success (#2091).
            cleanupError = error;
          },
          onEmptyTranslate: () =>
            logger.warn(
              "Translation step returned empty text, keeping previous text",
              {},
              "transcription"
            ),
          onUnchangedTranslate: () =>
            logger.warn(
              "Translation step returned unchanged text, keeping source text",
              {},
              "transcription"
            ),
        });
        translationApplied = translated;
        if (text !== rawText) {
          const updated = await window.electronAPI.updateTranscriptionText(id, text, rawText);
          if (updated.success && updated.transcription) {
            finalTranscription = updated.transcription;
          }
        }
      } else {
        // Translation disabled/unreachable since recording — fall through to cleanup.
        handledTranslation = false;
      }
    } catch {
      // Reasoning failed — keep the raw STT result
    }
  }

  // Apply AI reasoning if enabled
  if (!handledTranslation && s.useCleanupModel) {
    try {
      const [
        { default: ReasoningService },
        { getEffectiveCleanupModel, isCloudCleanupMode, getSettings: getLatestSettings },
      ] = await Promise.all([
        import("../services/ReasoningService"),
        import("../stores/settingsStore"),
      ]);
      const model = getEffectiveCleanupModel();
      const isCloud = isCloudCleanupMode();
      if (model || isCloud) {
        const agentName = getAgentName();
        const reasonedText = await ReasoningService.processText(rawText, model, agentName, {
          disableThinking: getLatestSettings().cleanupDisableThinking,
          requireCompleteOutput: true,
        });
        if (hasTextContent(reasonedText) && reasonedText !== rawText) {
          const updated = await window.electronAPI.updateTranscriptionText(
            id,
            reasonedText,
            rawText
          );
          if (updated.success && updated.transcription) {
            finalTranscription = updated.transcription;
          }
        }
      }
    } catch (error) {
      // The row keeps its raw transcript, so the retry must not look like it
      // cleaned anything — the caller reports why, the way dictation does (#2091).
      cleanupError = error as CleanupError;
    }
  }

  // Deterministic Chinese script pass, mirroring dictation (#975). Runs last so
  // it covers the cleaned/translated text, or the raw transcript when neither ran.
  // Same rule as audioManager.getEffectiveOutputLanguage: only a completed
  // translate step moves the text into the target language, so anything else
  // still has to be scripted as the language that was dictated.
  try {
    const outputLanguage =
      result.transcription.route_kind === "translation"
        ? (translationApplied ? s.translationTargetLanguage : s.translationSourceLanguage) || "auto"
        : s.preferredLanguage;
    const scripted = await applyChineseScript(
      finalTranscription.text,
      resolveChineseScriptTarget(outputLanguage, s.chineseScriptPreference, finalTranscription.text)
    );
    if (scripted !== finalTranscription.text) {
      const updated = await window.electronAPI.updateTranscriptionText(id, scripted, rawText);
      if (updated.success && updated.transcription) {
        finalTranscription = updated.transcription;
      }
    }
  } catch {
    // Conversion failed — keep the text as transcribed
  }

  return { status: "ok", transcription: finalTranscription, cleanupError };
}
