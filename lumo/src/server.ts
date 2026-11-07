import type { Answer, Request } from "lib/server/database";
import type { Op, Shape } from "lib/server/database/ops";

import * as Database from "lib/server/database";
import * as Args from "./args";
import { CodedError, ToLumoError } from "lib/server/database/errors";

const shapes: readonly Shape[] = ["run", "one", "value", "all"];
const releaseModes: readonly Op[] = ["release", "commit", "rollback"];

function caller() {
    return GetInvokingResource() || GetCurrentResourceName();
}

function request(op: Op, fields: Partial<Request> = {}): Request {
    return { op, sql: "", values: null, batch: null, session: null, resource: caller(), ...fields };
}

// Arguments come from other resources, so a bad one must come back as [null, err], never a throw.
function guard<A extends unknown[]>(handler: (...args: A) => Answer | Promise<Answer>) {
    return (...args: A) => {
        try {
            return handler(...args);
        } catch (error) {
            return [null, ToLumoError(error)] satisfies Answer;
        }
    };
}

function pick<T>(list: readonly T[], index: unknown, name: string): T {
    const entry = typeof index === "number" ? list[index] : undefined;
    if (entry === undefined) throw new CodedError("BAD_ARGUMENT", `${name} must be 0..${list.length - 1}`);
    return entry;
}

exports(
    "exec",
    guard((shape: unknown, sql: unknown, params: unknown, session: unknown) =>
        Database.Dispatch(
            request(pick(shapes, shape, "shape"), { sql: Args.Sql(sql), values: Args.Params(params), session: Args.Session(session) }),
        ),
    ),
);

exports(
    "batch",
    guard((statements: unknown) => {
        const batch = Args.Statements(statements);
        if (batch.length === 0) return [true];
        return Database.Dispatch(request("batch", { batch }));
    }),
);

exports(
    "checkout",
    guard(() => Database.Dispatch(request("checkout"))),
);

exports(
    "release",
    guard((session: unknown, mode: unknown) => {
        const id = Args.Session(session);
        if (id == null) throw new CodedError("BAD_ARGUMENT", "session must be a positive integer");
        return Database.Dispatch(request(pick(releaseModes, mode, "mode"), { session: id }));
    }),
);

const connectRetryMs = 10000;

function untilReady(): Promise<Answer> {
    return Database.Ready().then(
        (): Answer => [true],
        () => new Promise<Answer>((resolve) => setTimeout(() => resolve(untilReady()), connectRetryMs)),
    );
}

let waiting: Promise<Answer> | undefined;
const ready = (): Answer | Promise<Answer> => (Database.Connected() ? [true] : (waiting ??= untilReady()));

exports("ready", ready);

on("onResourceStop", (resource: string) => {
    if (resource !== GetCurrentResourceName() && Database.Connected()) Database.Dispatch({ ...request("releaseAll"), resource });
});

ready();
