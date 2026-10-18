/**
 * Gemini Live Translate - Options Page Script
 */
document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("opt-api-key");
  const toggleKeyBtn = document.getElementById("opt-toggle-key");
  const testKeyBtn = document.getElementById("opt-test-key-btn");
  const keyStatus = document.getElementById("opt-key-status");
  const modelSelect = document.getElementById("opt-model");

  const origVolSlider = document.getElementById("opt-orig-vol");
  const origVolVal = document.getElementById("opt-orig-val");
  const transVolSlider = document.getElementById("opt-trans-vol");
  const transVolVal = document.getElementById("opt-trans-val");
  const speedSlider = document.getElementById("opt-speed");
  const speedVal = document.getElementById("opt-speed-val");
  const voiceSelect = document.getElementById("opt-voice");
  const testVoiceBtn = document.getElementById("opt-test-voice-btn");
  const showOverlayCheckbox = document.getElementById("opt-show-overlay");

  // Load voices
  function populateVoices(selectedURI) {
    const voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '<option value="">Otomatik (En Uygun Türkçe Ses)</option>';
    
    const turkishVoices = voices.filter(v => v.lang && (v.lang.startsWith("tr") || v.lang.includes("TR")));
    
    const listToUse = turkishVoices.length > 0 ? turkishVoices : voices;
    listToUse.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} (${v.lang})`;
      if (v.voiceURI === selectedURI) opt.selected = true;
      voiceSelect.appendChild(opt);
    });
  }

  populateVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      populateVoices(voiceSelect.value);
    };
  }

  // Load saved settings
  chrome.runtime.sendMessage({ action: "GET_SETTINGS" }, (settings) => {
    if (!settings) return;

    if (settings.apiKey) apiKeyInput.value = settings.apiKey;
    modelSelect.value = "gemini-3.5-live-translate-preview";

    origVolSlider.value = settings.originalVolume ?? 15;
    origVolVal.textContent = `${settings.originalVolume ?? 15}%`;

    transVolSlider.value = settings.translatedVolume ?? 100;
    transVolVal.textContent = `${settings.translatedVolume ?? 100}%`;

    speedSlider.value = settings.speechRate ?? 1.1;
    speedVal.textContent = `${settings.speechRate ?? 1.1}x`;

    showOverlayCheckbox.checked = settings.showOverlay !== false;

    if (settings.selectedVoice) {
      populateVoices(settings.selectedVoice);
    }
  });

  // Toggle key visibility
  toggleKeyBtn.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleKeyBtn.textContent = "Gizle";
    } else {
      apiKeyInput.type = "password";
      toggleKeyBtn.textContent = "Göster";
    }
  });

  // Validate & Save API key
  testKeyBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    const model = modelSelect.value;

    if (!key) {
      showStatus("Lütfen bir API anahtarı girin.", "error");
      return;
    }

    // 1. ANINDA KALICI KAYDET - Tıklandığı an diskte saklanır
    chrome.storage.sync.set({ apiKey: key, model: model });
    chrome.runtime.sendMessage({
      action: "SAVE_SETTINGS",
      settings: { apiKey: key, model: model }
    });

    showStatus("Google AI Studio bağlantısı test ediliyor...", "");
    testKeyBtn.disabled = true;

    chrome.runtime.sendMessage({
      action: "VALIDATE_KEY",
      apiKey: key,
      model: model
    }, (res) => {
      testKeyBtn.disabled = false;
      if (res && res.valid) {
        showStatus("✓ Başarılı: API Anahtarı doğrulandı ve kalıcı olarak kaydedildi!", "success");
      } else {
        showStatus(`⚠️ API Anahtarı kaydedildi. Google uyarısı: ${res?.message || "Doğrulanamadı"}`, "error");
      }
    });
  });

  function showStatus(text, type) {
    keyStatus.textContent = text;
    keyStatus.className = `status-msg ${type}`;
  }

  // Auto-save sliders & select inputs
  origVolSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    origVolVal.textContent = `${val}%`;
    chrome.runtime.sendMessage({ action: "SAVE_SETTINGS", settings: { originalVolume: val } });
  });

  transVolSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10);
    transVolVal.textContent = `${val}%`;
    chrome.runtime.sendMessage({ action: "SAVE_SETTINGS", settings: { translatedVolume: val } });
  });

  speedSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    speedVal.textContent = `${val.toFixed(1)}x`;
    chrome.runtime.sendMessage({ action: "SAVE_SETTINGS", settings: { speechRate: val } });
  });

  modelSelect.addEventListener("change", (e) => {
    chrome.storage.sync.set({ model: e.target.value });
    chrome.runtime.sendMessage({ action: "SAVE_SETTINGS", settings: { model: e.target.value } });
  });

  apiKeyInput.addEventListener("change", () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      chrome.storage.sync.set({ apiKey: key });
      chrome.runtime.sendMessage({ action: "SAVE_SETTINGS", settings: { apiKey: key } });
    }
  });

  voiceSelect.addEventListener("change", (e) => {
    chrome.runtime.sendMessage({ action: "SAVE_SETTINGS", settings: { selectedVoice: e.target.value } });
  });

  showOverlayCheckbox.addEventListener("change", (e) => {
    chrome.runtime.sendMessage({ action: "SAVE_SETTINGS", settings: { showOverlay: e.target.checked } });
  });

  // Test voice button
  testVoiceBtn.addEventListener("click", () => {
    window.speechSynthesis.cancel();

    const sampleText = "Merhaba! Anlık Dublaj Türkçe seslendirme sistemi başarıyla çalışıyor.";
    const utterance = new SpeechSynthesisUtterance(sampleText);

    const voices = window.speechSynthesis.getVoices();
    const selectedURI = voiceSelect.value;
    if (selectedURI) {
      const match = voices.find(v => v.voiceURI === selectedURI);
      if (match) utterance.voice = match;
    } else {
      const trVoice = voices.find(v => v.lang && (v.lang.startsWith("tr") || v.lang.includes("TR")));
      if (trVoice) utterance.voice = trVoice;
    }

    utterance.volume = parseInt(transVolSlider.value, 10) / 100;
    utterance.rate = parseFloat(speedSlider.value);
    utterance.lang = "tr-TR";

    window.speechSynthesis.speak(utterance);
  });
});
