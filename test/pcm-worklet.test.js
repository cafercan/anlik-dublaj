const test = require("node:test");
const assert = require("node:assert/strict");

function loadWorklet(rate) {
  globalThis.sampleRate = rate;
  globalThis.AudioWorkletProcessor = class {
    constructor() {
      this.port = { posted: [], postMessage: (buf) => this.port.posted.push(new Int16Array(buf)) };
    }
  };
  delete require.cache[require.resolve("../offscreen/pcm-worklet.js")];
  return require("../offscreen/pcm-worklet.js");
}

function feed(proc, channels, totalFrames, fn) {
  for (let start = 0; start < totalFrames; start += 128) {
    const block = Array.from({ length: channels }, (_, c) =>
      Float32Array.from({ length: 128 }, (_, i) => fn(start + i, c))
    );
    proc.process([block]);
  }
}

for (const rate of [48000, 44100]) {
  test(`downsamples ${rate} Hz to 100 ms chunks of 16 kHz PCM`, () => {
    const { PcmDownsampler, CHUNK_SAMPLES } = loadWorklet(rate);
    const proc = new PcmDownsampler();
    feed(proc, 2, rate, () => 0.5); // one second of audio

    const chunks = proc.port.posted;
    assert.ok(chunks.length >= 9 && chunks.length <= 10, `got ${chunks.length} chunks`);
    for (const c of chunks) {
      assert.equal(c.length, CHUNK_SAMPLES);
      // 0.5 * 0x7fff = 16383.5, truncated by Int16Array
      for (const s of c) assert.equal(s, 16383);
    }
  });
}

test("mixes channels down to mono and clamps out-of-range input", () => {
  const { PcmDownsampler } = loadWorklet(48000);
  const proc = new PcmDownsampler();
  feed(proc, 2, 48000, (_, c) => (c === 0 ? 3 : 3)); // way above 1.0
  for (const s of proc.port.posted[0]) assert.equal(s, 0x7fff);

  const proc2 = new PcmDownsampler();
  feed(proc2, 2, 48000, (_, c) => (c === 0 ? 1 : -1)); // cancels out
  for (const s of proc2.port.posted[0]) assert.equal(s, 0);
});
