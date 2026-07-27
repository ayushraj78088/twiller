"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Mic, Square, Trash2, Play, Pause, Upload, Volume2, AlertCircle } from "lucide-react";

interface AudioRecorderProps {
  onAudioSelected: (file: File | Blob) => void;
  onAudioCleared: () => void;
  disabled?: boolean;
}

export default function AudioRecorder({
  onAudioSelected,
  onAudioCleared,
  disabled = false,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const MAX_DURATION_SECONDS = 300; // 5 minutes
  const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

  const recordedTimeRef = useRef(0);

  const startRecording = async () => {
    setErrorMsg(null);
    audioChunksRef.current = [];
    recordedTimeRef.current = 0;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());

        // Size check
        if (blob.size > MAX_FILE_SIZE_BYTES) {
          setErrorMsg("Audio exceeds the 100 MB limit.");
          return;
        }

        // Duration check using recorded time (avoids browser WebM Infinity duration bug)
        const finalDuration = recordedTimeRef.current;
        if (finalDuration > MAX_DURATION_SECONDS) {
          setErrorMsg("Audio duration exceeds 5 minutes (300s) limit.");
          return;
        }

        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioFile(blob);
        onAudioSelected(blob);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        recordedTimeRef.current += 1;
        setRecordingTime(recordedTimeRef.current);
        if (recordedTimeRef.current >= MAX_DURATION_SECONDS) {
          stopRecording();
        }
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      setErrorMsg("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg("Audio file size exceeds 100 MB limit.");
      return;
    }

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);

    audio.onloadedmetadata = () => {
      if (isFinite(audio.duration) && audio.duration > MAX_DURATION_SECONDS) {
        setErrorMsg(`Audio file duration (${Math.round(audio.duration)}s) exceeds 5 minutes limit.`);
        URL.revokeObjectURL(url);
        return;
      }
      setAudioUrl(url);
      setAudioFile(file);
      onAudioSelected(file);
    };

    audio.onerror = () => {
      setErrorMsg("Could not load audio file. Please check file format.");
    };
  };

  const clearAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioFile(null);
    setRecordingTime(0);
    setErrorMsg(null);
    setIsPlaying(false);
    onAudioCleared();
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full bg-gray-900/60 border border-gray-800 rounded-xl p-3 my-2 text-white">
      {errorMsg && (
        <div className="flex items-center space-x-2 text-red-400 text-sm mb-2 bg-red-950/40 p-2 rounded border border-red-800/50">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* When no audio is recorded or selected */}
      {!audioUrl && !isRecording && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={startRecording}
              className="bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 hover:text-red-300 rounded-full flex items-center space-x-2"
            >
              <Mic className="h-4 w-4 animate-pulse" />
              <span>Record Voice</span>
            </Button>
            <span className="text-xs text-gray-500">or</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-full flex items-center space-x-2 text-xs"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Audio</span>
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          <span className="text-xs text-gray-500">Max: 5 min & 100 MB</span>
        </div>
      )}

      {/* Recording in progress */}
      {isRecording && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 rounded-full bg-red-500 animate-ping" />
            <span className="text-sm font-mono text-red-400">
              Recording: {formatTime(recordingTime)} / 05:00
            </span>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={stopRecording}
            className="rounded-full flex items-center space-x-1 px-3 py-1"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            <span>Stop</span>
          </Button>
        </div>
      )}

      {/* Audio recorded / selected preview */}
      {audioUrl && !isRecording && (
        <div className="flex items-center justify-between space-x-3">
          <div className="flex items-center space-x-3 flex-1">
            <button
              type="button"
              onClick={togglePlayback}
              className="p-2.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <Volume2 className="h-4 w-4 text-blue-400" />
              <span className="font-semibold">Audio Tweet ready</span>
              {audioFile && (
                <span className="text-xs text-gray-500">
                  ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              )}
            </div>
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAudio}
            className="text-gray-400 hover:text-red-400 hover:bg-red-950/20 p-2 rounded-full"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
