import { WORD_BYTES } from "./constants";
import { EVMValue, EVMValueTypes } from "./evm-value";
import { toHex, toSafeNumber } from "./utils";

/** Result of a memory read: exact bytes, or a value we could not decompose. */
export type MemoryRead =
    | { kind: "known", hex: string }
    | { kind: "symbolic", value: EVMValue };

type SymbolicRegion = {
    offset: number,
    size: number,
    value: EVMValue,
};

/**
 * Byte addressable EVM memory.
 *
 * Known values are stored as individual bytes, so overlapping and partial
 * accesses behave like they do on chain (`MSTORE` then `MSTORE8` then a wide
 * `MLOAD`, `CALLDATACOPY` followed by a 4 byte `RETURN`, ...).
 *
 * Values that cannot be decomposed (a storage slot, a calldata word, ...) are
 * kept as symbolic regions covering a byte range. Reads that fall inside a
 * single region return it (or a slice of it); reads that mix known bytes with
 * symbolic ones report "unknown" instead of guessing.
 *
 * Writes through an unknown offset cannot be placed in the byte array, so they
 * are kept aside keyed by the offset description and only read back when the
 * same symbolic offset is used again.
 */
export class EVMMemory {
    private bytes = new Map<number, number>();
    private regions = new Map<string, SymbolicRegion>();
    private symbolicOffsets = new Map<string, EVMValue>();
    private signatureCache: string | undefined;

    clone(): EVMMemory {
        const copy = new EVMMemory();

        copy.bytes = new Map(this.bytes);
        copy.regions = new Map(this.regions);
        copy.symbolicOffsets = new Map(this.symbolicOffsets);
        copy.signatureCache = this.signatureCache;

        return copy;
    }

    /** Canonical description of the current contents, used as a cache key. */
    get signature(): string {
        if (this.signatureCache === undefined) {
            const parts: string[] = [];

            for (const [offset, byte] of [...this.bytes].sort((a, b) => a[0] - b[0])) {
                parts.push(`${offset}:${byte}`);
            }

            for (const region of [...this.regions.values()].sort((a, b) => a.offset - b.offset)) {
                parts.push(`${region.offset}+${region.size}=${region.value}`);
            }

            for (const [key, value] of this.symbolicOffsets) {
                parts.push(`${key}=${value}`);
            }

            this.signatureCache = parts.join(",");
        }

        return this.signatureCache;
    }

    private invalidate(): void {
        this.signatureCache = undefined;
    }

    /** True when nothing was written yet. */
    get isEmpty(): boolean {
        return this.bytes.size === 0 && this.regions.size === 0 && this.symbolicOffsets.size === 0;
    }

    storeWord(offset: EVMValue, value: EVMValue): void {
        this.store(offset, WORD_BYTES, value);
    }

    storeByte(offset: EVMValue, value: EVMValue): void {
        this.store(offset, 1, value);
    }

    /** Writes `size` bytes from a value (known values are written byte by byte). */
    store(offset: EVMValue, size: number, value: EVMValue): void {
        if (size <= 0) {
            return;
        }

        const offsetNumber = this.knownOffset(offset);

        if (offsetNumber === undefined) {
            this.invalidate();
            this.symbolicOffsets.set(offset.toString(), value);
            return;
        }

        this.storeAt(offsetNumber, size, value);
    }

    /** Writes `size` bytes of already decoded hex data (copies, MCOPY, ...). */
    storeHex(offset: EVMValue, size: number, hex: string): void {
        if (size <= 0) {
            return;
        }

        const offsetNumber = this.knownOffset(offset);

        if (offsetNumber === undefined) {
            this.invalidate();
            this.symbolicOffsets.set(offset.toString(), new EVMValue(`[memory: ${size} bytes]`, EVMValueTypes.CUSTOM));
            return;
        }

        this.clear(offsetNumber, offsetNumber + size);

        const data = hex.padEnd(size * 2, "0").slice(0, size * 2);

        for (let index = 0; index < size; index++) {
            this.bytes.set(offsetNumber + index, Number.parseInt(data.slice(index * 2, index * 2 + 2), 16));
        }
    }

