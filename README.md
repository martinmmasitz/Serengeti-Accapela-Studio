# Serengeti Acapella Studio

A lightweight, high-fidelity, client-side digital audio workstation (DAW) and vocal recording application built in React, TypeScript, and Tailwind CSS. It is specifically designed to allow vocalists, beatboxers, and acapella artists to record layered vocal tracks with precise synchronization, latency calibration, and real-time mixing consoles.

---

## 🎙️ Low-Latency Audio Core & Sync Strategy

Recording vocal layers in browsers is prone to internal and hardware round-trip audio latency (from the microphone capsule, through system sound drivers, into browser buffers, and back to the speakers/headphones). To address this, Serengeti Acapella Studio implements a two-fold synchronization strategy:

1. **Hardware Latency Compensation**: The app includes a global calibrator (baseline offset: 80ms) which allows users to slide or measure their system's latency. When recording completes, newly captured tracks are automatically shifted backward in time by the configured calibration factor.
2. **Micro-Alignment Offsets**: In addition to the global calibration offset, every individual track contains a dedicated tuning slider allowing +/- 150ms dynamic shifts. This lets the user correct minor timing mistakes or artistic offsets (e.g. rushing or dragging a backing vocal) in real-time.
3. **Web Audio Time Scheduling**: Track playback is triggered concurrently using a single browser `AudioContext` mapped directly to standard float timing intervals relative to `audioContext.currentTime`, completely preventing timing drift common in standard HTML5 audio tags.

---

## 🏛️ Project Directory Structure

```text
/
├── index.html                  # Core single-page HTML container with viewport and page title
├── metadata.json               # Sandbox camera, microphone, and system declarations
├── package.json                # Project dependencies and deployment build scripts
├── README.md                   # Complete architectural and operations manual (this file)
└── src/
    ├── main.tsx                # Client-side React bootloader
    ├── index.css               # Import for global Tailwind utility styles
    ├── types.ts                # TypeScript definition schemas for Tracks, Project metadata, etc.
    ├── App.tsx                 # Core Dashboard and Project Management entry shell
    ├── services/
    │   └── db.ts               # IndexedDB durable binary storage engine
    ├── utils/
    │   └── audio.ts            # WAV 16-Bit encoder, Offline Audio Context mixdowns, and Peak Extraction
    └── components/
        ├── WaveformVisualizer.tsx # Multi-bar static peaks visualization & real-time recording ripples
        ├── LatencyCalibrator.tsx # Tick metronome and global compensation faders
        ├── TrackCard.tsx         # Track channel stripping with Mute/Solo routing, offsets, and faders
        └── AcapellaWorkstation.tsx # Multi-track transport panel, overdub records, and merge-compiler
```

---

## 💾 Local Storage Database Schema

Large binary files (like wav data) easily overflow browser standard `localStorage` limits (5MB-10MB). Serengeti Acapella Studio avoids this by using client-side **IndexedDB**, yielding gigabytes of persistent sandbox capability for audio raw data.

### Object Store: `projects`
* **Key Path**: `id` (String UUID)
* **Metadata properties**:
  * `name`: string
  * `description`: string
  * `createdAt`: string (ISO-timestamp)
  * `tracks`: Array of `Track` objects

### Model Interface Schema: `Track` (from `types.ts`)
```typescript
export interface Track {
  id: string;             // Unique segment UUID
  name: string;           // Editable vocal label 
  blobUrl: string;        // Dynamic browser object URL mapping binary WAV buffers
  audioData?: ArrayBuffer;// Stored raw 16-bit PCM WAV binary array (Stored in IndexedDB)
  duration: number;       // Layer duration in seconds
  volume: number;         // Current fader level (0.0 to 1.0)
  isMuted: boolean;       // Mute state
  isSolo: boolean;        // Solo priority routing state
  latencyOffset: number;  // Dynamic delay offset in milliseconds (+/- 150ms)
  createdAt: string;      // Date string
}
```

---

## 📦 Master Features & Operational Guidelines

- **Project Management**: Create brand new vocal sessions, attach optional descriptions, search existing workspaces instantly, and safely delete completed projects from IndexedDB storage.
- **Layered Recording / Overdubbing**: Record multiple vocal pieces on top of each other. During vocal tracking, previous layers play back through the browser soundstage so you can sing exactly in time. Note: **Always wear headphones** to prevent background music from leaking into the active microphone!
- **Visual Waveforms**: Track cards extract peak-amplitude arrays to paint vertical bar shapes. During active tracking, the visualizer shifts into a pulsing waveform mimicking live vocal waves.
- **Master Mixing Console**: Adjust volume faders of single tracks or attenuate global decibels using the Master Console slider to avoid digital clip distortion. Toggle **Mute (M)** or **Solo (S)** nodes to isolate components.
- **Full Blend Master Export**: Blending tracks involves spinning up an `OfflineAudioContext`, scheduling sources together based on their precise offsets and gains, rendering the mixdown, encoding the buffer into a 44.1kHz mono WAV file, and initiating an automatic browser download.

---

## 🚀 Running, Linting, & Building the Applet

The application is fully configured to compile and run behind standard Node.js/Vite systems.

### Installation of Node Packages
Ensure all pre-configured client-side packages are loaded:
```bash
npm install
```

### Development Execution
Start the reactive dev server on default Port 3000:
```bash
npm run dev
```

### Static Build compilation
To construct standard distribution code files under `/dist`:
```bash
npm run build
```

### Code Integrity Checks
To assert standard compilation types and prevent code regression:
```bash
npm run lint
```
