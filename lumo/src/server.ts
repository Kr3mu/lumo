import type { TransactionStatement, WorkerOp } from "lib/server/database";
import type { QueryValues } from "types/database";

import * as Database from "lib/server/database";

type Callback = (result: unknown, error?: string) => void;
type LuaStatement = string | [string, QueryValues?] | { query: string; values?: QueryValues; parameters?: QueryValues };

// Lua sends an empty table as {} rather than [], which mariadb would treat as named placeholders.
function values(parameters: unknown): QueryValues {
    if (parameters == null || typeof parameters !== "object") return undefined;
    return Array.isArray(parameters) ? parameters : Object.keys(parameters).length ? (parameters as QueryValues) : undefined;
}

function statement(entry: LuaStatement): TransactionStatement {
    if (typeof entry === "string") return entry;
    if (Array.isArray(entry)) return [entry[0], values(entry[1])];
    return [entry.query, values(entry.values ?? entry.parameters)];
}

function transactionList(query: unknown): TransactionStatement[] {
    const list: TransactionStatement[] = [];
    if (Array.isArray(query)) for (let i = 0; i < query.length; i++) list.push(statement(query[i]));
    else for (const key in query as object) list.push(statement((query as Record<string, LuaStatement>)[key]!));
    return list;
}

function isBatch(op: WorkerOp, parameters: unknown): parameters is QueryValues[] {
    return op === "prepare" && Array.isArray(parameters) && Array.isArray(parameters[0]);
}

function bridge(op: WorkerOp, failure: unknown = null) {
    return (query: unknown, parameters: unknown, cb?: Callback) => {
        const task =
            op === "transaction"
                ? Database.Transact(transactionList(query))
                : isBatch(op, parameters)
                  ? Database.DispatchAsync("prepareMany", query as string, undefined, parameters)
                  : Database.DispatchAsync(op, query as string, values(parameters));
        task.then(
            (result) => cb?.(result ?? null),
            (error: Error) => cb?.(failure, error.message),
        );
    };
}

type Answer = [unknown] | [null, string];

const answered = (result: unknown): Answer => [result ?? null];
const failed = (error: Error): Answer => [null, error.message];

function answer(op: WorkerOp, sql: string, vals: QueryValues, batches?: unknown[]): Answer | Promise<Answer> {
    try {
        const result = Database.DispatchSync(op, sql, vals, batches);
        return result instanceof Promise ? result.then(answered, failed) : [result ?? null];
    } catch (error) {
        return [null, (error as Error).message];
    }
}

// MySQL.lua's await calls these with (query, parameters). A returned promise is awaited by the
// Lua funcref call itself, so Lua never yields when the worker answers within the wait.
function syncBridge(op: WorkerOp) {
    if (op === "transaction") {
        return (query: unknown) => {
            const list = transactionList(query);
            // Big batches would only burn the whole sync wait, so they go straight to the async path.
            if (list.length >= 16) return Database.Transact(list).then(answered, failed);
            return answer(op, `TRANSACTION (${list.length})`, undefined, list);
        };
    }

    return (query: unknown, parameters: unknown) => {
        if (!isBatch(op, parameters)) return answer(op, query as string, values(parameters));
        if (parameters.length >= 16) return Database.DispatchAsync("prepareMany", query as string, undefined, parameters).then(answered, failed);
        return answer("prepareMany", query as string, undefined, parameters);
    };
}

const ops: [string, WorkerOp, unknown?][] = [
    ["query", "query"],
    ["single", "row"],
    ["scalar", "scalar"],
    ["insert", "insert"],
    ["update", "update"],
    ["prepare", "prepare"],
    ["transaction", "transaction", false],
];

for (const [name, op, failure] of ops) {
    exports(name, bridge(op, failure ?? null));
    exports(`sync_${name}`, syncBridge(op));
}

exports("awaitConnection", () => Database.Ready().then(() => true));

Database.Ready();
