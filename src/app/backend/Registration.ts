'use server'
import { db } from "@/db";
import { users } from "@/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

export async function registerUser(formData: FormData) {

    const badEmail = formData.get("email") as string;
    const email = badEmail.toLowerCase()
    const password = formData.get("password") as string;
    const username = formData.get("username") as string;
    const hashedPassword = await bcrypt.hash(password, 10);
    let userFromDb
    try {
        userFromDb = await db.select().from(users).where(eq(users.email, email)).limit(1);
    } catch (err) {
        console.error(err)
        return { success: false, code: "errors.registrationFailed" }
    }


    if (userFromDb.length === 0) {
        try {
            await db.insert(users).values({
                email: email,
                username: username,
                password: hashedPassword,
            });
            return { success: true, code: "errors.registered" };
        } catch (err) {
            console.error(err)
            return { success: false, code: "errors.registrationFailed" };
        }
    } else if (userFromDb.length > 0) {
        return { success: false, code: "errors.userAlreadyExists" };
    }
}

export async function setUserPassword(email: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        await db.update(users)
            .set({ password: hashedPassword })
            .where(eq(users.email, email));
        return { success: true, code: "errors.passwordSet" };
    } catch (err) {
        console.error(err)
        return { success: false, code: "errors.registrationFailed" };
    }
}