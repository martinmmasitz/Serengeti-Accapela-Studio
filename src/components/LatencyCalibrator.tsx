/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sliders, HelpCircle, Volume2, Info, Check } from "lucide-react";

interface LatencyCalibratorProps {
  currentLatency: number;
  onSaveLatency: (value: number) => void;
  onClose: () => void;
}

export default function LatencyCalibrator({
  currentLatency,
  onSaveLatency,
  onClose,
}: LatencyCalibratorProps) {
  const [latency, setLatency] = useState(currentLatency);
  const [isPlayingTestClick, setIsPlayingTestClick] = useState(false);

  // Synthesize a precise 1000Hz metronome beep to let users test playback latency
  const playCalibratorBeep = () => {
    try {
      setIsPlayingTestClick(true);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1 kHz beep

      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.15);

      setTimeout(() => {
        setIsPlayingTestClick(false);
        audioCtx.close();
      }, 200);
    } catch (err) {
      console.warn("Failed to play calibration beep", err);
      setIsPlayingTestClick(false);
    }
  };

  const handleSave = () => {
    onSaveLatency(latency);
    onClose();
  };

  return (
    <div 
      id="latency-calibrator-modal"
      className="p-6 bg-[#15171D] border border-white/10 rounded-xl max-w-md w-full shadow-2xl relative overflow-hidden text-[#E0E0E0]"
    >
      <div className="absolute top-0 left-0 w-full h-[3px] bg-red-600" />
      
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-red-600/10 text-red-500 rounded-lg">
          <Sliders className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold tracking-tight text-white uppercase">Audio Latency Calibration</h3>
      </div>

      <p className="text-white/40 text-xs mb-5 leading-relaxed font-semibold uppercase tracking-wider">
        Browsers introduce a minor delay when recording vocals over other tracks. Standardize alignment by shifting newly recorded clips backward automatically.
      </p>

      {/* Info Card */}
      <div className="bg-red-950/10 border border-red-500/10 rounded-lg p-3.5 mb-5 flex gap-3 text-xs text-[#E0E0E0]">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
        <div className="space-y-1 text-white/50 font-semibold uppercase tracking-wider text-[11px]">
          <span className="font-bold text-white block mb-0.5">Typical latency speeds:</span>
          • Wired headphones: <strong className="text-red-500 font-bold">40ms – 80ms</strong> (Best)<br />
          • Built-in speakers: <strong className="text-red-500 font-bold">80ms – 120ms</strong><br />
          • Bluetooth earbuds: <strong className="text-amber-400 font-bold">180ms – 320ms</strong> (Not recommended)
        </div>
      </div>

      {/* Beep Test Button */}
      <div className="flex justify-between items-center bg-black/45 p-3 rounded-lg border border-white/5 mb-5">
        <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-white/30">
          Click metronome synchronization
        </div>
        <button
          onClick={playCalibratorBeep}
          disabled={isPlayingTestClick}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
            isPlayingTestClick
              ? "bg-red-600 text-white"
              : "bg-white/5 hover:bg-white/10 text-[#E0E0E0]"
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          {isPlayingTestClick ? "Beep!" : "Play Tick"}
        </button>
      </div>

      {/* Latency Slider */}
      <div className="mb-6 space-y-2">
        <div className="flex justify-between text-xs font-mono text-white/40 font-semibold uppercase tracking-wider">
          <span>Alignment compensation</span>
          <span className="text-red-500 font-bold">{latency} ms</span>
        </div>
        <input
          type="range"
          min="0"
          max="250"
          step="5"
          value={latency}
          onChange={(e) => setLatency(parseInt(e.target.value, 10))}
          className="w-full accent-red-600 h-1.5 bg-black/45 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-white/20 font-mono font-medium">
          <span>0ms (No shift)</span>
          <span>125ms</span>
          <span>250ms (Deep shift)</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={onClose}
          className="flex-grow py-2.5 px-4 bg-white/5 hover:bg-white/10 font-bold text-xs uppercase tracking-wider rounded-lg transition duration-150 text-[#E0E0E0] cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-grow py-2.5 px-4 bg-red-600 hover:bg-red-500 font-bold text-xs uppercase tracking-wider rounded-lg text-white flex items-center justify-center gap-1.5 transition duration-150 cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          Apply Offset
        </button>
      </div>
    </div>
  );
}
