import { pgTable, jsonb, text, timestamp, integer, boolean, doublePrecision, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('user', {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text('username').notNull().unique(),
    password: text('password'),
    email: text("email").notNull().unique(),
    createdAt: timestamp('created_at').defaultNow(),
    emailVerified: boolean('email_verified').default(false),
});


export const rooms = pgTable('room', {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text('name').unique().notNull(),
    hostId: uuid('host_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    videoUrl: text('video_url'),
    videoTimestamp: doublePrecision('video_timestamp').default(0).notNull(),
    lastActionTime: timestamp('last_action_time').defaultNow().notNull(),
    videoType: text('video_type', { enum: ['youtube', 'local'] }),
    isPaused: boolean('is_paused').default(true),
    emptiedAt: timestamp('emptied_at'),
    guestPermission: jsonb('guest_permission').$type<{
        canControl: boolean;
        canChat: boolean;
        canUpload: boolean;
    }>().default({
        canControl: false,
        canChat: true,
        canUpload: false,
    }).notNull(),

});

export const sessions = pgTable("session", {
    sessionToken: uuid("session_Token").defaultRandom().primaryKey(),
    userId: uuid("user_Id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires_at", { mode: "date" }).notNull(),
});

export const messages = pgTable('message', {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id').references(() => rooms.id),
    userId: uuid('user_id').references(() => users.id),
    content: text('content').notNull(),
    messageType: text('message_type', { enum: ['user', 'ai', 'system'] }).default('user'),
    timestamp: integer('timestamp').$defaultFn(() => Math.floor(Date.now() / 1000)),
    username: text('username'),
});

export const subtitles = pgTable('subtitle', {
    roomId: uuid('room_id').references(() => rooms.id).notNull(),
    name: text('name').notNull(),
    data: text('data').notNull(),
})

export type Room = typeof rooms.$inferSelect;
export type messages = typeof messages.$inferSelect;
export type User = typeof users.$inferSelect;
export type session = typeof sessions.$inferSelect;
export type Subtitle = typeof subtitles.$inferSelect;
