import { deserialize, serialize } from "node:v8";

// Sync replies travel through a SharedArrayBuffer. Plain results (null, booleans, numbers, strings and
// arrays/objects of those) use this compact format; anything else (Buffer, Date, BigInt, undefined)
// falls back to v8 serialization, which is what postMessage uses, so values never change type.
const V8 = 0xff;
const NULL = 0;
const TRUE = 1;
const FALSE = 2;
const INT = 3;
const DOUBLE = 4;
const STRING = 5;
const ARRAY = 6;
const OBJECT = 7;
const KEYREF = 8;
const KEYDEF = 9;

// Object keys are sent once and then referenced by id. Each thread owns one direction's encoder map
// and the other's decoder table; ids only become valid once the receiver is sure to read the message,
// so the sender rolls back keys added by a message that is dropped (see Rollback).
const maxKeys = 4096;
const keyIds = new Map<string, number>();
const addedKeys: string[] = [];
const keys: string[] = [];

class Unsupported extends Error {}

// Null-prototype objects decode as plain ones, exactly as v8 serialization (postMessage) already does.
function isPlain(value: object) {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function bind(target: Buffer) {
    if (buf === target) return;
    buf = target;
    view = new DataView(target.buffer, target.byteOffset, target.byteLength);
}
const unsupported = new Unsupported();

let view: DataView;
let buf: Buffer;
let at = 0;

function write(value: unknown): void {
    if (value === null) {
        buf[at++] = NULL;
    } else if (typeof value === "number") {
        if ((value | 0) === value && !Object.is(value, -0)) {
            buf[at] = INT;
            view.setInt32(at + 1, value, true);
            at += 5;
        } else {
            buf[at] = DOUBLE;
            view.setFloat64(at + 1, value, true);
            at += 9;
        }
    } else if (typeof value === "string") {
        writeString(value);
    } else if (typeof value === "boolean") {
        buf[at++] = value ? TRUE : FALSE;
    } else if (Array.isArray(value)) {
        buf[at] = ARRAY;
        view.setUint32(at + 1, value.length, true);
        at += 5;
        for (let i = 0; i < value.length; i++) write(value[i]);
    } else if (typeof value === "object" && isPlain(value)) {
        const keys = Object.keys(value as object);
        buf[at] = OBJECT;
        view.setUint32(at + 1, keys.length, true);
        at += 5;
        for (let i = 0; i < keys.length; i++) {
            writeKey(keys[i]!);
            write((value as Record<string, unknown>)[keys[i]!]);
        }
    } else {
        throw unsupported;
    }
}

function writeKey(key: string) {
    const id = keyIds.get(key);
    if (id !== undefined) {
        buf[at] = KEYREF;
        buf[at + 1] = id & 0xff;
        buf[at + 2] = id >> 8;
        at += 3;
    } else if (keyIds.size < maxKeys) {
        const next = keyIds.size;
        keyIds.set(key, next);
        addedKeys.push(key);
        buf[at] = KEYDEF;
        buf[at + 1] = next & 0xff;
        buf[at + 2] = next >> 8;
        at += 3;
        writeString(key);
    } else {
        writeString(key);
    }
}

function writeString(value: string) {
    const count = value.length;
    // Worst case 3 bytes per UTF-16 unit; checked so a huge string falls back instead of overflowing.
    if (at + 5 + count * 3 > buf.length) throw unsupported;
    buf[at] = STRING;
    // Short ASCII strings are copied by hand: cheaper than the native utf8 write call.
    if (count <= 32) {
        let i = 0;
        for (; i < count; i++) {
            const c = value.charCodeAt(i);
            if (c > 0x7f) break;
            buf[at + 5 + i] = c;
        }
        if (i === count) {
            view.setUint32(at + 1, count, true);
            at += 5 + count;
            return;
        }
    }
    const length = buf.utf8Write(value, at + 5);
    view.setUint32(at + 1, length, true);
    at += 5 + length;
}

function read(): unknown {
    const tag = buf[at++];
    switch (tag) {
        case NULL:
            return null;
        case TRUE:
            return true;
        case FALSE:
            return false;
        case INT:
            at += 4;
            return view.getInt32(at - 4, true);
        case DOUBLE:
            at += 8;
            return view.getFloat64(at - 8, true);
        case STRING:
            return readString();
        case ARRAY: {
            const count = view.getUint32(at, true);
            at += 4;
            const list = new Array(count);
            for (let i = 0; i < count; i++) list[i] = read();
            return list;
        }
        case OBJECT: {
            const count = view.getUint32(at, true);
            at += 4;
            const object: Record<string, unknown> = {};
            for (let i = 0; i < count; i++) {
                const kind = buf[at]!;
                let key: string;
                if (kind === KEYREF) {
                    key = keys[buf[at + 1]! | (buf[at + 2]! << 8)]!;
                    at += 3;
                } else if (kind === KEYDEF) {
                    const id = buf[at + 1]! | (buf[at + 2]! << 8);
                    at += 4;
                    key = keys[id] = readString();
                } else {
                    at++;
                    key = readString();
                }
                object[key] = read();
            }
            return object;
        }
        default:
            throw new Error(`Corrupt sync reply (tag ${tag})`);
    }
}

function readString() {
    const length = view.getUint32(at, true);
    const value = buf.utf8Slice(at + 4, at + 4 + length);
    at += 4 + length;
    return value;
}

// Returns the bytes written into target, or -1 when the value does not fit.
export function Encode(target: Buffer, value: unknown): number {
    bind(target);
    at = 1;
    addedKeys.length = 0;

    try {
        // Fixed-size tags are only bounds-checked at the end; 64KB of headroom covers any overshoot.
        if (target.length < 1 << 16) throw unsupported;
        target[0] = 0;
        write(value);
        if (at <= target.length - (1 << 16)) return at;
    } catch (error) {
        if (error !== unsupported && !(error instanceof RangeError)) throw error;
    }

    Rollback();
    const bytes = serialize(value);
    if (bytes.length + 1 > target.length) return -1;
    target[0] = V8;
    bytes.copy(target, 1);
    return bytes.length + 1;
}

// Forgets the keys the last Encode introduced, for a message that will never be read.
export function Rollback() {
    for (let i = 0; i < addedKeys.length; i++) keyIds.delete(addedKeys[i]!);
    addedKeys.length = 0;
}

export function Decode(source: Buffer, length: number): unknown {
    if (source[0] === V8) return deserialize(source.subarray(1, length));

    bind(source);
    at = 1;
    return read();
}
