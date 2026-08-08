"use client";

import { signInAction, roomLogicAction } from "@/app/backend/actions";
import { useRouter } from "next/navigation";
import { PlusCircle, ArrowRightCircle, LogInIcon, KeyIcon } from "lucide-react";
import styles from "@/app/styles/home.module.css";
import Card from "../UI/Card";
import Button from "../UI/Button";
import Form from "../UI/Form";
import PopUp from "../UI/PopUp";
import LanguageToggle from "../UI/LanguageToggle";
import Image from "next/image";
import logo from "@/app/images/logo3.png";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export function HomePage() {
  // t() is a translator
  const { t } = useI18n();
  const [isActive, setIsActive] = useState(false);
  const [roomNotFound, setRoomNotFound] = useState<string | null>(null);
  const [roomExists, setRoomExists] = useState<string | null>(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  const { data: session, status } = useSession();
  const router = useRouter();
  const handleCreateRoom = async (data: FormData) => {
    setRoomExists(null);
    setNotLoggedIn(false);
    if (status !== "authenticated") {
      setNotLoggedIn(true);
      return;
    }
    const roomName = data.get("roomName");
    if (
      !roomName ||
      typeof roomName !== "string" ||
      roomName.trim().length === 0
    ) {
      setRoomNotFound(t("home.createRoom.nameRequired"));
      return;
    }
    const res = await roomLogicAction(roomName, true, session.user?.id);
    if (res?.success === true) {
      const roomName = res.roomName;
      if (roomName) {
        router.push(`/room/${encodeURIComponent(roomName)}`);
      }
    } else if (res?.success === false) {
      setRoomExists(res.code ? t(res.code) : "");
    }
  };
  const toggle = async () => {
    setIsActive(!isActive);
  };
  const handleJoinRoom = async (data: FormData) => {
    setRoomNotFound(null);
    const roomName = data.get("roomName");
    if (
      !roomName ||
      typeof roomName !== "string" ||
      roomName.trim().length === 0
    ) {
      setRoomNotFound(t("home.joinRoom.nameRequired"));
      return;
    }
    const res = await roomLogicAction(roomName, false);
    if (res?.success === true) {
      const roomName = res.roomName;
      if (roomName) {
        router.push(`/room/${encodeURIComponent(roomName)}`);
      }
    } else if (res?.success === false) {
      setRoomNotFound(res.code ? t(res.code) : "");
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.langBtn}>
        <LanguageToggle />
      </div>
      <div
        className={styles.loginBtn}
        onClick={toggle}
        title={t("home.loginOrSignUp")}
      >
        <LogInIcon />
      </div>
      {isActive && (
        <PopUp
          className={styles.loginPopup}
          popUpColor="green"
          onClose={toggle}
          section1Children={
            <>
              <div className={styles.heading}>
                <KeyIcon className={styles.headingIcon} />
                <h2>{t("home.loginOrSignUp")}</h2>
              </div>

              {status === "authenticated" ? (
                <p className={styles.welcomeMsg}>
                  {t("home.welcomeBack", { name: session.user?.name ?? "" })}
                </p>
              ) : null}
              {status !== "authenticated" && (
                <button
                  className={styles.googleBtn}
                  type="button"
                  onClick={async () => {
                    await signInAction("google");
                  }}
                >
                  {t("home.continueWithGoogle")}
                </button>
              )}
            </>
          }
          section2Children={<div />}
        />
      )}
      <Image
        src={logo}
        alt={t("home.logoAlt")}
        placeholder="blur"
        width={600}
        style={{ maxWidth: "100%", height: "auto" }}
      />
      <div className={styles.row}>
        <Card
          className={styles.homeCard}
          cardColor="green"
          titleChildren={
            <>
              <PlusCircle
                className={`${styles.cardIcons} ${styles.greenIcon}`}
              />
              <h2>{t("home.createRoom.title")}</h2>
              <span>{t("home.createRoom.description")}</span>
            </>
          }
          actionChildren={
            <>
              <p>{t("home.youllBeHost")}</p>
              <Form
                className={styles.textInput}
                inputs={[
                  {
                    name: "roomName",
                    label: "",
                    type: "text",
                    placeholder: t("home.createRoom.placeholder"),
                    defaultValue: "",
                  },
                ]}
                onSubmit={handleCreateRoom}
              >
                {notLoggedIn && (
                  <span
                    style={{
                      color: "var(--errorColor)",
                      fontSize: "14px",
                      textAlign: "start",
                      paddingInlineStart: "4px",
                      fontWeight: "500",
                    }}
                  >
                    {t("home.createRoom.loginRequired")}
                  </span>
                )}
                {roomExists && (
                  <span
                    style={{
                      color: "var(--errorColor)",
                      fontSize: "14px",
                      textAlign: "start",
                      paddingInlineStart: "4px",
                      fontWeight: "500",
                    }}
                  >
                    {roomExists}
                  </span>
                )}
                <Button
                  className={styles.homeButton}
                  text={t("home.createRoom.button")}
                  buttonColor="green"
                />
              </Form>
            </>
          }
        />
        <Card
          className={styles.homeCard}
          cardColor="blue"
          titleChildren={
            <>
              <ArrowRightCircle
                className={`${styles.cardIcons} ${styles.blueIcon}`}
              />
              <h2>{t("home.joinRoom.title")}</h2>
              <span>{t("home.joinRoom.description")}</span>
            </>
          }
          actionChildren={
            <>
              <p>{t("home.youCanChat")}</p>

              <Form
                className={styles.textInput}
                inputs={[
                  {
                    name: "roomName",
                    label: "",
                    type: "text",
                    placeholder: t("home.joinRoom.placeholder"),
                    defaultValue: "",
                  },
                ]}
                onSubmit={handleJoinRoom}
              >
                {roomNotFound && (
                  <span
                    style={{
                      color: "var(--errorColor)",
                      fontSize: "14px",
                      textAlign: "start",
                      paddingInlineStart: "4px",
                      fontWeight: "500",
                    }}
                  >
                    {roomNotFound}
                  </span>
                )}
                <Button
                  className={styles.homeButton}
                  text={t("home.joinRoom.button")}
                  buttonColor="blue"
                />
              </Form>
            </>
          }
        />
      </div>
    </main>
  );
}
