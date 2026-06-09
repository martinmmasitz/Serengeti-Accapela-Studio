/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Project, Track, LatencySettings } from "../types";
import TrackCard from "./TrackCard";
import LatencyCalibrator from "./LatencyCalibrator";
import { DatabaseService } from "../services/db";
import { compileMultitrackMix, encodeWav, getAudioBufferFromData } from "../utils/audio";
import { 
  Play, 
  Square, 
  Mic, 
  Download, 
  Settings, 
  Volume2, 
  ArrowLeft, 
  Plus, 
  Info,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";

interface AcapellaWorkstationProps {
  project: Project;
  onBack: () => void;
  onProjectUpdated: () => void;
}

export default function AcapellaWorkstation({
  project,
  onBack,
  onProjectUpdated,
}: AcapellaWorkstationProps) {
  // State elements
  const [tracks, setTracks] = useState<Track[]>(project.tracks);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [latencySettings, setLatencySettings] = useState<LatencySettings>({ roundtripLatency: 80 });
  const [showCalibrator, setShowCalibrator] = useState(false);
  const [recProgressSeconds, setRecProgressSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio nodes and tracking references
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<{ source: AudioBufferSourceNode; gainNode: GainNode }[]>([]);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackIntervalRef = useRef<number | null>(null);
  
  // Recording tracking references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // Synchronize internal state list with the project property list when it changes
  useEffect(() => {
    setTracks(project.tracks);
  }, [project]);

  // Clean up all play cycles when component unmounts
  useEffect(() => {
    return () => {
      stopAllAudio();
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  /**
   * Main playback: Decodes and plays all unmuted/soloed tracks simultaneously
   */
  const playAllTracks = async () => {
    try {
      if (isPlaying) {
        stopAllAudio();
        return;
      }

      setErrorMessage(null);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      // Handle solo vs mute track routing
      const anySolo = tracks.some((t) => t.isSolo);
      const activePlayableTracks = tracks.filter((t) => {
        if (t.isMuted) return false;
        if (anySolo && !t.isSolo) return false;
        return !!t.audioData;
      });

      if (activePlayableTracks.length === 0) {
        setErrorMessage("No recorded audio tracks are active to play.");
        return;
      }

      // Keep a record of nodes so we can trigger standard clean stop routines
      activeSourcesRef.current = [];
      playbackStartTimeRef.current = audioCtx.currentTime;

      const decodePromises = activePlayableTracks.map(async (track) => {
        const audioBuf = await getAudioBufferFromData(track.audioData!, audioCtx);
        
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuf;

        const gainNode = audioCtx.createGain();
        // Compute volume matching both specific track slider and master fader
        gainNode.gain.setValueAtTime(track.volume * masterVolume, audioCtx.currentTime);

        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // Calculate offset (adjusting for user manual track sync alignments)
        const delayInSec = Math.max(0, track.latencyOffset / 1000);

        return { source, gainNode, delayInSec };
      });

      const scheduledNodes = await Promise.all(decodePromises);

      // Trigger all synchronized play triggers at once on Web Audio thread
      scheduledNodes.forEach(({ source, gainNode, delayInSec }) => {
        source.start(audioCtx.currentTime + delayInSec);
        activeSourcesRef.current.push({ source, gainNode });
      });

      setIsPlaying(true);

      // Start tick updates to animate timeline scrubber
      setCurrentTime(0);
      playbackIntervalRef.current = window.setInterval(() => {
        if (audioContextRef.current) {
          const runTime = audioContextRef.current.currentTime - playbackStartTimeRef.current;
          setCurrentTime(runTime);
          
          // Auto shutoff if timeline exceeds longest track
          const maxDur = Math.max(...tracks.map((t) => t.duration + Math.max(0, t.latencyOffset/1000)), 3);
          if (runTime >= maxDur) {
            stopAllAudio();
          }
        }
      }, 50);

    } catch (err) {
      console.error("Failed to play acapella multi-grid setup", err);
      setErrorMessage("Sound device error: Failed to initiate browser playback engine.");
      stopAllAudio();
    }
  };

  /**
   * Stop track playback
   */
  const stopAllAudio = () => {
    setIsPlaying(false);
    setCurrentTime(0);

    // Stop and clear dynamic nodes
    if (activeSourcesRef.current.length > 0) {
      activeSourcesRef.current.forEach(({ source }) => {
        try {
          source.stop();
        } catch (_) {}
      });
      activeSourcesRef.current = [];
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;

    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  };

  /**
   * Begin recording a new layered vocal track
   */
  const startLayerRecording = async () => {
    try {
      setErrorMessage(null);
      stopAllAudio();

      // Ask for microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // Turn off heavy compression for raw acapella accuracy
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      // Start backplane playback of existing layers so user can hear cues in headphones!
      // This plays only if we have at least one valid audio track in the project.
      const hasTracksToGuides = tracks.some((t) => !!t.audioData && !t.isMuted);
      if (hasTracksToGuides) {
        // Trigger playing shortly
        setTimeout(() => {
          playAllTracks();
        }, 100);
      }

      // Initialize recording chunks list
      recordedChunksRef.current = [];
      const options = { mimeType: "audio/webm" };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        // Fallback for Safari/Firefox
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          // Stop stream tracks
          stream.getTracks().forEach((track) => track.stop());

          // Gather recording duration in seconds
          const totalRecLength = recProgressSeconds;

          // Convert collected sound snippets to standard decoded AudioBuffer
          const combinedBlob = new Blob(recordedChunksRef.current, { type: recorder.mimeType });
          const rawBuffer = await combinedBlob.arrayBuffer();

          // Initialize local context to decode browser's native compression formats (webm/ogg/mp4)
          const decodingContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          let decodedAudio: AudioBuffer;
          try {
            decodedAudio = await decodingContext.decodeAudioData(rawBuffer);
          } catch (decodeErr) {
            console.error("Direct decode failed, attempting fallback conversion", decodeErr);
            throw new Error("Unable to parse microphone stream. Clean speech required.");
          }
          await decodingContext.close();

          // Encode high quality mono WAV representation
          const wavData = encodeWav(decodedAudio);

          // Build a default track naming offset based on current list index
          const nextIndex = tracks.length + 1;
          const newTrack: Track = {
            id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `Vocal Layer ${nextIndex}`,
            blobUrl: URL.createObjectURL(new Blob([wavData], { type: "audio/wav" })),
            audioData: wavData,
            duration: decodedAudio.duration,
            volume: 0.85,
            isMuted: false,
            isSolo: false,
            // Apply standard roundtrip latency offset shifting backward automatically
            latencyOffset: -latencySettings.roundtripLatency,
            createdAt: new Date().toISOString(),
          };

          // Save back into local list and persist to database store
          const updatedTracks = [...tracks, newTrack];
          setTracks(updatedTracks);

          const updatedProject = {
            ...project,
            tracks: updatedTracks,
          };
          
          await DatabaseService.saveProject(updatedProject);
          onProjectUpdated();

        } catch (convErr: any) {
          console.error("Conversion to high-fidelity wav failed", convErr);
          setErrorMessage(convErr.message || "Failed to process vocal track recording.");
        }
      };

      // Start recording
      recorder.start();
      setIsRecording(true);
      setRecProgressSeconds(0);

      // Trigger recording timer ticker
      let startTicks = 0;
      recordingTimerRef.current = window.setInterval(() => {
        startTicks += 0.1;
        setRecProgressSeconds(startTicks);
      }, 100);

    } catch (permissionErr) {
      console.error("Denied microphone permissions or device failure", permissionErr);
      setErrorMessage("Microphone Access Required: Please allow microphone permission in your browser.");
      setIsRecording(false);
    }
  };

  /**
   * Stop vocal session recording
   */
  const stopLayerRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    stopAllAudio();
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  /**
   * Delete a designated track from active workspace list
   */
  const handleTrackDelete = async (trackId: string) => {
    try {
      const remainingTracks = tracks.filter((t) => t.id !== trackId);
      
      // Revoke deleted URL to avoid resource leak
      const target = tracks.find((t) => t.id === trackId);
      if (target?.blobUrl) {
        URL.revokeObjectURL(target.blobUrl);
      }

      setTracks(remainingTracks);

      const updatedProject = {
        ...project,
        tracks: remainingTracks,
      };

      await DatabaseService.saveProject(updatedProject);
      onProjectUpdated();
    } catch (err) {
      console.error("Failed to delete vocal layer", err);
      setErrorMessage("Error occurred trying to delete track.");
    }
  };

  /**
   * Update individual layer track attributes (volume, mute, solo, offset)
   */
  const handleTrackUpdate = async (trackId: string, updates: Partial<Track>) => {
    const updated = tracks.map((t) => {
      if (t.id === trackId) {
        return { ...t, ...updates };
      }
      return t;
    });

    setTracks(updated);

    // Persist immediately on metadata changes
    const updatedProject = {
      ...project,
      tracks: updated,
    };

    try {
      await DatabaseService.saveProject(updatedProject);
      onProjectUpdated();
    } catch (err) {
      console.warn("Failed to persist real-time volume slider values", err);
    }
  };

  /**
   * Combine all tracks using Offline Audio Context and triggers WAV audio download.
   */
  const handleExportMix = async () => {
    try {
      setErrorMessage(null);
      if (tracks.length === 0) {
        setErrorMessage("Please record at least one vocal track prior to exporting.");
        return;
      }

      // Render mix
      const mixedAudioBuffer = await compileMultitrackMix(tracks);
      const mixedWavData = encodeWav(mixedAudioBuffer);

      // Create download trigger element
      const finalBlob = new Blob([mixedWavData], { type: "audio/wav" });
      const exportUrl = URL.createObjectURL(finalBlob);

      const downloadAnchor = document.createElement("a");
      downloadAnchor.href = exportUrl;
      
      const safeProjectName = project.name.toLowerCase().replace(/[^a-z0-9]/gi, "_");
      downloadAnchor.download = `${safeProjectName}_acapella_master.wav`;
      
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);

      // Revoke temporary master URL
      setTimeout(() => URL.revokeObjectURL(exportUrl), 2000);
    } catch (err) {
      console.error("Failed to export Serengeti Acapella Master mix down", err);
      setErrorMessage("Mixdown compilations failed. Check audio hardware connection.");
    }
  };

  // Convert timeline elapsed time into an elegant 11:34 style string format
  const formatScrubberTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${millis}`;
  };

  // Calculate master timeline boundary in seconds
  const projectTotalDuration = Math.max(
    ...tracks.map((t) => t.duration + Math.max(0, t.latencyOffset / 1000)),
    0
  );

  return (
    <div id="acapella-workstation" className="max-w-6xl mx-auto space-y-6 text-[#E0E0E0] px-4 py-3">
      {/* HEADER HUD BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#15171D] border border-white/10 p-4 rounded-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              stopAllAudio();
              onBack();
            }}
            className="p-2.5 bg-white/5 hover:bg-white/10 text-[#E0E0E0] rounded-lg transition duration-150 border border-white/5"
            title="Back to Studio Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-500 font-mono tracking-widest uppercase px-2 py-0.5 bg-red-600/10 rounded-md border border-red-500/10">
                Acapella Project
              </span>
              <span className="text-[10px] text-white/40 font-mono">
                {tracks.length} Layer{tracks.length !== 1 ? "s" : ""}
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mb-0.5">
              {project.name}
            </h2>
            <p className="text-xs text-white/40 font-sans italic">
              {project.description || "Synthesizing vocal energies dynamically."}
            </p>
          </div>
        </div>

        {/* Action Widgets */}
        <div className="flex items-center gap-2.5 self-stretch md:self-auto justify-end w-full md:w-auto">
          {/* Latency Adjust Config */}
          <button
            onClick={() => setShowCalibrator(true)}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-[#E0E0E0] rounded-lg flex items-center gap-1.5 transition text-xs font-bold uppercase tracking-wider cursor-pointer"
            title="Calibrate latency compensation"
          >
            <Settings className="w-4 h-4 text-red-500" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Master Export Mix Trigger */}
          <button
            onClick={handleExportMix}
            disabled={tracks.length === 0}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center gap-2 transition duration-150 text-xs font-bold uppercase tracking-wider shadow-lg shadow-red-600/5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            title="Download fully blended multi-track WAV"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Export Mix</span>
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg text-xs flex items-center gap-2">
          <span className="font-bold">⚠️ Warning:</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TIMELINE TRANSPORT CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Playback Transport Unit */}
        <div className="lg:col-span-3 bg-[#15171D] border border-white/10 p-5 rounded-xl flex flex-col justify-between space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono tracking-widest text-white/40 uppercase font-semibold flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-red-500 animate-pulse" /> Studio Workspace
            </span>
            {/* Playback Elapsed Indicator */}
            <div className="text-right">
              <div className="text-xl font-mono font-bold text-red-500">
                {formatScrubberTime(isRecording ? recProgressSeconds : currentTime)}
              </div>
              <div className="text-[10px] text-white/30 font-mono">
                Total length: {formatScrubberTime(projectTotalDuration)}
              </div>
            </div>
          </div>

          {/* Interactive scrubbing timeline bar */}
          <div className="relative pt-1">
            <div className="flex mb-1 items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-white/30">Master Playhead</span>
              </div>
            </div>
            <div className="h-2 bg-black/55 rounded-full overflow-hidden relative border border-white/5">
              {/* Playback progress tracker */}
              <div
                className={`h-full bg-red-600 rounded-full transition-all duration-75`}
                style={{
                  width: `${
                    projectTotalDuration > 0
                      ? Math.min(100, ((isRecording ? recProgressSeconds : currentTime) / projectTotalDuration) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Central Transport Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            {/* Left aligned: Stop & Play */}
            <div className="flex items-center gap-2.5">
              {/* Play/Pause Button */}
              <button
                onClick={playAllTracks}
                disabled={isRecording || tracks.length === 0}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isPlaying
                    ? "bg-amber-500 text-black hover:bg-amber-400 ring-4 ring-amber-500/10"
                    : "bg-red-600 text-white hover:bg-red-500 shadow-md shadow-red-600/10"
                } disabled:opacity-30 disabled:pointer-events-none`}
                title={isPlaying ? "Pause Playback" : "Start Multi-layer playback"}
              >
                {isPlaying ? <Square className="w-5 h-5 fill-black text-black" /> : <Play className="w-5 h-5 fill-white text-white translate-x-0.5" />}
              </button>

              {/* Stop Playback Button */}
              <button
                onClick={stopAllAudio}
                disabled={!isPlaying}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-white/80 hover:text-white flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                title="Stop timeline"
              >
                <Square className="w-4 h-4 fill-white text-white" />
              </button>
            </div>

            {/* Micro Record layer button */}
            <div className="flex items-center gap-3">
              {isRecording ? (
                <button
                  onClick={stopLayerRecording}
                  className="px-5 py-2.5 bg-red-500 hover:bg-red-400 text-black rounded-lg flex items-center gap-2 font-bold text-xs ring-4 ring-red-500/10 animate-pulse transition duration-150 cursor-pointer"
                  title="Stop core vocal record layer"
                >
                  <Square className="w-3.5 h-3.5 fill-black text-black" />
                  <span>Stop Recording ({recProgressSeconds.toFixed(1)}s)</span>
                </button>
              ) : (
                <button
                  onClick={startLayerRecording}
                  disabled={isPlaying}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center gap-2 font-bold text-xs shadow-lg shadow-red-600/10 transition duration-200 disabled:opacity-40 cursor-pointer"
                  title="Overdub / Record new vocal layer"
                >
                  <Mic className="w-4 h-4 animate-bounce" />
                  <span>Record Vocal Layer</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Master Console mixing settings */}
        <div className="bg-[#15171D] border border-white/10 p-5 rounded-xl flex flex-col justify-between space-y-4 shadow-xl">
          <div>
            <h4 className="text-xs font-mono uppercase tracking-widest text-[#E0E0E0]/80 mb-1 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-red-500" /> Master Fader
            </h4>
            <p className="text-[10px] text-white/40 leading-snug font-medium uppercase tracking-wider">
              Blends output audio signals to avoid desktop clipping distortions.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono text-white/50">
              <span>Mix amplification</span>
              <span className="text-red-500 font-bold">{Math.round(masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="w-full accent-red-600 h-1 bg-black/45 rounded-lg cursor-pointer"
            />
          </div>

          <div className="bg-black/30 p-2.5 rounded-lg border border-white/5 flex items-start gap-2 text-[10px] text-white/50 leading-normal">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <span>
              <strong>Headphones recommended!</strong> Recording layers without headphones triggers speaker feedback loops.
            </span>
          </div>
        </div>
      </div>

      {/* TRACKS LAYER STACK */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-semibold text-white/60 tracking-wider uppercase flex items-center gap-2 font-mono">
            <span>Layers Panel</span>
            <span className="px-2 py-0.5 bg-white/5 border border-white/5 text-white/40 text-[10px] font-bold rounded-sm">
              {tracks.length} track{(tracks.length !== 1) ? "s" : ""}
            </span>
          </h3>

          <div className="text-[10px] text-white/40 font-mono font-medium">
            Auto-latency offset: <strong className="text-red-500">-{latencySettings.roundtripLatency}ms</strong>
          </div>
        </div>

        {tracks.length === 0 ? (
          /* Empty placeholder card overlay */
          <div className="border border-dashed border-white/5 bg-[#15171D]/40 rounded-xl p-10 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 bg-red-600/10 text-red-500 rounded-lg flex items-center justify-center border border-red-500/20">
              <Mic className="w-6 h-6 animate-pulse" />
            </div>
            <div className="max-w-md">
              <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Begin First Vocal Recording</h4>
              <p className="text-white/40 text-xs leading-relaxed">
                Record your base backing track, beatbox tempo, or primary melody layer. Then, stack vocal overlays side-by-side!
              </p>
            </div>
            <button
              onClick={startLayerRecording}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Base Track</span>
            </button>
          </div>
        ) : (
          /* Map track panels */
          <div className="space-y-3">
            {tracks.map((track, i) => {
              // Alternate professional color schemes for staggered tracks to match design
              const colors = ["red", "blue", "zinc"];
              const assignedColor = colors[i % colors.length];

              return (
                <TrackCard
                  key={track.id}
                  track={track}
                  color={assignedColor}
                  isRecording={isRecording && i === tracks.length} // Just highlight mock visually
                  isPlaying={isPlaying}
                  onDelete={handleTrackDelete}
                  onUpdate={handleTrackUpdate}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* LATENCY CALIBRATION POPUP DIALOG */}
      {showCalibrator && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <LatencyCalibrator
            currentLatency={latencySettings.roundtripLatency}
            onSaveLatency={(val) => setLatencySettings({ roundtripLatency: val })}
            onClose={() => setShowCalibrator(false)}
          />
        </div>
      )}
    </div>
  );
}
