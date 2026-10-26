import { AbstractInstruction, CustomInstruction, IfStatementInstruction, stringifyBody } from "../code-builder";
import { EVMOperatorValue, EVMValue } from "../evm-value";
import { exists } from "../type-utils";
import { getInstructionFromLine, lineBytes } from "../utils";
import type { IOpcodeParser, OpcodeParserParentContext } from "./base";

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
    }: OpcodeParserParentContext): boolean {
        const destination = stack.pop();
        exists(destination);

        /** Parses the branch this jump leads to, or explains why it cannot be followed. */
        const jumpBody = (): AbstractInstruction[] => {
            const knownDestination = destination.knownNumber;

            if (knownDestination === undefined) {
                return [new CustomInstruction(`// JUMP to ${destination}`)];
            }

            const target = linesByOffset[Number(knownDestination)];

            if (!target || getInstructionFromLine(target.line) !== "JUMPDEST") {
                return [new CustomInstruction(`// Revert by JUMP to invalid destination ${destination}`)];
            }

            return parentCallback(opcode, Number(knownDestination), [...stack], { ...memory }, { ...storage });
        };

        if (!this.jumpi) {
            // Unconditional jump: follow it and stop the current fall-through path.
            codeBuilder.push(...jumpBody());
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
        const elseBody = parentCallback(opcode, currentOffset + lineBytes(line), [...stack], { ...memory }, { ...storage });

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

    const innerElse = stringifyBody(inner.bodies.at(-1) ?? []);

    if (innerElse === stringifyBody(outerElse)) {
        // Both branches end the same way, so the outer `else` adds nothing.
        return new IfStatementInstruction(reachableConditions, reachableBodies);
    }

    reachableConditions.push(outerCondition);
    reachableBodies.push(outerElse);

    return new IfStatementInstruction(reachableConditions, reachableBodies);
}
