import 'dotenv/config';
import { createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

const DRIZZLE_SCHEMA = 'drizzle';
const MIGRATIONS_TABLE = '__drizzle_migrations';

interface JournalEntry {
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
}

interface Journal {
    entries: JournalEntry[];
}

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL is missing!');
        process.exit(1);
    }

    const sql = postgres(connectionString, { max: 1 });
    const journal: Journal = JSON.parse(
        readFileSync(join(process.cwd(), 'drizzle', 'meta', '_journal.json'), 'utf8')
    );

    const migrationFiles: Record<string, string> = {};
    for (const file of readdirSync(join(process.cwd(), 'drizzle'))) {
        if (file.endsWith('.sql')) {
            migrationFiles[file.replace(/\.sql$/, '')] = file;
        }
    }

    const migrationsTable = sql`${sql(DRIZZLE_SCHEMA)}.${sql(MIGRATIONS_TABLE)}`;

    try {
        await sql`create schema if not exists ${sql(DRIZZLE_SCHEMA)}`;
        await sql`create table if not exists ${migrationsTable} (
            id serial primary key,
            hash text not null,
            created_at bigint
        )`;

        const applied = new Set(
            (await sql<{ hash: string }[]>`select hash from ${migrationsTable}`).map((row) => row.hash)
        );

        let marked = 0;
        for (const entry of journal.entries) {
            const file = migrationFiles[entry.tag];
            if (!file) {
                console.error(`Migration file for "${entry.tag}" not found!`);
                process.exit(1);
            }

            const content = readFileSync(join(process.cwd(), 'drizzle', file), 'utf8');
            const hash = createHash('sha256').update(content).digest('hex');
            if (applied.has(hash)) continue;

            const tables = extractCreatedTables(content);
            let allExist = true;
            for (const table of tables) {
                const [row] = await sql<{ exists: boolean }[]>`select to_regclass(${`public.${table}`}) is not null as exists`;
                if (!row?.exists) {
                    allExist = false;
                    break;
                }
            }

            if (tables.length > 0 && allExist) {
                await sql`insert into ${migrationsTable} (hash, created_at) values (${hash}, ${entry.when})`;
                console.log(`[db-reconcile] marked ${entry.tag} as applied (schema already present)`);
                marked++;
            }
        }

        console.log(marked === 0 ? '[db-reconcile] nothing to reconcile' : `[db-reconcile] reconciled ${marked} migration(s)`);
    } finally {
        await sql.end();
    }
}

function extractCreatedTables(sqlContent: string): string[] {
    const tables: string[] = [];
    const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["']?[\w."']+\s*\.\s*)?["']?([A-Za-z_][\w]*?)["']?\s*\(/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sqlContent)) !== null) {
        if (!tables.includes(match[1])) {
            tables.push(match[1]);
        }
    }
    return tables;
}

main().catch((err) => {
    console.error('[db-reconcile] failed:', err);
    process.exit(1);
});
