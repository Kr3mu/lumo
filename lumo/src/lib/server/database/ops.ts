import type { Connection, Pool, QueryOptions } from "mariadb";
import { Inline } from "./inline";
import type { Dictionary, OkPacket, QueryValues } from "types/database";

export type WorkerOp = "query" | "scalar" | "row" | "insert" | "update" | "batch" | "transaction" | "prepare" | "prepareMany";

export type TransactionStatement = string | [sql: string, values?: QueryValues];

// Single-statement ops also run on a plain connection; transactions and batches always get the pool.
export async function RunOp(
    pool: Pool | Connection,
    op: WorkerOp,
    query: string | QueryOptions,
    values?: QueryValues,
    batches?: unknown[],
    multiPool?: Pool,
): Promise<unknown> {
    switch (op) {
        case "query":
            return pool.query(query, values);
        case "row": {
            const rows = (await pool.query(query, values)) as Dictionary[];
            return rows?.[0] ?? null;
        }
        case "scalar": {
            const rows = (await pool.query(query, values)) as Dictionary[];
            return firstColumn(rows?.[0]);
        }
        case "insert":
            return ((await pool.query(query, values)) as OkPacket).insertId;
        case "update":
            return ((await pool.query(query, values)) as OkPacket).affectedRows;
        case "batch":
            return pool.batch(query, values);
        case "transaction":
            return multiPool
                ? transactMulti(multiPool, (batches ?? []) as TransactionStatement[])
                : transact(pool as Pool, (batches ?? []) as TransactionStatement[]);
        case "prepare":
            return unwrap(await pool.query(query, values));
        case "prepareMany":
            return prepareMany(pool as Pool, query, batches as QueryValues[]);
        default:
            throw new Error(`Unknown database op "${op satisfies never}"`);
    }
}

// Each set goes straight onto one of the idle connections, held for the batch, so the connector
// pipelines them instead of paying a pool acquire/release (and waiting for the previous reply) per
// set. Only idle ones are taken, so holding them can never wait on a connection it holds itself.
async function prepareMany(pool: Pool, query: string | QueryOptions, sets: QueryValues[]) {
    const count = Math.max(1, Math.min(sets.length, pool.idleConnections()));
    const connections = await Promise.all(Array.from({ length: count }, () => pool.getConnection()));
    const results = new Array<unknown>(sets.length);
    const pending: Promise<unknown>[] = [];

    for (let i = 0; i < sets.length; i++) {
        pending.push(connections[i % count]!.query(query, sets[i]).then((rows) => (results[i] = unwrap(rows))));
    }

    try {
        await Promise.all(pending);
        return results;
    } finally {
        // A failed set must not hand back connections that still have sets queued on them.
        await Promise.allSettled(pending);
        for (const connection of connections) connection.release();
    }
}

async function transact(pool: Pool, statements: TransactionStatement[]) {
    const connection = await pool.getConnection();

    try {
        // Issued without awaiting so the connector pipelines them. COMMIT is only sent once every
        // statement succeeded; on failure ROLLBACK queues behind the still-running statements.
        const pending: Promise<unknown>[] = [connection.query("START TRANSACTION")];

        for (const statement of statements) {
            if (typeof statement === "string") pending.push(connection.query(statement));
            else pending.push(connection.query(statement[0], statement[1]));
        }

        for (const p of pending) p.catch(() => undefined);
        await Promise.all(pending);
        await connection.query("COMMIT");
        return true;
    } catch (error) {
        await connection.query("ROLLBACK").catch(() => undefined);
        throw error;
    } finally {
        connection.release();
    }
}

const statementsPerPacket = 1000;
// Statements are inlined and sent as a few multi-statement COM_QUERYs. MariaDB stops a
// multi-statement at its first error; later chunks may still run, and ROLLBACK undoes them all.
async function transactMulti(pool: Pool, statements: TransactionStatement[]) {
    const connection = await pool.getConnection();

    try {
        const pending: Promise<unknown>[] = [];
        let chunk = ["START TRANSACTION"];

        for (const statement of statements) {
            const sql = typeof statement === "string" ? statement : Inline(connection, statement[0], statement[1]);
            chunk.push(endsClean(sql) ? sql : sql.replace(/[\s;]+$/, ""));
            if (chunk.length === statementsPerPacket) {
                pending.push(connection.query(chunk.join(";")));
                chunk = [];
            }
        }

        chunk.push("COMMIT");
        for (const p of pending) p.catch(() => undefined);
        await Promise.all(pending);
        await connection.query(chunk.join(";"));
        return true;
    } catch (error) {
        await connection.query("ROLLBACK").catch(() => undefined);
        throw error;
    } finally {
        connection.release();
    }
}

// Statements rarely end in whitespace or ";", so the trimming regex only runs when one does.
function endsClean(sql: string) {
    const c = sql.charCodeAt(sql.length - 1);
    return c !== 59 && c > 32 && c < 127;
}

function firstColumn<T>(row: Dictionary | undefined): T | null {
    if (!row) return null;

    for (const key in row) {
        return row[key] as T;
    }

    return null;
}

// oxmysql's prepare unwraps one row/one column to the value, one row to the row.
export function unwrap(rows: unknown) {
    const list = rows as Dictionary[];
    if (list.length === 0) return null;
    if (list.length > 1) return list;

    const row = list[0]!;
    let only: unknown;
    let count = 0;
    for (const key in row) {
        only = row[key];
        if (++count > 1) return row;
    }
    return only;
}
