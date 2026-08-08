import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
    conn: postgres.Sql | undefined;
};

export function getDb() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error("DATABASE_URL is missing!");
    }

    if (!globalForDb.conn) {
        globalForDb.conn = postgres(connectionString);
    }

    return drizzle(globalForDb.conn, { schema });
}

type Db = ReturnType<typeof getDb>;

export const db = new Proxy({} as Db, {
    get(_, prop) {
        return getDb()[prop as keyof Db];
    },
});