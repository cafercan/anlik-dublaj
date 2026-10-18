/**
 * Gemini Live Translate - Content Script
 * Shows the overlay and live transcripts streamed from the offscreen pipeline.
 * Audio capture, translation and playback all happen in the offscreen document.
 */
(function() {
  let isActive = false;
  let showOverlay = true;
  let inputLine = "";
  let outputLine = "";

  function sendSettings(settings) {
    chrome.runtime.sendMessage({ action: "SAVE_SETTINGS", settings });
  }

  function setupOverlayCallbacks() {
    const overlay = window.GeminiOverlay;
    overlay.onOriginalVolumeChange = (vol) => sendSettings({ originalVolume: vol });
    overlay.onTranslatedVolumeChange = (vol) => sendSettings({ translatedVolume: vol });
    overlay.onClose = () => chrome.runtime.sendMessage({ action: "SET_TAB_ACTIVE", isActive: false });
  }

  function activate(settings) {
    isActive = true;
    inputLine = "";
    outputLine = "";
    showOverlay = settings?.showOverlay !== false;
    if (!showOverlay) return;
    const overlay = window.GeminiOverlay;
    overlay.mount();
    overlay.setVolumes(settings?.originalVolume, settings?.translatedVolume);
    overlay.setStatus("translating");
    overlay.updateContent("Video dinleniyor...", "Anlık Dublaj Devrede");
    overlay.show();
  }

  function deactivate() {
    isActive = false;
    window.GeminiOverlay.hide();
  }

  // Keep only the tail of a growing transcript so the box stays readable
  function tail(text, max = 160) {
    return text.length > max ? "…" + text.slice(-max) : text;
  }

  function handleTranscript(message) {
    if (!isActive || !showOverlay) return;
    const overlay = window.GeminiOverlay;
    if (message.kind === "input") {
      inputLine += message.text;
    } else if (message.kind === "output") {
      outputLine += message.text;
      overlay.setStatus("speaking");
    } else if (message.kind === "turnComplete") {
      overlay.setStatus("idle");
      inputLine = "";
      outputLine = "";
      return;
    }
    overlay.updateContent(tail(inputLine.trim()), tail(outputLine.trim()));
  }

  chrome.runtime.onMessage.addListener((message) => {
    switch (message.action) {
      case "SET_ACTIVE_STATE":
        message.isActive ? activate(message.settings) : deactivate();
        break;
      case "TRANSCRIPT":
        handleTranscript(message);
        break;
      case "STATUS":
        if (isActive && showOverlay) {
          window.GeminiOverlay.setStatus(message.status);
          if (message.text) window.GeminiOverlay.updateContent(undefined, message.text);
        }
        break;
      case "SETTINGS_UPDATED":
        if (message.settings.showOverlay !== undefined) {
          showOverlay = message.settings.showOverlay;
          if (isActive) showOverlay ? activate(message.settings) : window.GeminiOverlay.hide();
        }
        window.GeminiOverlay.setVolumes(message.settings.originalVolume, message.settings.translatedVolume);
        break;
    }
    return false;
  });

  setupOverlayCallbacks();
  chrome.runtime.sendMessage({ action: "GET_SETTINGS" }, (settings) => {
    if (settings?.isTabActive) activate(settings);
  });
})();
