import { Resizable } from "react-resizable";
import "react-resizable/css/styles.css";
import styles from "!/chatSideBar.module.css";
import { useState, useEffect, useCallback, useRef } from "react";
import Form from "@/components/UI/Form";
import type { ResizeCallbackData } from "react-resizable";
import { useI18n } from "@/i18n/I18nContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Socket } from "socket.io-client";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
interface Message {
  user: string;
  id: string;
  text: string;
  timestamp: string;
  messageType?: string;
}
interface ChatSideBarProps {
  socket: Socket | null;
  username: string;
  roomId: string;
  roomName?: string;
  canChat: boolean;
}

export default function ChatSideBar({
  username,
  roomId,
  roomName,
  socket,
  canChat,
}: ChatSideBarProps) {
  const [width, setWidth] = useState(200);
  const [height, setHeight] = useState(150);
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useMediaQuery("(max-width: 900px)");
  const prevWidthRef = useRef(200);
  const prevHeightRef = useRef(150);
  const hasJoinedRef = useRef(false);
  const prevUsernameRef = useRef(username);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const { t } = useI18n();

  const playPop = () => {
    try {
      const pop = new Audio("/pop.mp3");
      pop.volume = 0.3;
      pop
        .play()
        .catch((err) => console.log("Playback prevented:", err.message));
    } catch (err) {
      console.log(err);
    }
  };

  const handleUserJoin = useCallback(() => {
    if (!socket) return;
    try {
      socket.emit("user-join", {
        user: username,
        roomId: roomId,
      });
    } catch (err) {
      console.log("error with connecting server! " + err);
    }
    const newMessage: Message = {
      user: "system",
      id: Math.random().toString(36).substring(2, 15),
      text: t("chat.joinedRoom", { username }),
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    playPop();
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  }, [socket, username, roomId, t]);
  useEffect(() => {
    if (!socket || !username || hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    prevUsernameRef.current = username;

    handleUserJoin();

    socket.on("user-join-sync", (data) => {
      const newMessage: Message = {
        user: "system",
        id: Math.random().toString(36).substring(2, 15),
        text: t("chat.joinedRoom", { username: data.user }),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      playPop();
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    });
    socket.on("send-message-sync", (data) => {
      const newMessage: Message = {
        user: data.message.user,
        id: data.message.id,
        text: data.message.text,
        messageType: data.message.messageType,
        timestamp: new Date(
          (data.message.rawTimestamp as number) * 1000
        ).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((prevMessages) => [...prevMessages, newMessage]);
    });
    socket.on("load-messages", (loadedMessages: Message[]) => {
      if (loadedMessages.length > 0) {
        const formatted = loadedMessages.map((msg) => ({
          ...msg,
          timestamp: new Date(
            (msg.timestamp as unknown as number) * 1000
          ).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        setMessages(formatted);
      }
    });
    socket.on("video-action-sync", (raw) => {
      const data = raw as { user: string; action: string };
      const newMessage: Message = {
        user: "system",
        id: Math.random().toString(36).substring(2, 15),
        text: t("chat.videoAction", {
          user: data.user,
          action:
            data.action === "played" ? t("common.played") : t("common.paused"),
        }),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    });
    socket.emit("get-messages", roomId);
    return () => {
      socket.off("user-join-sync");
      socket.off("send-message-sync");
      socket.off("load-messages");
      socket.off("video-action-sync");
    };
  }, [socket, handleUserJoin, roomId, username, t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSendMessage = (data: FormData) => {
    if (!canChat) return;
    const text = data.get("message") as string;
    if (!text.trim()) return;
    const id = Math.random().toString(36).substring(2, 15);
    const timeStamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const newMessage: Message = {
      user: username,
      id: id,
      text: text,
      timestamp: timeStamp,
    };

    try {
      socket?.emit("send-message", {
        message: { text, user: username },
        roomId: roomId,
        roomName: roomName,
      });
    } catch (err) {
      console.log("Something went wrong with sending message... " + err);
    }

    setMessages([...messages, newMessage]);
  };
  const dragRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(150);

  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      startYRef.current = clientY;
      startHeightRef.current = height;
      const handleMove = (ev: MouseEvent | TouchEvent) => {
        const currentY =
          "touches" in ev
            ? (ev as TouchEvent).touches[0].clientY
            : (ev as MouseEvent).clientY;
        const delta = startYRef.current - currentY;
        const max = window.innerHeight * 0.5;
        const newHeight = Math.round(
          Math.max(150, Math.min(max, startHeightRef.current + delta))
        );
        setHeight(newHeight);
      };
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
        window.removeEventListener("touchmove", handleMove);
        window.removeEventListener("touchend", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
      window.addEventListener("touchmove", handleMove, { passive: true });
      window.addEventListener("touchend", handleUp);
      e.preventDefault();
    },
    [height]
  );

  const toggleCollapse = () => {
    if (collapsed) {
      setWidth(prevWidthRef.current);
      setHeight(prevHeightRef.current);
      setCollapsed(false);
    } else {
      prevWidthRef.current = width;
      prevHeightRef.current = height;
      setWidth(1);
      setCollapsed(true);
    }
  };
  const isLoading = !socket || !username;
  const onResize = (
    event: React.SyntheticEvent,
    { size }: ResizeCallbackData
  ) => {
    setWidth(size.width);
  };
  return (
    <Resizable
      width={width}
      height={150}
      resizeHandles={["w"]}
      onResize={onResize}
      minConstraints={[1, 0]}
      maxConstraints={[400, 1000]}
      className={`${styles.main} ${collapsed ? styles.collapsed : ""}`}
    >
      <div
        className={styles.chat}
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <div
          ref={dragRef}
          className={styles.dragHandle}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        />
        <button
          className={styles.toggleButton}
          onClick={toggleCollapse}
          title={collapsed ? t("chat.showChat") : t("chat.hideChat")}
        >
          {collapsed ? (
            isMobile ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronLeft size={14} />
            )
          ) : isMobile ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>
        {!collapsed &&
          (isLoading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner} />
              <span className={styles.loadingText}>{t("chat.connecting")}</span>
            </div>
          ) : (
            <>
              <div className={styles.messagesArea}>
                {messages.map((msg) => {
                  const isAI = msg.messageType === "ai";
                  return (
                    <div
                      key={msg.id}
                      className={`${styles.message} ${
                        isAI ? styles.messageAi : ""
                      }`}
                    >
                      <span
                        dir="ltr"
                        className={`${styles.username} ${
                          isAI ? styles.usernameAi : ""
                        }`}
                      >
                        {msg.user}
                        <span className={styles.timestamp}>
                          {msg.timestamp}
                        </span>
                      </span>
                      <p className={styles.messageText}>{msg.text}</p>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <div className={styles.textArea}>
                {canChat ? (
                  <Form
                    className={styles.textInput}
                    inputs={[
                      {
                        name: "message",
                        label: "",
                        type: "text",
                        placeholder: t("chat.typeMessage"),
                        defaultValue: "",
                      },
                    ]}
                    onSubmit={handleSendMessage}
                  />
                ) : (
                  <div className={styles.chatDisabled}>
                    {t("chat.disabled")}
                  </div>
                )}
              </div>
            </>
          ))}
      </div>
    </Resizable>
  );
}
