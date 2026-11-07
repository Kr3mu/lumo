// Node's Buffer has UTF-8 fast paths that @types/node doesn't declare. wire.ts uses them because they skip the
// encoding lookup that toString('utf8') and write() do on every call; they exist on every Buffer in Node 22.
export {};

declare global {
    interface Buffer {
        utf8Slice(start: number, end: number): string;
        utf8Write(text: string, offset: number, length?: number): number;
    }
}
