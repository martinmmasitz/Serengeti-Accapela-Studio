/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Track {
  id: string;
  name: string;
  blobUrl: string; // Web URL generated from audio binary for active playing
  audioData?: ArrayBuffer; // Stored WAV binary data in DB
  duration: number; // Duration in seconds
  volume: number; // Volume slider value (0.0 to 1.0)
  isMuted: boolean;
  isSolo: boolean;
  latencyOffset: number; // Latency alignment in milliseconds (+/- offset)
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  tracks: Track[];
}

export interface LatencySettings {
  roundtripLatency: number; // User calibration delay in ms
}
