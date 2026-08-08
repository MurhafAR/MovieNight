"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { AppSocket } from "@/app/types/global"

export const useSocket = () => {
    const [socket, setSocket] = useState<AppSocket | null>(null);
    const socketRef = useRef<AppSocket | null>(null);

    useEffect(() => {
        if (!socketRef.current) {
            const socketInstance = io({ path: "/api/socket" }) as AppSocket;
            socketRef.current = socketInstance;
            setSocket(socketInstance);
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
            }
        };
    }, []);

    return socket;
};
