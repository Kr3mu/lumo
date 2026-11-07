import type { Connection, Pool, PoolConnection } from "mariadb";
import type { Sessions } from "./sessions";

import { Inline } from "./inline";

export type Shape = "run" | "one" | "value" | "all";
export type EachOp = "eachRun" | "eachOne" | "eachValue" | "eachAll";
export type Op = Shape | EachOp | "batch" | "checkout" | "release" | "commit" | "rollback" | "releaseAll";

const eachShapes: Record<EachOp, Shape> = { eachRun: "run", eachOne: "one", eachValue: "value", eachAll: "all" };

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
    // The pool's connection limit: how many lanes Database.each may spread over.
    lanes: number;
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
        case "eachRun":
        case "eachOne":
        case "eachValue":
        case "eachAll":
            return each(target, request, eachShapes[op]);
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

// One statement, many parameter sets. The sets are spread over up to all of the pool's connections (one lane per
// connection, at least setsPerLane sets each; the pool opens any it hasn't yet) and every lane pipelines its slice, so MariaDB works on several at
// once. In a session everything stays on the session's connection. Results come back in the order of the sets.
const setsPerLane = 32;

async function each(target: Target, request: Request, op: Shape): Promise<unknown[]> {
    const sets = (request.values ?? []) as unknown[][];
    const results = new Array<unknown>(sets.length);
    if (sets.length === 0) return results;

    // Waits for every query of the lane before failing, so a connection is never released with queries still queued.
    const run = async (runner: { query: Connection["query"] }, first: number, step: number) => {
        const pending: Promise<void>[] = [];
        for (let i = first; i < sets.length; i += step) {
            const values = sets[i]!;
            pending.push(runner.query(request.sql, values.length > 0 ? values : undefined).then((result) => {
                results[i] = shape(op, result);
            }));
        }
        const settled = await Promise.allSettled(pending);
        for (const outcome of settled) if (outcome.status === "rejected") throw outcome.reason;
    };

    if (request.session != null) {
        await run(target.sessions.Get(request.session), 0, 1);
        return results;
    }

    // Lane n takes sets n, n + lanes, n + 2 * lanes, ...: interleaved, every lane works through the list together.
    const lanes = Math.max(1, Math.min(target.lanes, Math.ceil(sets.length / setsPerLane)));
    const work: Promise<void>[] = [];
    for (let lane = 0; lane < lanes; lane++) {
        work.push(target.pool.getConnection().then(async (connection) => {
            try {
                await run(connection, lane, lanes);
            } finally {
                connection.release();
            }
        }));
    }
    const settled = await Promise.allSettled(work);
    for (const outcome of settled) if (outcome.status === "rejected") throw outcome.reason;
    return results;
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
