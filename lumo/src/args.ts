import type { Statement } from "lib/server/database";

import { CodedError } from "lib/server/database/errors";

const invalid = (message: string) => new CodedError("BAD_ARGUMENT", message);

export function Sql(value: unknown): string {
    if (typeof value !== "string" || value.trim() === "") throw invalid("sql must be a non-empty string");
    return value;
}

// Lua cannot hold nil in an array, so it sends { __lumo: "null" } for SQL NULL. An empty Lua table
// arrives as {} rather than [], which counts as no params.
export function Params(value: unknown): unknown[] | null {
    if (value == null) return null;
    if (!Array.isArray(value)) {
        if (typeof value === "object" && Object.keys(value).length === 0) return null;
        throw invalid("params must be an array");
    }
    if (value.length === 0) return null;

    const list = new Array<unknown>(value.length);
    for (let i = 0; i < value.length; i++) list[i] = isNullMarker(value[i]) ? null : value[i];
    return list;
}

function isNullMarker(value: unknown) {
    return typeof value === "object" && value !== null && "__lumo" in value && value.__lumo === "null";
}

// Parameter sets for one statement: an array of params arrays, each validated like Params.
export function Sets(value: unknown): unknown[][] {
    const list = value == null || (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) ? [] : value;
    if (!Array.isArray(list)) throw invalid("sets must be an array of params arrays");

    return list.map((entry: unknown, i) => {
        if (entry != null && !Array.isArray(entry) && !(typeof entry === "object" && Object.keys(entry).length === 0)) {
            throw invalid(`set ${i + 1} must be a params array`);
        }
        return Params(entry) ?? [];
    });
}

export function Session(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw invalid("session must be a positive integer");
    return value;
}

export function Statements(value: unknown): Statement[] {
    const list = value == null || (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) ? [] : value;
    if (!Array.isArray(list)) throw invalid("statements must be an array of [sql, params]");

    return list.map((entry: unknown, i): Statement => {
        if (!Array.isArray(entry)) throw invalid(`statement ${i + 1} must be [sql, params]`);
        return [Sql(entry[0]), Params(entry[1])];
    });
}
