/**
 * Gemini Live Translate - Background Service Worker
 * Owns the offscreen document that captures tab audio and streams it to
 * Gemini 3.5 Live Translate, and relays transcripts to the tab's overlay.
 */
import { validateApiKey } from './gemini_service.js';

const DEFAULT_SETTINGS = {
  apiKey: "",
  isEnabled: false,
  originalVolume: 15,       // Original tab audio level while translating
  translatedVolume: 100,    // Gemini's Turkish voice level
  showOverlay: true,
  targetLang: "tr"
};

// Only one tab can be captured at a time. Mirrored to storage.session because
// the service worker is killed when idle while the offscreen capture keeps running.
let activeTabId = null;
const activeTabReady = chrome.storage.session.get({ activeTabId: null })
  .then((s) => { activeTabId = s.activeTabId; });

function setActiveTab(tabId) {
  activeTabId = tabId;
  chrome.storage.session.set({ activeTabId: tabId });
}

async function loadSettings() {
  const items = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...items };
}

async function saveSettings(newSettings) {
  await chrome.storage.sync.set(newSettings);
}

chrome.runtime.onInstalled.addListener(async () => {
  // Drop keys left over from the old text-based implementation
  await chrome.storage.sync.remove(["activeTabs", "model", "speechRate", "speechPitch", "selectedVoice"]);
  await saveSettings(await loadSettings());
  updateBadge(false);
});

function updateBadge(isActive) {
  chrome.action.setBadgeText({ text: isActive ? "ON" : "" });
  if (isActive) chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
}

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: "offscreen/offscreen.html",
    reasons: ["USER_MEDIA", "AUDIO_PLAYBACK"],
    justification: "Sekme sesini yakalayıp Gemini Live Translate'e akıtmak ve Türkçe sesi çalmak"
  });
}

async function closeOffscreen() {
  if (await chrome.offscreen.hasDocument()) {
    await chrome.offscreen.closeDocument();
  }
}

// Content scripts run on arbitrary sites: never hand them the API key and only
// let them change these keys.
const TAB_WRITABLE_KEYS = ["originalVolume", "translatedVolume", "showOverlay"];

function publicSettings(settings) {
  const { apiKey, ...rest } = settings;
  return rest;
}

function pick(obj, keys) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([k]) => keys.includes(k)));
}

function sendToTab(tabId, message) {
  if (tabId == null) return;
  chrome.tabs.sendMessage(tabId, message).catch(() => {});
}

async function startTranslation(tabId, streamId) {
  const settings = await loadSettings();
  if (!settings.apiKey) throw new Error("Gemini API anahtarı girilmemiş.");

  if (activeTabId !== null) await stopTranslation();

  await ensureOffscreen();
  setActiveTab(tabId);
  await chrome.runtime.sendMessage({
    target: "offscreen",
    action: "START_CAPTURE",
    streamId,
    settings
  });
  updateBadge(true);
  sendToTab(tabId, { action: "SET_ACTIVE_STATE", isActive: true, settings: publicSettings(settings) });
}

async function stopTranslation() {
  const tabId = activeTabId;
  setActiveTab(null);
  await closeOffscreen();
  updateBadge(false);
  sendToTab(tabId, { action: "SET_ACTIVE_STATE", isActive: false });
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await activeTabReady;
  if (tabId === activeTabId) stopTranslation();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === "offscreen") return false;
  activeTabReady.then(() => handleMessage(message, sender, sendResponse));
  return true;
});

function handleMessage(message, sender, sendResponse) {
  // Events coming from the offscreen document
  if (message.source === "offscreen") {
    if (message.action === "TRANSCRIPT" || message.action === "STATUS") {
      sendToTab(activeTabId, message);
    }
    if (message.action === "FATAL") {
      sendToTab(activeTabId, { action: "STATUS", status: "error", text: message.error });
      stopTranslation();
    }
    return false;
  }

  const action = message.action;

  if (action === "GET_SETTINGS") {
    loadSettings().then((settings) => {
      const tabId = sender.tab ? sender.tab.id : message.tabId;
      const visible = sender.tab ? publicSettings(settings) : settings;
      sendResponse({ ...visible, isTabActive: tabId != null && tabId === activeTabId });
    });
    return true;
  }

  if (action === "SAVE_SETTINGS") {
    (async () => {
      const changes = sender.tab ? pick(message.settings, TAB_WRITABLE_KEYS) : message.settings;
      await saveSettings(changes);
      // Live volume changes go straight to the audio graph
      chrome.runtime.sendMessage({ target: "offscreen", action: "UPDATE_SETTINGS", settings: changes }).catch(() => {});
      sendToTab(activeTabId, { action: "SETTINGS_UPDATED", settings: publicSettings(changes) });
      sendResponse({ success: true });
    })();
    return true;
  }

  if (action === "SET_TAB_ACTIVE") {
    (async () => {
      try {
        // A tab may only switch itself off; starting needs the popup's tabCapture grant
        if (sender.tab && message.isActive) throw new Error("Sekmeden başlatma yapılamaz.");
        const tabId = sender.tab ? sender.tab.id : message.tabId;
        if (sender.tab && tabId !== activeTabId) {
          sendResponse({ success: true });
          return;
        }
        if (message.isActive) {
          await startTranslation(tabId, message.streamId);
        } else {
          await stopTranslation();
        }
        sendResponse({ success: true });
      } catch (err) {
        console.error("Çeviri başlatılamadı:", err);
        await stopTranslation();
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (action === "VALIDATE_KEY") {
    validateApiKey(message.apiKey).then(sendResponse);
    return true;
  }

  return false;
}
