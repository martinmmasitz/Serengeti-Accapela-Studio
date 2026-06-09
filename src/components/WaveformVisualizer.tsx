/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import { generateWaveformPeaks } from "../utils/audio";

interface WaveformVisualizerProps {
  audioData?: ArrayBuffer;
  isRecording?: boolean;
  isMuted?: boolean;
  color?: string; // e.g. "red" | "blue" | "zinc"
}

export default function WaveformVisualizer({
  audioData,
  isRecording = false,
  isMuted = false,
  color = "red",
}: WaveformVisualizerProps) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const animationRef = useRef<number | null>(null);
  const [micLevel, setMicLevel] = useState<number>(0.1);

  // Parse peak heights if audioData changes
  useEffect(() => {
    if (audioData) {
      setLoading(true);
      generateWaveformPeaks(audioData, 80)
        .then((data) => {
          setPeaks(data);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    } else {
      setPeaks([]);
    }
  }, [audioData]);

  // Simulate an active pulsating wave indicator during recording if no real-time stream is bound
  useEffect(() => {
    if (isRecording) {
      const pulse = () => {
        setMicLevel(Math.random() * 0.7 + 0.3);
        animationRef.current = requestAnimationFrame(pulse);
      };
      pulse();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording]);

  const colorMap = {
    red: {
      bar: isMuted ? "bg-white/10" : "bg-red-500",
      glow: "shadow-red-500/10",
      text: "text-red-400",
    },
    blue: {
      bar: isMuted ? "bg-white/10" : "bg-blue-500",
      glow: "shadow-blue-500/10",
      text: "text-blue-400",
    },
    zinc: {
      bar: isMuted ? "bg-white/10" : "bg-zinc-400",
      glow: "shadow-zinc-500/10",
      text: "text-zinc-400",
    },
  };

  const currentTheme = colorMap[color as keyof typeof colorMap] || colorMap.red;

  if (isRecording) {
    // Generate organic pseudo-sine-wave bars that dynamically shift to imitate a live input
    return (
      <div 
        id="waveform-recording-state"
        className="h-16 w-full bg-black/55 rounded-lg flex items-center justify-center gap-[2px] px-3 overflow-hidden border border-red-500/30 shadow-inner"
      >
        {Array.from({ length: 80 }).map((_, i) => {
          // Compound wave formulas to create an acoustic ripple look
          const sinBase = Math.sin((i / 80) * Math.PI * 4 + Date.now() * 0.01);
          const noise = Math.sin((i / 80) * Math.PI * 12 + Date.now() * 0.03) * 0.2;
          const amplitude = Math.abs(sinBase + noise) * micLevel;
          const barHeight = Math.max(3, Math.min(100, Math.floor(amplitude * 85)));

          return (
            <div
              key={i}
              className="w-[3px] bg-red-500 rounded-full transition-all duration-75 animate-pulse"
              style={{ height: `${barHeight}%` }}
            />
          );
        })}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-950/20 to-transparent pointer-events-none" />
        <span className="absolute text-[10px] uppercase tracking-widest font-mono text-red-500 bg-[#15171D] border border-red-500/20 px-2 py-0.5 rounded animate-pulse shadow-md">
          ● RECORDING INPUT
        </span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-16 w-full bg-[#15171D] rounded-lg flex items-center justify-center border border-white/10">
        <div className="flex space-x-1 items-center">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce delay-75" />
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce delay-150" />
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce delay-300" />
        </div>
      </div>
    );
  }

  if (peaks.length === 0) {
    return (
      <div className="h-16 w-full bg-black/30 rounded-lg flex items-center justify-center border border-white/5 border-dashed">
        <span className="text-white/20 text-xs font-mono">Empty timeline track - tap record to start</span>
      </div>
    );
  }

  return (
    <div 
      id="waveform-display"
      className={`h-16 w-full bg-black/35 rounded-lg flex items-center justify-between gap-[1px] px-3 overflow-hidden border border-white/10 transition-all duration-200 ${currentTheme.glow}`}
    >
      {peaks.map((val, idx) => {
        // Height formula
        const barHeight = Math.max(4, Math.floor(val * 100));
        return (
          <div
            key={idx}
            className={`w-0.5 md:w-1 rounded-full transition-all duration-300 ${currentTheme.bar}`}
            style={{ height: `${barHeight}%` }}
          />
        );
      })}
    </div>
  );
}
