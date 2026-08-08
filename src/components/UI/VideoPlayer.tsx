/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import ReactPlayer from "react-player";
import styles from "@/app/styles/videoPlayer.module.css";
import {
  Play,
  Pause,
  Maximize,
  Minimize,
  Volume2,
  VolumeOff,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { useI18n } from "@/i18n/I18nContext";

interface VideoPlayerProps {
  socket: Socket | null;
  source: string;
  className?: string;
  handleFullScreen: () => void;
  handleExitFullScreen: () => void;
  isFullScreen: boolean;
  roomId: string;
  canControl: boolean;
  onUnloadVideo?: () => void;
}

const SKIP_TIME = 10;

export default function VideoPlayer({
  socket,
  source,
  isFullScreen = false,
  handleFullScreen,
  handleExitFullScreen,
  roomId,
  canControl,
  onUnloadVideo,
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volumeValue, setVolumeValue] = useState(1);
  const { data: session } = useSession();
  const { t } = useI18n();

  const handleSync = useCallback(
    (syncProgress: number, time: number, status: boolean) => {
      if (Number.isFinite(syncProgress)) setProgress(syncProgress);
      if (Number.isFinite(time) && playerRef.current) {
        playerRef.current.currentTime = time;
        setCurrentTime(time);
      }
      setIsPlaying(status);
    },
    []
  );

  const emitPlayState = useCallback(
    (status: boolean, time: number) => {
      if (!socket || !playerRef.current) return;
      const totalDuration = playerRef.current.duration || 1;
      const progressPercent = totalDuration > 0 ? (time / totalDuration) * 100 : 0;
      if (!Number.isFinite(progressPercent)) return;
      socket.emit("video-play", {
        roomId,
        actionAt: time,
        progress: progressPercent,
        user: session?.user,
        status,
      });
    },
    [socket, roomId, session?.user]
  );

  const handlePlay = useCallback(
    (status: boolean) => {
      if (!canControl) return;
      if (!playerRef.current) return;
      const currentDuration = playerRef.current.currentTime || 0;
      emitPlayState(status, currentDuration);
      setIsPlaying(status);
    },
    [canControl, emitPlayState]
  );

  const handleSkip = useCallback(
    (seconds: number) => {
      if (!canControl || !playerRef.current) return;
      const currentDuration = playerRef.current.currentTime || 0;
      const totalDuration = playerRef.current.duration || 1;
      const newTime = Math.max(
        0,
        Math.min(currentDuration + seconds, totalDuration)
      );
      playerRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      const progressPercent = totalDuration > 0 ? (newTime / totalDuration) * 100 : 0;
      setProgress(progressPercent);
      emitPlayState(true, newTime);
      setIsPlaying(true);
    },
    [canControl, emitPlayState]
  );

  useEffect(() => {
    if (!socket) return;
    socket.on("video-play-sync", (data) => {
      handleSync(data.progress, data.actionAt, data.status);
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        handlePlay(!isPlaying);
      }
      if (event.code === "KeyM") setIsMuted((m) => !m);
      if (event.code === "ArrowLeft") handleSkip(-SKIP_TIME);
      if (event.code === "ArrowRight") handleSkip(SKIP_TIME);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      socket.off("video-play-sync");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [socket, isPlaying, handleSync, handlePlay, handleSkip]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const h = hrs.toString().padStart(2, "0");
    const m = mins.toString().padStart(2, "0");
    const s = secs.toString().padStart(2, "0");
    return hrs > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (!isSeeking && video && video.duration > 0) {
      setProgress((video.currentTime / video.duration) * 100);
      setCurrentTime(video.currentTime);
    }
  };

  const seekProgressRef = useRef(progress);
  seekProgressRef.current = progress;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canControl || !playerRef.current) return;
    const timeStamp = parseFloat(e.target.value);
    if (!Number.isFinite(timeStamp)) return;
    const totalDuration = playerRef.current.duration || 1;
    const seekTime = (timeStamp / 100) * totalDuration;
    setProgress(timeStamp);
    setCurrentTime(seekTime);
  };

  const commitSeek = useCallback(() => {
    if (!canControl || !playerRef.current) {
      setIsSeeking(false);
      return;
    }
    const totalDuration = playerRef.current.duration || 1;
    const seekTime = (seekProgressRef.current / 100) * totalDuration;
    playerRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
    setIsSeeking(false);
    setIsPlaying(true);
    emitPlayState(true, seekTime);
  }, [canControl, emitPlayState]);

  useEffect(() => {
    if (!isSeeking) return;

    const handleWindowPointerUp = () => {
      commitSeek();
    };

    window.addEventListener("mouseup", handleWindowPointerUp);
    window.addEventListener("touchend", handleWindowPointerUp);
    return () => {
      window.removeEventListener("mouseup", handleWindowPointerUp);
      window.removeEventListener("touchend", handleWindowPointerUp);
    };
  }, [isSeeking, commitSeek]);

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.currentTarget.value);
    if (Number.isFinite(value)) setVolumeValue(value);
  };

  return (
    <div dir="ltr" className={styles.container}>
      <ReactPlayer
        ref={playerRef}
        src={source}
        width="100%"
        height="100%"
        controls={false}
        playing={isPlaying}
        onTimeUpdate={handleTimeUpdate as any}
        volume={volumeValue}
        muted={isMuted}
        className={styles.videoPlayer}
        onError={(e) => {
          if (String(e).includes("AbortError")) return;
        }}
        config={{ youtube: { disablekb: 1 } } as any}
      />
      <div
        className={styles.controlsOverlay}
        onClick={() => handlePlay(!isPlaying)}
      >
        <div
          className={styles.bottomBar}
          onClick={(e) => e.stopPropagation()}
        >
          {canControl && (
            <span title={t("player.rewind")}>
              <SkipBack
                className={styles.icon}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSkip(-SKIP_TIME);
                }}
              />
            </span>
          )}
          {canControl &&
            (isPlaying ? (
              <span title={t("player.pause")}>
                <Pause
                  className={styles.icon}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlay(false);
                  }}
                />
              </span>
            ) : (
              <span title={t("player.play")}>
                <Play
                  className={styles.icon}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlay(true);
                  }}
                />
              </span>
            ))}
          {canControl && (
            <span title={t("player.forward")}>
              <SkipForward
                className={styles.icon}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSkip(SKIP_TIME);
                }}
              />
            </span>
          )}
          <input
            type="range"
            min={0}
            max={100}
            step="any"
            value={progress}
            className={`${styles.seekBar} ${
              !canControl ? styles.seekBarDisabled : ""
            }`}
            onChange={handleSeekChange}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (canControl) {
                setIsSeeking(true);
              }
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              if (canControl) {
                setIsSeeking(true);
              }
            }}
            disabled={!canControl}
          />
          <span>{formatTime(currentTime)}</span>
          {isMuted ? (
            <span title={t("player.unmute")}>
              <VolumeOff
                className={styles.icon}
                onClick={() => setIsMuted(false)}
              />
            </span>
          ) : (
            <span title={t("player.mute")}>
              <Volume2 className={styles.icon} onClick={() => setIsMuted(true)} />
            </span>
          )}
          <input
            type="range"
            step="any"
            className={styles.volumeBar}
            min={0}
            max={1}
            defaultValue={1}
            onChange={handleVolume}
          />
          {isFullScreen ? (
            <span title={t("player.exitFullscreen")}>
              <Minimize onClick={handleExitFullScreen} className={styles.icon} />
            </span>
          ) : (
            <span title={t("player.fullscreen")}>
              <Maximize onClick={handleFullScreen} className={styles.icon} />
            </span>
          )}
          <span title={t("player.unloadVideo")}>
            <X
              className={styles.icon}
              onClick={(e) => {
                e.stopPropagation();
                onUnloadVideo?.();
              }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}

