import type { Request } from "./ops";
import type { PoolConfig } from "mariadb";
import type { LumoError } from "./errors";

import { Log } from "lib/shared";
import { OnStop } from "lib/shared/resource";
import { Decode, Encode } from "./wire";
import { Handoff, Slot, done, headerBytes, replyBytes, requestBytes } from "./sync";
import { Worker } from "node:worker_threads";

export type WorkerMessage = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: LumoError } | { log: string };

interface Pending {
    resolve: (result: unknown) => void;
    reject: (error: unknown) => void;
}

const shared = new SharedArrayBuffer(headerBytes + requestBytes + replyBytes);
const ctl = new Int32Array(shared, 0, headerBytes >> 2);
const request = Buffer.from(shared, headerBytes, requestBytes);
const reply = Buffer.from(shared, headerBytes + requestBytes, replyBytes);
const spinMs = 0.5;

let worker: Worker | undefined;
let requestId = 0;
const pending = new Map<number, Pending>();

function fail(reason: string) {
    if (!worker) return;

    worker = undefined;
    Log.Warn(`[lumo] Query worker stopped (${reason}), falling back to the in-process pool`);

    for (const entry of pending.values()) {
        entry.reject(new Error(`Query worker stopped (${reason})`));
    }

    pending.clear();
}

export function Active() {
    return worker != null;
}

// The bundle may sit anywhere inside its host resource (e.g. core/lib/lumo/dist). FiveM's Node runtime
// defines no __dirname (and bun would inline the build-time one), but stack frames read
// "@<resource>/<path>/server.js", which gives the bundle's folder.
function workerPath(resource: string) {
    const folder = /@[^/\s]+\/((?:[^\s:]*\/)?)[^/\s:]+\.js:\d+/.exec(new Error().stack ?? "")?.[1];
    return `${GetResourcePath(resource)}/${folder ?? "dist/"}dbworker.cjs`;
}

export function Start(config: PoolConfig, checkoutTimeoutMs: number): boolean {
    const resource = GetCurrentResourceName();

    try {
        worker = new Worker(workerPath(resource), {
            workerData: { config, shared, checkoutTimeoutMs },
        });
    } catch (error) {
        Log.Warn(
            `[lumo] Query worker unavailable (${error}) - add "add_unsafe_worker_permission ${resource}" to server.cfg for faster queries`,
        );
        return false;
    }

    worker.on("message", (message: WorkerMessage) => {
        if ("log" in message) {
            Log.Warn(message.log);
            return;
        }

        const entry = pending.get(message.id);
        if (!entry) return;

        pending.delete(message.id);
        if (message.ok) entry.resolve(message.result);
        else entry.reject(message.error);
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

    Log.Info("[lumo] Query worker started");
    return true;
}

export function Request(req: Request): Promise<unknown> {
    return new Promise((resolve, reject) => {
        if (!worker) {
            reject(new Error("Query worker is not running"));
            return;
        }

        const id = next();
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, ...req });
    });
}

function next() {
    if (requestId === 0x7fffffff) requestId = 0;
    return ++requestId;
}

// Returns the result, throws the worker's failure, or returns a promise when the answer misses the wait.
export function RequestSync(req: Request, waitMs: number): unknown {
    if (!worker) return Request(req);

    const id = next();
    Atomics.store(ctl, Slot.State, id);
    // A worker still spinning after its last sync answer takes the request straight from shared memory.
    if (Atomics.compareExchange(ctl, Slot.Handoff, Handoff.Spinning, Handoff.Writing) === Handoff.Spinning) {
        const length = Encode(request, [id, req.op, req.sql, req.values, req.batch, req.session, req.resource]);
        ctl[Slot.RequestLength] = length;
        Atomics.store(ctl, Slot.Handoff, Handoff.Ready);
        if (length < 0) worker.postMessage({ id, ...req, sync: true });
    } else {
        worker.postMessage({ id, ...req, sync: true });
    }

    // Spinning first skips the futex wake-up latency for the common sub-millisecond answer.
    const spinUntil = performance.now() + Math.min(spinMs, waitMs);
    for (let n = 1; Atomics.load(ctl, Slot.State) === id; n++) {
        if ((n & 63) === 0 && performance.now() >= spinUntil) {
            Atomics.wait(ctl, Slot.State, id, waitMs);
            break;
        }
    }

    if (Atomics.compareExchange(ctl, Slot.State, id, 0) === done) {
        Atomics.store(ctl, Slot.State, 0);
        const value = Decode(reply, ctl[Slot.ReplyLength]!);
        if (ctl[Slot.ReplyStatus] === 1) return value;
        throw value;
    }

    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
