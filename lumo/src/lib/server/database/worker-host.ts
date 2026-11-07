import type { WorkerOp } from "./ops";
import type { PoolConfig, QueryOptions } from "mariadb";

import { Log } from "lib/shared";
import { OnStop } from "lib/shared/resource";
import { Decode, Encode } from "./wire";
import { Handoff, Slot, done, headerBytes, replyBytes, requestBytes } from "./sync";
import { Worker } from "node:worker_threads";

export type { WorkerOp } from "./ops";

interface WorkerSuccess {
    id: number;
    ok: true;
    result: unknown;
    duration: number;
}

interface WorkerFailure {
    id: number;
    ok: false;
    duration: number;
    message: string;
    code?: string;
    errno?: number;
    sqlState?: string;
    sql?: string;
}

interface Pending {
    resolve: (response: WorkerSuccess) => void;
    reject: (error: WorkerFailure | Error) => void;
}

export class WorkerNotRunningError extends Error {
    public constructor() {
        super("Query worker is not running");
        this.name = "WorkerNotRunningError";
    }
}

const shared = new SharedArrayBuffer(headerBytes + requestBytes + replyBytes);
const ctl = new Int32Array(shared, 0, headerBytes >> 2);
const request = Buffer.from(shared, headerBytes, requestBytes);
const reply = Buffer.from(shared, headerBytes + requestBytes, replyBytes);
// Caps how long a slow query can stall the server thread before it falls back to the async callback (same budget as cssql).
const syncWaitMs = 2;
const spinMs = 0.5;

let worker: Worker | undefined;
let requestId = 0;
const pending = new Map<number, Pending>();

function fail(reason: string) {
    if (!worker) return;

    worker = undefined;
    Log.Warn(`[database] Query worker stopped (${reason}), falling back to the in-process pool`);

    for (const entry of pending.values()) {
        entry.reject(new Error(`Query worker stopped (${reason})`));
    }

    pending.clear();
}

export function Active() {
    return worker != null;
}

export function Start(config: PoolConfig): boolean {
    const resource = GetCurrentResourceName();

    try {
        worker = new Worker(`${GetResourcePath(resource)}/dist/dbworker.cjs`, { workerData: { config, shared } });
    } catch (error) {
        Log.Warn(
            `[database] Query worker unavailable (${error}) - add "add_unsafe_worker_permission ${resource}" to server.cfg for faster queries`,
        );
        return false;
    }

    worker.on("message", (response: WorkerSuccess | WorkerFailure) => {
        const entry = pending.get(response.id);
        if (!entry) return;

        pending.delete(response.id);

        if (response.ok) entry.resolve(response);
        else entry.reject(response);
    });

    worker.on("error", (error: Error) => {
        fail(error.message);
    });
    worker.on("exit", (code: number) => {
        if (code !== 0) fail(`exit code ${code}`);
    });

    OnStop(() => {
        const current = worker;
        fail("resource stop");
        current?.terminate();
    });

    Log.Info("[database] Query worker started");
    return true;
}

export function Request(
    op: WorkerOp,
    query: string | QueryOptions,
    values?: unknown,
    batches?: unknown[],
): Promise<WorkerSuccess> {
    return new Promise((resolve, reject) => {
        if (!worker) {
            reject(new WorkerNotRunningError());
            return;
        }

        const id = ++requestId;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, op, query, values, batches });
    });
}

// Returns the result, throws the worker's failure, or returns a promise when the answer misses the wait.
export function RequestSync(op: WorkerOp, query: string | QueryOptions, values?: unknown, batches?: unknown[]): unknown {
    if (!worker) return Promise.reject(new WorkerNotRunningError());

    if (requestId === 0x7fffffff) requestId = 0;
    const id = ++requestId;
    Atomics.store(ctl, Slot.State, id);
    // A worker still spinning after its last sync answer takes the request straight from shared memory.
    if (Atomics.compareExchange(ctl, Slot.Handoff, Handoff.Spinning, Handoff.Writing) === Handoff.Spinning) {
        const length = Encode(request, [id, op, query, values ?? null, batches ?? null]);
        ctl[Slot.RequestLength] = length;
        Atomics.store(ctl, Slot.Handoff, Handoff.Ready);
        if (length < 0) worker.postMessage({ id, op, query, values, batches, sync: true });
    } else {
        worker.postMessage({ id, op, query, values, batches, sync: true });
    }

    // Spinning first skips the futex wake-up latency for the common sub-millisecond answer.
    const spinUntil = performance.now() + spinMs;
    for (let n = 1; Atomics.load(ctl, Slot.State) === id; n++) {
        if ((n & 63) === 0 && performance.now() >= spinUntil) {
            Atomics.wait(ctl, Slot.State, id, syncWaitMs);
            break;
        }
    }

    if (Atomics.compareExchange(ctl, Slot.State, id, 0) === done) {
        Atomics.store(ctl, Slot.State, 0);
        const value = Decode(reply, ctl[Slot.ReplyLength]!);
        if (ctl[Slot.ReplyStatus] === 1) return value;
        throw value;
    }

    return new Promise<WorkerSuccess>((resolve, reject) => pending.set(id, { resolve, reject }));
}
