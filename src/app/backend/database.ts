import { db } from "../../db";
import { rooms, users, messages, subtitles } from "../../db/schema";
import { eq, sql, and, isNotNull } from "drizzle-orm";
import { asc } from "drizzle-orm/sql/expressions/select";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

export async function getRoomByName(roomName: string) {
    try {
        const [roomData] = await db
            .select()
            .from(rooms)
            .where(eq(rooms.name, roomName))
            .limit(1);

        return roomData
    } catch (err) {
        console.error("getRoomByName failed:", err)
        return undefined
    }
}

export async function getRoomById(roomId: string) {
    try {
        const [roomData] = await db
            .select()
            .from(rooms)
            .where(eq(rooms.id, roomId))
            .limit(1);

        return roomData
    } catch (err) {
        console.error("getRoomById failed:", err)
        return undefined
    }
}

export async function getUser(userId: string) {
    try {
        const [userData] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        return userData
    } catch (err) {
        console.error("getUser failed:", err)
        return undefined
    }
}

export async function setRoomPermissions(roomId: string, canControl: boolean, canChat: boolean, canUpload: boolean) {
    await db
        .update(rooms)
        .set({
            guestPermission: {
                canControl: canControl,
                canChat: canChat,
                canUpload: canUpload,
            }
        })
        .where(eq(rooms.id, roomId));
}

export async function insertMessage(roomId: string, userId: string | null, content: string, username: string, messageType: 'user' | 'ai' = 'user') {
    const id = randomUUID();
    await db.insert(messages).values({
        id,
        roomId,
        userId,
        content,
        messageType,
        username,
    });
    return id;
}

export async function getRoomMessages(roomId: string) {
    const rows = await db
        .select({
            id: messages.id,
            content: messages.content,
            timestamp: messages.timestamp,
            username: messages.username,
            joinedUsername: users.username,
            messageType: messages.messageType,
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.roomId, roomId))
        .orderBy(asc(messages.timestamp));

    return rows.map(msg => ({
        user: msg.username || msg.joinedUsername || 'system',
        id: msg.id,
        text: msg.content,
        timestamp: msg.timestamp!,
        messageType: msg.messageType,
    }));
}

export async function deleteRoom(roomId: string) {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);

    if (room?.videoType === "local" && room.videoUrl) {
        const filename = room.videoUrl.replace("/api/watch/", "");
        const decoded = decodeURIComponent(filename);
        const uploadDirs = [
            path.join(process.cwd(), "public", "uploads"),
            path.join(process.cwd(), "src", "public", "uploads"),
        ];
        for (const dir of uploadDirs) {
            const filePath = path.join(dir, decoded);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                break;
            }
        }
    }

    await db.transaction(async (tx) => {
        await tx.delete(messages).where(eq(messages.roomId, roomId));
        await tx.delete(subtitles).where(eq(subtitles.roomId, roomId));
        await tx.delete(rooms).where(eq(rooms.id, roomId));
    });
}

export async function setRoomEmptiedAt(roomId: string) {
    await db
        .update(rooms)
        .set({ emptiedAt: sql`now()` })
        .where(eq(rooms.id, roomId));
}

// room has users again
export async function clearRoomEmptiedAt(roomId: string) {
    await db
        .update(rooms)
        .set({ emptiedAt: null })
        .where(eq(rooms.id, roomId));
}

export async function setRoomVideo(roomId: string, videoUrl: string, videoType: 'youtube' | 'local') {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);

    if (room?.videoType === "local" && room.videoUrl && videoType === "local") {
        const oldFilename = room.videoUrl.replace("/api/watch/", "");
        const oldDecoded = decodeURIComponent(oldFilename);
        const uploadDirs = [
            path.join(process.cwd(), "public", "uploads"),
            path.join(process.cwd(), "src", "public", "uploads"),
        ];
        for (const dir of uploadDirs) {
            const filePath = path.join(dir, oldDecoded);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                break;
            }
        }
    }

    await db
        .update(rooms)
        .set({ videoUrl, videoType })
        .where(eq(rooms.id, roomId));
}

export async function updateRoomVideoState(roomId: string, videoTimestamp: number, isPaused: boolean) {
    await db
        .update(rooms)
        .set({ videoTimestamp, isPaused, lastActionTime: sql`now()` })
        .where(eq(rooms.id, roomId));
}

export async function verifyRoomHost(roomName: string, hostId: string | undefined) {
    const room = await getRoomByName(roomName);
    if (!room) return null;
    if (!hostId || room.hostId !== hostId) return null;
    return room;
}

export async function updateRoomPermissions(roomName: string, hostId: string | undefined, canControl: boolean, canChat: boolean, canUpload: boolean) {
    const room = await getRoomByName(roomName);
    if (!room) return { success: false, code: "errors.roomNotFound" };
    if (room.hostId !== hostId) return { success: false, code: "errors.hostOnlyEdit" };
    try {
        await setRoomPermissions(room.id, canControl, canChat, canUpload);
        return { success: true, code: "errors.permissionsUpdateSuccess" };
    } catch (err) {
        console.error("Failed to set room permissions:", err);
        return { success: false, code: "errors.permissionsUpdateFailed" };
    }
}

export async function getEmptyRoomsOlderThan(maxAgeHours: number) {
    const rows = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(
            and(
                isNotNull(rooms.emptiedAt),
                sql`${rooms.emptiedAt} < now() - make_interval(hours => ${maxAgeHours})`
            )
        );
    return rows;
}
