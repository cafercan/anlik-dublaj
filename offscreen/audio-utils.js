/**
 * Pure audio helpers shared by the offscreen pipeline (and its tests).
 */
(function (root) {
  /** Root-mean-square level of a 16-bit PCM chunk, in 0..1 */
  function rmsLevel(int16) {
    if (int16.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < int16.length; i++) {
      const v = int16[i] / 0x8000;
      sum += v * v;
    }
    return Math.sqrt(sum / int16.length);
  }

  function bytesToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  /** Decode base64 little-endian 16-bit PCM into Float32 samples */
  function base64PcmToFloat32(base64) {
    const bin = atob(base64);
    const out = new Float32Array(bin.length >> 1);
    for (let i = 0; i < out.length; i++) {
      let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      if (v >= 0x8000) v -= 0x10000;
      out[i] = v / 0x8000;
    }
    return out;
  }

  /**
   * Decides which 100 ms chunks are worth sending. Silence is not sent (saves
   * quota while a video is paused or quiet); a short hangover keeps word
   * endings, and the last silent chunk is replayed when sound resumes so
   * speech onsets are not clipped.
   */
  class SilenceGate {
    constructor({ threshold = 0.004, hangoverChunks = 8 } = {}) {
      this.threshold = threshold;
      this.hangoverChunks = hangoverChunks;
      this.quietCount = Infinity; // start closed until sound arrives
      this.lastSilent = null;
    }

    /**
     * @returns {{send: ArrayBuffer[], streamEnded: boolean}} chunks to send now,
     *   and whether the gate just closed (so the caller can signal end of audio)
     */
    push(int16) {
      const loud = rmsLevel(int16) >= this.threshold;
      if (loud) {
        const send = [];
        if (this.quietCount > this.hangoverChunks && this.lastSilent) send.push(this.lastSilent);
        send.push(int16.buffer);
        this.quietCount = 0;
        this.lastSilent = null;
        return { send, streamEnded: false };
      }

      this.quietCount++;
      if (this.quietCount <= this.hangoverChunks) {
        return { send: [int16.buffer], streamEnded: false };
      }
      this.lastSilent = int16.buffer;
      return { send: [], streamEnded: this.quietCount === this.hangoverChunks + 1 };
    }
  }

  const api = { rmsLevel, bytesToBase64, base64PcmToFloat32, SilenceGate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AudioUtils = api;
})(typeof self !== "undefined" ? self : globalThis);
