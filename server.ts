import "dotenv/config";
import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { parse } from "url";
import { getToken } from "next-auth/jwt";
import { deleteRoom, insertMessage, getRoomMessages, setRoomEmptiedAt, clearRoomEmptiedAt, getEmptyRoomsOlderThan, setRoomVideo, updateRoomVideoState, verifyRoomHost, updateRoomPermissions, getRoomById, getUser } from "@/app/backend/database";
import { generateAiResponse } from "@/app/backend/ai";

declare module "socket.io" {
    interface Socket {
        userId?: string;
        username?: string;
        roomId?: string;
    }
}

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
console.log("Server is starting...");

const roomUsers = new Map<string, Set<string>>();
const roomMembers = new Map<string, Map<string, { username: string; userId?: string }>>();
const mutedUsers = new Map<string, Set<string>>();
const voiceUsers = new Map<string, Map<string, { username: string }>>();
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

async function trackSocketInRoom(socketId: string, roomId: string) {
    const sockets = roomUsers.get(roomId);
    const wasEmpty = !sockets || sockets.size === 0;
    if (!sockets) {
        roomUsers.set(roomId, new Set());
    }
    roomUsers.get(roomId)!.add(socketId);
    if (wasEmpty) {
        await clearRoomEmptiedAt(roomId);
    }
}

// removes socket from all rooms, marks room as empty if last socket left
async function untrackSocketFromAllRooms(socketId: string) {
    for (const [roomId, sockets] of roomUsers.entries()) {
        if (sockets.has(socketId)) {
            sockets.delete(socketId);
            if (sockets.size === 0) {
                roomUsers.delete(roomId);
                await setRoomEmptiedAt(roomId);
            }
        }
    }
}

function getMemberList(roomId: string) {
    const members = roomMembers.get(roomId);
    if (!members) return [];
    return Array.from(members.entries()).map(([socketId, info]) => ({
        socketId,
        username: info.username,
        userId: info.userId,
        isMuted: mutedUsers.get(roomId)?.has(info.username) ?? false,
    }));
}

function broadcastMembers(io: Server, roomId: string) {
    const list = getMemberList(roomId);
    if (list.length === 0) return;
    io.to(roomId).emit("members-update", list);
}

