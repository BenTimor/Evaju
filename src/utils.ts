import { BASES_PREFIX } from "./constants";
import { exists } from "./type-utils";

export function getInstructionFromLine(line: string): string {
    const instruct = line.split(" ")[0];

    exists(instruct);

    return instruct;
}

export function unknownBaseStringToNumber(str: string) {
    return BigInt(str);
};

export function lineBytes(line: string) {
    const instruct = getInstructionFromLine(line);

    if (instruct.startsWith("PUSH")) {
        return +instruct.replace("PUSH", "") + 1;
    }

    return 1;
}

export type LinesByOffset = Record<number, {
    line: string,
    lineNumber: number,
}>;

export function calculateLinesByOffset(lines: string[]) {
    const linesByOffset: LinesByOffset = {};
    let currentOffset = 0;

    for (const lineNumber in lines) {
        const line = lines[lineNumber];
        exists(line);

        linesByOffset[currentOffset] = {
            line,
            lineNumber: +lineNumber,
        };
        currentOffset += lineBytes(line);
    }

    return linesByOffset;
}

export function shiftMultilineText(text: string) {
    return text.split("\n").map(line => `  ${line}`).join("\n");
}

export function sliceOffset(from: bigint, slice: number) {
    return from.toString(16).slice(slice * 2);
}