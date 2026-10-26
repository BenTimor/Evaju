export function exists<T>(obj: T | undefined | null): asserts obj is T {
    if (obj === undefined || obj === null) {
        throw new Error("Expected a value, received undefined (stack underflow or truncated listing)");
    }
}

export function assertNumber(obj: unknown): asserts obj is number {
    if (typeof (obj) !== "number") {
        throw new Error(`Expected a number, received ${typeof obj}`);
    }
}

export function assertBigInt(obj: unknown): asserts obj is bigint {
    if (typeof (obj) !== "bigint") {
        throw new Error(`Expected a BigInt, received ${typeof obj}`);
    }
}

export function assertString(obj: unknown): asserts obj is string {
    if (typeof (obj) !== "string") {
        throw new Error(`Expected a string, received ${typeof obj}`);
    }
}

export function everyExists<T>(obj: (T | undefined | null)[]): asserts obj is T[] {
    obj.forEach(exists);
}
