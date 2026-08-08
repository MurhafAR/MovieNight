"use client";

import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { UserX, MicOff, Mic } from "lucide-react";
import styles from "@/app/styles/room.module.css";
import { useI18n } from "@/i18n/I18nContext";

interface Member {
  socketId: string;
  username: string;
  userId?: string;
  isMuted: boolean;
}

interface MembersListProps {
  socket: Socket | null;
  roomName: string;
  roomId: string;
  hostId: string;
  username: string;
}

export default function MembersList({
  socket,
  roomName,
  roomId,
  hostId,
  username: currentUser,
}: MembersListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    if (!socket) return;
    socket.emit("get-members", roomId);
    socket.on("members-update", (list: Member[]) => {
      setMembers(list);
    });
    return () => {
      socket.off("members-update");
    };
  }, [socket, roomId]);

  const handleKick = (targetUsername: string) => {
    socket?.emit("kick-user", {
      roomName,
      hostId,
      targetUsername,
    });
  };

  const handleMute = (targetUsername: string) => {
    socket?.emit("mute-user", {
      roomName,
      hostId,
      targetUsername,
    });
  };

  const handleUnmute = (targetUsername: string) => {
    socket?.emit("unmute-user", {
      roomName,
      hostId,
      targetUsername,
    });
  };

  if (members.length === 0) return null;

  return (
    <div className={styles.memberList}>
      <h3 className={styles.memberListTitle}>
        {t("members.title", { count: members.length })}
      </h3>
      {members.map((member) => (
        <div key={member.socketId} className={styles.memberRow}>
          <span className={styles.memberName}>
            {member.username}
            {member.username === currentUser && t("members.you")}
          </span>
          <div className={styles.memberActions}>
            {member.isMuted && (
              <MicOff size={14} className={styles.mutedIndicator} />
            )}
            {hostId && member.username !== currentUser && (
              <>
                {member.isMuted ? (
                  <button
                    className={styles.memberActionBtn}
                    onClick={() => handleUnmute(member.username)}
                    title={t("members.unmute")}
                  >
                    <Mic size={14} />
                  </button>
                ) : (
                  <button
                    className={styles.memberActionBtn}
                    onClick={() => handleMute(member.username)}
                    title={t("members.mute")}
                  >
                    <MicOff size={14} />
                  </button>
                )}
                <button
                  className={styles.memberActionBtn}
                  onClick={() => handleKick(member.username)}
                  title={t("members.kick")}
                >
                  <UserX size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
