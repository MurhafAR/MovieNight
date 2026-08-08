import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { User } from "@/db/schema";
export const { handlers, auth, signIn, signOut } = NextAuth({
    session: { strategy: "jwt" },
    secret: process.env.AUTH_SECRET,
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
        Credentials({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "username" },
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials): Promise<User | null> => {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }
                let userFromDb
                try {
                    [userFromDb] = await db.select().from(users).where(eq(users.email, credentials.email as string)).limit(1);

                } catch (err) {
                    console.error(err)
                    return null
                }
                if (!userFromDb) {
                    return null;
                }


                // pretty much self explanatory
                let isValid
                try {
                    isValid = await bcrypt.compare(credentials.password as string, userFromDb.password as string);
                    if (!isValid) {
                        return null;
                    }
                } catch (err) {
                    console.error(err)
                    return null
                }

                return {
                    // return the user
                    id: userFromDb.id.toString(),
                    email: userFromDb.email,
                    username: userFromDb.username,
                } as User;
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            if (user && account?.provider === 'google') {
                // for some reason, we have to check if a google account got an email? welcome to coding!
                if (!user.email) return false;
                try {
                    // checking if the user exists
                    const existingUser = await db.select().from(users).where(eq(users.email, user.email))
                    if (existingUser.length === 0) {
                        let username = user.name || user.email.split('@')[0];
                        const nameExists = await db.select().from(users).where(eq(users.username, username));
                        if (nameExists.length > 0) {
                            username = `${username}_${crypto.randomUUID().split('-')[0]}`;
                        }
                        const [insertedUser] = await db.insert(users).values({
                            email: user.email,
                            username,
                        }).returning();
                        user.id = insertedUser.id;
                    } else {
                        user.id = existingUser[0].id;
                    }
                } catch (error) {
                    console.error("Failed to insert user data to database!", error)
                    return false;
                }
            }
            return true
        },
        async jwt({ token, user }) {
            if (user) {
                try {
                    const [newSession] = await db
                        .insert(sessions)
                        .values({
                            userId: user.id!,
                            expires: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                        })
                        .returning({
                            sessionToken: sessions.sessionToken,
                        });

                    token.sessionToken = newSession.sessionToken;
                } catch (dbError) {
                    console.error("Database insertion failed inside JWT callback:", dbError);
                }
                token.id = user.id;
                token.name = user.name;
                token.email = user.email;
            }
            return token;
        },

        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.name = token.name as string;
                session.user.email = token.email as string;
                session.sessionToken = token.sessionToken as string;
            }
            return session;
        },
    },
});