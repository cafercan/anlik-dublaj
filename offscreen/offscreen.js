/**
 * Gemini Live Translate - Offscreen audio pipeline
 * tab audio -> 16 kHz PCM -> Gemini Live WebSocket -> 24 kHz Turkish PCM -> speakers
 */
const MODEL = "models/gemini-3.5-live-translate-preview";
const WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const OUTPUT_RATE = 24000;
const MAX_RECONNECTS = 5;

let settings = null;
let stream = null;
let captureCtx = null;
let originalGain = null;
let playbackCtx = null;
let translatedGain = null;
let nextPlayTime = 0;
let ws = null;
let wsReady = false;
let running = false;
let reconnects = 0;

function emit(action, payload = {}) {
  chrome.runtime.sendMessage({ source: "offscreen", action, ...payload }).catch(() => {});
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function playPcm24k(base64) {
  const bin = atob(base64);
  const samples = new Int16Array(bin.length >> 1);
  for (let i = 0; i < samples.length; i++) {
    const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    samples[i] = v;
  }
  const buffer = playbackCtx.createBuffer(1, samples.length, OUTPUT_RATE);
  const ch = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 0x8000;

  const src = playbackCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(translatedGain);
  // Queue chunks back to back; if we fell behind, restart slightly ahead
  const now = playbackCtx.currentTime;
  if (nextPlayTime < now) nextPlayTime = now + 0.05;
  src.start(nextPlayTime);
  nextPlayTime += buffer.duration;
}

function connectSocket() {
  wsReady = false;
  ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(settings.apiKey.trim())}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      setup: {
        model: MODEL,
        // Transcription options live on setup itself, not inside generationConfig
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        generationConfig: {
          responseModalities: ["AUDIO"],
          translationConfig: {
            targetLanguageCode: settings.targetLang || "tr",
            echoTargetLanguage: false
          }
        }
      }
    }));
  };

  ws.onmessage = async (event) => {
    const raw = typeof event.data === "string" ? event.data : await event.data.text();
    let data;
    try { data = JSON.parse(raw); } catch (_) { return; }

    if (data.setupComplete) {
      wsReady = true;
      reconnects = 0;
      emit("STATUS", { status: "idle", text: "Video dinleniyor..." });
      return;
    }

    const sc = data.serverContent;
    if (sc) {
      for (const part of sc.modelTurn?.parts || []) {
        if (part.inlineData?.data) playPcm24k(part.inlineData.data);
      }
      if (sc.inputTranscription?.text) {
        emit("TRANSCRIPT", { kind: "input", text: sc.inputTranscription.text });
      }
      if (sc.outputTranscription?.text) {
        emit("TRANSCRIPT", { kind: "output", text: sc.outputTranscription.text });
      }
      if (sc.turnComplete) emit("TRANSCRIPT", { kind: "turnComplete" });
    }

    // Server is about to end the session; open a fresh one
    if (data.goAway) ws.close(1000, "goAway");
  };

  ws.onclose = (event) => {
    wsReady = false;
    if (!running) return;
    if (reconnects++ >= MAX_RECONNECTS) {
      emit("FATAL", { error: `Gemini bağlantısı kapandı: ${event.reason || "kod " + event.code}` });
      return;
    }
    // Setup errors (bad key, unknown model, ...) arrive as close reasons
    if (event.code !== 1000) {
      emit("STATUS", { status: "error", text: `Bağlantı koptu (${event.reason || event.code}), yeniden bağlanılıyor...` });
    }
    setTimeout(() => running && connectSocket(), 1000 * reconnects);
  };
}

async function startCapture(streamId, initialSettings) {
  settings = initialSettings;
  running = true;

  stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
    video: false
  });

  // Capturing mutes the tab, so we play the original audio back ourselves
  captureCtx = new AudioContext();
  const source = captureCtx.createMediaStreamSource(stream);
  originalGain = captureCtx.createGain();
  originalGain.gain.value = settings.originalVolume / 100;
  source.connect(originalGain).connect(captureCtx.destination);

  await captureCtx.audioWorklet.addModule("pcm-worklet.js");
  const worklet = new AudioWorkletNode(captureCtx, "pcm-downsampler");
  worklet.port.onmessage = (e) => {
    if (wsReady && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        realtimeInput: { audio: { data: toBase64(e.data), mimeType: "audio/pcm;rate=16000" } }
      }));
    }
  };
  source.connect(worklet);

  playbackCtx = new AudioContext({ sampleRate: OUTPUT_RATE });
  translatedGain = playbackCtx.createGain();
  translatedGain.gain.value = settings.translatedVolume / 100;
  translatedGain.connect(playbackCtx.destination);

  emit("STATUS", { status: "translating", text: "Gemini'ye bağlanılıyor..." });
  connectSocket();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== "offscreen") return false;

  if (message.action === "START_CAPTURE") {
    startCapture(message.streamId, message.settings).catch((err) => {
      emit("FATAL", { error: `Ses yakalanamadı: ${err.message}` });
    });
  }

  if (message.action === "UPDATE_SETTINGS" && settings) {
    Object.assign(settings, message.settings);
    if (originalGain && message.settings.originalVolume !== undefined) {
      originalGain.gain.value = message.settings.originalVolume / 100;
    }
    if (translatedGain && message.settings.translatedVolume !== undefined) {
      translatedGain.gain.value = message.settings.translatedVolume / 100;
    }
  }
  return false;
});
