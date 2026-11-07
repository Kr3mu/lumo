import type { Pool, PoolConnection } from "mariadb";

import { CodedError } from "./errors";

interface Session {
    connection: PoolConnection;
    resource: string;
    started: number;
    timer: ReturnType<typeof setTimeout>;
}

export type OnExpire = (id: number, resource: string, heldMs: number) => void;

// Remembered so a late call on a timed-out session says why it failed; oldest ids are forgotten first.
const maxExpired = 4096;

export class Sessions {
    private readonly open = new Map<number, Session>();
    private readonly expired = new Set<number>();
    private next = 0;

    public constructor(
        private readonly pool: Pool,
        private readonly timeoutMs: number,
        private readonly onExpire: OnExpire,
    ) {}

    public async Checkout(resource: string) {
        const connection = await this.pool.getConnection();
        const id = ++this.next;
        const timer = setTimeout(() => this.expire(id), this.timeoutMs);
        this.open.set(id, { connection, resource, started: performance.now(), timer });
        return id;
    }

    public Get(id: number) {
        return this.find(id).connection;
    }

    public async Release(id: number, commit: boolean) {
        const { connection } = this.take(this.find(id), id);
        try {
            if (commit) await connection.query("COMMIT");
        } finally {
            await recycle(connection);
        }
        return true;
    }

    public ReleaseAll(resource: string) {
        for (const [id, session] of this.open) {
            if (session.resource === resource) recycle(this.take(session, id).connection);
        }
    }

    private find(id: number) {
        const session = this.open.get(id);
        if (session) return session;
        if (this.expired.has(id)) throw new CodedError("SESSION_EXPIRED", `Session ${id} expired after ${this.timeoutMs}ms`);
        throw new CodedError("NO_SESSION", `No session ${id}`);
    }

    private take(session: Session, id: number) {
        clearTimeout(session.timer);
        this.open.delete(id);
        return session;
    }

    private expire(id: number) {
        const session = this.open.get(id);
        if (!session) return;

        this.take(session, id);
        this.expired.add(id);
        if (this.expired.size > maxExpired) this.expired.delete(this.expired.values().next().value!);
        recycle(session.connection);
        this.onExpire(id, session.resource, performance.now() - session.started);
    }
}

// COM_RESET_CONNECTION rolls back any open transaction and drops temporary tables, user variables
// and LAST_INSERT_ID, so nothing leaks to the next pool user. A connection that fails it is dropped.
function recycle(connection: PoolConnection) {
    return connection.reset().then(
        () => connection.release(),
        () => connection.destroy(),
    );
}
