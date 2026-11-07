import type { Request, Op, Statement } from "./ops";
import type { WorkerMessage } from "./worker-host";

import { IsShape, RunOp } from "./ops";
import { Sessions } from "./sessions";
import { ToLumoError } from "./errors";
import { createConnection, createPool, type Connection } from "mariadb";
import { Decode, Encode, Rollback } from "./wire";
import { Handoff, Slot, done, headerBytes, replyBytes, requestBytes } from "./sync";
import { parentPort, receiveMessageOnPort, workerData } from "node:worker_threads";

type WorkerRequest = Request & { id: number; sync?: boolean };
type Encoded = [id: number, op: Op, sql: string, values: unknown[] | null, batch: Statement[] | null, session: number | null, resource: string];

const ctl = new Int32Array(workerData.shared, 0, headerBytes >> 2);
const request = Buffer.from(workerData.shared, headerBytes, requestBytes);
const reply = Buffer.from(workerData.shared, headerBytes + requestBytes, replyBytes);
const port = parentPort!;
// Long enough to catch the next await from a Lua loop (~50 us later), short enough to stay cheap when idle.
const spinMs = 0.25;

function post(message: WorkerMessage) {
    port.postMessage(message);
}

const pool = createPool(workerData.config);
const target = {
    pool,
    lanes: workerData.config.connectionLimit ?? 10,
    // Kept apart so multipleStatements never applies to ordinary queries.
    multi: createPool({ ...workerData.config, multipleStatements: true, connectionLimit: 2 }),
    sessions: new Sessions(pool, workerData.checkoutTimeoutMs, (id, resource, heldMs) =>
        post({ log: `[lumo] Session ${id} of ${resource} timed out after ${heldMs.toFixed(0)}ms and was rolled back` }),
    ),
};

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

function directFor(req: WorkerRequest): Connection | undefined {
    if (!req.sync || !direct || directBusy || req.session != null || !IsShape(req.op)) return undefined;
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

async function handle(req: WorkerRequest) {
    let ok = true;
    let result: unknown;

    const connection = directFor(req);
    if (connection) directBusy = true;

    inFlight++;
    try {
        result = await RunOp(target, req, connection);
    } catch (error) {
        ok = false;
        result = ToLumoError(error);
    }
    inFlight--;
    if (connection) directBusy = false;

    if (req.sync && replySync(req.id, ok ? 1 : 0, result)) {
        if (inFlight === 0) spin();
        return;
    }

    post(ok ? { id: req.id, ok, result } : { id: req.id, ok, error: ToLumoError(result) });
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

    if (message) handle(message.message);
}

function take() {
    const length = ctl[Slot.RequestLength]!;
    // Written by RequestSync in worker-host.ts from an already validated Request.
    const decoded = length < 0 ? undefined : (Decode(request, length) as Encoded);
    Atomics.store(ctl, Slot.Handoff, Handoff.Idle);
    if (!decoded) return;

    const [id, op, sql, values, batch, session, resource] = decoded;
    handle({ id, op, sql, values, batch, session, resource, sync: true });
}

port.on("message", handle);
