"use client";
import VideoPlayer from "../UI/VideoPlayer";
import ChatSidebar from "../UI/ChatSidebar";
import MediaPicker from "../UI/MediaPicker";
import MembersList from "../UI/MembersList";
import VoiceChat from "../UI/VoiceChat";
import Nav from "@/components/UI/Nav";
import { useRef, useState, useEffect, useCallback } from "react";
import Username from "@/components/UI/Username";
import styles from "@/app/styles/room.module.css";
import PopUp from "../UI/PopUp";
import Button from "../UI/Button";
import { Room } from "@/db/schema";
import { useSession } from "next-auth/react";
import { useSocket } from "@/hooks/useSocket";
import { useI18n } from "@/i18n/I18nContext";
import {
  SlidersHorizontal,
  MessageSquareLock,
  Settings,
  CloudUpload,
  Users,
  LogOut,
} from "lucide-react";

interface RoomPageProps {
  roomData: Room;
}

export default function RoomPage({ roomData }: RoomPageProps) {
  const socket = useSocket();

  const [isFullScreen, setIsFullScreen] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [userame, setUsername] = useState("");
  const [loadVideo, setLoadVideo] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [uploader, setUploader] = useState<string>("");
  const [videoName, setVideoName] = useState<string>("");
  const [showSettings, setShowSettings] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [notHostAlert, setNotHostAlert] = useState<string | null>(null);
  const [guestCanControl, setGuestCanControl] = useState(
    roomData.guestPermission.canControl === true
  );
  const [guestCanChat, setGuestCanChat] = useState(
    roomData.guestPermission.canChat === true
  );
  const [guestCanUpload, setGuestUpload] = useState(
    roomData.guestPermission.canUpload === true
  );
  const session = useSession();
  const { t } = useI18n();
  const isHost = session.data?.user?.id === roomData.hostId;
  const [hasHostUploaded, setHasHostUploaded] = useState(false);

  useEffect(() => {
    if (!socket || !roomData.id) return;
    socket.emit("join-room", roomData.id);

    // When joining mid session, the server sends the current room video
    socket.on("current-room-video", (raw) => {
      const data = raw as {
        url: string;
        name: string;
        user: string;
        videoType: string;
      };
      setHasHostUploaded(true);
      setVideoUrl(data.url);
      setVideoName(data.name);
      setUploader(data.user);
      if (data.videoType === "local") {
        setShowPopup(true);
      } else {
        setLoadVideo(true);
      }
    });

    socket.on("set-video-sync", (raw) => {
      const data = raw as {
        url: string;
        name: string;
        user: string;
        videoType: string;
        isHost?: boolean;
      };
      if (data.isHost) setHasHostUploaded(true);
      setVideoUrl(data.url);
      setVideoName(`${data.name}`);
      setUploader(`${data.user}`);
      if (data.videoType === "local") {
        setShowPopup(true);
      } else {
        setLoadVideo(true);
      }
    });

    // Redirects user to home when kicked
    socket.on("kicked", (raw) => {
      const data = raw as { code: string };
      alert(t(data.code));
      window.location.href = "/";
    });

    socket.on("muted", (raw) => {
      const data = raw as { code: string };
      alert(t(data.code));
    });

    socket.on("chat-disabled", (raw) => {
      const data = raw as { code: string };
      alert(t(data.code));
    });

    const handleSyncFullScreen = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleSyncFullScreen);

    return () => {
      document.removeEventListener("fullscreenchange", handleSyncFullScreen);
      socket.off("join-room");
      socket.off("current-room-video");
      socket.off("set-video-sync");
      socket.off("kicked");
      socket.off("banned");
      socket.off("muted");
      socket.off("chat-disabled");
    };
  }, [socket, roomData.id]);

  const setElementRef = useCallback((element: HTMLDivElement) => {
    if (element !== null) {
      elementRef.current = element;
    }
  }, []);

  const handleFullScreen = useCallback(async () => {
    if (elementRef.current) {
      try {
        await elementRef.current.requestFullscreen();
        setIsFullScreen(true);
      } catch (err) {
        console.error("Something went wrong... ", err);
      }
    } else {
      console.error("Fullscreen element not found!");
    }
  }, []);

  const handleExitFullScreen = useCallback(() => {
    document.exitFullscreen();
    setIsFullScreen(false);
  }, []);
  const handleSendSettings = async () => {
    socket?.emit(
      "room-settings",
      {
        roomName: roomData.name,
        hostId: roomData.hostId,
        canChat: guestCanChat,
        canControl: guestCanControl,
        canUpload: guestCanUpload,
      },
      (raw) => {
        const res = raw as { success: boolean; code?: string };
        if (res.success === true) {
          return;
        } else {
          setNotHostAlert(res.code ? t(res.code) : "");
          return;
        }
      }
    );
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setVideoUrl(objectUrl);
    setLoadVideo(true);
    setShowPopup(false);
  };

  return (
    <main className={styles.roomLayout}>
      <Nav>
        <Username onNameChange={setUsername} />
        <VoiceChat socket={socket} />
        <span title={t("room.members")}>
          <Users
            className={styles.navIcon}
            onClick={() => setShowMembers(true)}
          />
        </span>
        {isHost && (
          <span title={t("room.settings")}>
            <Settings
              className={styles.navIcon}
              onClick={() => {
                setShowSettings(true);
              }}
            />
          </span>
        )}
        <span title={t("room.leave")}>
          <LogOut
            className={styles.navIcon}
            onClick={() => {
              window.location.href = "/";
            }}
          />
        </span>
      </Nav>
      <div ref={setElementRef} className={styles.roomContainer}>
        {showMembers && (
          <PopUp
            className={styles.membersPopup}
            popUpColor="green"
            section1Children={
              <>
                <div className={styles.popupHeader}>
                  <h1>Room Members</h1>
                </div>
              </>
            }
            section1Styles={styles.membersSection1}
            section2Children={
              <>
                <MembersList
                  socket={socket}
                  roomName={roomData.name}
                  roomId={roomData.id}
                  hostId={roomData.hostId ?? ""}
                  username={userame}
                />
                <Button
                  text="Close"
                  buttonColor="green"
                  action={() => setShowMembers(false)}
                  className={styles.doneBtn}
                />
              </>
            }
            section2Styles={styles.settingsSection}
            onClose={() => setShowMembers(false)}
          />
        )}
        {isHost && showSettings && (
          <PopUp
            className={styles.settingsPopup}
            popUpColor="blue"
            section1Children={
              <>
                <div className={styles.popupHeader}>
                  <h1>{t("room.settings")}</h1>
                  <span>{t("room.managePermissions")}</span>
                </div>
              </>
            }
            section1Styles={styles.settingsSection1}

            section2Children={
              <>
                <div className={styles.switchRow}>
                  <div className={styles.permissionLabel}>
                    <SlidersHorizontal></SlidersHorizontal>
                    <span>{t("room.allowControl")}</span>
                  </div>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={guestCanControl}
                      onChange={(e) => setGuestCanControl(e.target.checked)}
                      className={styles.toggleInput}
                    />

                    <span className={styles.toggleSlider} />
                  </label>

                  <span className={styles.toggleStatus}></span>
                </div>
                <div className={styles.switchRow}>
                  <div className={styles.permissionLabel}>
                    <MessageSquareLock></MessageSquareLock>
                    <span>{t("room.allowChat")}</span>
                  </div>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={guestCanChat}
                      onChange={(e) => {
                        setGuestCanChat(e.target.checked);
                      }}
                      className={styles.toggleInput}
                    />

                    <span className={styles.toggleSlider} />
                  </label>

                  <span className={styles.toggleStatus}></span>
                </div>
                <div className={styles.switchRow}>
                  <div className={styles.permissionLabel}>
                    <CloudUpload></CloudUpload>
                    <span>{t("room.allowUpload")}</span>
                  </div>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={guestCanUpload}
                      onChange={(e) => setGuestUpload(e.target.checked)}
                      className={styles.toggleInput}
                    />

                    <span className={styles.toggleSlider} />
                  </label>

                  <span className={styles.toggleStatus}></span>
                </div>
                {notHostAlert && (
                  <span
                    style={{
                      color: "#ff6b6b",
                      fontSize: "14px",
                      textAlign: "left",
                      paddingLeft: "4px",
                      fontWeight: "500",
                    }}
                  >
                    {notHostAlert}
                  </span>
                )}
                <Button
                  text={t("room.done")}
                  buttonColor="blue"
                  action={() => {
                    setShowSettings(false);
                    handleSendSettings();
                  }}
                  className={styles.doneBtn}
                />{" "}
              </>
            }
            section2Styles={styles.settingsSection}
          />
        )}
        {showPopup && (
          <PopUp
            className={styles.videoPopup}
            popUpColor="green"
            onClose={() => {
              setShowPopup(false);
            }}
            section1Children={
              <>
                <h3 style={{ textAlign: "center", marginBottom: 7 }}>
                  {t("room.wantsToWatch", { uploader, name: videoName })}
                </h3>
                <span>
                  {t("room.streamOrDevice")}
                </span>
              </>
            }
            section2Children={
              <>
                {videoUrl.startsWith("/") && (
                  <Button
                    text={t("room.streamFromServer")}
                    buttonColor="green"
                    action={() => {
                      setLoadVideo(true);
                      setShowPopup(false);
                    }}
                    className={styles.videoActionBtn}
                  />
                )}

                <Button
                  text={t("room.localVideo")}
                  buttonColor="blue"
                  action={() =>
                    document.getElementById("popup-file-upload")?.click()
                  }
                  className={styles.videoActionBtn}
                />
                <input
                  type="file"
                  accept="video/*"
                  id="popup-file-upload"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </>
            }
            section2Styles={styles.videoPopupActions}
          />
        )}
        {loadVideo ? (
          <VideoPlayer
            socket={socket}
            className={styles.videoPlayer}
            isFullScreen={isFullScreen}
            handleFullScreen={handleFullScreen}
            handleExitFullScreen={handleExitFullScreen}
            roomId={roomData.id}
            source={videoUrl}
            canControl={isHost || guestCanControl}
            onUnloadVideo={() => {
              setLoadVideo(false);
              if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
              }
              setVideoUrl("");
              setVideoName("");
              setUploader("");
              setHasHostUploaded(false);
              setShowPopup(false);
            }}
          />
        ) : (
          <MediaPicker
            onVideoSourceReady={setVideoUrl}
            socket={socket}
            roomId={roomData.id}
            roomName={roomData.name}
            username={userame}
            isHost={isHost}
            hasHostUploaded={hasHostUploaded}
            guestCanUpload={guestCanUpload}
            loadVideo={setLoadVideo}
          />
        )}
        <ChatSidebar
          username={userame}
          roomId={roomData.id}
          roomName={roomData.name}
          socket={socket}
          canChat={isHost || guestCanChat}
        />
      </div>
    </main>
  );
}
