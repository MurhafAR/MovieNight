"use client";

import { ChevronDown, XIcon } from "lucide-react";
import React, { useState } from "react";
import styles from "!/mediaPicker.module.css";
import { Socket } from "socket.io-client";
import { useI18n } from "@/i18n/I18nContext";
import PopUp from "./PopUp";
import Button from "./Button";
import Form from "./Form";
interface MediaPickerProps {
  onVideoSourceReady: (url: string) => void;
  loadVideo: (load: boolean) => void;
  socket: Socket | null;
  roomId: string;
  roomName: string;
  username: string;
  isHost: boolean;
  hasHostUploaded: boolean;
  guestCanUpload: boolean;
}
export default function MediaPicker({
  onVideoSourceReady,
  loadVideo,
  socket,
  roomId,
  roomName,
  username,
  isHost,
  hasHostUploaded,
  guestCanUpload,
}: MediaPickerProps) {
  const [sourceType, setSourceType] = useState("local");
  const [showPopup, setShowPopup] = useState(false);
  const [showUploadPopup, setShowUploadPopup] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [hostUploadMsg, setHostUploadMsg] = useState("");
  const { t } = useI18n();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isHost && !hasHostUploaded) {
      setHostUploadMsg(t("media.hostNotUploaded"));
      return;
    }

    setPendingFile(file);
    setShowUploadPopup(true);
  };

  const handleUploadConfirm = async () => {
    if (!pendingFile) return;
    setShowUploadPopup(false);
    const file = pendingFile;
    setPendingFile(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (data.url) {
        setHostUploadMsg("");
        if (isHost || (hasHostUploaded && guestCanUpload)) {
          socket?.emit("set-video", {
            url: data.url,
            name: file.name,
            roomId: roomId,
            roomName: roomName,
            user: username,
            videoType: "local",
          });
        }
        onVideoSourceReady(data.url);
        loadVideo(true);
      }
    } catch (error) {
      console.error("Upload failed", error);
    }
  };

  const handleUploadDecline = () => {
    if (!pendingFile) return;
    setShowUploadPopup(false);
    const file = pendingFile;
    setPendingFile(null);

    const objectUrl = URL.createObjectURL(file);
    if (isHost || (hasHostUploaded && guestCanUpload)) {
      socket?.emit("set-video", {
        url: file.name,
        name: file.name,
        roomId: roomId,
        roomName: roomName,
        user: username,
        videoType: "local",
      });
    }
    onVideoSourceReady(objectUrl);
    loadVideo(true);
  };
  const handleYoutubeSubmit = (data: FormData) => {
    setShowPopup(false);
    const youtubeURL = data.get("youtubeURL") as string;

    if (!isHost && !hasHostUploaded) {
      setHostUploadMsg(t("media.hostNotUploaded"));
      return;
    }

    setHostUploadMsg("");
    if (isHost || (hasHostUploaded && guestCanUpload)) {
      socket?.emit("set-video", {
        url: youtubeURL,
        name: youtubeURL,
        roomId: roomId,
        roomName: roomName,
        user: username,
        videoType: "youtube",
      });
    }
    onVideoSourceReady(youtubeURL);
    loadVideo(true);
  };
  return (
    <div className={styles.container}>
      {showUploadPopup && (
        <PopUp
          className={styles.pop}
          popUpColor="green"
          section1Children={
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", position: "relative" }}>
              <h2>{t("media.uploadConfirm")}</h2>
              <span
                onClick={() => setShowUploadPopup(false)}
                style={{ position: "absolute", right: 0, cursor: "pointer", color: "gray", padding: "4px" }}
              >
                <XIcon size={20} />
              </span>
            </div>
          }
          section2Children={
            <>
              <Button
                text={t("media.uploadYes")}
                buttonColor="green"
                action={handleUploadConfirm}
                className={styles.popupButton}
              />
              <Button
                text={t("media.uploadNo")}
                buttonColor="blue"
                action={handleUploadDecline}
                className={styles.popupButton}
              />
            </>
          }
        />
      )}
      {showPopup && (
        <PopUp
          className={styles.pop}
          popUpColor="green"
          section1Children={
            <>
              <h2>{t("media.youtubeHeading")}</h2>
            </>
          }
          section1Styles={styles.section1}
          section2Children={
            <>
              <Form
                className={styles.textInput}
                onSubmit={handleYoutubeSubmit}
                inputs={[
                  {
                    name: "youtubeURL",
                    label: "",
                    type: "text",
                    placeholder: t("media.youtubePlaceholder"),
                    defaultValue: "",
                  },
                ]}
              >
                <Button
                  text={t("media.streamFromServer")}
                  buttonColor="green"
                  className={styles.popupButton}
                />
              </Form>
            </>
          }
          section2Styles={styles.section2}
        />
      )}
      <div className={styles.videoSelector}>
        <input
          type="file"
          accept="video/*"
          id="movie-file-upload"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        {sourceType === "youtube" ? (
          <button
            type="button"
            className={styles.videoSource}
            onClick={() => setShowPopup(true)}
          >
            {t("media.youtubeVideo")}
          </button>
        ) : (
          <button
            type="button"
            className={styles.videoSource}
            onClick={() =>
              document.getElementById("movie-file-upload")?.click()
            }
          >
            {t("media.localVideo")}
          </button>
        )}
        <div className={styles.dropdown}>
          <select
            onChange={(e) => setSourceType(e.target.value)}
            className={`${styles.selector}`}
          >
            <option value="local">{t("media.deviceFile")}</option>
            <option value="youtube">{t("media.youtubeOption")}</option>
          </select>
          <ChevronDown className={styles.dropdownArrow} />
        </div>
      </div>
      {hostUploadMsg && <p className={styles.hostUploadMsg}>{hostUploadMsg}</p>}
    </div>
  );
}