    read(offset: EVMValue, size: number): MemoryRead | undefined {
        if (size < 0) {
            return undefined;
        }

        if (size === 0) {
            return { kind: "known", hex: "" };
        }

        const offsetNumber = this.knownOffset(offset);

        if (offsetNumber === undefined) {
            const entry = this.symbolicOffsets.get(offset.toString());

            return entry === undefined ? undefined : { kind: "symbolic", value: entry };
        }

        return this.readAt(offsetNumber, size);
    }

    /** Reads a full word, `undefined` when the result is only partially known. */
    readWord(offset: EVMValue): EVMValue | undefined {
        const read = this.read(offset, WORD_BYTES);

        if (read === undefined) {
            return undefined;
        }

        if (read.kind === "symbolic") {
            return read.value;
        }

        return new EVMValue(BigInt(`0x${read.hex}`), EVMValueTypes.NUMBER);
    }

    private knownOffset(offset: EVMValue): number | undefined {
        const value = offset.knownNumber;

        return value === undefined ? undefined : toSafeNumber(value);
    }

    private storeAt(offset: number, size: number, value: EVMValue): void {
        this.clear(offset, offset + size);

        const known = value.knownNumber;

        if (known !== undefined && size <= WORD_BYTES) {
            const hex = toHex(known, size);

            for (let index = 0; index < size; index++) {
                this.bytes.set(offset + index, Number.parseInt(hex.slice(2 + index * 2, 4 + index * 2), 16));
            }

            return;
        }

        this.regions.set(`${offset}:${size}`, { offset, size, value });
    }

    private readAt(offset: number, size: number): MemoryRead | undefined {
        const end = offset + size;
        const overlapping: SymbolicRegion[] = [];

        for (const region of this.regions.values()) {
            if (region.offset < end && region.offset + region.size > offset) {
                overlapping.push(region);
            }
        }

        if (overlapping.length === 1) {
            const region = overlapping[0]!;

            if (region.offset <= offset && region.offset + region.size >= end) {
                if (region.offset === offset && region.size === size) {
                    return { kind: "symbolic", value: region.value.clone() };
                }

                const from = offset - region.offset;
                const to = end - region.offset;

                return { kind: "symbolic", value: new EVMValue(`[${region.value}[${from}:${to}]]`, EVMValueTypes.CUSTOM) };
            }
        }

        if (overlapping.length > 0) {
            // Partly symbolic and partly known: do not invent bytes.
            return undefined;
        }

        return { kind: "known", hex: this.knownHex(offset, size) };
    }

    private knownHex(offset: number, size: number): string {
        let hex = "";

        for (let index = 0; index < size; index++) {
            hex += (this.bytes.get(offset + index) ?? 0).toString(16).padStart(2, "0");
        }

        return hex;
    }

    /** Removes everything previously written in `[start, end)`. */
    private clear(start: number, end: number): void {
        this.invalidate();

        for (let index = start; index < end; index++) {
            this.bytes.delete(index);
        }

        for (const [key, region] of [...this.regions]) {
            const regionEnd = region.offset + region.size;

            if (regionEnd <= start || region.offset >= end) {
                continue;
            }

            this.regions.delete(key);

            if (region.offset < start) {
                this.addRegionSlice(region, region.offset, start);
            }

            if (regionEnd > end) {
                this.addRegionSlice(region, end, regionEnd);
            }
        }
    }

    private addRegionSlice(region: SymbolicRegion, from: number, to: number): void {
        const fromDelta = from - region.offset;
        const toDelta = to - region.offset;
        const value = fromDelta === 0 && toDelta === region.size
            ? region.value
            : new EVMValue(`[${region.value}[${fromDelta}:${toDelta}]]`, EVMValueTypes.CUSTOM);

        this.regions.set(`${from}:${to - from}`, { offset: from, size: to - from, value });
    }
}
