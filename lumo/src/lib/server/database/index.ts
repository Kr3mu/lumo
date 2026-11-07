import type { Request, Target } from "./ops";
import type { LumoError } from "./errors";

import { RunOp } from "./ops";
import { Sessions } from "./sessions";
import { ToLumoError } from "./errors";
import { GetConfig, MaskConfig, Settings } from "./config";
import * as Worker from "./worker-host";
import { Log } from "lib/shared";
import { createConnection, createPool } from "mariadb";

export type { Request, Statement } from "./ops";

export type Answer = [unknown] | [null, LumoError];

const fallbackConnectionLimit = 2;
// Big batches would only burn the whole inline budget, so they go straight to the async path.
const inlineBatchLimit = 16;

let local: Target | undefined;
let readyPromise: Promise<Target> | undefined;

export function Connected() {
    return local != null;
}

export function Ready() {
    readyPromise ??= connect()
        .then((target) => (local = target))
        .catch((error) => {
            readyPromise = undefined;
            throw error;
        });

    return readyPromise;
}

// Answers inline when the worker replies within the budget, else a promise of the answer. Never throws.
export function Dispatch(req: Request): Answer | Promise<Answer> {
    const started = performance.now();
    const inline = Settings.inlineBudgetMs > 0 && (req.batch == null || req.batch.length < inlineBatchLimit);
    if (!local || !Worker.Active() || !inline) return dispatchAsync(req, started);

    try {
        const result = Worker.RequestSync(req, Settings.inlineBudgetMs);
        if (result instanceof Promise) return result.then((value) => answered(req, started, value), (error) => failed(req, started, error));
        return answered(req, started, result);
    } catch (error) {
        return failed(req, started, error);
    }
}

async function dispatchAsync(req: Request, started: number): Promise<Answer> {
    try {
        const target = local ?? (await Ready());
        const result = Worker.Active() ? await Worker.Request(req) : await RunOp(target, req);
        return answered(req, started, result);
    } catch (error) {
        return failed(req, started, error);
    }
}

function answered(req: Request, started: number, value: unknown): Answer {
    report(req, performance.now() - started);
    return [value ?? null];
}

function failed(req: Request, started: number, error: unknown): Answer {
    const err = ToLumoError(error);
    report(req, performance.now() - started);
    if (Settings.debug) Log.Error(`[lumo] ${req.resource}: ${err.code ?? "error"} ${err.message} (${describe(req)})`);
    return [null, { ...err, sql: err.sql ?? (req.sql || null) }];
}

const logSqlLength = 240;

function describe(req: Request) {
    const sql = req.batch ? `BATCH (${req.batch.length}) ${req.batch.map((s) => s[0]).join("; ")}` : req.sql || req.op;
    const text = sql.replace(/\s+/g, " ").trim();
    return text.length > logSqlLength ? `${text.slice(0, logSqlLength)}...` : text;
}

function report(req: Request, ms: number) {
    if (ms >= Settings.slowQueryMs && req.op !== "checkout") {
        Log.Warn(`[lumo] Slow query from ${req.resource} (${ms.toFixed(1)}ms): ${describe(req)}`);
    } else if (Settings.debug) {
        Log.Debug(`[lumo] ${req.resource} ${req.op} ${describe(req)} (${ms.toFixed(1)}ms)`);
    }
}

async function connect(): Promise<Target> {
    const configuration = GetConfig();

    try {
        const connection = await createConnection(configuration);
        try {
            const info = connection.info;
            if (!info) throw new Error("Database connection info was unavailable");

            const version = info.serverVersion;
            const recommended = "Install MariaDB 11.4+ for the best experience.";
            if (!version.mariaDb) throw new Error(`MySQL ${version.raw} is not supported. ${recommended}`);
            if (!info.hasMinVersion(11, 4, 0)) throw new Error(`${version.raw} is not supported. ${recommended}`);

            Log.Success(`[lumo] Connected to ${version.raw}`);
        } finally {
            await connection.end().catch(() => undefined);
        }
    } catch (error) {
        const err = ToLumoError(error);
        Log.Error(`[lumo] Connection failed (${err.code ?? "unknown"}): ${err.message}`);
        Log.Error(`[lumo] ${JSON.stringify(MaskConfig(configuration))}`);
        throw error;
    }

    const workerStarted = Worker.Start(configuration, Settings.checkoutTimeoutMs);
    const pool = createPool(workerStarted ? { ...configuration, connectionLimit: fallbackConnectionLimit } : configuration);
    const sessions = new Sessions(pool, Settings.checkoutTimeoutMs, (id, resource, heldMs) =>
        Log.Warn(`[lumo] Session ${id} of ${resource} timed out after ${heldMs.toFixed(0)}ms and was rolled back`),
    );
    return { pool, sessions };
}
