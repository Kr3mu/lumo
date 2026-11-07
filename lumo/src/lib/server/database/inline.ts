import type { Connection } from "mariadb";
import type { QueryValues } from "types/database";

const partsCache = new Map<string, string[]>();

// Splits SQL at its ? placeholders, skipping quoted strings, identifiers and comments.
export function SplitPlaceholders(sql: string): string[] {
    const cached = partsCache.get(sql);
    if (cached) return cached;

    const parts: string[] = [];
    let start = 0;
    let quote = "";

    for (let i = 0; i < sql.length; i++) {
        const c = sql[i];
        if (quote) {
            if (c === "\\" && quote !== "`") i++;
            else if (c === quote) quote = "";
        } else if (c === "'" || c === '"' || c === "`") {
            quote = c;
        } else if (c === "#" || (c === "-" && sql[i + 1] === "-")) {
            const end = sql.indexOf("\n", i);
            i = end < 0 ? sql.length : end;
        } else if (c === "/" && sql[i + 1] === "*") {
            const end = sql.indexOf("*/", i + 2);
            i = end < 0 ? sql.length : end + 1;
        } else if (c === "?") {
            parts.push(sql.slice(start, i));
            start = i + 1;
        }
    }

    parts.push(sql.slice(start));
    if (partsCache.size < 1000) partsCache.set(sql, parts);
    return parts;
}

// connection.escape follows the session's NO_BACKSLASH_ESCAPES state.
export function Inline(connection: Connection, sql: string, values?: QueryValues): string {
    if (!values) return sql;
    const parts = SplitPlaceholders(sql);
    const list = values as unknown[];
    if (!Array.isArray(list) || parts.length - 1 !== list.length) {
        throw new Error(`Expected ${parts.length - 1} parameters, received ${Array.isArray(list) ? list.length : "named"}`);
    }

    let out = parts[0]!;
    for (let i = 0; i < list.length; i++) {
        const value = list[i];
        // Same text the connector's escape produces for these, without its two wrapper calls.
        out += (typeof value === "number" ? `${value}` : value == null ? "NULL" : connection.escape(value)) + parts[i + 1];
    }
    return out;
}
