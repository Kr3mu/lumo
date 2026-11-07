export type Dictionary<T = unknown> = Record<string, T>;

export type QueryValues = unknown[] | Dictionary | undefined;

export interface MysqlRow<T = string | number | boolean | Dictionary | null | undefined> {
    [column: string]: T;
}

export interface OkPacket {
    affectedRows: number;
    insertId: number;
    warningStatus: number;
}
