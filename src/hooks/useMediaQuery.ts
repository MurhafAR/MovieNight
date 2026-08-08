"use client";

import { useSyncExternalStore } from "react";

export const useMediaQuery = (query: string) => {
  const getSnapshot = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  };

  const subscribe = (onStoreChange: () => void) => {
    if (typeof window === "undefined") return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onStoreChange);
    return () => mql.removeEventListener("change", onStoreChange);
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};
