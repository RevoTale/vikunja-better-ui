export function silentWave(): Buffer {
  const samples = 8_000;
  const wave = Buffer.alloc(44 + samples * 2);
  wave.write("RIFF", 0);
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write("WAVEfmt ", 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(8_000, 24);
  wave.writeUInt32LE(16_000, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write("data", 36);
  wave.writeUInt32LE(samples * 2, 40);
  return wave;
}
