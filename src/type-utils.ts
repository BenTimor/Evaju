export function exists<T>(obj: T | undefined): asserts obj is T {
    if (obj === undefined || obj === null) {
        throw new Error("Obj is undefined");
    }
}

export function assertNumber(obj: any): asserts obj is number {
    if (typeof(obj) !== "number") {
        throw new Error("Obj is not a number");
    }
}

export function assertBigInt(obj: any): asserts obj is bigint {
    if (typeof(obj) !== "bigint") {
        throw new Error("Obj is not a BigInt");
    }
}

export function everyExists<T>(obj: (T | undefined)[]): asserts obj is T[] {
    obj.forEach(exists);
}