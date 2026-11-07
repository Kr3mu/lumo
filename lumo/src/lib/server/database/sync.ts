// Layout of the SharedArrayBuffer between the server thread and the query worker. State holds the
// waiting request id; the worker swaps it to Done (payload in the reply area) and the server thread
// swaps it to 0 when it gives up waiting, after which the answer comes by postMessage.
export const enum Slot {
    State = 0,
    ReplyLength = 1,
    ReplyStatus = 2,
    Handoff = 3,
    RequestLength = 4,
}

export const done = -1;

// After a sync answer the worker spins briefly (Spinning); the server thread claims it with
// Writing, fills the request area and publishes Ready, saving the worker's postMessage wake-up.
export const enum Handoff {
    Idle = 0,
    Spinning = 1,
    Writing = 2,
    Ready = 3,
}

export const headerBytes = 32;
export const requestBytes = 1 << 20;
export const replyBytes = 4 << 20;
