"use server";
import { signIn as authSignIn } from "./auth";
import { registerUser, setUserPassword } from "./Registration";
import { roomLogic } from "./roomLogic";
import { getRoomByName } from "./database";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getRoomByNameAction(roomName: string) {
    try {
        const roomData = await getRoomByName(roomName)
        return roomData

    } catch {
        return null
    }
}
export async function signInAction(provider: string, data?: FormData) {
    await authSignIn(provider, data);
}

export async function signUp(data: FormData) {
    try {
        await registerUser(data);
        return { success: true, code: "errors.registered" }
    } catch (err) {
        console.error("signUp failed:", err)
        return { success: false, code: "errors.registrationFailed" }
    }

}
export async function checkUserStatus(email: string) {
    try {
        const [user] = await db
            .select({ password: users.password })
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .limit(1);
        if (!user) return { exists: false, hasPassword: false };
        return { exists: true, hasPassword: user.password !== null };
    } catch {
        return { exists: false, hasPassword: false };
    }
}

export async function setPasswordAction(formData: FormData) {
    try {
        const email = (formData.get("email") as string).toLowerCase();
        const password = formData.get("password") as string;
        return await setUserPassword(email, password);
    } catch (err) {
        console.error("setPasswordAction failed:", err)
        return { success: false, code: "errors.registrationFailed" }
    }
}

export async function roomLogicAction(roomName: string, create: boolean, userId?: string) {
    try {
        const res = await roomLogic(roomName, create, userId)
        return res
    } catch (err) {
        console.error("roomLogicAction failed:", err)
        return { success: false, code: "errors.backendIssue" }
    }
}