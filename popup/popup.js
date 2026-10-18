/**
 * Anlık Dublaj - Popup controller (the extension's only settings screen)
 */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  const masterToggle = $("master-toggle");
  const statusDesc = $("status-desc");
  const footerDot = $("footer-dot");
  const apiAlert = $("api-alert");
  const targetLang = $("target-lang");
  const origVolSlider = $("orig-vol-slider");
  const origVolVal = $("orig-vol-val");
  const transVolSlider = $("trans-vol-slider");
  const transVolVal = $("trans-vol-val");
  const showOverlayCheckbox = $("show-overlay-checkbox");
  const apiChevron = $("api-chevron");
  const apiContent = $("api-content");
  const apiKeyInput = $("api-key-input");
  const toggleKeyVisibility = $("toggle-key-visibility");
  const saveKeyBtn = $("save-key-btn");
  const keyStatusMsg = $("key-status-msg");

  let previousOrigVol = 15;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTabId = tab?.id ?? null;

  $("version-badge").textContent = `v${chrome.runtime.getManifest().version}`;
  chrome.commands.getAll((commands) => {
    const toggle = commands.find((c) => c.name === "toggle-translation");
    $("shortcut-key").textContent = toggle?.shortcut || "atanmadı";
  });

  for (const { code, name } of window.TARGET_LANGUAGES) {
    targetLang.add(new Option(name, code));
  }

  function save(settings) {
    chrome.runtime.sendMessage({ action: "SAVE_SETTINGS", settings });
  }

  function setApiSectionOpen(open) {
    apiContent.classList.toggle("hidden", !open);
    apiChevron.classList.toggle("collapsed", !open);
  }

  function showKeyStatus(msg, type) {
    keyStatusMsg.textContent = msg;
    keyStatusMsg.className = `key-status-message ${type}`;
  }

  function updateStatusUI(isActive, errorText) {
    footerDot.classList.toggle("active", isActive);
    if (errorText) {
      statusDesc.textContent = errorText;
      statusDesc.style.color = "#ef4444";
    } else if (isActive) {
      statusDesc.textContent = "🟢 Aktif - sekme sesi çevriliyor";
      statusDesc.style.color = "#10b981";
    } else {
      statusDesc.textContent = "Bu sekmedeki sesi çevirmek için açın";
      statusDesc.style.color = "#94a3b8";
    }
  }

  function setOrigVolume(val) {
    origVolSlider.value = val;
    origVolVal.textContent = `${val}%`;
  }

  chrome.runtime.sendMessage({ action: "GET_SETTINGS", tabId: currentTabId }, (settings) => {
    if (!settings) return;
    setOrigVolume(settings.originalVolume);
    previousOrigVol = settings.originalVolume || 15;
    transVolSlider.value = settings.translatedVolume;
    transVolVal.textContent = `${settings.translatedVolume}%`;
    targetLang.value = settings.targetLang;
    showOverlayCheckbox.checked = settings.showOverlay !== false;

    apiKeyInput.value = settings.apiKey || "";
    apiAlert.hidden = !!settings.apiKey;
    if (!settings.apiKey) setApiSectionOpen(true);

    masterToggle.checked = !!settings.isTabActive;
    updateStatusUI(masterToggle.checked);
  });

  masterToggle.addEventListener("change", async () => {
    const isActive = masterToggle.checked;

    if (isActive && apiKeyInput.value.trim().length < 5) {
      masterToggle.checked = false;
      apiAlert.hidden = false;
      setApiSectionOpen(true);
      apiKeyInput.focus();
      showKeyStatus("Lütfen önce geçerli bir Gemini API anahtarı kaydedin.", "error");
      return;
    }

    // Tab capture must be granted from this user gesture (popup click)
    let streamId;
    if (isActive) {
      try {
        streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: currentTabId });
      } catch (err) {
        masterToggle.checked = false;
        updateStatusUI(false, `Sekme sesi yakalanamadı: ${err.message}`);
        return;
      }
    }

    updateStatusUI(isActive);
    chrome.runtime.sendMessage(
      { action: "SET_TAB_ACTIVE", tabId: currentTabId, isActive, streamId },
      (res) => {
        if (res && !res.success) {
          masterToggle.checked = false;
          updateStatusUI(false, `Hata: ${res.error}`);
        }
      }
    );
  });

  targetLang.addEventListener("change", () => {
    save({ targetLang: targetLang.value });
    if (masterToggle.checked) {
      statusDesc.textContent = "Dil değişikliği çeviri yeniden açıldığında geçerli olur";
    }
  });

  origVolSlider.addEventListener("input", () => {
    const val = parseInt(origVolSlider.value, 10);
    origVolVal.textContent = `${val}%`;
    if (val > 0) previousOrigVol = val;
    save({ originalVolume: val });
  });

  $("mute-orig-btn").addEventListener("click", () => {
    const current = parseInt(origVolSlider.value, 10);
    const target = current === 0 ? previousOrigVol || 15 : 0;
    if (current > 0) previousOrigVol = current;
    setOrigVolume(target);
    save({ originalVolume: target });
  });

  transVolSlider.addEventListener("input", () => {
    const val = parseInt(transVolSlider.value, 10);
    transVolVal.textContent = `${val}%`;
    save({ translatedVolume: val });
  });

  showOverlayCheckbox.addEventListener("change", () => {
    save({ showOverlay: showOverlayCheckbox.checked });
  });

  $("api-section-header").addEventListener("click", () => {
    setApiSectionOpen(apiContent.classList.contains("hidden"));
  });

  $("go-to-key-btn").addEventListener("click", () => {
    setApiSectionOpen(true);
    apiKeyInput.focus();
  });

  toggleKeyVisibility.addEventListener("click", () => {
    const hidden = apiKeyInput.type === "password";
    apiKeyInput.type = hidden ? "text" : "password";
    toggleKeyVisibility.textContent = hidden ? "🙈" : "👁️";
  });

  saveKeyBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showKeyStatus("Lütfen bir API anahtarı girin.", "error");
      return;
    }

    save({ apiKey: key });
    showKeyStatus("Doğrulanıyor...", "");
    saveKeyBtn.disabled = true;

    chrome.runtime.sendMessage({ action: "VALIDATE_KEY", apiKey: key }, (res) => {
      saveKeyBtn.disabled = false;
      if (res?.valid) {
        showKeyStatus(`✓ ${res.message}`, "success");
        apiAlert.hidden = true;
      } else {
        showKeyStatus(
          `⚠️ Anahtar kaydedildi ama doğrulanamadı: ${res?.message || "Bilinmeyen hata"}`,
          "error"
        );
      }
    });
  });
});
