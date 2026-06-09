/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Track } from "../types";
import WaveformVisualizer from "./WaveformVisualizer";
import { 
  VolumeX, 
  Volume2, 
  Trash2, 
  Edit2, 
  Check, 
  Mic, 
  Clock, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface TrackCardProps {
  key?: string | number;
  track: Track;
  isRecording?: boolean;
  isPlaying?: boolean;
  color?: string; // "emerald" | "amber" | "sky"
  onDelete: (id: string) => void | Promise<void>;
  onUpdate: (id: string, updates: Partial<Track>) => void | Promise<void>;
}

export default function TrackCard({
  track,
  isRecording = false,
  isPlaying = false,
  color = "emerald",
  onDelete,
  onUpdate,
}: TrackCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(track.name);

  const handleSaveName = () => {
    if (tempName.trim()) {
      onUpdate(track.id, { name: tempName.trim() });
    }
    setIsEditingName(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    }
  };

  const formatDuration = (seconds: number) => {
    return `${seconds.toFixed(1)}s`;
  };

  return (
    <div 
      id={`track-card-${track.id}`}
      className="track-card bg-[#15171D] hover:bg-[#15171D]/90 border border-white/10 hover:border-white/20 p-4 rounded-xl flex flex-col lg:flex-row items-stretch gap-4 transition-all duration-200 shadow-md relative"
    >
      {/* Decorative vertical line indicating active state */}
      <div 
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
          track.isSolo 
            ? "bg-amber-400" 
            : track.isMuted 
            ? "bg-white/10" 
            : "bg-red-600"
        }`} 
      />

      {/* SECTION 1: Technical Meta and Track Name */}
      <div className="flex flex-col justify-between w-full lg:w-48 shrink-0 space-y-2 pl-2">
        <div className="flex items-center justify-between">
          {isEditingName ? (
            <div className="flex items-center gap-1.5 w-full">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={handleKeyPress}
                className="bg-black/55 text-xs text-white px-2 py-1 rounded border border-red-500/30 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 w-full font-sans"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                className="p-1 bg-red-600 text-white rounded hover:bg-red-500 cursor-pointer"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group max-w-[85%]">
              <span className="font-semibold text-xs text-[#E0E0E0] truncate pr-1">
                {track.name}
              </span>
              <button
                onClick={() => {
                  setTempName(track.name);
                  setIsEditingName(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-white text-white/40 transition cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Delete Trigger */}
          <button
            onClick={() => onDelete(track.id)}
            className="text-white/30 hover:text-red-500 p-1 rounded-md transition hover:bg-white/5 shrink-0 self-start cursor-pointer"
            title="Delete this layer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Audio Meta specs */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-white/30 font-semibold uppercase tracking-wider">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-white/20" />
            <span>{formatDuration(track.duration)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Mic className="w-3 h-3 text-white/20" />
            <span>Mono WAV</span>
          </div>
        </div>

        {/* Dynamic Offset Fine Tuner - real-time delay slider */}
        <div className="pt-1.5 border-t border-white/5">
          <label className="flex justify-between items-center text-[9px] font-mono font-bold uppercase tracking-wider text-white/40 mb-1">
            <span className="flex items-center gap-1">
              <SlidersHorizontal className="w-2.5 h-2.5 text-red-500" /> Track Sync Delay
            </span>
            <span className={`${track.latencyOffset !== 0 ? "text-amber-400 font-bold" : ""}`}>
              {track.latencyOffset > 0 ? `+${track.latencyOffset}` : track.latencyOffset} ms
            </span>
          </label>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => onUpdate(track.id, { latencyOffset: Math.max(-150, track.latencyOffset - 10) })}
              className="text-white/30 hover:text-white p-0.5 hover:bg-white/5 rounded cursor-pointer"
              title="Shift left (earlier)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min="-150"
              max="150"
              step="5"
              value={track.latencyOffset}
              onChange={(e) => onUpdate(track.id, { latencyOffset: parseInt(e.target.value, 10) })}
              className="w-full accent-red-600 h-1 bg-black/45 rounded-lg cursor-pointer max-w-[124px]"
            />
            <button 
              onClick={() => onUpdate(track.id, { latencyOffset: Math.min(150, track.latencyOffset + 10) })}
              className="text-white/30 hover:text-white p-0.5 hover:bg-white/5 rounded cursor-pointer"
              title="Shift right (later)"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Centered Audio Waveform Container */}
      <div className="flex-1 min-w-0 flex items-center">
        <WaveformVisualizer
          audioData={track.audioData}
          isRecording={isRecording}
          isMuted={track.isMuted}
          color={color}
        />
      </div>

      {/* SECTION 3: Mix parameters (Volume, Mute, Solo) */}
      <div className="flex flex-row lg:flex-col justify-between lg:justify-center items-center w-full lg:w-32 shrink-0 gap-3 border-t lg:border-t-0 lg:border-l border-white/5 pt-3 lg:pt-0 lg:pl-3">
        {/* Toggle Switches */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* MUTE button */}
          <button
            onClick={() => onUpdate(track.id, { isMuted: !track.isMuted })}
            className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-all border cursor-pointer ${
              track.isMuted
                ? "bg-red-600/10 text-red-500 border-red-600/30 shadow-sm"
                : "bg-white/5 text-white/40 border-white/5 hover:text-[#E0E0E0] hover:bg-white/10"
            }`}
            title="Mute track"
          >
            M
          </button>

          {/* SOLO button */}
          <button
            onClick={() => onUpdate(track.id, { isSolo: !track.isSolo })}
            className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-all border cursor-pointer ${
              track.isSolo
                ? "bg-amber-400 text-black border-amber-400/50 shadow-md font-extrabold"
                : "bg-white/5 text-white/40 border-white/5 hover:text-[#E0E0E0] hover:bg-white/10"
            }`}
            title="Solo track"
          >
            S
          </button>
        </div>

        {/* Volume Linear Fader */}
        <div className="flex items-center gap-2 flex-1 lg:w-full">
          <button
            onClick={() => onUpdate(track.id, { isMuted: !track.isMuted })}
            className="text-white/30 hover:text-white transition shrink-0 cursor-pointer"
          >
            {track.isMuted || track.volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-500/80" />
            ) : (
              <Volume2 className="w-4 h-4 text-white/50" />
            )}
          </button>
          
          <div className="flex flex-col flex-1">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={track.volume}
              onChange={(e) => onUpdate(track.id, { volume: parseFloat(e.target.value) })}
              className="w-full accent-red-600 h-1 bg-black/45 rounded-lg cursor-pointer"
            />
            <span className="text-[9px] font-mono text-white/40 font-semibold text-right mt-1">
              {Math.round(track.volume * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
