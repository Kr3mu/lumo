import type { TransactionStatement, WorkerOp } from "./ops";
import type { MysqlRow, QueryValues } from "types/database";

import { RunOp } from "./ops";
import { Config, Worker } from "lib/server/database";
import { Log, Resource } from "lib/shared";
import { createConnection, createPool, type Connection, type Pool, type QueryOptions } from "mariadb";

export type { TransactionStatement, WorkerOp } from "./ops";

export * as Config from "./config";
export * as Worker from "./worker-host";

type SqlErrorLike = {
    code?: string;
    errno?: number;
    sqlState?: string;
    message?: string;
    sql?: string;
};

export class DatabaseError extends Error {
    public readonly errno?: number;
    public readonly sqlCode?: string;
    public readonly sqlState?: string;
    public readonly sql?: string;

    public constructor(error: SqlErrorLike) {
        super(error.message ?? "Database query failed");
        this.name = "DatabaseError";
        this.errno = error.errno;
        this.sqlCode = error.code;
        this.sqlState = error.sqlState;
        this.sql = error.sql;
        this.stack = undefined;
    }
}

const connectRetryMs = 10000;

let activePool: Pool | undefined;
let readyPromise: Promise<Pool> | undefined;

export function Ready() {
    readyPromise ??= connect()
        .then((pool) => {
            activePool = pool;
            return pool;
        })
        .catch((error) => {
            readyPromise = undefined;
            throw error;
        });

    return readyPromise;
}

export function Run(task: () => Promise<void>): Promise<void> {
    return Ready()
        .then(task)
        .catch((error) => {
            if (!activePool) {
                setTimeout(() => {
                    Run(task);
                }, connectRetryMs);
                return;
            }

            if (error instanceof DatabaseError) return;
            Log.Error("[database] Run task failed");
            Log.Error(error instanceof Error ? (error.stack ?? error.message) : String(error));
        });
}

export function Query<T = MysqlRow>(query: string | QueryOptions, values?: QueryValues) {
    return dispatch<T[]>("query", query, values);
}

export function Scalar<T>(query: string | QueryOptions, values?: QueryValues) {
    return dispatch<T | null>("scalar", query, values);
}

export function Row<T = MysqlRow>(query: string | QueryOptions, values?: QueryValues) {
    return dispatch<T | null>("row", query, values);
}

export async function Exists(query: string | QueryOptions, values?: QueryValues) {
    return (await Scalar<number | boolean>(query, values)) != null;
}

export function Insert(query: string | QueryOptions, values?: QueryValues) {
    return dispatch<number>("insert", query, values);
}

export function Update(query: string | QueryOptions, values?: QueryValues) {
    return dispatch<number>("update", query, values);
}

export function Batch(query: string | QueryOptions, values?: QueryValues) {
    return dispatch<unknown>("batch", query, values);
}

export function Prepare(query: string, values?: QueryValues) {
    return dispatch<unknown>("prepare", query, values);
}

export function PrepareMany(query: string, sets: QueryValues[]) {
    return dispatch<unknown[]>("prepareMany", query, undefined, sets);
}

export function DispatchAsync(op: WorkerOp, query: string, values?: QueryValues, batches?: unknown[]) {
    return dispatch<unknown>(op, query, values, batches);
}

// Returns the result on the spot when the worker replies within the wait, else a promise of it.
export function DispatchSync(op: WorkerOp, query: string, values?: QueryValues, batches?: unknown[]): unknown {
    if (!activePool || !Worker.Active()) return dispatch(op, query, values, batches);

    let result: unknown;
    try {
        result = Worker.RequestSync(op, query, values, batches);
    } catch (error) {
        reject(error);
    }
    return result instanceof Promise ? result.then(resultOf, reject) : result;
}

const resultOf = (response: { result: unknown }) => response.result;

export function Transact(statements: TransactionStatement[]) {
    return dispatch<boolean>("transaction", `TRANSACTION (${statements.length})`, undefined, statements);
}

const fallbackConnectionLimit = 2;
const slowQueryMs = 250;
const summaryLength = 120;
const errorSqlLength = 240;

function normalizeSql(query: string | QueryOptions, max: number) {
    const sql = (typeof query === "string" ? query : query.sql).replace(/\s+/g, " ").trim();
    return sql.length > max ? `${sql.slice(0, max)}...` : sql;
}

function formatSql(query: string | QueryOptions) {
    return normalizeSql(query, summaryLength);
}

