const test = require("node:test");
const assert = require("node:assert/strict");
const {
  rmsLevel,
  bytesToBase64,
  base64PcmToFloat32,
  SilenceGate
} = require("../offscreen/audio-utils.js");

const CHUNK = 1600; // 100 ms at 16 kHz

function chunk(amplitude) {
  const a = new Int16Array(CHUNK);
  for (let i = 0; i < CHUNK; i++) a[i] = Math.round(amplitude * 0x7fff * Math.sin(i / 3));
  return a;
}

test("rmsLevel is 0 for silence and ~0.707 for a full-scale square wave", () => {
  assert.equal(rmsLevel(new Int16Array(CHUNK)), 0);
  const square = new Int16Array(CHUNK).map((_, i) => (i % 2 ? 0x7fff : -0x8000));
  assert.ok(Math.abs(rmsLevel(square) - 1) < 0.001);
  assert.ok(Math.abs(rmsLevel(chunk(1)) - Math.SQRT1_2) < 0.01);
});

test("PCM survives a base64 round trip, including negative samples", () => {
  const pcm = Int16Array.from([0, 1, -1, 0x7fff, -0x8000, 1234, -4321]);
  const floats = base64PcmToFloat32(bytesToBase64(pcm.buffer));
  assert.deepEqual(
    Array.from(floats, (f) => Math.round(f * 0x8000)),
    Array.from(pcm)
  );
});

test("SilenceGate sends nothing until sound arrives", () => {
  const gate = new SilenceGate();
  for (let i = 0; i < 20; i++) {
    const r = gate.push(chunk(0));
    assert.equal(r.send.length, 0);
    assert.equal(r.streamEnded, false);
  }
});

test("SilenceGate replays the last silent chunk when speech starts", () => {
  const gate = new SilenceGate();
  const quiet = chunk(0);
  gate.push(quiet);
  const loud = chunk(0.5);
  const r = gate.push(loud);
  assert.deepEqual(r.send, [quiet.buffer, loud.buffer]);
});

test("SilenceGate keeps sending during the hangover, then ends the stream once", () => {
  const gate = new SilenceGate({ hangoverChunks: 3 });
  gate.push(chunk(0.5));
  const results = Array.from({ length: 6 }, () => gate.push(chunk(0)));
  assert.deepEqual(
    results.map((r) => r.send.length),
    [1, 1, 1, 0, 0, 0]
  );
  assert.deepEqual(
    results.map((r) => r.streamEnded),
    [false, false, false, true, false, false]
  );
});
