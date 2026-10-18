/**
 * Gemini Live Translate - Popup Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const masterToggle = document.getElementById("master-toggle");
  const statusDesc = document.getElementById("status-desc");
  const modelBadge = document.getElementById("model-badge");
  const footerDot = document.getElementById("footer-dot");
  const apiAlert = document.getElementById("api-alert");
  const goToSettingsBtn = document.getElementById("go-to-settings-btn");

  const origVolSlider = document.getElementById("orig-vol-slider");
  const origVolVal = document.getElementById("orig-vol-val");
  const muteOrigBtn = document.getElementById("mute-orig-btn");
  const transVolSlider = document.getElementById("trans-vol-slider");
  const transVolVal = document.getElementById("trans-vol-val");
  const speedSlider = document.getElementById("speed-slider");
  const speedVal = document.getElementById("speed-val");
  const voiceSelect = document.getElementById("voice-select");
  const showOverlayCheckbox = document.getElementById("show-overlay-checkbox");

  const apiSectionHeader = document.getElementById("api-section-header");
  const apiChevron = document.getElementById("api-chevron");
  const apiContent = document.getElementById("api-content");
  const apiKeyInput = document.getElementById("api-key-input");
  const toggleKeyVisibility = document.getElementById("toggle-key-visibility");
  const modelSelect = document.getElementById("model-select");
  const saveKeyBtn = document.getElementById("save-key-btn");
  const keyStatusMsg = document.getElementById("key-status-msg");

  let currentTabId = null;
  let previousOrigVol = 15;

  // 1. Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    currentTabId = tab.id;
  }

  // 2. Load system voices
  function populateVoices(selectedURI) {
    const voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '<option value="">Otomatik (En Uygun Türkçe Ses)</option>';
    
    // Filter Turkish voices or all voices
    const turkishVoices = voices.filter(v => v.lang && (v.lang.startsWith("tr") || v.lang.includes("TR")));
    
    if (turkishVoices.length > 0) {
      turkishVoices.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.voiceURI;
        opt.textContent = `${v.name} (${v.lang})`;
        if (v.voiceURI === selectedURI) opt.selected = true;
        voiceSelect.appendChild(opt);
      });
    } else {
      // Fallback: list all system voices
      voices.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.voiceURI;
        opt.textContent = `${v.name} (${v.lang})`;
        if (v.voiceURI === selectedURI) opt.selected = true;
        voiceSelect.appendChild(opt);
      });
    }
  }

  populateVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      populateVoices(voiceSelect.value);
    };
  }

  // 3. Fetch current stored settings
  chrome.runtime.sendMessage({ action: "GET_SETTINGS", tabId: currentTabId }, (settings) => {
    if (!settings) return;

    // Apply values to UI
    origVolSlider.value = settings.originalVolume ?? 15;
    origVolVal.textContent = `${settings.originalVolume ?? 15}%`;
    previousOrigVol = settings.originalVolume || 15;

    transVolSlider.value = settings.translatedVolume ?? 100;
    transVolVal.textContent = `${settings.translatedVolume ?? 100}%`;

    speedSlider.value = settings.speechRate ?? 1.1;
    speedVal.textContent = `${settings.speechRate ?? 1.1}x`;

    showOverlayCheckbox.checked = settings.showOverlay !== false;

    if (settings.apiKey) {
      apiKeyInput.value = settings.apiKey;
      apiAlert.style.display = "none";
    } else {
      apiAlert.style.display = "flex";
      // Expand settings if no API key is set
      apiContent.classList.remove("hidden");
      apiChevron.classList.remove("collapsed");
    }

    modelSelect.value = "gemini-3.5-live-translate-preview";
    modelBadge.textContent = "Gemini 3.5 Live Translate";

    if (settings.selectedVoice) {
      populateVoices(settings.selectedVoice);
    }

    // Tab active status
    const isActive = !!settings.isTabActive;
    masterToggle.checked = isActive;
    updateStatusUI(isActive);
  });

  function updateStatusUI(isActive) {
    if (isActive) {
      statusDesc.textContent = "🟢 Çeviri Aktif - Video dinleniyor";
      statusDesc.style.color = "#10b981";
      footerDot.classList.add("active");
    } else {
      statusDesc.textContent = "Sekmedeki videoyu dinlemek için açın";
      statusDesc.style.color = "#94a3b8";
      footerDot.classList.remove("active");
    }
  }

  // 4. Master Toggle Event
  masterToggle.addEventListener("change", async () => {
    const isActive = masterToggle.checked;

    // Check if API key exists
    if (isActive && (!apiKeyInput.value || apiKeyInput.value.trim().length < 5)) {
      masterToggle.checked = false;
      apiAlert.style.display = "flex";
      apiContent.classList.remove("hidden");
      apiChevron.classList.remove("collapsed");
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
        statusDesc.textContent = `Sekme sesi yakalanamadı: ${err.message}`;
        statusDesc.style.color = "#ef4444";
        return;
      }
    }

    updateStatusUI(isActive);

    chrome.runtime.sendMessage({
      action: "SET_TAB_ACTIVE",
      tabId: currentTabId,
      isActive: isActive,
      streamId
    }, (res) => {
      if (res && !res.success) {
        masterToggle.checked = false;
        updateStatusUI(false);
        statusDesc.textContent = `Hata: ${res.error}`;
        statusDesc.style.color = "#ef4444";
      }
    });
  });

  // 5. Volume Sliders
  origVolSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    origVolVal.textContent = `${val}%`;
    if (val > 0) previousOrigVol = val;
    chrome.runtime.sendMessage({
      action: "SAVE_SETTINGS",
      settings: { originalVolume: val }
    });
  });

  muteOrigBtn.addEventListener("click", () => {
    let current = parseInt(origVolSlider.value, 10);
    let target = 0;
    if (current === 0) {
      target = previousOrigVol > 0 ? previousOrigVol : 15;
    } else {
      previousOrigVol = current;
      target = 0;
    }
    origVolSlider.value = target;
    origVolVal.textContent = `${target}%`;
    chrome.runtime.sendMessage({
      action: "SAVE_SETTINGS",
      settings: { originalVolume: target }
    });
  });

  transVolSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    transVolVal.textContent = `${val}%`;
    chrome.runtime.sendMessage({
      action: "SAVE_SETTINGS",
      settings: { translatedVolume: val }
    });
  });

  speedSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    speedVal.textContent = `${val.toFixed(1)}x`;
    chrome.runtime.sendMessage({
      action: "SAVE_SETTINGS",
      settings: { speechRate: val }
    });
  });

  voiceSelect.addEventListener("change", (e) => {
    const selected = e.target.value;
    chrome.runtime.sendMessage({
      action: "SAVE_SETTINGS",
      settings: { selectedVoice: selected }
    });
  });

  showOverlayCheckbox.addEventListener("change", (e) => {
    chrome.runtime.sendMessage({
      action: "SAVE_SETTINGS",
      settings: { showOverlay: e.target.checked }
    });
  });

  // 6. Collapsible API section
  apiSectionHeader.addEventListener("click", () => {
    apiContent.classList.toggle("hidden");
    apiChevron.classList.toggle("collapsed");
  });

  goToSettingsBtn.addEventListener("click", () => {
    apiContent.classList.remove("hidden");
    apiChevron.classList.remove("collapsed");
    apiKeyInput.focus();
  });

  toggleKeyVisibility.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleKeyVisibility.textContent = "🙈";
    } else {
      apiKeyInput.type = "password";
      toggleKeyVisibility.textContent = "👁️";
    }
  });

  modelSelect.addEventListener("change", () => {
    chrome.runtime.sendMessage({
      action: "SAVE_SETTINGS",
      settings: { model: modelSelect.value }
    });
    chrome.storage.sync.set({ model: modelSelect.value });
    modelBadge.textContent = modelSelect.value;
  });

  // Auto-save key on change
  apiKeyInput.addEventListener("change", () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      chrome.storage.sync.set({ apiKey: key });
      chrome.runtime.sendMessage({ action: "SAVE_SETTINGS", settings: { apiKey: key } });
    }
  });

  // 7. Save & Validate API Key
  saveKeyBtn.addEventListener("click", async () => {
    const key = apiKeyInput.value.trim();
    const model = modelSelect.value;

    if (!key) {
      showKeyStatus("Lütfen bir API anahtarı girin.", "error");
      return;
    }

    // 1. ANINDA KALICI KAYDET - Kullanıcı bastığı an saklanır
    chrome.storage.sync.set({ apiKey: key, model: model });
    chrome.runtime.sendMessage({
      action: "SAVE_SETTINGS",
      settings: { apiKey: key, model: model }
    });

    showKeyStatus("Doğrulanıyor...", "");
    saveKeyBtn.disabled = true;

    chrome.runtime.sendMessage({
      action: "VALIDATE_KEY",
      apiKey: key,
      model: model
    }, (res) => {
      saveKeyBtn.disabled = false;
      if (res && res.valid) {
        showKeyStatus("✓ API Anahtarı başarıyla kaydedildi ve doğrulandı!", "success");
        apiAlert.style.display = "none";
        modelBadge.textContent = model;
      } else {
        showKeyStatus(`⚠️ API Anahtarı kaydedildi. Google uyarısı: ${res?.message || "Bilinmeyen hata"}`, "error");
      }
    });
  });

  function showKeyStatus(msg, type) {
    keyStatusMsg.textContent = msg;
    keyStatusMsg.className = `key-status-message ${type}`;
  }
});
