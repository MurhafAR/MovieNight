"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useI18n } from "@/i18n/I18nContext";

interface UsernameProps {
  onNameChange: (name: string) => void;
}

export default function Username({ onNameChange }: UsernameProps) {
  const { data: session, status } = useSession();

  const [username, setUsername] = useState(() => {
    const randomDigits = Math.floor(1000 + Math.random() * 99000);
    return `"guest"_${randomDigits}`;
  });

  useEffect(() => {
    if (status === "authenticated" && session?.user?.name) {
      onNameChange(session.user.name);
    } else if (status === "unauthenticated") {
      onNameChange(username);
    }
  }, [status, session, username, onNameChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };

  if (status === "authenticated") {
    return <span>{session?.user?.name}</span>;
  }

  return <input type="text" value={username} onChange={handleChange} dir="ltr" />;
}
