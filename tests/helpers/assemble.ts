import { getInstructionFromLine, lineBytes } from "../../src/utils";

/**
 * Tiny two-pass assembler for tests.
 *
 * Labels are written as `name:` on their own line and referenced as `@name`.
 * Jump targets are rendered as 4 hex digits so `PUSH2 @label` always fits.
 */
export function assemble(program: string): string {
    const lines = program
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith("#"));

    const labels = new Map<string, number>();
    let offset = 0;

    for (const line of lines) {
        if (line.endsWith(":")) {
            labels.set(line.slice(0, -1), offset);
            continue;
        }

        offset += lineBytes(line);
    }

    return lines
        .filter(line => !line.endsWith(":"))
        .map(line => line.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_, name: string) => {
            const value = labels.get(name);

            if (value === undefined) {
                throw new Error(`Unknown label "${name}" in test program`);
            }

            return `0x${value.toString(16).padStart(4, "0")}`;
        }))
        .join("\n");
}

/** A `0x` prefixed word of `size` bytes whose last bytes are `tail`. */
export function zeroWord(tail: string, size = 32): string {
    const padded = tail.padStart(size * 2, "0");

    return `0x${padded.slice(-size * 2)}`;
}

export { getInstructionFromLine };
