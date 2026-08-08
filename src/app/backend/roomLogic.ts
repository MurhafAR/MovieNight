import { db } from "@/db";
import { Room, rooms } from "@/db/schema";
import { eq } from "drizzle-orm";
interface RoomResponse {
    success: boolean,
    roomName?: string,
    code?: string,
}

export async function roomLogic(rawName: string, create: boolean, userId?: string): Promise<RoomResponse> {
    const roomName = rawName.trim().toLowerCase();
    if (!roomName) return { success: false, code: "errors.noRoomName" }

    let existingRoom: Room | undefined;
    try {
        [existingRoom] = await db.select().from(rooms).where(eq(rooms.name, roomName)).limit(1);
    } catch (err) {
        console.error(err)
        return { success: false, code: "errors.backendIssue" }
    }
    if (create) {

        if (existingRoom) {
            return { success: false, code: "errors.roomAlreadyExists" };
        }
        try {
            await db.insert(rooms).values({
                name: roomName,
                hostId: userId
            });
            return { success: true, roomName }
        } catch (err) {
            console.error(err)
            return { success: false, code: "errors.roomCreateFailed" }
        }
    } else {

        if (!existingRoom) {
            return { success: false, code: "errors.roomNotFound" }
        } else {
            return { success: true, roomName: existingRoom.name }
        }
    }
}