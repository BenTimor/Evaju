import { AbstractInstruction, CustomInstruction, IfStatementInstruction } from "../code-builder";
import { EVMOperatorValue, EVMValue } from "../evm-value";
import { exists } from "../type-utils";
import { getInstructionFromLine, lineBytes, toSafeNumber, type LinesByOffset } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

/** Resolves a jump destination to a JUMPDEST offset, or `undefined` when invalid. */
function resolveJumpTarget(destination: EVMValue, linesByOffset: LinesByOffset): number | undefined {
    const knownDestination = destination.knownNumber;

    if (knownDestination === undefined) {
        return undefined;
    }

    const offset = toSafeNumber(knownDestination);
    const lineInfo = offset === undefined ? undefined : linesByOffset[offset];

    if (lineInfo === undefined || getInstructionFromLine(lineInfo.line) !== "JUMPDEST") {
        return undefined;
    }

    return offset;
}

/** True when the destination is a known continuation of one of the call sites. */
function isReturnTarget(destination: EVMValue, returnTargets: Set<number> | undefined): boolean {
    if (returnTargets === undefined) {
        return false;
    }

    const knownDestination = destination.knownNumber;

    if (knownDestination === undefined) {
        return false;
    }

    const offset = toSafeNumber(knownDestination);

    return offset !== undefined && returnTargets.has(offset);
}

export class JUMPParser implements IOpcodeParser {
    constructor(private jumpi: boolean) { }

    parse({
        opcode,
        stack,
        linesByOffset,
        parentCallback,
        memory,
        codeBuilder,
        currentOffset,
        line,
        storage,
        onJumpTarget,
        onJumpParsed,
        onReturn,
        returnTargets,
    }: OpcodeParserParentContext): boolean {
        const destination = stack.pop();
        exists(destination);

        // Jumping to a call site's continuation ends an extracted function body.
        if (!this.jumpi && isReturnTarget(destination, returnTargets)) {
            codeBuilder.push(new CustomInstruction("// return"));
            onReturn?.([...stack]);
            return true;
        }

        /** Parses the body the jump leads to, or explains why it cannot be followed. */
        const jumpBody = (): AbstractInstruction[] => {
            const target = resolveJumpTarget(destination, linesByOffset);

            if (target !== undefined) {
                return parentCallback(opcode, target, [...stack], memory.clone(), { ...storage });
            }

            return [new CustomInstruction(destination.knownNumber === undefined
                ? `// JUMP to ${destination}`
                : `// Revert by JUMP to invalid destination ${destination}`)];
        };

        if (!this.jumpi) {
            const target = resolveJumpTarget(destination, linesByOffset);
            const replacement = target === undefined
                ? undefined
                : onJumpTarget?.({
                    target,
                    site: currentOffset,
                    stack: [...stack],
                    memory,
                    storage,
                    jumpBytes: lineBytes(line),
                });

            if (replacement !== undefined) {
                codeBuilder.push(...replacement);
                return true;
            }

            const body = jumpBody();

            if (target !== undefined) {
                onJumpParsed?.(target, currentOffset);
            }

            codeBuilder.push(...body);
            return true;
        }

        const condition = stack.pop();
        exists(condition);

        const knownCondition = condition.knownNumber;

        if (knownCondition !== undefined) {
            if (knownCondition !== 0n) {
                codeBuilder.push(...jumpBody());
                return true;
            }

            // Statically false: only the fall-through path is reachable.
            return false;
        }

        const ifBody = jumpBody();
        const elseBody = parentCallback(opcode, currentOffset + lineBytes(line), [...stack], memory.clone(), { ...storage });

        if (ifBody[0] instanceof IfStatementInstruction) {
            codeBuilder.push(mergeNestedIf(ifBody[0], condition, elseBody));
            return true;
        }

        codeBuilder.push(new IfStatementInstruction([condition], [ifBody, elseBody]));

        return true;
    }
}

/**
 * `if (a) { if (b) {...} else {...} } else {...}` is flattened into a single
 * `if (a && b) ... else if (a) ...` chain, which reads much closer to the
 * original source than nested ifs do.
 */
function mergeNestedIf(inner: IfStatementInstruction, outerCondition: EVMValue, outerElse: AbstractInstruction[]): IfStatementInstruction {
    const conditions = inner.conditions.map(condition => new EVMOperatorValue("&&", outerCondition, condition));
    const reachableConditions: EVMValue[] = [];
    const reachableBodies: AbstractInstruction[][] = [];
    const bodies = inner.bodies;

    // Branches whose condition folded to zero can never be taken.
    for (let index = 0; index < bodies.length; index++) {
        const body = bodies[index];
        const condition = conditions[index];

        if (!body) {
            continue;
        }

        if (condition?.isZero) {
            continue;
        }

        if (condition) {
            reachableConditions.push(condition);
        }

        reachableBodies.push(body);
    }

    const innerElse = stringifiedElse(inner);

    if (innerElse === stringifiedElse({ bodies: [outerElse] })) {
        // Both branches end the same way, so the outer `else` adds nothing.
        return new IfStatementInstruction(reachableConditions, reachableBodies);
    }

    reachableConditions.push(outerCondition);
    reachableBodies.push(outerElse);

    return new IfStatementInstruction(reachableConditions, reachableBodies);
}

function stringifiedElse(instruction: { bodies: AbstractInstruction[][] }): string {
    return (instruction.bodies.at(-1) ?? []).map(entry => entry.toString()).join("\n");
}
