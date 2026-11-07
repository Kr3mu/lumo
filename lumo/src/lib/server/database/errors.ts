export interface LumoError {
    code: number | string | null;
    state: string | null;
    message: string;
    sql: string | null;
}

export class CodedError extends Error {
    public constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
    }
}

const maxLength = 2000;

// Accepts mariadb errors (errno + code + sqlState), CodedErrors and already-shaped LumoErrors.
export function ToLumoError(error: unknown): LumoError {
    if (typeof error !== "object" || error === null) return { code: null, state: null, message: String(error), sql: null };

    const err: Record<string, unknown> = { ...error, message: "message" in error ? error.message : String(error) };
    const code = typeof err.errno === "number" ? err.errno : typeof err.code === "string" || typeof err.code === "number" ? err.code : null;
    const state = typeof err.sqlState === "string" ? err.sqlState : typeof err.state === "string" ? err.state : null;
    // mariadb prefixes its messages with "(conn:N, no: E, SQLState: S) "; code and state carry that already.
    const message = String(typeof err.sqlMessage === "string" ? err.sqlMessage : err.message).slice(0, maxLength);

    return { code, state, message, sql: typeof err.sql === "string" ? err.sql.slice(0, maxLength) : null };
}
