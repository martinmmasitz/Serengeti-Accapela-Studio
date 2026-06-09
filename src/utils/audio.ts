/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Track } from "../types";

/**
 * Encodes an AudioBuffer into an ArrayBuffer containing a standard, production-ready 16-bit Mono WAV file.
 */
export function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = 1; // Standard mono recording as per audio requirements
  const bitsPerSample = 16;
  const format = 1; // Linear PCM

  // Get raw float 32 sample data (downmixing to mono by averaging channels if necessary)
  let floatSamples: Float32Array;
  if (audioBuffer.numberOfChannels === 1) {
    floatSamples = audioBuffer.getChannelData(0);
  } else {
    // Average left and right
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    floatSamples = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      floatSamples[i] = (left[i] + right[i]) / 2;
    }
  }

  const sampleCount = floatSamples.length;
  const dataByteLength = sampleCount * 2; // 2 bytes per sample (16 bit)
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  // Write RIFF Header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(view, 8, "WAVE");

  // Write format chunk "fmt "
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);             // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true);         // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);    // NumChannels
  view.setUint32(24, sampleRate, true);     // SampleRate
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // ByteRate
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);             // BlockAlign
  view.setUint16(34, bitsPerSample, true);  // BitsPerSample

  // Write data chunk header "data"
  writeString(view, 36, "data");
  view.setUint32(40, dataByteLength, true); // Subchunk2Size

  // Write 16-bit signed PCM samples
  let offset = 44;
  for (let i = 0; i < sampleCount; i++) {
    // Clamp sample amplitude between -1.0 and 1.0 to prevent audio clipping distortion
    let s = Math.max(-1, Math.min(1, floatSamples[i]));
    
    // Scale to standard short range (-32768 to 32767)
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Creates an AudioBuffer out of a recorded WAV ArrayBuffer.
 */
export async function getAudioBufferFromData(
  audioData: ArrayBuffer,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  // Use custom slice to get a fresh copy of array buffer since decodeAudioData detaches buffers
  const copy = audioData.slice(0);
  return await audioContext.decodeAudioData(copy);
}

/**
 * Generates N visual peak data points between 0.0 and 1.0 from a WAV binary array.
 */
export async function generateWaveformPeaks(
  audioData: ArrayBuffer,
  pointsCount = 120
): Promise<number[]> {
  try {
    const tempContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await getAudioBufferFromData(audioData, tempContext);
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / pointsCount);
    const peaks: number[] = [];

    for (let i = 0; i < pointsCount; i++) {
      const start = i * step;
      let maxVal = 0;
      for (let j = 0; j < step; j++) {
        const val = channelData[start + j];
        if (val !== undefined) {
          const abs = Math.abs(val);
          if (abs > maxVal) {
            maxVal = abs;
          }
        }
      }
      peaks.push(maxVal);
    }

    // Free temp audio contexts
    await tempContext.close();

    // Normalize peaks to create a balanced full-screen waveform visualizer
    const maxPeak = Math.max(...peaks);
    if (maxPeak > 0) {
      return peaks.map((p) => p / maxPeak);
    }
    return peaks;
  } catch (error) {
    console.error("Error drawing sound peak waveform details", error);
    // Return flat dummy values in case of decode failure
    return Array.from({ length: pointsCount }, () => 0.1);
  }
}

/**
 * Renders multiple separate audio tracks into a single mixed output AudioBuffer,
 * aligning and scheduling tracks based on volume, mute/solo flags, and dynamic offsets.
 */
export async function compileMultitrackMix(
  tracks: Track[],
  targetSampleRate = 44100
): Promise<AudioBuffer> {
  const activeContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // 1. Resolve Solo/Mute logic to identify which tracks should actually output sound
  const anySolo = tracks.some((t) => t.isSolo);
  const playableTracks = tracks.filter((t) => {
    if (t.isMuted) return false;
    if (anySolo && !t.isSolo) return false;
    return !!t.audioData;
  });

  if (playableTracks.length === 0) {
    // Return empty 1-second buffer filled with silent samples
    const emptyBuffer = activeContext.createBuffer(1, targetSampleRate, targetSampleRate);
    await activeContext.close();
    return emptyBuffer;
  }

  // 2. Load the binary track buffers and compute maximum length in seconds.
  // Effective start offset is positive latencyOffset (delay). Track relative end is duration + offset.
  const decodedBuffers = await Promise.all(
    playableTracks.map(async (t) => {
      const buf = await getAudioBufferFromData(t.audioData!, activeContext);
      const effectiveDelay = Math.max(0, t.latencyOffset / 1000);
      const totalDuration = buf.duration + effectiveDelay;
      return { track: t, buffer: buf, totalDuration, effectiveDelay };
    })
  );

  const maxDuration = Math.max(...decodedBuffers.map((db) => db.totalDuration), 0.5);
  const totalSamples = Math.ceil(maxDuration * targetSampleRate);

  // 3. Setup OfflineAudioContext for extremely fast server-side like mixdown rendering.
  const offlineCtx = new OfflineAudioContext(1, totalSamples, targetSampleRate);

  decodedBuffers.forEach(({ buffer, track, effectiveDelay }) => {
    const sourceNode = offlineCtx.createBufferSource();
    sourceNode.buffer = buffer;

    // Use custom volume gain node for exact blending ratios
    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = track.volume;

    sourceNode.connect(gainNode);
    gainNode.connect(offlineCtx.destination);

    // Schedule start at offset
    sourceNode.start(effectiveDelay);
  });

  const mixedBuffer = await offlineCtx.startRendering();
  await activeContext.close();

  return mixedBuffer;
}
