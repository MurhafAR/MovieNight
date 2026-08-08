"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import styles from "@/app/styles/voiceChat.module.css";
import { useI18n } from "@/i18n/I18nContext";

interface VoiceChatProps {
  socket: Socket | null;
}

interface VoiceUser {
  socketId: string;
  username: string;
}

export default function VoiceChat({ socket }: VoiceChatProps) {
  const { t } = useI18n();
  const [inVoice, setInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<VoiceUser[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map());
  const socketIdToUser = useRef<Map<string, string>>(new Map());
  const [speakerMuted, setSpeakerMuted] = useState<Record<string, boolean>>({});

  const cleanup = useCallback(() => {
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    audioElements.current.forEach((audio) => {
      audio.pause();
      audio.remove();
    });
    audioElements.current.clear();
    socketIdToUser.current.clear();
    setSpeakerMuted({});
  }, []);

  const createPeerConnection = useCallback(
    (targetSocketId: string) => {
      if (peerConnections.current.has(targetSocketId)) return;
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
      pc.ontrack = (event) => {
        let audio = audioElements.current.get(targetSocketId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audioElements.current.set(targetSocketId, audio);
          document.body.appendChild(audio);
        }
        audio.srcObject = event.streams[0];
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket?.emit("voice-ice-candidate", {
            targetSocketId,
            candidate: event.candidate,
          });
        }
      };
      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed"
        ) {
          pc.close();
          peerConnections.current.delete(targetSocketId);
          audioElements.current.get(targetSocketId)?.pause();
          audioElements.current.get(targetSocketId)?.remove();
          audioElements.current.delete(targetSocketId);
        }
      };
      peerConnections.current.set(targetSocketId, pc);
      return pc;
    },
    [socket]
  );

  const joinVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setIsMuted(false);
      socket?.emit("voice-join");
      setInVoice(true);
    } catch {
      alert(t("voice.micDenied"));
    }
  }, [socket]);

  const leaveVoice = useCallback(() => {
    socket?.emit("voice-leave");
    cleanup();
    setInVoice(false);
    setParticipants([]);
  }, [socket, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((m) => !m);
    }
  }, []);

  const toggleSpeaker = useCallback((targetSocketId: string) => {
    const audio = audioElements.current.get(targetSocketId);
    setSpeakerMuted((prev) => {
      const newMuted = !prev[targetSocketId];
      if (audio) audio.muted = newMuted;
      return { ...prev, [targetSocketId]: newMuted };
    });
  }, []);

  useEffect(() => {
    if (!socket) return;

    // When joining, create offers for all current participants
    const handleExistingUsers = async (users: VoiceUser[]) => {
      setParticipants(users);
      // create offers for everyone already in the channel
      for (const user of users) {
        socketIdToUser.current.set(user.socketId, user.username);
        const pc = createPeerConnection(user.socketId);
        if (pc) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("voice-offer", { targetSocketId: user.socketId, offer });
        }
      }
    };

    const handleUserJoined = (data: VoiceUser) => {
      setParticipants((prev) => [...prev, data]);
      socketIdToUser.current.set(data.socketId, data.username);
    };

    const handleUserLeft = (data: { socketId: string }) => {
      setParticipants((prev) =>
        prev.filter((u) => u.socketId !== data.socketId)
      );
      socketIdToUser.current.delete(data.socketId);
      peerConnections.current.get(data.socketId)?.close();
      peerConnections.current.delete(data.socketId);
      audioElements.current.get(data.socketId)?.pause();
      audioElements.current.get(data.socketId)?.remove();
      audioElements.current.delete(data.socketId);
    };

    // someone sent us an offer — answer it
    const handleOffer = async (data: {
      offer: RTCSessionDescriptionInit;
      socketId: string;
      username: string;
    }) => {
      setParticipants((prev) => {
        if (!prev.some((u) => u.socketId === data.socketId)) {
          return [
            ...prev,
            { socketId: data.socketId, username: data.username },
          ];
        }
        return prev;
      });
      socketIdToUser.current.set(data.socketId, data.username);
      const pc = createPeerConnection(data.socketId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("voice-answer", { targetSocketId: data.socketId, answer });
      }
    };

    // they accepted our offer
    const handleAnswer = async (data: {
      answer: RTCSessionDescriptionInit;
      socketId: string;
    }) => {
      const pc = peerConnections.current.get(data.socketId);
      if (pc && pc.remoteDescription === null) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };

    const handleIceCandidate = async (data: {
      candidate: RTCIceCandidateInit;
      socketId: string;
    }) => {
      const pc = peerConnections.current.get(data.socketId);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {}
      }
    };

    socket.on("voice-existing-users", handleExistingUsers);
    socket.on("voice-user-joined", handleUserJoined);
    socket.on("voice-user-left", handleUserLeft);
    socket.on("voice-offer", handleOffer);
    socket.on("voice-answer", handleAnswer);
    socket.on("voice-ice-candidate", handleIceCandidate);

    return () => {
      socket.off("voice-existing-users", handleExistingUsers);
      socket.off("voice-user-joined", handleUserJoined);
      socket.off("voice-user-left", handleUserLeft);
      socket.off("voice-offer", handleOffer);
      socket.off("voice-answer", handleAnswer);
      socket.off("voice-ice-candidate", handleIceCandidate);
      if (inVoice) {
        socket.emit("voice-leave");
        cleanup();
      }
    };
  }, [socket, createPeerConnection, inVoice, cleanup]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        {inVoice ? (
          <div
            className={styles.active}
            onClick={() => setShowParticipants((s) => !s)}
          >
            <button
              className={styles.voiceBtn}
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              title={isMuted ? t("voice.unmuteMic") : t("voice.muteMic")}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              className={`${styles.voiceBtn} ${styles.leaveBtn}`}
              onClick={(e) => {
                e.stopPropagation();
                leaveVoice();
              }}
              title={t("voice.leaveVoice")}
            >
              <PhoneOff size={18} />
            </button>
            <span className={styles.count}>{participants.length + 1}</span>
          </div>
        ) : (
          <button
            className={styles.joinBtn}
            onClick={joinVoice}
            title={t("voice.joinVoice")}
          >
            <Phone size={18} />
          </button>
        )}
      </div>
      {inVoice && showParticipants && participants.length > 0 && (
        <div className={styles.participantList}>
          {participants.map((p) => {
            const spMuted = speakerMuted[p.socketId] ?? false;
            return (
              <div key={p.socketId} className={styles.participantRow}>
                <span className={styles.participantName}>{p.username}</span>
                <button
                  className={styles.speakerBtn}
                  onClick={() => toggleSpeaker(p.socketId)}
                  title={
                    spMuted ? t("voice.unmuteSpeaker") : t("voice.muteSpeaker")
                  }
                >
                  {spMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