app.prepare().then(() => {

    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });
    const io = new Server(httpServer, {
        path: "/api/socket",
        cors: {
            origin: process.env.CORS_ORIGIN || "http://localhost:3000",
            methods: ["GET", "POST"],
        },
    });

    // reads the jwt from cookies on every connection, so socket.userId is set server side so it cant be hacked by client
    io.use(async (socket, next) => {
        try {
            const token = await getToken({
                req: { headers: socket.request.headers as Record<string, string> },
                secret: process.env.AUTH_SECRET,
            });
            if (token?.sub) {
                socket.userId = token.sub;
            }
        } catch {
            // user is guest
        }
        next();
    });

    io.on("connection", (socket) => {

        // Joins the socket to the room channel and tracks it
        socket.on("join-room", async (roomId) => {
            socket.join(roomId);
            socket.roomId = roomId;
            await trackSocketInRoom(socket.id, roomId);

            const room = await getRoomById(roomId);
            if (room?.videoUrl) {
                let uploader = "Someone";
                if (room.hostId) {
                    const host = await getUser(room.hostId);
                    if (host) uploader = host.username;
                }
                const name = room.videoType === "local"
                    ? decodeURIComponent(room.videoUrl.split("/").pop() || "a video")
                    : room.videoUrl;
                socket.emit("current-room-video", {
                    url: room.videoUrl,
                    name,
                    user: uploader,
                    videoType: room.videoType,
                });
            }
        });

        // on disconnect, do general cleanup for tracking, member list, broadcast
        socket.on("disconnect", async () => {
            const roomId = socket.roomId;
            await untrackSocketFromAllRooms(socket.id);
            if (roomId) {
                roomMembers.get(roomId)?.delete(socket.id);
                if (roomMembers.get(roomId)?.size === 0) {
                    roomMembers.delete(roomId);
                }
                broadcastMembers(io, roomId);
                voiceUsers.get(roomId)?.delete(socket.id);
                if (voiceUsers.get(roomId)?.size === 0) {
                    voiceUsers.delete(roomId);
                }
                socket.to(roomId).emit("voice-user-left", { socketId: socket.id });
            }
        });

        socket.on("user-join", async (data) => {

            socket.username = data.user;
            if (!roomMembers.has(data.roomId)) {
                roomMembers.set(data.roomId, new Map());
            }
            roomMembers.get(data.roomId)!.set(socket.id, { username: data.user, userId: socket.userId });
            broadcastMembers(io, data.roomId);

            socket.to(data.roomId).emit("user-join-sync", {
                user: data.user
            });
        });

        socket.on("get-members", (roomId: string) => {
            socket.emit("members-update", getMemberList(roomId));
        });
        socket.on("set-video", async (data) => {
            try {
                await setRoomVideo(data.roomId, data.url, data.videoType);
            } catch (err) {
                console.error("Failed to save video:", err);
            }
            socket.to(data.roomId).emit("set-video-sync", {
                url: data.url,
                name: data.name,
                user: data.user,
                videoType: data.videoType,
            });
        });
        socket.on("send-message", async (data) => {
            const roomId = data.roomId;
            const muted = mutedUsers.get(roomId);
            if (muted && data.message?.user && muted.has(data.message.user)) {
                socket.emit("muted", { code: "errors.muted" });
                return;
            }

            const serverTimestamp = Math.floor(Date.now() / 1000);
            let messageId: string | undefined;
            try {
                messageId = await insertMessage(
                    roomId,
                    socket.userId ?? null,
                    data.message.text,
                    data.message.user
                );
            } catch (err) {
                console.error("Failed to save message:", err);
            }
            if (!messageId) return;
            socket.to(data.roomId).emit("send-message-sync", {
                message: { ...data.message, id: messageId, rawTimestamp: serverTimestamp }
            });

            const text = data.message?.text?.trim();
            if (text) {
                const lowerText = text.toLowerCase();
                let query = "";
                if (lowerText.startsWith("@ai")) {
                    query = text.slice(3).trim();
                } else if (lowerText.startsWith("@")) {
                    query = text.slice(1).trim();
                } else if (lowerText.endsWith("ai@")) {
                    query = text.slice(0, -3).trim();
                } else if (lowerText.endsWith("@")) {
                    query = text.slice(0, -1).trim();
                }
                if (query) {
                    const recentMessages = await getRoomMessages(roomId);
                    const history = recentMessages
                        .filter(m => m.messageType !== "ai" || m.user === "🤖 AI")
                        .slice(-20)
                        .map(m => ({
                            role: m.user === "🤖 AI" ? "model" as const : "user" as const,
                            text: m.text,
                        }));

                    const aiText = await generateAiResponse(query, history);
                    if (aiText) {
                        const aiId = await insertMessage(
                            roomId,
                            null,
                            aiText,
                            "🤖 AI",
                            "ai"
                        );
                        if (aiId) {
                            io.to(roomId).emit("send-message-sync", {
                                message: {
                                    user: "🤖 AI",
                                    text: aiText,
                                    id: aiId,
                                    messageType: "ai",
                                    rawTimestamp: Math.floor(Date.now() / 1000),
                                }
                            });
                        }
                    }
                }
            }
        });
        socket.on("get-messages", async (roomId) => {
            try {
                const messages = await getRoomMessages(roomId);
                socket.emit("load-messages", messages);
            } catch (err) {
                console.error("Failed to load messages:", err);
                socket.emit("load-messages", []);
            }
        });
        socket.on("video-play", async (data) => {
            try {
                await updateRoomVideoState(data.roomId, data.progress, !data.status);
            } catch (err) {
                console.error("Failed to save video state:", err);
            }
            socket.to(data.roomId).emit("video-play-sync", {
                actionAt: data.actionAt,
                progress: data.progress,
                user: data.user,
                status: data.status,
            });
            const actionUsername = socket.username ?? data.user?.name ?? "Someone";
            if (actionUsername) {
                const action = data.status ? "played" : "paused";
                socket.to(data.roomId).emit("video-action-sync", {
                    user: actionUsername,
                    action,
                });
            }
        });
        socket.on("room-settings", async (data, callback) => {
            const result = await updateRoomPermissions(data.roomName, socket.userId, data.canControl, data.canChat, data.canUpload);
            if (callback) callback(result);
        });

        socket.on("kick-user", async (data, callback) => {
            const room = await verifyRoomHost(data.roomName, socket.userId);
            if (!room) {
                if (callback) callback({ success: false, code: "errors.hostOnlyKick" });
                return;
            }
            const members = roomMembers.get(room.id);
            if (!members) return;
            for (const [sid, info] of members) {
                if (info.username === data.targetUsername) {
                    const targetSocket = io.sockets.sockets.get(sid);
                    if (targetSocket) {
                        targetSocket.emit("kicked", { code: "errors.kicked" });
                        targetSocket.disconnect(true);
                    }
                    break;
                }
            }
            if (callback) callback({ success: true });
        });

        socket.on("mute-user", async (data, callback) => {
            const room = await verifyRoomHost(data.roomName, socket.userId);
            if (!room) {
                if (callback) callback({ success: false, code: "errors.hostOnlyMute" });
                return;
            }
            if (!mutedUsers.has(room.id)) {
                mutedUsers.set(room.id, new Set());
            }
            mutedUsers.get(room.id)!.add(data.targetUsername);

            const members = roomMembers.get(room.id);
            for (const [sid, info] of members ?? []) {
                if (info.username === data.targetUsername) {
                    const targetSocket = io.sockets.sockets.get(sid);
                    if (targetSocket) {
                        targetSocket.emit("muted", { code: "errors.mutedByHost" });
                    }
                    break;
                }
            }

            broadcastMembers(io, room.id);
            if (callback) callback({ success: true });
        });

        socket.on("unmute-user", async (data, callback) => {
            const room = await verifyRoomHost(data.roomName, socket.userId);
            if (!room) {
                if (callback) callback({ success: false, code: "errors.hostOnlyUnmute" });
                return;
            }
            mutedUsers.get(room.id)?.delete(data.targetUsername);
            broadcastMembers(io, room.id);
            if (callback) callback({ success: true });
        });

        // Voice chat signaling
        socket.on("voice-join", () => {
            const roomId = socket.roomId;
            if (!roomId) return;
            if (!voiceUsers.has(roomId)) {
                voiceUsers.set(roomId, new Map());
            }
            const users = voiceUsers.get(roomId)!;
            const existing = Array.from(users.entries()).map(([sid, info]) => ({
                socketId: sid,
                username: info.username,
            }));
            socket.emit("voice-existing-users", existing);
            users.set(socket.id, { username: socket.username ?? "Guest" });
            socket.to(roomId).emit("voice-user-joined", {
                socketId: socket.id,
                username: socket.username ?? "Guest",
            });
        });

        socket.on("voice-leave", () => {
            const roomId = socket.roomId;
            if (!roomId) return;
            voiceUsers.get(roomId)?.delete(socket.id);
            if (voiceUsers.get(roomId)?.size === 0) {
                voiceUsers.delete(roomId);
            }
            socket.to(roomId).emit("voice-user-left", { socketId: socket.id });
        });

        socket.on("voice-offer", (data: { targetSocketId: string; offer: unknown }) => {
            socket.to(data.targetSocketId).emit("voice-offer", {
                offer: data.offer,
                socketId: socket.id,
                username: socket.username ?? "Guest",
            });
        });

        socket.on("voice-answer", (data: { targetSocketId: string; answer: unknown }) => {
            socket.to(data.targetSocketId).emit("voice-answer", {
                answer: data.answer,
                socketId: socket.id,
            });
        });

        socket.on("voice-ice-candidate", (data: { targetSocketId: string; candidate: unknown }) => {
            socket.to(data.targetSocketId).emit("voice-ice-candidate", {
                candidate: data.candidate,
                socketId: socket.id,
            });
        });
    });

    setInterval(() => {
        (async () => {
            try {
                const rooms = await getEmptyRoomsOlderThan(24);
                for (const room of rooms) {
                    const sockets = roomUsers.get(room.id);
                    if (sockets && sockets.size > 0) {
                        await clearRoomEmptiedAt(room.id);
                        continue;
                    }
                    try {
                        await deleteRoom(room.id);
                    } catch (err) {
                        console.error(`Failed to delete room ${room.id}:`, err);
                    }
                }
            } catch (err) {
                console.error("Room cleanup failed:", err);
            }
        })();
    }, CLEANUP_INTERVAL_MS);

    const port = parseInt(process.env.PORT || "3000", 10);
    httpServer.on("error", (err) => {
        console.error("HTTP server failed to start:", err);
        process.exit(1);
    });
    httpServer.listen(port, "0.0.0.0", () => {
        console.log(`MovieNight is running on http://0.0.0.0:${port}`);
    });
}).catch((err) => {
    console.error("Next.js preparation failed:", err);
});
