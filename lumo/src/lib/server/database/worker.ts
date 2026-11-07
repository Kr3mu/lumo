import type { WorkerOp } from "./ops";
import type { QueryOptions } from "mariadb";
import type { QueryValues } from "types/database";

import { RunOp } from "./ops";
import { createConnection, createPool, type Connection } from "mariadb";
import { Decode, Encode, Rollback } from "./wire";
import { Handoff, Slot, done, headerBytes, replyBytes, requestBytes } from "./sync";
import { parentPort, receiveMessageOnPort, workerData } from "node:worker_threads";

interface WorkerRequest {
    id: number;
    op: WorkerOp;
    query: string | QueryOptions;
    values?: QueryValues;
    batches?: unknown[];
    sync?: boolean;
}

const ctl = new Int32Array(workerData.shared, 0, headerBytes >> 2);
const request = Buffer.from(workerData.shared, headerBytes, requestBytes);
const reply = Buffer.from(workerData.shared, headerBytes + requestBytes, replyBytes);
const port = parentPort!;
// Long enough to catch the next await from a Lua loop (~50 us later), short enough to stay cheap when idle.
const spinMs = 0.25;

const pool = createPool(workerData.config);
// Kept apart so multipleStatements never applies to ordinary queries.
const multiPool = createPool({ ...workerData.config, multipleStatements: true, connectionLimit: 2 });

let inFlight = 0;

// Sync single-statement ops run on a connection of their own: no pool acquire/release bookkeeping
// and no validation ping when queries are more than the pool's 500 ms apart. Busy, idle for long or
// broken, it hands the query to the pool, which validates its connections itself.
const directIdleMs = 30000;
let direct: Connection | undefined;
let directBusy = false;
let directUsed = 0;

function openDirect() {
    createConnection(workerData.config).then(
        (connection) => {
            const lost = () => {
                if (direct !== connection) return;
                direct = undefined;
                setTimeout(openDirect, 1000);
            };
            connection.on("error", lost);
            connection.on("end", lost);
            direct = connection;
            directUsed = performance.now();
        },
        () => setTimeout(openDirect, 5000),
    );
}

openDirect();

function directFor(op: WorkerOp, sync?: boolean): Connection | undefined {
    if (!sync || !direct || directBusy || op === "transaction" || op === "prepareMany" || op === "batch") return undefined;
    if (!direct.isValid()) return undefined;

    const now = performance.now();
    if (now - directUsed > directIdleMs) {
        const connection = direct;
        connection.ping().then(
            () => (directUsed = performance.now()),
            () => connection.destroy(),
        );
        return undefined;
    }
    directUsed = now;
    return direct;
}

// Encode yields the same values as postMessage (see wire.ts), so sync and async answers match.
function replySync(id: number, status: number, value: unknown) {
    if (Atomics.load(ctl, Slot.State) !== id) return false;

    const length = Encode(reply, value);
    if (length < 0) return false;

    ctl[Slot.ReplyLength] = length;
    ctl[Slot.ReplyStatus] = status;
    if (Atomics.compareExchange(ctl, Slot.State, id, done) !== id) {
        Rollback();
        return false;
    }

    Atomics.notify(ctl, Slot.State);
    return true;
}

function failure(error: unknown) {
    const err = error as Record<string, unknown>;
    return {
        message: String(err?.message ?? error).slice(0, 2000),
        code: err?.code ?? null,
        errno: err?.errno ?? null,
        sqlState: err?.sqlState ?? null,
        sql: typeof err?.sql === "string" ? err.sql.slice(0, 2000) : null,
    };
}

async function handle(id: number, op: WorkerOp, query: string | QueryOptions, values?: QueryValues, batches?: unknown[], sync?: boolean) {
    const started = sync ? 0 : performance.now();
    let ok = true;
    let result: unknown;

    const connection = directFor(op, sync);
    if (connection) directBusy = true;

    inFlight++;
    try {
        result = await RunOp(connection ?? pool, op, query, values, batches, multiPool);
    } catch (error) {
        ok = false;
        result = failure(error);
    }
    inFlight--;
    if (connection) directBusy = false;

    if (sync && replySync(id, ok ? 1 : 0, result)) {
        if (inFlight === 0) spin();
        return;
    }

    const duration = sync ? 0 : performance.now() - started;
    port.postMessage(ok ? { id, ok, result, duration } : { id, ok, duration, ...(result as object) });
}

function onMessage(message: WorkerRequest) {
    handle(message.id, message.op, message.query, message.values, message.batches, message.sync);
}

// Busy-waits for the server thread's next sync request; an async request arriving meanwhile ends it.
function spin() {
    Atomics.store(ctl, Slot.Handoff, Handoff.Spinning);
    const until = performance.now() + spinMs;
    let message: { message: WorkerRequest } | undefined;

    for (let n = 1; ; n++) {
        const state = Atomics.load(ctl, Slot.Handoff);
        if (state === Handoff.Ready) {
            take();
            break;
        }
        if (state === Handoff.Spinning && (n & 127) === 0) {
            message ??= receiveMessageOnPort(port);
            if (
                (message || performance.now() >= until) &&
                Atomics.compareExchange(ctl, Slot.Handoff, Handoff.Spinning, Handoff.Idle) === Handoff.Spinning
            ) {
                break;
            }
        }
    }

    if (message) onMessage(message.message);
}

function take() {
    const length = ctl[Slot.RequestLength]!;
    const decoded = length < 0 ? undefined : (Decode(request, length) as [number, WorkerOp, string | QueryOptions, QueryValues | null, unknown[] | null]);
    Atomics.store(ctl, Slot.Handoff, Handoff.Idle);
    if (decoded) handle(decoded[0], decoded[1], decoded[2], decoded[3] ?? undefined, decoded[4] ?? undefined, true);
}

port.on("message", onMessage);
