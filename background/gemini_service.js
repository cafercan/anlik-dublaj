/**
 * Gemini 3.5 Live Translate - model constants and API key validation.
 * The model only accepts AUDIO input (text input is not supported), so the
 * actual streaming lives in offscreen/offscreen.js where tab audio is captured.
 */
export const LIVE_TRANSLATE_MODEL = "gemini-3.5-live-translate-preview";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Validate the API key by fetching the Live Translate model's metadata
 */
export async function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 5) {
    return { valid: false, message: "Lütfen geçerli bir API anahtarı girin." };
  }

  try {
    const res = await fetch(`${API_BASE}/${LIVE_TRANSLATE_MODEL}?key=${encodeURIComponent(apiKey.trim())}`);
    if (res.ok) {
      const model = await res.json();
      return {
        valid: true,
        message: `API Anahtarı doğrulandı! Model: ${model.displayName || LIVE_TRANSLATE_MODEL}`,
        modelId: LIVE_TRANSLATE_MODEL
      };
    }
    const err = await res.json().catch(() => ({}));
    if (res.status === 404) {
      return { valid: false, message: `Bu anahtar '${LIVE_TRANSLATE_MODEL}' modeline erişemiyor (bölge/önizleme erişimi gerekebilir).` };
    }
    return { valid: false, message: err?.error?.message || `HTTP ${res.status}` };
  } catch (error) {
    return { valid: false, message: `Bağlantı hatası: ${error.message}` };
  }
}
