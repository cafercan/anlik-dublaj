/**
 * AudioWorklet that downsamples captured tab audio to 16 kHz mono and posts
 * 100 ms chunks of 16-bit little-endian PCM, as Gemini Live expects.
 */
const TARGET_RATE = 16000;
const CHUNK_SAMPLES = TARGET_RATE / 10; // 100 ms

class PcmDownsampler extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE;
    this.pos = 0;                 // fractional read position into incoming stream
    this.out = new Int16Array(CHUNK_SAMPLES);
    this.outIdx = 0;
    this.acc = 0;
    this.accCount = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const frames = input[0].length;

    for (let i = 0; i < frames; i++) {
      let s = 0;
      for (let c = 0; c < input.length; c++) s += input[c][i];
      this.acc += s / input.length;
      this.accCount++;

      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        // Box-filter average of the source frames covering this output sample
        const v = Math.max(-1, Math.min(1, this.acc / this.accCount));
        this.out[this.outIdx++] = v < 0 ? v * 0x8000 : v * 0x7fff;
        this.acc = 0;
        this.accCount = 0;

        if (this.outIdx === CHUNK_SAMPLES) {
          this.port.postMessage(this.out.buffer, [this.out.buffer]);
          this.out = new Int16Array(CHUNK_SAMPLES);
          this.outIdx = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("pcm-downsampler", PcmDownsampler);