function summarizeSql(query: string | QueryOptions) {
    const sql = normalizeSql(query, Number.POSITIVE_INFINITY);
    if (sql.startsWith("TRANSACTION")) return formatSql(sql);

    const verb = sql.split(" ", 1)[0]?.toUpperCase() ?? "QUERY";
    const table = /(?:FROM|INTO|UPDATE|JOIN|TABLE IF NOT EXISTS|TABLE)\s+`?(\w+)`?/i.exec(sql)?.[1];

    return table ? `${verb} ${table}` : verb;
}

function transactionLabel(query: string | QueryOptions, batches?: unknown[]) {
    if (!batches || typeof query !== "string" || !query.startsWith("TRANSACTION")) return query;

    const summary = (batches as TransactionStatement[])
        .map((statement) => summarizeSql(typeof statement === "string" ? statement : statement[0]))
        .join(", ");

    return `${query} ${summary}`;
}

function report(query: string | QueryOptions, duration: number, batches?: unknown[]) {
    if (duration >= slowQueryMs) {
        Log.Warn(`[database] Slow query (${duration.toFixed(1)}ms): ${formatSql(transactionLabel(query, batches))}`);
    } else if (Resource.IsDebug()) {
        Log.Debug(`[database] ${summarizeSql(transactionLabel(query, batches))} (${duration.toFixed(1)}ms)`);
    }
}

async function run<T>(query: string | QueryOptions, task: (pool: Pool) => Promise<T>, batches?: unknown[]) {
    const pool = activePool ?? (await Ready());
    const started = performance.now();

    try {
        return await task(pool);
    } catch (error) {
        reject(error);
    } finally {
        report(query, performance.now() - started, batches);
    }
}

async function dispatch<T>(
    op: WorkerOp,
    query: string | QueryOptions,
    values?: QueryValues,
    batches?: unknown[],
): Promise<T> {
    if (!activePool) await Ready();

    if (Worker.Active()) {
        try {
            const response = await Worker.Request(op, query, values, batches);
            report(query, response.duration, batches);
            return response.result as T;
        } catch (error) {
            if (!(error instanceof Worker.WorkerNotRunningError)) reject(error);
        }
    }

    return run(query, (pool) => RunOp(pool, op, query, values, batches), batches) as Promise<T>;
}

function reject(error: unknown): never {
    if (error instanceof DatabaseError) throw error;
    logError(error);
    throw new DatabaseError(error as SqlErrorLike);
}

function logError(error: unknown) {
    const err = error as SqlErrorLike;
    const meta = [
        err.errno != null ? `#${err.errno}` : undefined,
        err.code,
        err.sqlState ? `state ${err.sqlState}` : undefined,
    ]
        .filter(Boolean)
        .join(" · ");

    Log.Error(`[database] ${meta || "query failed"}`);
    Log.Error(`[database] ${err.message ?? String(error)}`);

    if (err.sql) Log.Error(`[database] SQL: ${normalizeSql(err.sql, errorSqlLength)}`);
}

async function connect() {
    const configuration = Config.GetConfig();
    let connection: Connection | undefined;

    try {
        connection = await createConnection(configuration);
        const info = connection.info;

        if (!info) {
            throw new Error("Database connection info was unavailable");
        }

        const { serverVersion: version } = info;
        const recommended =
            "Install MariaDB 11.4+ for the best experience.\n- https://mariadb.com/kb/en/changes-improvements-in-mariadb-11-4/";

        if (!version.mariaDb) {
            throw new Error(`MySQL ${version.raw} is not supported. ${recommended}`);
        }

        if (!info.hasMinVersion(11, 4, 0)) {
            throw new Error(`${version.raw} is not supported. ${recommended}`);
        }

        Log.Success(`[database] Connected to ${version.raw}`);
    } catch (error) {
        const err = error as SqlErrorLike;
        Log.Error(
            `[database] Connection failed (${err.code ?? "unknown"}) error ${err.errno ?? ""}: ${err.message ?? error}`,
        );
        Log.Error(`[database] ${JSON.stringify(Config.MaskConfig(configuration))}`);
        throw new DatabaseError(err);
    } finally {
        await connection?.end().catch(() => undefined);
    }

    if (Worker.Start(configuration)) {
        return createPool({ ...configuration, connectionLimit: fallbackConnectionLimit });
    }

    return createPool(configuration);
}
