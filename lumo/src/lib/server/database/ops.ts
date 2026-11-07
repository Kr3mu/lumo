import type { Connection, Pool, PoolConnection } from "mariadb";
import type { Sessions } from "./sessions";

import { Inline } from "./inline";

export type Shape = "run" | "one" | "value" | "all";
export type Op = Shape | "batch" | "checkout" | "release" | "commit" | "rollback" | "releaseAll";

export type Statement = [sql: string, values: unknown[] | null];

export interface Request {
    op: Op;
    sql: string;
    values: unknown[] | null;
    batch: Statement[] | null;
    session: number | null;
    resource: string;
}

export interface Target {
    pool: Pool;
    sessions: Sessions;
    // Pool with multipleStatements enabled; without it batches pipeline one statement at a time.
    multi?: Pool;
}

export function IsShape(op: Op): op is Shape {
    return op === "run" || op === "one" || op === "value" || op === "all";
}

// `connection` is the worker's dedicated fast connection, when it may take this request.
export async function RunOp(target: Target, request: Request, connection?: Connection): Promise<unknown> {
    const { op, session } = request;

    switch (op) {
        case "run":
        case "one":
        case "value":
        case "all": {
            const runner = connection ?? (session != null ? target.sessions.Get(session) : target.pool);
            return shape(op, await runner.query(request.sql, request.values ?? undefined));
        }
        case "batch": {
            const statements = request.batch ?? [];
            return target.multi ? transactMulti(target.multi, statements) : transact(target.pool, statements);
        }
        case "checkout":
            return target.sessions.Checkout(request.resource);
        case "release":
        case "rollback":
            return target.sessions.Release(session ?? 0, false);
        case "commit":
            return target.sessions.Release(session ?? 0, true);
        case "releaseAll":
            target.sessions.ReleaseAll(request.resource);
            return true;
        default:
            throw new Error(`Unknown op "${op satisfies never}"`);
    }
}

function shape(op: Shape, result: unknown): unknown {
    if (op === "run") {
        if (Array.isArray(result) || typeof result !== "object" || result === null) return [0, null];
        const affected = "affectedRows" in result && typeof result.affectedRows === "number" ? result.affectedRows : 0;
        const insertId = "insertId" in result && typeof result.insertId === "number" && result.insertId !== 0 ? result.insertId : null;
        return [affected, insertId];
    }

    const rows: unknown[] = Array.isArray(result) ? result : [];
    if (op === "all") return rows;

    const row = rows[0];
    if (typeof row !== "object" || row === null) return null;
    if (op === "one") return row;
    for (const key in row) return Reflect.get(row, key) ?? null;
    return null;
}

async function transact(pool: Pool, statements: Statement[]) {
    const connection = await pool.getConnection();

    try {
        // Issued without awaiting so the connector pipelines them. COMMIT is only sent once every
        // statement succeeded; on failure ROLLBACK queues behind the still-running statements.
        const pending: Promise<unknown>[] = [connection.query("START TRANSACTION")];
        for (const [sql, values] of statements) pending.push(connection.query(sql, values ?? undefined));

        for (const p of pending) p.catch(() => undefined);
        await Promise.all(pending);
        await connection.query("COMMIT");
        return true;
    } catch (error) {
        await rollback(connection);
        throw error;
    } finally {
        connection.release();
    }
}

const statementsPerPacket = 1000;
// Statements are inlined and sent as a few multi-statement COM_QUERYs. MariaDB stops a
// multi-statement at its first error; later chunks may still run, and ROLLBACK undoes them all.
async function transactMulti(pool: Pool, statements: Statement[]) {
    const connection = await pool.getConnection();

    try {
        const pending: Promise<unknown>[] = [];
        let chunk = ["START TRANSACTION"];

        for (const [statement, values] of statements) {
            const sql = Inline(connection, statement, values);
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
        await rollback(connection);
        throw error;
    } finally {
        connection.release();
    }
}

function rollback(connection: PoolConnection) {
    return connection.query("ROLLBACK").catch(() => undefined);
}

// Statements rarely end in whitespace or ";", so the trimming regex only runs when one does.
function endsClean(sql: string) {
    const c = sql.charCodeAt(sql.length - 1);
    return c !== 59 && c > 32 && c < 127;
}
